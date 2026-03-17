"""
API роутер для расписания и трекинга тренировок
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, and_, update, func
from sqlalchemy.orm import selectinload
from typing import List, Optional
from datetime import datetime, date, timedelta
from uuid import UUID

from app.db.database import get_db
from app.core.dependencies import get_current_active_user
from app.models.user import User, UserProfile
from app.models.program import Program, ProgramDetail, WorkoutLog
from app.models.user_program import UserProgram, ProgramStatus
from app.schemas.program import WorkoutLogCreate, WorkoutLogResponse, ProgramWithDetails

router = APIRouter()

@router.post("/start/{program_id}", status_code=status.HTTP_200_OK)
async def start_program(
    program_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Начать выполнение программы (сделать её текущей)
    """
    # 1. Проверяем существование программы
    result = await db.execute(select(Program).where(Program.id == program_id))
    program = result.scalar_one_or_none()
    
    if not program:
        raise HTTPException(status_code=404, detail="Программа не найдена")
    
    # 2. Деактивируем текущую активную программу пользователя
    await db.execute(
        update(UserProgram)
        .where(
            and_(
                UserProgram.user_id == current_user.id,
                UserProgram.is_active == True
            )
        )
        .values(is_active=False)
    )
    
    # 3. Ищем или создаем запись для новой программы
    stmt = select(UserProgram).where(
        and_(
            UserProgram.user_id == current_user.id,
            UserProgram.program_id == program_id
        )
    )
    result = await db.execute(stmt)
    user_program = result.scalar_one_or_none()
    
    if user_program:
        # Обновляем существующую
        user_program.is_active = True
        user_program.status = ProgramStatus.STARTED
        user_program.last_interaction_at = datetime.utcnow()
        if not user_program.start_date:
            user_program.start_date = datetime.utcnow()
    else:
        # Создаем новую
        user_program = UserProgram(
            user_id=current_user.id,
            program_id=program_id,
            status=ProgramStatus.STARTED,
            is_active=True,
            start_date=datetime.utcnow()
        )
        db.add(user_program)
    
    # 4. Обновляем профиль пользователя для backward compatibility (пока не удалим поле)
    stmt = select(UserProfile).where(UserProfile.user_id == current_user.id)
    result = await db.execute(stmt)
    profile = result.scalar_one_or_none()
    
    if not profile:
        profile = UserProfile(user_id=current_user.id)
        db.add(profile)
    
    profile.current_program_id = program_id
    profile.current_program_start_date = date.today()
    
    await db.commit()
    return {"message": "Программа успешно начата"}


