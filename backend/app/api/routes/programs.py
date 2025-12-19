"""
API роутер для тренировочных программ
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, delete
from sqlalchemy.orm import selectinload
from typing import List
from uuid import UUID

from app.db.database import get_db
from app.core.dependencies import get_current_active_user, require_admin
from app.models.program import Program, ProgramDetail
from app.models.user import User
from app.schemas.program import (
    ProgramCreate,
    ProgramUpdate,
    ProgramResponse,
    ProgramWithDetails,
    ProgramDetailCreate
)

router = APIRouter()


@router.get("/", response_model=List[ProgramResponse])
async def list_programs(
    skip: int = 0,
    limit: int = 50,
    difficulty: str = None,
    muscle_group: str = None,
    public_only: bool = True,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Получить список программ
    - public_only=True: только публичные программы
    - public_only=False: публичные + свои личные программы
    - muscle_group: фильтр по группе мышц (поиск подстроки)
    """
    query = select(Program).options(
        selectinload(Program.author).selectinload(User.profile)
    )
    
    if public_only:
        query = query.where(Program.is_public == True)
    else:
        # Показываем публичные и свои личные программы
        query = query.where(
            or_(
                Program.is_public == True,
                Program.author_id == current_user.id
            )
        )
    
    if difficulty:
        query = query.where(Program.difficulty == difficulty)
        
    if muscle_group:
        # Используем ilike для поиска без учета регистра
        query = query.where(Program.target_muscle_groups.ilike(f"%{muscle_group}%"))
    
    query = query.offset(skip).limit(limit).order_by(Program.created_at.desc())
    
    result = await db.execute(query)
    programs = result.scalars().all()
    
    return programs


@router.get("/{program_id}", response_model=ProgramWithDetails)
async def get_program(
    program_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Получить программу с деталями по ID
    """
    result = await db.execute(
        select(Program)
        .options(
            selectinload(Program.details),
            selectinload(Program.author).selectinload(User.profile)
        )
        .where(Program.id == program_id)
    )
    program = result.scalar_one_or_none()
    
    if not program:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Программа не найдена"
        )
    
    # Проверяем доступ к приватной программе
    if not program.is_public and program.author_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Доступ к этой программе запрещен"
        )
    
    return program


@router.post("/", response_model=ProgramResponse, status_code=status.HTTP_201_CREATED)
async def create_program(
    program_data: ProgramCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Создать новую программу
    """
    # Создаем программу
    program_dict = program_data.model_dump(exclude={"details"})
    program = Program(
        **program_dict,
        author_id=current_user.id
    )
    
    db.add(program)
    await db.flush()
    
    # Добавляем детали программы
    if program_data.details:
        for detail_data in program_data.details:
            detail = ProgramDetail(
                program_id=program.id,
                **detail_data.model_dump()
            )
            db.add(detail)
    
    await db.commit()
    
    # Перезагружаем программу с необходимыми связями для сериализации
    result = await db.execute(
        select(Program)
        .options(
            selectinload(Program.author).selectinload(User.profile)
        )
        .where(Program.id == program.id)
    )
    program = result.scalar_one()
    
    return program


@router.put("/{program_id}", response_model=ProgramResponse)
async def update_program(
    program_id: UUID,
    program_data: ProgramUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Обновить программу
    """
    result = await db.execute(select(Program).where(Program.id == program_id))
    program = result.scalar_one_or_none()
    
    if not program:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Программа не найдена"
        )
    
    # Проверяем права на редактирование
    if program.author_id != current_user.id and current_user.role.value != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Вы не можете редактировать эту программу"
        )
    
    # Обновляем поля
    update_data = program_data.model_dump(exclude_unset=True)

    # Если переданы детали, обновляем их
    if "details" in update_data:
        details = update_data.pop("details")
        
        # Удаляем текущие детали
        await db.execute(delete(ProgramDetail).where(ProgramDetail.program_id == program_id))
        
        # Добавляем новые
        if details:
            for detail_data in details:
                detail = ProgramDetail(
                    program_id=program_id,
                    **detail_data
                )
                db.add(detail)

    for field, value in update_data.items():
        setattr(program, field, value)
    
    await db.commit()
    
    # Перезагружаем программу с необходимыми связями для сериализации
    result = await db.execute(
        select(Program)
        .options(
            selectinload(Program.author).selectinload(User.profile)
        )
        .where(Program.id == program_id)
    )
    program = result.scalar_one()
    
    return program


@router.delete("/{program_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_program(
    program_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Удалить программу
    """
    result = await db.execute(select(Program).where(Program.id == program_id))
    program = result.scalar_one_or_none()
    
    if not program:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Программа не найдена"
        )
    
    # Проверяем права на удаление
    if program.author_id != current_user.id and current_user.role.value != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Вы не можете удалить эту программу"
        )
    
    await db.delete(program)
    await db.commit()
    
    return None


@router.get("/my/programs", response_model=List[ProgramResponse])
async def get_my_programs(
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Получить свои программы
    """
    result = await db.execute(
        select(Program)
        .options(
            selectinload(Program.author).selectinload(User.profile)
        )
        .where(Program.author_id == current_user.id)
        .offset(skip)
        .limit(limit)
        .order_by(Program.created_at.desc())
    )
    programs = result.scalars().all()
    
    return programs

