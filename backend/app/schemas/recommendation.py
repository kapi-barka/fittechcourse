"""
Pydantic схемы для рекомендаций тренировок и логирования выполнения
"""
from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List, Any, Dict
from datetime import datetime
from uuid import UUID


class RecommendedExercise(BaseModel):
    exercise_id: str
    exercise_name: str
    muscle_groups: List[str]
    sets: int
    reps: int
    rest_time: int
    reason: str


class WorkoutRecommendationResponse(BaseModel):
    id: UUID
    generated_at: datetime
    reason: str
    exercises: List[RecommendedExercise]
    status: str
    context: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(from_attributes=True)


class ExercisePerformanceLogCreate(BaseModel):
    exercise_id: UUID
    source_type: str = Field(..., pattern="^(program|recommendation|free)$")
    source_id: Optional[UUID] = None
    sets_done: int = Field(..., ge=1, le=20)
    reps_done: int = Field(..., ge=1, le=100)
    weight_kg: Optional[float] = Field(None, ge=0, le=500)
    rpe: Optional[int] = Field(None, ge=1, le=10)
    notes: Optional[str] = None


class ExercisePerformanceLogResponse(BaseModel):
    id: UUID
    exercise_id: Optional[UUID]
    source_type: str
    logged_at: datetime
    sets_done: int
    reps_done: int
    weight_kg: Optional[float] = None
    rpe: Optional[int] = None
    notes: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