@router.get("/active", response_model=Optional[ProgramWithDetails])
async def get_active_program(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Получить текущую активную программу
    """
    # Ищем активную программу через UserProgram
    stmt = select(UserProgram).where(
        and_(
            UserProgram.user_id == current_user.id,
            UserProgram.is_active == True
        )
    )
    result = await db.execute(stmt)
    active_up = result.scalar_one_or_none()
    
    if not active_up:
        return None
        
    # Загружаем программу с деталями
    result = await db.execute(
        select(Program)
        .options(
            selectinload(Program.details),
            selectinload(Program.author).selectinload(User.profile)
        )
        .where(Program.id == active_up.program_id)
    )
    program = result.scalar_one_or_none()
    return program


@router.get("/status")
async def get_schedule_status(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Получить статус текущего расписания с расчетом прогресса по выполненным тренировкам
    """
    # 1. Получаем активную программу
    stmt = select(UserProgram).where(
        and_(
            UserProgram.user_id == current_user.id,
            UserProgram.is_active == True
        )
    )
    result = await db.execute(stmt)
    active_up = result.scalar_one_or_none()
    
    if not active_up:
        return None

    # 2. Загружаем структуру программы для определения тренировочных дней
    program_stmt = select(ProgramDetail.day_number).where(
        ProgramDetail.program_id == active_up.program_id
    ).distinct()
    result = await db.execute(program_stmt)
    training_days = sorted([row[0] for row in result.fetchall()])
    workouts_per_week = len(training_days)

    # Загружаем duration_weeks программы
    prog_stmt = select(Program.duration_weeks).where(Program.id == active_up.program_id)
    result = await db.execute(prog_stmt)
    duration_weeks = result.scalar() or 1
    total_workout_days = workouts_per_week * duration_weeks

    # 3. Выполненные тренировки с датами
    logs_stmt = select(WorkoutLog).where(
        and_(
            WorkoutLog.user_id == current_user.id,
            WorkoutLog.program_id == active_up.program_id
        )
    ).order_by(WorkoutLog.completed_at)
    result = await db.execute(logs_stmt)
    logs = result.scalars().all()
    completed_workouts_count = len(logs)

    # 4. Текущая неделя — считаем по реальному числу тренировок в неделе
    current_week = (completed_workouts_count // workouts_per_week) + 1 if workouts_per_week > 0 else 1

    # 5. Процент прогресса
    progress_percent = round(min(100, (completed_workouts_count / total_workout_days) * 100)) if total_workout_days > 0 else 0

    # 6. Сегодняшний день недели
    today = date.today()
    current_day_of_week = today.isoweekday()

    # 7. Выполнена ли тренировка сегодня
    start_of_day = datetime.combine(today, datetime.min.time())
    end_of_day = datetime.combine(today, datetime.max.time())

    todays_log_stmt = select(WorkoutLog).where(
        and_(
            WorkoutLog.user_id == current_user.id,
            WorkoutLog.program_id == active_up.program_id,
            WorkoutLog.completed_at >= start_of_day,
            WorkoutLog.completed_at <= end_of_day
        )
    )
    result = await db.execute(todays_log_stmt)
    todays_log = result.scalars().first()

    return {
        "current_week": current_week,
        "current_day_of_week": current_day_of_week,
        "completed_workouts": completed_workouts_count,
        "total_workout_days": total_workout_days,
        "workouts_per_week": workouts_per_week,
        "duration_weeks": duration_weeks,
        "training_days": training_days,
        "progress_percent": progress_percent,
        "is_completed_today": todays_log is not None,
        "start_date": active_up.start_date,
    }


@router.post("/log", response_model=WorkoutLogResponse)
async def log_workout(
    log_data: WorkoutLogCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Записать выполненную тренировку
    """
    # Check if already logged today for this program
    today = date.today()
    start_of_day = datetime.combine(today, datetime.min.time())
    end_of_day = datetime.combine(today, datetime.max.time())

    existing_log_stmt = select(WorkoutLog).where(
        and_(
            WorkoutLog.user_id == current_user.id,
            WorkoutLog.program_id == log_data.program_id,
            WorkoutLog.completed_at >= start_of_day,
            WorkoutLog.completed_at <= end_of_day
        )
    )
    existing_log_result = await db.execute(existing_log_stmt)
    existing_log = existing_log_result.scalars().first()

    if existing_log:
        # Update existing log instead of creating new one
        existing_log.duration_minutes = log_data.duration_minutes
        existing_log.notes = log_data.notes
        
        await db.commit()
        await db.refresh(existing_log)
        
        # Обновим время последнего взаимодействия в UserProgram
        await db.execute(
            update(UserProgram)
            .where(
                and_(
                    UserProgram.user_id == current_user.id,
                    UserProgram.program_id == log_data.program_id
                )
            )
            .values(last_interaction_at=datetime.utcnow())
        )
        await db.commit()
        
        return existing_log

    # Создаем запись
    log = WorkoutLog(
        user_id=current_user.id,
        program_id=log_data.program_id,
        day_number=log_data.day_number,
        completed_at=log_data.completed_at or datetime.now(),
        duration_minutes=log_data.duration_minutes,
        notes=log_data.notes
    )
    
    db.add(log)
    
    # Обновляем last_interaction_at
    # Если это первая тренировка, UserProgram уже должен быть created/updated в start_program
    # Но на всякий случай ensure
    
    # Также здесь можно обновить статус на STARTED, если он был SAVED?
    # Логика: если юзер залогировал тренировку, значит программа активна/начата.
    
    # 1. Находим UserProgram
    up_stmt = select(UserProgram).where(
        and_(
            UserProgram.user_id == current_user.id,
            UserProgram.program_id == log_data.program_id
        )
    )
    up_result = await db.execute(up_stmt)
    user_program = up_result.scalar_one_or_none()
    
    if user_program:
        user_program.last_interaction_at = datetime.utcnow()
        if user_program.status == ProgramStatus.SAVED:
            user_program.status = ProgramStatus.STARTED
            user_program.is_active = True # Делаем активной?
            if not user_program.start_date:
                user_program.start_date = datetime.utcnow()
    
    await db.commit()
    await db.refresh(log)
    
    return log


@router.get("/history", response_model=List[WorkoutLogResponse])
async def get_workout_history(
    skip: int = 0,
    limit: int = 50,
    program_id: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Получить историю тренировок
    """
    query = select(WorkoutLog).where(WorkoutLog.user_id == current_user.id)
    
    if program_id:
        query = query.where(WorkoutLog.program_id == program_id)
        
    query = query.order_by(desc(WorkoutLog.completed_at)).offset(skip).limit(limit)
    
    result = await db.execute(query)
    logs = result.scalars().all()
    
    return logs
