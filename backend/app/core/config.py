import os
import json
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional, Union
from pydantic import field_validator

def get_env_files() -> list[str]:
    env = os.getenv("ENVIRONMENT", os.getenv("ENV", "development")).lower()

    if env == "production":
        return [".env.production", ".env"]
    elif env == "development":
        return [".env.development", ".env"]
    else:

        return [f".env.{env}", ".env"]

class Settings(BaseSettings):

    ENVIRONMENT: str = "development"

    DATABASE_URL: str = "postgresql+asyncpg://postgres:password@localhost:5432/fitness_trainer"

    @field_validator('DATABASE_URL', mode='before')
    @classmethod
    def validate_database_url(cls, v):
        if isinstance(v, str):

            if v.startswith('postgresql://') and '+asyncpg' not in v:
                v = v.replace('postgresql://', 'postgresql+asyncpg://', 1)

            if 'neon.tech' in v and 'ssl=' not in v:
                separator = '&' if '?' in v else '?'
                v = f"{v}{separator}ssl=require"

            from urllib.parse import quote_plus, urlparse, urlunparse
            try:
                parsed = urlparse(v)
                if parsed.password:

                    pass
            except:
                pass
        return v

    SECRET_KEY: str = "your-secret-key-please-change-in-production-use-openssl-rand-hex-32"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    APP_NAME: str = "My Fitness Trainer"
    VERSION: str = "1.0.0"
    DEBUG: bool = True

    CORS_ORIGINS: Union[str, list] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    @field_validator('CORS_ORIGINS', mode='before')
    @classmethod
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            try:

                parsed = json.loads(v)
                if isinstance(parsed, list):
                    return parsed

                return [parsed] if parsed else []
            except (json.JSONDecodeError, TypeError):

                return [v] if v else []
        return v if isinstance(v, list) else []

    CLOUDINARY_CLOUD_NAME: str = "dbx0kd3lt"
    CLOUDINARY_API_KEY: str = "679396674386546"
    CLOUDINARY_API_SECRET: str = "YD8h8rhsnzZDCrlYHD1HgLzSQ5U"

    GOOGLE_CLIENT_ID: Optional[str] = None

    GOOGLE_VISION_API_KEY: Optional[str] = None
    GOOGLE_GEMINI_API_KEY: Optional[str] = None
    SPOONACULAR_API_KEY: Optional[str] = None
    HUGGINGFACE_API_KEY: Optional[str] = None
    PRODUCT_RECOGNITION_PROVIDER: str = "gemini"

    GOOGLE_CLOUD_PROJECT: Optional[str] = None
    GOOGLE_CLOUD_LOCATION: str = "us-central1"

    model_config = SettingsConfigDict(
        env_file=get_env_files(),
        case_sensitive=True,
        env_file_encoding='utf-8',

        env_ignore_empty=True,
    )

settings = Settings()

if settings.ENVIRONMENT == "production":
    settings.DEBUG = False

if not isinstance(settings.CORS_ORIGINS, list):
    if isinstance(settings.CORS_ORIGINS, str):
        try:
            settings.CORS_ORIGINS = json.loads(settings.CORS_ORIGINS)
        except (json.JSONDecodeError, TypeError):
            settings.CORS_ORIGINS = [settings.CORS_ORIGINS] if settings.CORS_ORIGINS else []
    else:
        settings.CORS_ORIGINS = []

import logging
logger = logging.getLogger(__name__)
logger.info(f"CORS_ORIGINS configured: {settings.CORS_ORIGINS}")

def mask_password_in_url(url: str) -> str:
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
