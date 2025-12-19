"""
Модель для отслеживания метрик тела пользователя
"""
import uuid
from datetime import date
from sqlalchemy import Column, ForeignKey, Date, Float, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.db.database import Base


class BodyMetric(Base):
    """
    Замеры тела пользователя - вес, объемы, фотографии прогресса
    """
    __tablename__ = "body_metrics"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    date = Column(Date, nullable=False, default=date.today, index=True)
    weight = Column(Float, nullable=True)  # Вес в кг
    chest = Column(Float, nullable=True)  # Обхват груди в см
    waist = Column(Float, nullable=True)  # Обхват талии в см
    hips = Column(Float, nullable=True)  # Обхват бедер в см
    biceps = Column(Float, nullable=True)  # Обхват бицепса в см
    thigh = Column(Float, nullable=True)  # Обхват бедра в см
    photo_url = Column(String, nullable=True)  # Ссылка на фото прогресса
    notes = Column(String, nullable=True)  # Заметки к замерам

    # Relationship
    user = relationship("User", back_populates="body_metrics")

