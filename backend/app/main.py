"""
Главный файл FastAPI приложения My Fitness Trainer
"""
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from app.core.config import settings
from app.api import api_router
from app.db.database import init_db

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

# Создаем экземпляр приложения
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    description="API для фитнес-приложения с трекингом тренировок, питания и прогресса",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

# Настройка CORS для работы с фронтендом
# Убеждаемся, что CORS_ORIGINS - это список
cors_origins = settings.CORS_ORIGINS
if not isinstance(cors_origins, list):
    cors_origins = [cors_origins] if cors_origins else []

logger = logging.getLogger(__name__)
logger.info(f"Configuring CORS with origins: {cors_origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    """
    Инициализация при запуске приложения
    """
    logger = logging.getLogger(__name__)
    logger.info(f"🚀 Starting {settings.APP_NAME} v{settings.VERSION}")
    logger.info(f"Environment: {settings.ENVIRONMENT}")
    logger.info(f"CORS Origins: {settings.CORS_ORIGINS}")
    
    # Проверка подключения к БД
    try:
        from app.db.database import engine
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        logger.info("✅ Database connection successful")
    except Exception as e:
        logger.error(f"❌ Database connection failed: {e}")
        # Не падаем при старте, но логируем ошибку
    
    # В продакшене используем Alembic вместо init_db()
    # await init_db()


@app.get("/")
async def root():
    """
    Корневой endpoint - информация о приложении
    """
    return {
        "app": settings.APP_NAME,
        "version": settings.VERSION,
        "status": "running",
        "docs": "/api/docs"
    }


@app.get("/health")
async def health_check():
    """
    Проверка здоровья приложения
    """
    return {"status": "healthy"}


# Подключаем API роутеры
app.include_router(api_router, prefix="/api")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG
    )

