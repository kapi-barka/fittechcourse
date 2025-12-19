"""
Pydantic схемы для тренировочных программ
"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime
from uuid import UUID


class ProgramDetailCreate(BaseModel):
    """Схема создания деталей программы"""
    exercise_id: UUID
    day_number: int = Field(..., ge=1, description="Номер дня тренировки")
    sets: int = Field(..., ge=1, le=20, description="Количество подходов")
    reps: int = Field(..., ge=1, le=100, description="Количество повторений")
    rest_time: Optional[int] = Field(None, ge=0, le=600, description="Время отдыха в секундах")
    order: int = Field(0, ge=0, description="Порядок упражнения")
    notes: Optional[str] = None


class ProgramDetailResponse(BaseModel):
    """Схема ответа с деталями программы"""
    id: UUID
    exercise_id: UUID
    day_number: int
    sets: int
    reps: int
    rest_time: Optional[int] = None
    order: int
    notes: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ProgramCreate(BaseModel):
    """Схема создания программы"""
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    is_public: bool = False
    difficulty: Optional[str] = Field(None, pattern="^(beginner|intermediate|advanced)$")
    target_muscle_groups: Optional[str] = None  # Comma-separated list
    image_url: Optional[str] = None
    duration_weeks: Optional[int] = Field(None, ge=1, le=52)
    details: Optional[List[ProgramDetailCreate]] = []


class ProgramUpdate(BaseModel):
    """Схема обновления программы"""
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    is_public: Optional[bool] = None
    difficulty: Optional[str] = Field(None, pattern="^(beginner|intermediate|advanced)$")
    target_muscle_groups: Optional[str] = None
    image_url: Optional[str] = None
    duration_weeks: Optional[int] = Field(None, ge=1, le=52)
    details: Optional[List[ProgramDetailCreate]] = None


class ProgramAuthorProfile(BaseModel):
    full_name: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class ProgramAuthor(BaseModel):
    id: UUID
    email: Optional[str] = None # Optional, maybe don't expose email publicly? User requested "Author", usually name. 
    # Let's keep email out for privacy unless needed. But schemas/user.py UserResponse has email.
    # Let's just use a custom one.
    profile: Optional[ProgramAuthorProfile] = None
    model_config = ConfigDict(from_attributes=True)

class ProgramResponse(BaseModel):
    """Схема ответа с программой"""
    id: UUID
    author_id: UUID
    author: Optional[ProgramAuthor] = None
    title: str
    description: Optional[str] = None
    is_public: bool
    difficulty: Optional[str] = None
    target_muscle_groups: Optional[str] = None
    image_url: Optional[str] = None
    duration_weeks: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)



class ProgramWithStatus(ProgramResponse):
    """Программа с статусом пользователя"""
    status: str
    is_active: bool
    start_date: Optional[datetime] = None
    last_interaction_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class ProgramWithDetails(ProgramResponse):
    """Программа с полными деталями"""
    details: List[ProgramDetailResponse] = []

    model_config = ConfigDict(from_attributes=True)


class WorkoutLogCreate(BaseModel):
    """Схема создания записи о тренировке"""
    program_id: UUID
    day_number: int
    duration_minutes: Optional[int] = None
    notes: Optional[str] = None
    completed_at: Optional[datetime] = None


class WorkoutLogResponse(BaseModel):
    """Схема ответа с записью о тренировке"""
    id: UUID
    program_id: UUID
    day_number: int
    completed_at: datetime
    duration_minutes: Optional[int] = None
    notes: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
