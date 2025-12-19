"""
API роутер для метрик тела
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from datetime import date, timedelta
from uuid import UUID

from app.db.database import get_db
from app.core.dependencies import get_current_active_user
from app.models.metrics import BodyMetric
from app.models.user import User
from app.schemas.metrics import BodyMetricCreate, BodyMetricResponse

router = APIRouter()


@router.get("/", response_model=List[BodyMetricResponse])
async def get_my_metrics(
    skip: int = 0,
    limit: int = 100,
    from_date: date = None,
    to_date: date = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Получить свои замеры с опциональной фильтрацией по датам
    """
    query = select(BodyMetric).where(BodyMetric.user_id == current_user.id)
    
    if from_date:
        query = query.where(BodyMetric.date >= from_date)
    
    if to_date:
        query = query.where(BodyMetric.date <= to_date)
    
    query = query.order_by(BodyMetric.date.desc()).offset(skip).limit(limit)
    
    result = await db.execute(query)
    metrics = result.scalars().all()
    
    return metrics


@router.get("/latest", response_model=BodyMetricResponse)
async def get_latest_metric(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Получить последний замер
    """
    result = await db.execute(
        select(BodyMetric)
        .where(BodyMetric.user_id == current_user.id)
        .order_by(BodyMetric.date.desc())
        .limit(1)
    )
    metric = result.scalar_one_or_none()
    
    if not metric:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Замеры не найдены"
        )
    
    return metric


@router.post("/", response_model=BodyMetricResponse, status_code=status.HTTP_201_CREATED)
async def create_metric(
    metric_data: BodyMetricCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Добавить новый замер
    """
    metric = BodyMetric(
        user_id=current_user.id,
        **metric_data.model_dump()
    )
    
    db.add(metric)
    await db.commit()
    await db.refresh(metric)
    
    return metric


@router.delete("/{metric_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_metric(
    metric_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Удалить замер
    """
    result = await db.execute(
        select(BodyMetric)
        .where(BodyMetric.id == metric_id, BodyMetric.user_id == current_user.id)
    )
    metric = result.scalar_one_or_none()
    
    if not metric:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Замер не найден"
        )
    
    await db.delete(metric)
    await db.commit()
    
    return None

