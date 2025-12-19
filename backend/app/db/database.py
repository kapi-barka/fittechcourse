"""
Конфигурация подключения к базе данных
Использует SQLAlchemy с асинхронным драйвером asyncpg для PostgreSQL
"""
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base
from app.core.config import settings

# Создаем асинхронный движок для подключения к БД
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,  # Логирование SQL запросов в режиме отладки
    future=True,
    pool_pre_ping=True,  # Проверка соединения перед использованием
)

# Фабрика сессий для работы с БД
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

# Базовый класс для всех моделей
Base = declarative_base()


async def get_db() -> AsyncSession:
    """
    Dependency для получения сессии БД в FastAPI endpoints
    
    Yields:
        AsyncSession: Асинхронная сессия для работы с БД
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db():
    """
    Инициализация базы данных - создание всех таблиц
    Используется только для разработки, в продакшене используем Alembic
    """
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

