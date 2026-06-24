from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import List, Optional
from uuid import UUID
from datetime import date

from app.db.database import get_db
from app.core.dependencies import get_current_active_user, require_admin
from app.models.user import User, UserProfile
from app.models.metrics import BodyMetric
from app.models.nutrition import NutritionLog, FoodProduct
from app.schemas.user import (
    UserResponse,
    UserWithProfile,
    UserProfileUpdate,
    UserProfileResponse
)
from app.services.daily_advice import generate_daily_advice
from app.core.config import settings

router = APIRouter()

@router.get("/me", response_model=UserWithProfile)
async def get_current_user_info(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):

    result = await db.execute(
        select(UserProfile).where(UserProfile.user_id == current_user.id)
    )
    profile = result.scalar_one_or_none()

    user_dict = {
        "id": current_user.id,
        "email": current_user.email,
        "role": current_user.role,
        "telegram_id": current_user.telegram_id,
        "created_at": current_user.created_at,
        "is_active": current_user.is_active,
        "profile": profile
    }

    return user_dict

@router.put("/me/profile", response_model=UserProfileResponse)
async def update_my_profile(
    profile_data: UserProfileUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):

    result = await db.execute(
        select(UserProfile).where(UserProfile.user_id == current_user.id)
    )
    profile = result.scalar_one_or_none()

    if not profile:

        profile = UserProfile(user_id=current_user.id)
        db.add(profile)

    update_data = profile_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(profile, field, value)

    await db.commit()
    await db.refresh(profile)

    return profile

@router.get("/", response_model=List[UserWithProfile], dependencies=[Depends(require_admin)])
async def list_users(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db)
):

    result = await db.execute(
        select(User)
        .options(selectinload(User.profile))
        .offset(skip)
        .limit(limit)
    )
    users = result.scalars().all()

    return users

@router.patch("/{user_id}/block", dependencies=[Depends(require_admin)])
async def block_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь не найден"
        )

    user.is_active = False
    await db.commit()

    return {"message": "Пользователь заблокирован"}

@router.patch("/{user_id}/unblock", dependencies=[Depends(require_admin)])
async def unblock_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь не найден"
        )

    user.is_active = True
    await db.commit()

    return {"message": "Пользователь разблокирован"}

@router.get("/me/daily-advice")
async def get_daily_advice(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    if not settings.GOOGLE_GEMINI_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Сервис советов временно недоступен"
        )

    profile_result = await db.execute(
        select(UserProfile).where(UserProfile.user_id == current_user.id)
    )
    profile = profile_result.scalar_one_or_none()

    if not profile:
        profile_dict = {}
    else:
        profile_dict = {
            'full_name': profile.full_name,
            'gender': profile.gender,
            'height': profile.height,
        }

    latest_weight = None
    weight_result = await db.execute(
        select(BodyMetric)
        .where(BodyMetric.user_id == current_user.id)
        .order_by(BodyMetric.date.desc())
        .limit(1)
    )
    weight_metric = weight_result.scalar_one_or_none()
    if weight_metric:
        latest_weight = weight_metric.weight

    today = date.today()
    nutrition_result = await db.execute(
        select(NutritionLog)
        .where(
            NutritionLog.user_id == current_user.id,
            func.date(NutritionLog.eaten_at) == today
        )
    )
    logs = nutrition_result.scalars().all()

    today_calories = 0.0
    total_proteins = 0.0
    total_fats = 0.0
    total_carbs = 0.0

    for log in logs:
        product_result = await db.execute(
            select(FoodProduct).where(FoodProduct.id == log.product_id)
        )
        product = product_result.scalar_one_or_none()

        if product:
            multiplier = log.weight_g / 100.0
            today_calories += product.calories * multiplier
            total_proteins += product.proteins * multiplier
            total_fats += product.fats * multiplier
            total_carbs += product.carbs * multiplier

    nutrition_summary = {
        'total_proteins': total_proteins,
        'total_fats': total_fats,
        'total_carbs': total_carbs,
    }

    advice = await generate_daily_advice(
        user_profile=profile_dict,
        today_calories=today_calories,
        target_calories=profile.target_calories if profile else None,
        latest_weight=latest_weight,
        target_weight=profile.target_weight if profile else None,
        nutrition_summary=nutrition_summary,
        api_key=settings.GOOGLE_GEMINI_API_KEY
    )

    if not advice:

        advice = "Продолжай следить за своим питанием и тренировками. Каждый день - это шаг к твоей цели!"

    return {
        "advice": advice,
        "date": today.isoformat()
    }
