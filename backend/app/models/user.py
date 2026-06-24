import uuid
from datetime import datetime, date
from sqlalchemy import Column, String, Boolean, DateTime, Enum, ForeignKey, Date, Float, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum
from app.db.database import Base

class UserRole(str, enum.Enum):
    GUEST = "guest"
    USER = "user"
    ADMIN = "admin"

class ActivityLevel(str, enum.Enum):
    SEDENTARY = "sedentary"
    LIGHTLY_ACTIVE = "lightly_active"
    MODERATELY_ACTIVE = "moderately_active"
    VERY_ACTIVE = "very_active"
    EXTREMELY_ACTIVE = "extremely_active"

class Gender(str, enum.Enum):
    MALE = "male"
    FEMALE = "female"
    OTHER = "other"

class FitnessGoal(str, enum.Enum):
    LOSE_FAT = "lose_fat"
    GAIN_MUSCLE = "gain_muscle"
    RECOMPOSITION = "recomposition"
    MAINTAIN = "maintain"

class ExperienceLevel(str, enum.Enum):
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=True)
    role = Column(Enum(UserRole), default=UserRole.GUEST, nullable=False)
    telegram_id = Column(String, unique=True, nullable=True, index=True)
    google_id = Column(String, unique=True, nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    profile = relationship("UserProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    programs = relationship("Program", back_populates="author", cascade="all, delete-orphan")
    body_metrics = relationship("BodyMetric", back_populates="user", cascade="all, delete-orphan")
    nutrition_logs = relationship("NutritionLog", back_populates="user", cascade="all, delete-orphan")
    articles = relationship("Article", back_populates="author", cascade="all, delete-orphan")
    workout_logs = relationship("WorkoutLog", back_populates="user", cascade="all, delete-orphan")
    user_programs = relationship("UserProgram", back_populates="user", cascade="all, delete-orphan")
    custom_products = relationship("FoodProduct", back_populates="user", cascade="all, delete-orphan")
    hydration_logs = relationship("HydrationLog", back_populates="user", cascade="all, delete-orphan")
    performance_logs = relationship("ExercisePerformanceLog", back_populates="user", cascade="all, delete-orphan")
    recommendations = relationship("WorkoutRecommendation", back_populates="user", cascade="all, delete-orphan")
    chat_messages = relationship("ChatMessage", back_populates="user", cascade="all, delete-orphan")

class UserProfile(Base):
    __tablename__ = "user_profiles"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    full_name = Column(String, nullable=True)
    gender = Column(Enum(Gender), nullable=True)
    birth_date = Column(Date, nullable=True)
    height = Column(Float, nullable=True)
    target_weight = Column(Float, nullable=True)
    target_calories = Column(Integer, nullable=True)
    target_proteins = Column(Float, nullable=True)
    target_fats = Column(Float, nullable=True)
    target_carbs = Column(Float, nullable=True)

    target_chest = Column(Float, nullable=True)
    target_waist = Column(Float, nullable=True)
    target_hips = Column(Float, nullable=True)
    target_biceps = Column(Float, nullable=True)
    target_thigh = Column(Float, nullable=True)
    activity_level = Column(Enum(ActivityLevel), default=ActivityLevel.SEDENTARY, nullable=True)
    fitness_goal = Column(Enum(FitnessGoal), nullable=True)
    experience_level = Column(Enum(ExperienceLevel), nullable=True)

    current_program_id = Column(UUID(as_uuid=True), ForeignKey("programs.id", ondelete="SET NULL"), nullable=True)
    current_program_start_date = Column(Date, nullable=True)
    avatar_url = Column(String, nullable=True)

    user = relationship("User", back_populates="profile")
    current_program = relationship("Program", foreign_keys=[current_program_id])
