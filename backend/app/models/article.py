import uuid
from datetime import datetime
from sqlalchemy import Column, String, ForeignKey, DateTime, Integer, ARRAY, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.db.database import Base

class Article(Base):
    __tablename__ = "articles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    title = Column(String, nullable=False, index=True)
    html_file_name = Column(String, nullable=True)
    html_file_url = Column(String, nullable=True)
    author_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    tags = Column(ARRAY(String), nullable=True)
    viewed_by = Column(ARRAY(UUID(as_uuid=True)), nullable=True, default=None)
    cover_image_url = Column(String, nullable=True)
    excerpt = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    is_published = Column(Boolean, default=False, nullable=False)

    author = relationship("User", back_populates="articles")
