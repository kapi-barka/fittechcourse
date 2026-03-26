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
from app.schemas.metrics import BodyMetricCreate, BodyMetricUpdate, BodyMetricResponse

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
    Получить последний замер. Для каждого поля берётся последнее
    ненулевое значение из истории, чтобы частичные записи не обнуляли
    ранее внесённые данные.
    """
    result = await db.execute(
        select(BodyMetric)
        .where(BodyMetric.user_id == current_user.id)
        .order_by(BodyMetric.date.desc())
        .limit(50)
    )
    records = result.scalars().all()

    if not records:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Замеры не найдены"
        )

    latest = records[0]
    MERGE_FIELDS = ('weight', 'chest', 'waist', 'hips', 'biceps', 'thigh', 'neck')

    merged = {
        'id':         latest.id,
        'user_id':    latest.user_id,
        'date':       latest.date,
        'photo_url':  latest.photo_url,
        'notes':      latest.notes,
    }
    for field in MERGE_FIELDS:
        value = getattr(latest, field)
        if value is None:
            for rec in records[1:]:
                v = getattr(rec, field)
                if v is not None:
                    value = v
                    break
        merged[field] = value

    return merged


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


@router.put("/{metric_id}", response_model=BodyMetricResponse)
async def update_metric(
    metric_id: UUID,
    metric_data: BodyMetricUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Изменить замер (дату менять нельзя)
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
    
    # Обновляем только переданные поля
    update_data = metric_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(metric, field, value)
    
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

