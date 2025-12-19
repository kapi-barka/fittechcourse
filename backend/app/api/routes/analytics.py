"""
API роутер для аналитики и прогнозов
"""
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
    
    return {
        "bmr": round(bmr, 1),
        "tdee": round(tdee, 1),
        "weight_kg": weight_metric.weight,
        "height_cm": profile.height,
        "age": age,
        "activity_level": profile.activity_level.value if profile.activity_level else "sedentary"
    }

