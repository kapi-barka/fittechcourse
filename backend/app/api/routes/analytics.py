"""
API роутер для аналитики и прогнозов
"""
import math
import numpy as np
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from datetime import date, timedelta
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
    
    # Получаем последние записи и мержим: для каждого поля — последнее ненулевое
    from app.models.metrics import BodyMetric
    recent_result = await db.execute(
        select(BodyMetric)
        .where(BodyMetric.user_id == current_user.id)
        .order_by(desc(BodyMetric.date))
        .limit(50)
    )
    recent_records = recent_result.scalars().all()

    def latest_value(field: str):
        for rec in recent_records:
            v = getattr(rec, field)
            if v is not None:
                return v
        return None

    weight_val = latest_value('weight')
    if not weight_val:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Необходимо добавить замер веса"
        )

    # Псевдо-объект для совместимости с расчётами ниже
    class _Merged:
        weight = weight_val
        neck   = latest_value('neck')
        waist  = latest_value('waist')
        hips   = latest_value('hips')

    weight_metric = _Merged()
    
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


@router.get("/weight-prediction")
async def get_weight_prediction(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Линейная регрессия по замерам веса → прогноз даты достижения целевого веса.
    Возвращает точки проекции для отображения пунктирной линии на графике.
    """
    from app.models.metrics import BodyMetric

    profile_result = await db.execute(
        select(UserProfile).where(UserProfile.user_id == current_user.id)
    )
    profile = profile_result.scalar_one_or_none()
    target_weight = profile.target_weight if profile else None

    if not target_weight:
        return {"has_enough_data": False, "reason": "no_target", "projection": []}

    all_result = await db.execute(
        select(BodyMetric)
        .where(BodyMetric.user_id == current_user.id)
        .where(BodyMetric.weight.isnot(None))
        .order_by(BodyMetric.date.asc())
    )
    all_metrics = all_result.scalars().all()

    if len(all_metrics) < 2:
        return {"has_enough_data": False, "reason": "need_more_data", "projection": []}

    # Регрессия только по недавним замерам — как на графике дашборда (30 дней).
    # Старые записи (другая фаза: похудение vs набор) иначе переворачивают тренд.
    metrics = []
    lookback_days = 30
    for window in (30, 90, None):
        if window is None:
            candidate = all_metrics
        else:
            since = date.today() - timedelta(days=window)
            candidate = [m for m in all_metrics if m.date >= since]
        if len(candidate) >= 2:
            metrics = candidate
            lookback_days = window if window is not None else None
            break

    if len(metrics) < 2:
        return {"has_enough_data": False, "reason": "need_more_data", "projection": []}

    first_date = metrics[0].date
    x = np.array([(m.date - first_date).days for m in metrics], dtype=float)
    y = np.array([m.weight for m in metrics], dtype=float)

    coeffs = np.polyfit(x, y, 1)
    slope, intercept = coeffs[0], coeffs[1]

    # R²
    y_pred = np.polyval(coeffs, x)
    ss_res = float(np.sum((y - y_pred) ** 2))
    ss_tot = float(np.sum((y - np.mean(y)) ** 2))
    r_squared = round(1 - ss_res / ss_tot, 2) if ss_tot > 0 else 0.0

    current_weight = float(y[-1])
    weekly_rate = round(float(slope) * 7, 2)

    # Цель уже достигнута?
    if abs(current_weight - target_weight) < 0.3:
        return {
            "has_enough_data": True, "goal_reached": True,
            "current_weight": current_weight, "target_weight": target_weight,
            "weekly_rate": weekly_rate, "r_squared": r_squared, "projection": [],
        }

    # Тренд в неправильном направлении?
    going_wrong = (target_weight < current_weight and slope >= 0) or \
                  (target_weight > current_weight and slope <= 0)
    if going_wrong or abs(slope) < 0.001:
        return {
            "has_enough_data": True, "wrong_direction": True,
            "current_weight": current_weight, "target_weight": target_weight,
            "weekly_rate": weekly_rate, "r_squared": r_squared,
            "lookback_days": lookback_days, "projection": [],
        }

    # Дата достижения цели
    last_x = float(x[-1])
    x_goal = (target_weight - intercept) / slope
    days_to_goal = x_goal - last_x
    goal_date = metrics[-1].date + timedelta(days=int(days_to_goal))

    # Ограничиваем 2 годами
    max_date = date.today() + timedelta(days=730)
    capped = goal_date > max_date
    if capped:
        goal_date = max_date

    days_remaining = (goal_date - date.today()).days

    # Еженедельные точки проекции (от последнего замера до даты цели)
    projection = []
    cur = metrics[-1].date
    while cur <= goal_date:
        days_from_start = (cur - first_date).days
        proj_w = round(float(slope) * days_from_start + float(intercept), 1)
        projection.append({"date": cur.isoformat(), "weight": proj_w})
        cur += timedelta(days=7)

    # Гарантируем финальную точку точно на дате цели
    if not projection or projection[-1]["date"] != goal_date.isoformat():
        projection.append({"date": goal_date.isoformat(), "weight": round(target_weight, 1)})

    return {
        "has_enough_data": True,
        "wrong_direction": False,
        "goal_reached": False,
        "capped": capped,
        "current_weight": current_weight,
        "target_weight": target_weight,
        "predicted_date": goal_date.isoformat(),
        "days_remaining": days_remaining,
        "weekly_rate": weekly_rate,
        "r_squared": r_squared,
        "lookback_days": lookback_days,
        "projection": projection,
    }

