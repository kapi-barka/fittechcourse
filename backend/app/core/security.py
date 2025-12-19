"""
Модуль безопасности: хэширование паролей и работа с JWT токенами
"""
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from jose import JWTError, jwt
from passlib.context import CryptContext
from app.core.config import settings

# Контекст для хэширования паролей с использованием bcrypt
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Проверяет соответствие пароля его хэшу
    
    Args:
        plain_password: Пароль в открытом виде
        hashed_password: Хэшированный пароль из БД
        
    Returns:
        True если пароль верный, иначе False
    """
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """
    Создает хэш пароля для безопасного хранения
    
    Args:
        password: Пароль в открытом виде
        
    Returns:
        Хэшированный пароль
    """
    return pwd_context.hash(password)


def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """
    Создает JWT Access токен
    
    Args:
        data: Данные для включения в токен (обычно user_id и role)
        expires_delta: Время жизни токена (по умолчанию из настроек)
        
    Returns:
        JWT токен в виде строки
    """
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire, "type": "access"})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def create_refresh_token(data: Dict[str, Any]) -> str:
    """
    Создает JWT Refresh токен с увеличенным временем жизни
    
    Args:
        data: Данные для включения в токен
        
    Returns:
        JWT refresh токен
    """
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def decode_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Декодирует и проверяет JWT токен
    
    Args:
        token: JWT токен для декодирования
        
    Returns:
        Данные из токена или None при ошибке
    """
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return None

