"""
Модели тренировочных программ: Program (общая информация) и ProgramDetail (упражнения в программе)
"""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, Integer, ForeignKey, DateTime, Float
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum
from app.db.database import Base


class Program(Base):
    """
    Тренировочная программа - набор упражнений на определенный период
    """
    __tablename__ = "programs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    author_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String, nullable=False, index=True)
    description = Column(String, nullable=True)
    is_public = Column(Boolean, default=False, nullable=False, index=True)
    difficulty = Column(String, nullable=True)  # beginner, intermediate, advanced
    target_muscle_groups = Column(String, nullable=True)  # Comma-separated list of muscle groups
    image_url = Column(String, nullable=True)  # Ссылка на фоновое изображение
    duration_weeks = Column(Integer, nullable=True)  # Длительность программы в неделях
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    author = relationship("User", back_populates="programs")
    details = relationship("ProgramDetail", back_populates="program", cascade="all, delete-orphan")
    workout_logs = relationship("WorkoutLog", back_populates="program", cascade="all, delete-orphan")


class ProgramDetail(Base):
    """
    Детали программы - упражнения, подходы, повторения для каждого дня
    """
    __tablename__ = "program_details"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    program_id = Column(UUID(as_uuid=True), ForeignKey("programs.id", ondelete="CASCADE"), nullable=False, index=True)
    exercise_id = Column(UUID(as_uuid=True), ForeignKey("exercises.id", ondelete="CASCADE"), nullable=False, index=True)
    day_number = Column(Integer, nullable=False)  # День в программе (1, 2, 3...)
    sets = Column(Integer, nullable=False)  # Количество подходов
    reps = Column(Integer, nullable=False)  # Количество повторений
    rest_time = Column(Integer, nullable=True)  # Время отдыха между подходами (в секундах)
    order = Column(Integer, default=0)  # Порядок упражнения в тренировке
    notes = Column(String, nullable=True)  # Дополнительные заметки

    # Relationships
    program = relationship("Program", back_populates="details")
    exercise = relationship("Exercise", back_populates="program_details")


class WorkoutLog(Base):
    """
    История выполненных тренировок
    """
    __tablename__ = "workout_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    program_id = Column(UUID(as_uuid=True), ForeignKey("programs.id", ondelete="CASCADE"), nullable=False, index=True)
    day_number = Column(Integer, nullable=False)  # Какой день программы был выполнен
    completed_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    duration_minutes = Column(Integer, nullable=True)
    notes = Column(String, nullable=True)

    # Relationships
    user = relationship("User", back_populates="workout_logs")
    program = relationship("Program", back_populates="workout_logs")
