"""
API роутер для аутентификации: регистрация и вход
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db.database import get_db
from app.core.security import verify_password, get_password_hash, create_access_token, create_refresh_token
from app.models.user import User, UserProfile, UserRole
from app.schemas.user import UserCreate, UserLogin, Token, UserResponse, UserWithProfile

router = APIRouter()


@router.post("/register", response_model=UserWithProfile, status_code=status.HTTP_201_CREATED)
async def register(
    user_data: UserCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Регистрация нового пользователя
    
    - **email**: Email пользователя (уникальный)
    - **password**: Пароль (минимум 6 символов)
    - **full_name**: Полное имя (опционально)
    """
    # Проверяем существует ли пользователь с таким email
    result = await db.execute(select(User).where(User.email == user_data.email))
    existing_user = result.scalar_one_or_none()
    
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Пользователь с таким email уже зарегистрирован"
        )
    
    # Создаем нового пользователя
    hashed_password = get_password_hash(user_data.password)
    new_user = User(
        email=user_data.email,
        password_hash=hashed_password,
        role=UserRole.USER  # По умолчанию роль USER
    )
    
    db.add(new_user)
    await db.flush()  # Получаем ID пользователя
    
    # Создаем профиль пользователя
    profile = UserProfile(
        user_id=new_user.id,
        full_name=user_data.full_name
    )
    db.add(profile)
    
    await db.commit()
    
    # Загружаем пользователя с профилем для правильной сериализации
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
    """
    Вход в систему - получение JWT токенов
    
    - **username**: Email пользователя
    - **password**: Пароль
    """
    # Ищем пользователя по email
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
    
    # Создаем токены
    access_token = create_access_token(data={"sub": str(user.id), "role": user.role})
    refresh_token = create_refresh_token(data={"sub": str(user.id)})
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }


@router.post("/login/json", response_model=Token)
async def login_json(
    credentials: UserLogin,
    db: AsyncSession = Depends(get_db)
):
    """
    Альтернативный endpoint для входа с JSON телом запроса
    """
    # Ищем пользователя по email
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
    
    # Создаем токены
    access_token = create_access_token(data={"sub": str(user.id), "role": user.role})
    refresh_token = create_refresh_token(data={"sub": str(user.id)})
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }

