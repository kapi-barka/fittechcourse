"""
Pydantic схемы для питания и трекинга калорий
"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime
from uuid import UUID


class FoodProductCreate(BaseModel):
    """Схема создания продукта"""
    name: str = Field(..., min_length=1, max_length=200)
    calories: float = Field(..., ge=0, description="Калории на 100г")
    proteins: float = Field(..., ge=0, description="Белки (г) на 100г")
    fats: float = Field(..., ge=0, description="Жиры (г) на 100г")
    carbs: float = Field(..., ge=0, description="Углеводы (г) на 100г")
    brand: Optional[str] = None
    category: Optional[str] = None
    barcode: Optional[str] = None
    source: Optional[str] = None  # 'openfoodfacts', 'manual', 'user_added'


class FoodProductUpdate(BaseModel):
    """Схема обновления продукта"""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    calories: Optional[float] = Field(None, ge=0, description="Калории на 100г")
    proteins: Optional[float] = Field(None, ge=0, description="Белки (г) на 100г")
    fats: Optional[float] = Field(None, ge=0, description="Жиры (г) на 100г")
    carbs: Optional[float] = Field(None, ge=0, description="Углеводы (г) на 100г")
    brand: Optional[str] = None
    category: Optional[str] = None


class FoodProductResponse(BaseModel):
    """Схема ответа с продуктом"""
    id: UUID
    name: str
    calories: float
    proteins: float
    fats: float
    carbs: float
    brand: Optional[str] = None
    category: Optional[str] = None
    barcode: Optional[str] = None
    source: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class NutritionLogCreate(BaseModel):
    """Схема создания записи о питании"""
    product_id: UUID
    weight_g: float = Field(..., ge=1, le=10000, description="Вес порции в граммах (от 1 до 10000)")
    eaten_at: Optional[datetime] = Field(default_factory=datetime.utcnow)
    meal_type: Optional[str] = Field(None, pattern="^(breakfast|lunch|dinner|snack)$")
    notes: Optional[str] = None


class NutritionLogResponse(BaseModel):
    """Схема ответа с записью о питании"""
    id: UUID
    user_id: UUID
    product_id: UUID
    weight_g: float
    eaten_at: datetime
    meal_type: Optional[str] = None
    notes: Optional[str] = None
    # Вычисляемые поля на основе веса порции
    calories: Optional[float] = None
    proteins: Optional[float] = None
    fats: Optional[float] = None
    carbs: Optional[float] = None
    # Дополнительная информация о продукте
    product_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class DailyNutritionSummary(BaseModel):
    """Итоговая статистика питания за день"""
    date: str
    total_calories: float
    total_proteins: float
    total_fats: float
    total_carbs: float
    meals_count: int


class BarcodeLookupRequest(BaseModel):
    """Схема запроса поиска по штрихкоду"""
    barcode: str = Field(..., min_length=8, max_length=20, description="Штрихкод продукта")


class BarcodeLogCreate(BaseModel):
    """Схема создания лога из штрихкода"""
    barcode: str = Field(..., min_length=8, max_length=20)
    weight_g: float = Field(..., ge=1, le=10000, description="Вес порции в граммах (от 1 до 10000)")
    eaten_at: Optional[datetime] = Field(default_factory=datetime.utcnow)
    meal_type: Optional[str] = Field(None, pattern="^(breakfast|lunch|dinner|snack)$")
    notes: Optional[str] = None

