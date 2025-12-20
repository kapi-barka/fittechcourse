"""
Модель статей для образовательного контента
"""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, ForeignKey, DateTime, Integer, ARRAY, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.db.database import Base


class Article(Base):
    """
    Статья - образовательный контент о фитнесе, питании, здоровье
    """
    __tablename__ = "articles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    title = Column(String, nullable=False, index=True)
    html_file_name = Column(String, nullable=True)  # Имя HTML файла локально (например, "article-1.html")
    html_file_url = Column(String, nullable=True)  # URL HTML файла на Cloudinary
    author_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    tags = Column(ARRAY(String), nullable=True)  # Теги для поиска и фильтрации
    viewed_by = Column(ARRAY(UUID(as_uuid=True)), nullable=True, default=None)  # Массив ID пользователей, которые просмотрели статью
    cover_image_url = Column(String, nullable=True)  # Обложка статьи
    excerpt = Column(String, nullable=True)  # Краткое описание
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    is_published = Column(Boolean, default=False, nullable=False)

    # Relationship
    author = relationship("User", back_populates="articles")

