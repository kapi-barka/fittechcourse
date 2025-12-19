"""
Модели базы данных
Экспорт всех моделей для удобного импорта
"""
from app.models.user import User, UserProfile
from app.models.exercise import Exercise
from app.models.program import Program, ProgramDetail
from app.models.metrics import BodyMetric
from app.models.nutrition import FoodProduct, NutritionLog, HydrationLog
from app.models.article import Article
from app.models.user_program import UserProgram

__all__ = [
    "User",
    "UserProfile",
    "Exercise",
    "Program",
    "ProgramDetail",
    "BodyMetric",
    "FoodProduct",
    "NutritionLog",
    "HydrationLog",
    "Article",
    "UserProgram",
]

