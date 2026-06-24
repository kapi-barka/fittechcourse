from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from uuid import UUID

class ExerciseCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    muscle_groups: list[str] = Field(..., min_length=1)
    video_urls: Optional[list[str]] = None
    description: Optional[str] = None

class ExerciseUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    muscle_groups: Optional[list[str]] = Field(None, min_length=1)
    video_urls: Optional[list[str]] = None
    description: Optional[str] = None

class ExerciseResponse(BaseModel):
    id: UUID
    name: str
    muscle_groups: list[str]
    video_urls: Optional[list[str]] = None
    description: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
