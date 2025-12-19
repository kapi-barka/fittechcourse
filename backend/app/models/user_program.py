"""
Модель UserProgram для отслеживания статуса программ пользователя (активные, сохраненные, завершенные)
"""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, ForeignKey, DateTime, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum
from app.db.database import Base

class ProgramStatus(str, enum.Enum):
    STARTED = "started"       # Программа начата (активна или была активна)
    SAVED = "saved"           # Программа сохранена (в избранное)
    COMPLETED = "completed"   # Программа завершена

class UserProgram(Base):
    __tablename__ = "user_programs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    program_id = Column(UUID(as_uuid=True), ForeignKey("programs.id", ondelete="CASCADE"), nullable=False, index=True)
    
    status = Column(Enum(ProgramStatus), default=ProgramStatus.STARTED, nullable=False)
    
    # Флаг для быстрой выборки текущей активной программы
    # У пользователя должна быть только одна is_active=True программа
    is_active = Column(Boolean, default=False, nullable=False)
    
    start_date = Column(DateTime, default=datetime.utcnow, nullable=True)
    last_interaction_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="user_programs")
    program = relationship("Program")
