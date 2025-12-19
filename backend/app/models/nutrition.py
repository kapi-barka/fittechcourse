"""
Модели питания: FoodProduct (продукты) и NutritionLog (дневник питания)
"""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, ForeignKey, DateTime, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.db.database import Base


class FoodProduct(Base):
    """
    Продукт питания с данными о калориях и макронутриентах (на 100г)
    """
    __tablename__ = "food_products"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    name = Column(String, nullable=False, index=True)
    calories = Column(Float, nullable=False)  # Калории на 100г
    proteins = Column(Float, nullable=False)  # Белки в граммах на 100г
    fats = Column(Float, nullable=False)  # Жиры в граммах на 100г
    carbs = Column(Float, nullable=False)  # Углеводы в граммах на 100г
    brand = Column(String, nullable=True)  # Бренд/производитель
    category = Column(String, nullable=True, index=True)  # Категория продукта
    barcode = Column(String, nullable=True, unique=True, index=True)  # Штрихкод продукта
    source = Column(String, nullable=True)  # Источник: 'openfoodfacts', 'manual', 'user_added'
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)  # Для пользовательских продуктов

    # Relationship
    nutrition_logs = relationship("NutritionLog", back_populates="product", cascade="all, delete-orphan")
    user = relationship("User", back_populates="custom_products")


class NutritionLog(Base):
    """
    Запись в дневнике питания - что съел пользователь
    Калории и макросы рассчитываются на основе веса порции
    """
    __tablename__ = "nutrition_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), ForeignKey("food_products.id", ondelete="CASCADE"), nullable=False, index=True)
    weight_g = Column(Float, nullable=False)  # Вес порции в граммах
    eaten_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    meal_type = Column(String, nullable=True)  # breakfast, lunch, dinner, snack
    notes = Column(String, nullable=True)

    # Relationships
    user = relationship("User", back_populates="nutrition_logs")
    product = relationship("FoodProduct", back_populates="nutrition_logs")


class HydrationLog(Base):
    """
    Лог выпитой воды
    """
    __tablename__ = "hydration_logs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    amount_ml = Column(Float, nullable=False)  # Количество в мл
    logged_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    activity_level = Column(String, nullable=True)  # Для расчета потребности
    
    # Relationship
    user = relationship("User", back_populates="hydration_logs")