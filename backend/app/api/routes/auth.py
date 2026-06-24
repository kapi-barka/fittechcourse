from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
import httpx

from app.db.database import get_db
from app.core.security import verify_password, get_password_hash, create_access_token, create_refresh_token
from app.core.config import settings
from app.models.user import User, UserProfile, UserRole
from app.schemas.user import UserCreate, UserLogin, Token, UserResponse, UserWithProfile, GoogleAuthRequest

router = APIRouter()

@router.post("/register", response_model=UserWithProfile, status_code=status.HTTP_201_CREATED)
async def register(
    user_data: UserCreate,
    db: AsyncSession = Depends(get_db)
):

    result = await db.execute(select(User).where(User.email == user_data.email))
    existing_user = result.scalar_one_or_none()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Пользователь с таким email уже зарегистрирован"
        )

    hashed_password = get_password_hash(user_data.password)
    new_user = User(
        email=user_data.email,
        password_hash=hashed_password,
        role=UserRole.USER
    )

    db.add(new_user)
    await db.flush()

    profile = UserProfile(
        user_id=new_user.id,
        full_name=user_data.full_name
    )
    db.add(profile)

    await db.commit()

    result = await db.execute(
        select(User)
        .options(selectinload(User.profile))
        .where(User.id == new_user.id)
    )
    user_with_profile = result.scalar_one()

    return user_with_profile

@router.post("/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
):

    result = await db.execute(select(User).where(User.email == form_data.username))
    user = result.scalar_one_or_none()

    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный email или пароль",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Пользователь заблокирован"
        )

    access_token = create_access_token(data={"sub": str(user.id), "role": user.role})
    refresh_token = create_refresh_token(data={"sub": str(user.id)})

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }

@router.post("/google", response_model=Token)
async def google_auth(
    data: GoogleAuthRequest,
    db: AsyncSession = Depends(get_db)
):

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://oauth2.googleapis.com/tokeninfo",
            params={"id_token": data.credential},
        )

    if resp.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Недействительный Google токен",
        )

    google_data = resp.json()

    if settings.GOOGLE_CLIENT_ID and google_data.get("aud") != settings.GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Токен выдан для другого приложения",
        )

    google_id = google_data.get("sub")
    email = google_data.get("email")
    full_name = google_data.get("name")
    avatar_url = google_data.get("picture")

    if not google_id or not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google не вернул email или идентификатор пользователя",
        )

    result = await db.execute(select(User).options(selectinload(User.profile)).where(User.google_id == google_id))
    user = result.scalar_one_or_none()

    if user is None:

        result = await db.execute(select(User).options(selectinload(User.profile)).where(User.email == email))
        user = result.scalar_one_or_none()

        if user is not None:

            user.google_id = google_id
            if user.profile and avatar_url and not user.profile.avatar_url:
                user.profile.avatar_url = avatar_url
        else:

            user = User(
                email=email,
                password_hash=None,
                google_id=google_id,
                role=UserRole.USER,
            )
            db.add(user)
            await db.flush()

            profile = UserProfile(
                user_id=user.id,
                full_name=full_name,
                avatar_url=avatar_url,
            )
            db.add(profile)

    await db.commit()
    await db.refresh(user)

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Пользователь заблокирован",
        )

    access_token = create_access_token(data={"sub": str(user.id), "role": user.role})
    refresh_token = create_refresh_token(data={"sub": str(user.id)})

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
    }

@router.post("/login/json", response_model=Token)
async def login_json(
    credentials: UserLogin,
    db: AsyncSession = Depends(get_db)
):

    result = await db.execute(select(User).where(User.email == credentials.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный email или пароль",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Пользователь заблокирован"
        )

    access_token = create_access_token(data={"sub": str(user.id), "role": user.role})
    refresh_token = create_refresh_token(data={"sub": str(user.id)})

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }
