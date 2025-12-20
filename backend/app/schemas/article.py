"""
Pydantic схемы для статей
"""
from pydantic import BaseModel, Field, ConfigDict, model_validator, computed_field
from typing import Optional, List
from datetime import datetime
from uuid import UUID


class ArticleCreate(BaseModel):
    """Схема создания статьи"""
    title: str = Field(..., min_length=1, max_length=300)
    html_file_name: Optional[str] = Field(None, description="Имя HTML файла локально (например, 'article-1.html')")
    html_file_url: Optional[str] = Field(None, description="URL HTML файла на Cloudinary")
    tags: Optional[List[str]] = []
    cover_image_url: Optional[str] = None
    excerpt: Optional[str] = Field(None, max_length=500)
    is_published: bool = False

    @model_validator(mode='after')
    def validate_html_source(self):
        """Проверяем, что указан хотя бы один источник HTML (локальный файл или URL)"""
        if not self.html_file_name and not self.html_file_url:
            raise ValueError("Необходимо указать либо html_file_name, либо html_file_url")
        return self


class ArticleUpdate(BaseModel):
    """Схема обновления статьи"""
    title: Optional[str] = Field(None, min_length=1, max_length=300)
    html_file_name: Optional[str] = Field(None, description="Имя HTML файла локально (например, 'article-1.html')")
    html_file_url: Optional[str] = Field(None, description="URL HTML файла на Cloudinary")
    tags: Optional[List[str]] = None
    cover_image_url: Optional[str] = None
    excerpt: Optional[str] = Field(None, max_length=500)
    is_published: Optional[bool] = None


class ArticleResponse(BaseModel):
    """Схема ответа со статьей"""
    id: UUID
    title: str
    html_file_name: Optional[str] = None
    html_file_url: Optional[str] = None
    content: Optional[str] = None  # Загружается динамически из HTML файла при запросе
    author_id: Optional[UUID] = None
    tags: Optional[List[str]] = []
    viewed_by: Optional[List[UUID]] = None  # Массив ID пользователей, которые просмотрели статью
    cover_image_url: Optional[str] = None
    excerpt: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    is_published: bool

    model_config = ConfigDict(from_attributes=True)
    
    @computed_field
    @property
    def views_count(self) -> int:
        """Вычисляем views_count из viewed_by для обратной совместимости"""
        if self.viewed_by is None:
            return 0
        return len(self.viewed_by)

