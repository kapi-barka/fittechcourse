"""
API роутер для аналитики и прогнозов
"""
import math
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from datetime import date
from uuid import UUID
from pydantic import BaseModel

from app.db.database import get_db
from app.core.dependencies import get_current_active_user
from app.models.user import User
from app.services.predictions import calculate_tdee
from app.models.user import UserProfile
from sqlalchemy import select, desc

router = APIRouter()


@router.get("/tdee")
async def get_tdee(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Рассчитать TDEE (Total Daily Energy Expenditure) и BMR
    """
    profile_result = await db.execute(
        select(UserProfile).where(UserProfile.user_id == current_user.id)
    )
    profile = profile_result.scalar_one_or_none()
    
    if not profile or not profile.height or not profile.birth_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Необходимо заполнить профиль (рост, дата рождения)"
        )
    
    # Получаем последний вес
    from app.models.metrics import BodyMetric
    weight_result = await db.execute(
        select(BodyMetric)
        .where(BodyMetric.user_id == current_user.id)
        .where(BodyMetric.weight.isnot(None))
        .order_by(desc(BodyMetric.date))
        .limit(1)
    )
    weight_metric = weight_result.scalar_one_or_none()
    
    if not weight_metric or not weight_metric.weight:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Необходимо добавить замер веса"
        )
    
    # Рассчитываем возраст
    age = (date.today() - profile.birth_date).days // 365
    
    tdee = calculate_tdee(
        weight_kg=weight_metric.weight,
        height_cm=profile.height,
        age=age,
        gender=profile.gender.value if profile.gender else "male",
        activity_level=profile.activity_level.value if profile.activity_level else "sedentary"
    )
    
    # BMR для справки
    if profile.gender and profile.gender.value.lower() == "male":
        bmr = 10 * weight_metric.weight + 6.25 * profile.height - 5 * age + 5
    else:
        bmr = 10 * weight_metric.weight + 6.25 * profile.height - 5 * age - 161
    
    # Расчёт % жира по формуле Navy (если есть обхват шеи и талии)
    body_fat_pct = None
    if weight_metric.neck and weight_metric.waist and profile.height:
        try:
            gender_val = profile.gender.value.lower() if profile.gender else "male"
            if gender_val == "female" and weight_metric.hips:
                # Женская формула: нужны талия, шея, бёдра, рост
                body_fat_pct = round(
                    495 / (1.29579 - 0.35004 * math.log10(weight_metric.waist + weight_metric.hips - weight_metric.neck)
                           + 0.22100 * math.log10(profile.height)) - 450,
                    1
                )
            else:
                # Мужская формула: нужны талия, шея, рост
                diff = weight_metric.waist - weight_metric.neck
                if diff > 0:
                    body_fat_pct = round(
                        495 / (1.0324 - 0.19077 * math.log10(diff)
                               + 0.15456 * math.log10(profile.height)) - 450,
                        1
                    )
        except (ValueError, ZeroDivisionError):
            body_fat_pct = None

    return {
        "bmr": round(bmr, 1),
        "tdee": round(tdee, 1),
        "weight_kg": weight_metric.weight,
        "height_cm": profile.height,
        "age": age,
        "activity_level": profile.activity_level.value if profile.activity_level else "sedentary",
        "fitness_goal": profile.fitness_goal.value if profile.fitness_goal else None,
        "experience_level": profile.experience_level.value if profile.experience_level else None,
        "body_fat_pct": body_fat_pct,
    }

