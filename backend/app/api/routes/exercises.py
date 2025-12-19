"""
API роутер для упражнений
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from uuid import UUID

from app.db.database import get_db
from app.core.dependencies import get_current_active_user, require_admin
from app.models.exercise import Exercise
from app.models.user import User
from app.schemas.exercise import ExerciseCreate, ExerciseUpdate, ExerciseResponse

router = APIRouter()


@router.get("/", response_model=List[ExerciseResponse])
async def list_exercises(
    skip: int = 0,
    limit: int = 100,
    muscle_group: str = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Получить список упражнений
    """
    query = select(Exercise)

    if muscle_group:
        query = query.where(Exercise.muscle_groups.contains([muscle_group]))

    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    exercises = result.scalars().all()

    return exercises


@router.get("/{exercise_id}", response_model=ExerciseResponse)
async def get_exercise(
    exercise_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Получить упражнение по ID
    """
    result = await db.execute(select(Exercise).where(Exercise.id == exercise_id))
    exercise = result.scalar_one_or_none()
    
    if not exercise:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Упражнение не найдено"
        )
    
    return exercise


@router.post("/", response_model=ExerciseResponse, status_code=status.HTTP_201_CREATED)
async def create_exercise(
    exercise_data: ExerciseCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Создать новое упражнение (только для администраторов)
    """
    # Проверяем уникальность названия
    result = await db.execute(select(Exercise).where(Exercise.name == exercise_data.name))
    existing = result.scalar_one_or_none()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Упражнение с таким названием уже существует"
        )
    
    exercise = Exercise(**exercise_data.model_dump())
    db.add(exercise)
    await db.commit()
    await db.refresh(exercise)
    
    return exercise


@router.put("/{exercise_id}", response_model=ExerciseResponse)
async def update_exercise(
    exercise_id: UUID,
    exercise_data: ExerciseUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Обновить упражнение (только для администраторов)
    """
    result = await db.execute(select(Exercise).where(Exercise.id == exercise_id))
    exercise = result.scalar_one_or_none()
    
    if not exercise:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Упражнение не найдено"
        )
    
    # Обновляем только переданные поля
    update_data = exercise_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(exercise, field, value)
    
    await db.commit()
    await db.refresh(exercise)
    
    return exercise


@router.delete("/{exercise_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_exercise(
    exercise_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Удалить упражнение (только для администраторов)
    """
    result = await db.execute(select(Exercise).where(Exercise.id == exercise_id))
    exercise = result.scalar_one_or_none()
    
    if not exercise:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Упражнение не найдено"
        )
    
    await db.delete(exercise)
    await db.commit()
    
    return None

