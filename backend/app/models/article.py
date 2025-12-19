"""
Модель статей для образовательного контента
"""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, ForeignKey, DateTime, Integer, ARRAY, Boolean
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
    content = Column(Text, nullable=False)  # Полный текст статьи
    author_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    tags = Column(ARRAY(String), nullable=True)  # Теги для поиска и фильтрации
    views_count = Column(Integer, default=0, nullable=False)
    cover_image_url = Column(String, nullable=True)  # Обложка статьи
    excerpt = Column(String, nullable=True)  # Краткое описание
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    is_published = Column(Boolean, default=False, nullable=False)

    # Relationship
    author = relationship("User", back_populates="articles")

