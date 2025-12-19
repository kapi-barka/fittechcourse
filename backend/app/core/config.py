"""
Конфигурация приложения
Загружает переменные окружения и предоставляет настройки для всего приложения
Поддерживает разные окружения: development и production
"""
import os
import json
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional, Union
from pydantic import field_validator


def get_env_files() -> list[str]:
    """
    Определяет, какие .env файлы использовать в зависимости от окружения.
    Проверяет переменную ENVIRONMENT или ENV.
    По умолчанию использует .env.development для разработки.
    Возвращает список файлов для загрузки (первый найденный будет использован).
    """
    env = os.getenv("ENVIRONMENT", os.getenv("ENV", "development")).lower()
    
    if env == "production":
        return [".env.production", ".env"]  # .env как fallback
    elif env == "development":
        return [".env.development", ".env"]  # .env как fallback
    else:
        # Если указано другое окружение, используем .env.{env}
        return [f".env.{env}", ".env"]


class Settings(BaseSettings):
    """Класс настроек приложения"""
    
    # Environment
    ENVIRONMENT: str = "development"  # development или production
    
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:password@localhost:5432/fitness_trainer"
    
    @field_validator('DATABASE_URL', mode='before')
    @classmethod
    def validate_database_url(cls, v):
        """Валидация и нормализация DATABASE_URL"""
        if isinstance(v, str):
            # Убеждаемся, что используется asyncpg
            if v.startswith('postgresql://') and '+asyncpg' not in v:
                v = v.replace('postgresql://', 'postgresql+asyncpg://', 1)
            
            # Для Neon: если используется pooler, можно попробовать прямое подключение
            # Но оставляем как есть, так как pooler тоже должен работать
            
            # Если URL от Neon, убеждаемся что есть ssl=require
            if 'neon.tech' in v and 'ssl=' not in v:
                separator = '&' if '?' in v else '?'
                v = f"{v}{separator}ssl=require"
            
            # URL-кодируем пароль, если он содержит специальные символы
            # Это делается автоматически при парсинге URL, но на всякий случай
            from urllib.parse import quote_plus, urlparse, urlunparse
            try:
                parsed = urlparse(v)
                if parsed.password:
                    # Если пароль уже закодирован, не кодируем повторно
                    # Просто убеждаемся что формат правильный
                    pass
            except:
                pass
        return v
    
    # Security
    SECRET_KEY: str = "your-secret-key-please-change-in-production-use-openssl-rand-hex-32"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # Application
    APP_NAME: str = "My Fitness Trainer"
    VERSION: str = "1.0.0"
    DEBUG: bool = True
    
    # CORS
    CORS_ORIGINS: Union[str, list] = ["http://localhost:3000", "http://127.0.0.1:3000"]
    
    @field_validator('CORS_ORIGINS', mode='before')
    @classmethod
    def parse_cors_origins(cls, v):
        """Парсит CORS_ORIGINS из строки JSON или оставляет как список"""
        if isinstance(v, str):
            try:
                # Пытаемся распарсить как JSON
                parsed = json.loads(v)
                if isinstance(parsed, list):
                    return parsed
                # Если это строка с одним URL
                return [parsed] if parsed else []
            except (json.JSONDecodeError, TypeError):
                # Если не JSON, возвращаем как список с одним элементом
                return [v] if v else []
        return v if isinstance(v, list) else []
    
    # Cloudinary
    CLOUDINARY_CLOUD_NAME: str = "dbx0kd3lt"
    CLOUDINARY_API_KEY: str = "679396674386546"
    CLOUDINARY_API_SECRET: str = "YD8h8rhsnzZDCrlYHD1HgLzSQ5U"
    
    # AI Recognition Services
    OPENAI_API_KEY: Optional[str] = None
    GOOGLE_VISION_API_KEY: Optional[str] = None
    GOOGLE_GEMINI_API_KEY: Optional[str] = None  # Для Gemini API (генеративная модель с поддержкой промптов)
    SPOONACULAR_API_KEY: Optional[str] = None
    HUGGINGFACE_API_KEY: Optional[str] = None  # Опционально, для бесплатного tier не обязателен
    PRODUCT_RECOGNITION_PROVIDER: str = "openai"  # openai, google, gemini (gemini-pro/flash), spoonacular, huggingface (нестабильно)

    model_config = SettingsConfigDict(
        env_file=get_env_files(),
        case_sensitive=True,
        env_file_encoding='utf-8',
        # Переменные окружения имеют приоритет над файлами
        env_ignore_empty=True,
    )


# Создаем глобальный экземпляр настроек
settings = Settings()

# Обновляем DEBUG в зависимости от окружения
if settings.ENVIRONMENT == "production":
    settings.DEBUG = False

# Убеждаемся, что CORS_ORIGINS всегда список
if not isinstance(settings.CORS_ORIGINS, list):
    if isinstance(settings.CORS_ORIGINS, str):
        try:
            settings.CORS_ORIGINS = json.loads(settings.CORS_ORIGINS)
        except (json.JSONDecodeError, TypeError):
            settings.CORS_ORIGINS = [settings.CORS_ORIGINS] if settings.CORS_ORIGINS else []
    else:
        settings.CORS_ORIGINS = []

# Логируем настройки для отладки (без пароля!)
import logging
logger = logging.getLogger(__name__)
logger.info(f"CORS_ORIGINS configured: {settings.CORS_ORIGINS}")

# Логируем DATABASE_URL без пароля для безопасности
def mask_password_in_url(url: str) -> str:
    """Маскирует пароль в DATABASE_URL для логирования"""
    try:
        if '@' in url:
            parts = url.split('@')
            if '://' in parts[0]:
                protocol_user_pass = parts[0]
                if ':' in protocol_user_pass.split('://')[1]:
                    protocol = protocol_user_pass.split('://')[0]
                    user_pass = protocol_user_pass.split('://')[1]
                    user = user_pass.split(':')[0]
                    return f"{protocol}://{user}:***@{parts[1]}"
    except:
        pass
    return "***"

logger.info(f"DATABASE_URL configured: {mask_password_in_url(settings.DATABASE_URL)}")

