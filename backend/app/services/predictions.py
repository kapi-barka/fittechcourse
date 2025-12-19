"""
Сервис для прогнозирования прогресса с помощью ML
"""
import logging
from typing import Dict, Any, Optional, List
from datetime import date, timedelta
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
import numpy as np

from app.models.metrics import BodyMetric
from app.models.nutrition import NutritionLog
from app.models.program import WorkoutLog
from app.models.nutrition import FoodProduct

logger = logging.getLogger(__name__)


def calculate_tdee(
    weight_kg: float,
    height_cm: float,
    age: int,
    gender: str,
    activity_level: str
) -> float:
    """
    Расчет Total Daily Energy Expenditure (TDEE)
    Использует формулу Mifflin-St Jeor для BMR
    """
    # BMR расчет
    if gender.lower() == "male":
        bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age + 5
    else:
        bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age - 161
    
    # Множители активности
    activity_multipliers = {
        "sedentary": 1.2,
        "lightly_active": 1.375,
        "moderately_active": 1.55,
        "very_active": 1.725,
        "extremely_active": 1.9
    }
    
    multiplier = activity_multipliers.get(activity_level.lower(), 1.2)
    return bmr * multiplier

