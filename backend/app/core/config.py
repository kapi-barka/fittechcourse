"""
Конфигурация приложения
Загружает переменные окружения и предоставляет настройки для всего приложения
Поддерживает разные окружения: development и production
"""
import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional


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
    CORS_ORIGINS: list = ["http://localhost:3000", "http://127.0.0.1:3000"]
    
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

