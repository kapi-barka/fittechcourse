"""
Зависимости FastAPI для проверки аутентификации и авторизации
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from uuid import UUID

from app.db.database import get_db
from app.core.security import decode_token
from app.models.user import User, UserRole
from app.schemas.user import TokenData

# OAuth2 схема для извлечения токена из заголовка Authorization
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    """
    Получает текущего пользователя из JWT токена
    
    Args:
        token: JWT токен из заголовка Authorization
        db: Сессия базы данных
        
    Returns:
        User: Объект пользователя
        
    Raises:
        HTTPException: Если токен невалидный или пользователь не найден
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Невозможно проверить учетные данные",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    # Декодируем токен
    payload = decode_token(token)
    if payload is None:
        raise credentials_exception
    
    user_id: Optional[str] = payload.get("sub")
    if user_id is None:
        raise credentials_exception
    
    try:
        user_uuid = UUID(user_id)
    except ValueError:
        raise credentials_exception
    
    # Получаем пользователя из БД
    result = await db.execute(select(User).where(User.id == user_uuid))
    user = result.scalar_one_or_none()
    
    if user is None:
        raise credentials_exception
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Пользователь заблокирован"
        )
    
    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Проверяет что пользователь активен
    """
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Пользователь неактивен"
        )
    return current_user


def require_role(required_role: UserRole):
    """
    Создает зависимость для проверки роли пользователя
    
    Args:
        required_role: Минимальная требуемая роль
        
    Returns:
        Функция-зависимость для FastAPI
    """
    async def role_checker(current_user: User = Depends(get_current_active_user)) -> User:
        # Иерархия ролей: guest < user < admin
        role_hierarchy = {
            UserRole.GUEST: 0,
            UserRole.USER: 1,
            UserRole.ADMIN: 2,
        }
        
        if role_hierarchy[current_user.role] < role_hierarchy[required_role]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Недостаточно прав для выполнения этой операции"
            )
        
        return current_user
    
    return role_checker


# Готовые зависимости для разных ролей
require_user = require_role(UserRole.USER)
require_admin = require_role(UserRole.ADMIN)

