"""
Pydantic схемы для пользователей и аутентификации
"""
from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional
from datetime import datetime, date
from uuid import UUID
from app.models.user import UserRole, ActivityLevel, Gender


# ============ Аутентификация ============

class UserLogin(BaseModel):
    """Схема для входа пользователя"""
    email: EmailStr
    password: str


class UserCreate(BaseModel):
    """Схема для регистрации пользователя"""
    email: EmailStr
    password: str = Field(..., min_length=6, description="Минимум 6 символов")
    full_name: Optional[str] = None


class Token(BaseModel):
    """Схема JWT токенов"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    """Данные из JWT токена"""
    user_id: Optional[UUID] = None
    role: Optional[UserRole] = None


# ============ Пользователь ============

class UserResponse(BaseModel):
    """Схема ответа с данными пользователя"""
    id: UUID
    email: str
    role: UserRole
    telegram_id: Optional[str] = None
    created_at: datetime
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


# ============ Профиль пользователя ============

class UserProfileCreate(BaseModel):
    """Схема создания профиля"""
    full_name: Optional[str] = None
    gender: Optional[Gender] = None
    birth_date: Optional[date] = None
    height: Optional[float] = Field(None, gt=0, lt=300, description="Рост в см")
    target_weight: Optional[float] = Field(None, gt=0, lt=500, description="Целевой вес в кг")
    target_calories: Optional[int] = Field(None, gt=0, lt=10000, description="Целевые калории в день")
    target_proteins: Optional[float] = Field(None, gt=0, lt=1000, description="Целевые белки в день (г)")
    target_fats: Optional[float] = Field(None, gt=0, lt=1000, description="Целевые жиры в день (г)")
    target_carbs: Optional[float] = Field(None, gt=0, lt=1000, description="Целевые углеводы в день (г)")
    activity_level: Optional[ActivityLevel] = ActivityLevel.SEDENTARY


class UserProfileUpdate(BaseModel):
    """Схема обновления профиля"""
    full_name: Optional[str] = None
    gender: Optional[Gender] = None
    birth_date: Optional[date] = None
    height: Optional[float] = Field(None, gt=0, lt=300)
    target_weight: Optional[float] = Field(None, gt=0, lt=500)
    target_calories: Optional[int] = Field(None, gt=0, lt=10000)
    target_proteins: Optional[float] = Field(None, gt=0, lt=1000)
    target_fats: Optional[float] = Field(None, gt=0, lt=1000)
    target_carbs: Optional[float] = Field(None, gt=0, lt=1000)
    activity_level: Optional[ActivityLevel] = None
    avatar_url: Optional[str] = None


class UserProfileResponse(BaseModel):
    """Схема ответа с профилем пользователя"""
    user_id: UUID
    full_name: Optional[str] = None
    gender: Optional[Gender] = None
    birth_date: Optional[date] = None
    height: Optional[float] = None
    target_weight: Optional[float] = None
    target_calories: Optional[int] = None
    target_proteins: Optional[float] = None
    target_fats: Optional[float] = None
    target_carbs: Optional[float] = None
    activity_level: Optional[ActivityLevel] = None
    current_program_id: Optional[UUID] = None
    current_program_start_date: Optional[date] = None
    avatar_url: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class UserWithProfile(UserResponse):
    """Пользователь с профилем"""
    profile: Optional[UserProfileResponse] = None

    model_config = ConfigDict(from_attributes=True)

