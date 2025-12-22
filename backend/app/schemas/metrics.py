"""
Pydantic схемы для метрик тела
"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import date as date_type
from uuid import UUID


class BodyMetricCreate(BaseModel):
    """Схема создания замера"""
    date: date_type = Field(default_factory=date_type.today)
    weight: Optional[float] = Field(None, ge=20, le=300, description="Вес в кг (от 20 до 300)")
    chest: Optional[float] = Field(None, ge=50, le=200, description="Обхват груди в см (от 50 до 200)")
    waist: Optional[float] = Field(None, ge=40, le=200, description="Обхват талии в см (от 40 до 200)")
    hips: Optional[float] = Field(None, ge=50, le=200, description="Обхват бедер в см (от 50 до 200)")
    biceps: Optional[float] = Field(None, ge=15, le=80, description="Обхват бицепса в см (от 15 до 80)")
    thigh: Optional[float] = Field(None, ge=30, le=150, description="Обхват бедра в см (от 30 до 150)")
    photo_url: Optional[str] = None
    notes: Optional[str] = None


class BodyMetricUpdate(BaseModel):
    """Схема обновления замера (дату менять нельзя)"""
    weight: Optional[float] = Field(None, ge=20, le=300, description="Вес в кг (от 20 до 300)")
    chest: Optional[float] = Field(None, ge=50, le=200, description="Обхват груди в см (от 50 до 200)")
    waist: Optional[float] = Field(None, ge=40, le=200, description="Обхват талии в см (от 40 до 200)")
    hips: Optional[float] = Field(None, ge=50, le=200, description="Обхват бедер в см (от 50 до 200)")
    biceps: Optional[float] = Field(None, ge=15, le=80, description="Обхват бицепса в см (от 15 до 80)")
    thigh: Optional[float] = Field(None, ge=30, le=150, description="Обхват бедра в см (от 30 до 150)")
    photo_url: Optional[str] = None
    notes: Optional[str] = None


class BodyMetricResponse(BaseModel):
    """Схема ответа с замером"""
    id: UUID
    user_id: UUID
    date: date_type
    weight: Optional[float] = None
    chest: Optional[float] = None
    waist: Optional[float] = None
    hips: Optional[float] = None
    biceps: Optional[float] = None
    thigh: Optional[float] = None
    photo_url: Optional[str] = None
    notes: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

