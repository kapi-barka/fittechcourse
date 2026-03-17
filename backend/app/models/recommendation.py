"""
Модели рекомендаций упражнений и логирования фактического выполнения
"""
import uuid
import enum
from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey, Enum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.db.database import Base


class RecommendationReason(str, enum.Enum):
    WEAK_POINT = "weak_point"        # Отстающие мышечные группы
    RECOVERY = "recovery"            # День восстановления — нагружаем незатронутые мышцы
    NUTRITION_SYNC = "nutrition_sync"  # Подбор нагрузки под питание
    FREE_DAY = "free_day"            # Свободная тренировка (нет данных для анализа)


class RecommendationStatus(str, enum.Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    SKIPPED = "skipped"
    COMPLETED = "completed"


class ExercisePerformanceLog(Base):
    """
    Лог фактического выполнения упражнения.
    Хранит реальные подходы/повторения/вес — фундамент для анализа прогресса.
    """
    __tablename__ = "exercise_performance_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    exercise_id = Column(UUID(as_uuid=True), ForeignKey("exercises.id", ondelete="SET NULL"), nullable=True, index=True)
    source_type = Column(String, nullable=False)  # "program", "recommendation", "free"
    source_id = Column(UUID(as_uuid=True), nullable=True)  # workout_log_id или recommendation_id
    logged_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    sets_done = Column(Integer, nullable=False)
    reps_done = Column(Integer, nullable=False)
    weight_kg = Column(Float, nullable=True)
    rpe = Column(Integer, nullable=True)  # Rate of Perceived Exertion (1-10)
    notes = Column(String, nullable=True)

    user = relationship("User", back_populates="performance_logs")
    exercise = relationship("Exercise", back_populates="performance_logs")


class WorkoutRecommendation(Base):
    """
    Сгенерированная рекомендация-тренировка.
    Создаётся движком рекомендаций на основе замеров тела, усталости и питания.
    """
    __tablename__ = "workout_recommendations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    generated_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    reason = Column(Enum(RecommendationReason), nullable=False)
    exercises = Column(JSONB, nullable=False)  # [{exercise_id, exercise_name, muscle_groups, sets, reps, rest_time, reason}]
    status = Column(Enum(RecommendationStatus), default=RecommendationStatus.PENDING, nullable=False, index=True)
    context = Column(JSONB, nullable=True)  # снапшот данных на момент генерации

    user = relationship("User", back_populates="recommendations")
