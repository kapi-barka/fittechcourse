"""
Pydantic схемы для статей
"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime
from uuid import UUID


class ArticleCreate(BaseModel):
    """Схема создания статьи"""
    title: str = Field(..., min_length=1, max_length=300)
    content: str = Field(..., min_length=1)
    tags: Optional[List[str]] = []
    cover_image_url: Optional[str] = None
    excerpt: Optional[str] = Field(None, max_length=500)
    is_published: bool = False


class ArticleUpdate(BaseModel):
    """Схема обновления статьи"""
    title: Optional[str] = Field(None, min_length=1, max_length=300)
    content: Optional[str] = Field(None, min_length=1)
    tags: Optional[List[str]] = None
    cover_image_url: Optional[str] = None
    excerpt: Optional[str] = Field(None, max_length=500)
    is_published: Optional[bool] = None


class ArticleResponse(BaseModel):
    """Схема ответа со статьей"""
    id: UUID
    title: str
    content: str
    author_id: Optional[UUID] = None
    tags: Optional[List[str]] = []
    views_count: int
    cover_image_url: Optional[str] = None
    excerpt: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    is_published: bool

    model_config = ConfigDict(from_attributes=True)

