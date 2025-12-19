"""
Модели пользователя: User (учетные данные) и UserProfile (личная информация)
"""
import uuid
from datetime import datetime, date
from sqlalchemy import Column, String, Boolean, DateTime, Enum, ForeignKey, Date, Float, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum
from app.db.database import Base
# Avoid circular import by using string references in relationship



class UserRole(str, enum.Enum):
    """Роли пользователей в системе"""
    GUEST = "guest"
    USER = "user"
    ADMIN = "admin"


class ActivityLevel(str, enum.Enum):
    """Уровни физической активности"""
    SEDENTARY = "sedentary"  # Сидячий образ жизни
    LIGHTLY_ACTIVE = "lightly_active"  # Легкая активность
    MODERATELY_ACTIVE = "moderately_active"  # Умеренная активность
    VERY_ACTIVE = "very_active"  # Высокая активность
    EXTREMELY_ACTIVE = "extremely_active"  # Очень высокая активность


class Gender(str, enum.Enum):
    """Пол пользователя"""
    MALE = "male"
    FEMALE = "female"
    OTHER = "other"


class User(Base):
    """
    Модель пользователя - основная таблица для аутентификации
    """
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(Enum(UserRole), default=UserRole.GUEST, nullable=False)
    telegram_id = Column(String, unique=True, nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    # Relationships
    profile = relationship("UserProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    programs = relationship("Program", back_populates="author", cascade="all, delete-orphan")
    body_metrics = relationship("BodyMetric", back_populates="user", cascade="all, delete-orphan")
    nutrition_logs = relationship("NutritionLog", back_populates="user", cascade="all, delete-orphan")
    articles = relationship("Article", back_populates="author", cascade="all, delete-orphan")
    workout_logs = relationship("WorkoutLog", back_populates="user", cascade="all, delete-orphan")
    user_programs = relationship("UserProgram", back_populates="user", cascade="all, delete-orphan")
    custom_products = relationship("FoodProduct", back_populates="user", cascade="all, delete-orphan")
    hydration_logs = relationship("HydrationLog", back_populates="user", cascade="all, delete-orphan")


class UserProfile(Base):
    """
    Профиль пользователя с личными данными и целями
    """
    __tablename__ = "user_profiles"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    full_name = Column(String, nullable=True)
    gender = Column(Enum(Gender), nullable=True)
    birth_date = Column(Date, nullable=True)
    height = Column(Float, nullable=True)  # Рост в см
    target_weight = Column(Float, nullable=True)  # Целевой вес в кг
    target_calories = Column(Integer, nullable=True)  # Целевые калории в день
    target_proteins = Column(Float, nullable=True)  # Целевые белки в день (г)
    target_fats = Column(Float, nullable=True)  # Целевые жиры в день (г)
    target_carbs = Column(Float, nullable=True)  # Целевые углеводы в день (г)
    activity_level = Column(Enum(ActivityLevel), default=ActivityLevel.SEDENTARY, nullable=True)
    
    # Active Program
    current_program_id = Column(UUID(as_uuid=True), ForeignKey("programs.id", ondelete="SET NULL"), nullable=True)
    current_program_start_date = Column(Date, nullable=True)
    avatar_url = Column(String, nullable=True)

    # Relationship
    user = relationship("User", back_populates="profile")
    current_program = relationship("Program", foreign_keys=[current_program_id])

