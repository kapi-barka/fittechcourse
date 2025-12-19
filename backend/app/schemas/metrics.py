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
    weight: Optional[float] = Field(None, gt=0, lt=500, description="Вес в кг")
    chest: Optional[float] = Field(None, gt=0, lt=300, description="Обхват груди в см")
    waist: Optional[float] = Field(None, gt=0, lt=300, description="Обхват талии в см")
    hips: Optional[float] = Field(None, gt=0, lt=300, description="Обхват бедер в см")
    biceps: Optional[float] = Field(None, gt=0, lt=100, description="Обхват бицепса в см")
    thigh: Optional[float] = Field(None, gt=0, lt=200, description="Обхват бедра в см")
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

