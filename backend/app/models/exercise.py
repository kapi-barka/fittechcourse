import uuid
from sqlalchemy import Column, String
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import relationship
from app.db.database import Base

class Exercise(Base):
    __tablename__ = "exercises"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    name = Column(String, nullable=False, unique=True, index=True)
    muscle_groups = Column(ARRAY(String), nullable=False, index=True)
    video_urls = Column(ARRAY(String), nullable=True)
    description = Column(String, nullable=True)

    program_details = relationship("ProgramDetail", back_populates="exercise", cascade="all, delete-orphan")
    performance_logs = relationship("ExercisePerformanceLog", back_populates="exercise")
