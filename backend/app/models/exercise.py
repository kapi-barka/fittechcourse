"""
Модель упражнений для тренировочных программ
"""
import uuid
from sqlalchemy import Column, String
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import relationship
from app.db.database import Base


class Exercise(Base):
    """
    Упражнение - базовый элемент тренировочной программы
    """
    __tablename__ = "exercises"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    name = Column(String, nullable=False, unique=True, index=True)
    muscle_groups = Column(ARRAY(String), nullable=False, index=True)  # Группы мышц
    video_urls = Column(ARRAY(String), nullable=True)  # Ссылки на видео
    description = Column(String, nullable=True)  # Описание техники выполнения

    # Relationship
    program_details = relationship("ProgramDetail", back_populates="exercise", cascade="all, delete-orphan")

