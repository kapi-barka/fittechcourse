from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional
from datetime import datetime, date
from uuid import UUID
from app.models.user import UserRole, ActivityLevel, Gender, FitnessGoal, ExperienceLevel

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class GoogleAuthRequest(BaseModel):
    credential: str

class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6, description="Минимум 6 символов")
    full_name: Optional[str] = None

class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class TokenData(BaseModel):
    user_id: Optional[UUID] = None
    role: Optional[UserRole] = None

class UserResponse(BaseModel):
    id: UUID
    email: str
    role: UserRole
    telegram_id: Optional[str] = None
    created_at: datetime
    is_active: bool

    model_config = ConfigDict(from_attributes=True)

class UserProfileCreate(BaseModel):
    full_name: Optional[str] = None
    gender: Optional[Gender] = None
    birth_date: Optional[date] = None
    height: Optional[float] = Field(None, gt=0, lt=300, description="Рост в см")
    target_weight: Optional[float] = Field(None, ge=20, le=300, description="Целевой вес в кг (от 20 до 300)")
    target_calories: Optional[int] = Field(None, ge=800, le=8000, description="Целевые калории в день (от 800 до 8000)")
    target_proteins: Optional[float] = Field(None, ge=0, le=500, description="Целевые белки в день (г, от 0 до 500)")
    target_fats: Optional[float] = Field(None, ge=0, le=500, description="Целевые жиры в день (г, от 0 до 500)")
    target_carbs: Optional[float] = Field(None, ge=0, le=1000, description="Целевые углеводы в день (г, от 0 до 1000)")

    target_chest: Optional[float] = Field(None, ge=50, le=200, description="Целевой обхват груди в см (от 50 до 200)")
    target_waist: Optional[float] = Field(None, ge=40, le=200, description="Целевой обхват талии в см (от 40 до 200)")
    target_hips: Optional[float] = Field(None, ge=50, le=200, description="Целевой обхват бедер в см (от 50 до 200)")
    target_biceps: Optional[float] = Field(None, ge=15, le=80, description="Целевой обхват бицепса в см (от 15 до 80)")
    target_thigh: Optional[float] = Field(None, ge=30, le=150, description="Целевой обхват бедра в см (от 30 до 150)")
    activity_level: Optional[ActivityLevel] = ActivityLevel.SEDENTARY
    fitness_goal: Optional[FitnessGoal] = None
    experience_level: Optional[ExperienceLevel] = None

class UserProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    gender: Optional[Gender] = None
    birth_date: Optional[date] = None
    height: Optional[float] = Field(None, gt=0, lt=300)
    target_weight: Optional[float] = Field(None, ge=20, le=300)
    target_calories: Optional[int] = Field(None, ge=800, le=8000)
    target_proteins: Optional[float] = Field(None, ge=0, le=500)
    target_fats: Optional[float] = Field(None, ge=0, le=500)
    target_carbs: Optional[float] = Field(None, ge=0, le=1000)

    target_chest: Optional[float] = Field(None, ge=50, le=200)
    target_waist: Optional[float] = Field(None, ge=40, le=200)
    target_hips: Optional[float] = Field(None, ge=50, le=200)
    target_biceps: Optional[float] = Field(None, ge=15, le=80)
    target_thigh: Optional[float] = Field(None, ge=30, le=150)
    activity_level: Optional[ActivityLevel] = None
    fitness_goal: Optional[FitnessGoal] = None
    experience_level: Optional[ExperienceLevel] = None
    avatar_url: Optional[str] = None

class UserProfileResponse(BaseModel):
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

    target_chest: Optional[float] = None
    target_waist: Optional[float] = None
    target_hips: Optional[float] = None
    target_biceps: Optional[float] = None
    target_thigh: Optional[float] = None
    activity_level: Optional[ActivityLevel] = None
    fitness_goal: Optional[FitnessGoal] = None
    experience_level: Optional[ExperienceLevel] = None
    current_program_id: Optional[UUID] = None
    current_program_start_date: Optional[date] = None
    avatar_url: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class UserWithProfile(UserResponse):
    profile: Optional[UserProfileResponse] = None

    model_config = ConfigDict(from_attributes=True)
