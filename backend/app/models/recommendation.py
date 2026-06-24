import uuid
import enum
from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey, Enum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.db.database import Base

class RecommendationReason(str, enum.Enum):
    WEAK_POINT = "weak_point"
    RECOVERY = "recovery"
    NUTRITION_SYNC = "nutrition_sync"
    FREE_DAY = "free_day"

class RecommendationStatus(str, enum.Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    SKIPPED = "skipped"
    COMPLETED = "completed"

class ExercisePerformanceLog(Base):
    __tablename__ = "exercise_performance_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    exercise_id = Column(UUID(as_uuid=True), ForeignKey("exercises.id", ondelete="SET NULL"), nullable=True, index=True)
    source_type = Column(String, nullable=False)
    source_id = Column(UUID(as_uuid=True), nullable=True)
    logged_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    sets_done = Column(Integer, nullable=False)
    reps_done = Column(Integer, nullable=False)
    weight_kg = Column(Float, nullable=True)
    rpe = Column(Integer, nullable=True)
    notes = Column(String, nullable=True)

    user = relationship("User", back_populates="performance_logs")
    exercise = relationship("Exercise", back_populates="performance_logs")

class WorkoutRecommendation(Base):
    __tablename__ = "workout_recommendations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    generated_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    reason = Column(Enum(RecommendationReason, values_callable=lambda x: [e.value for e in x]), nullable=False)
    exercises = Column(JSONB, nullable=False)
    status = Column(Enum(RecommendationStatus, values_callable=lambda x: [e.value for e in x]), default=RecommendationStatus.PENDING, nullable=False, index=True)
    context = Column(JSONB, nullable=True)

    user = relationship("User", back_populates="recommendations")
