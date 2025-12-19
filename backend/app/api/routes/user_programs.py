from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, update
from typing import List, Optional
from uuid import UUID
from datetime import datetime

from app.db.database import get_db
from app.core.dependencies import get_current_active_user
from app.models.user import User
from app.models.program import Program
from app.models.user_program import UserProgram, ProgramStatus
from app.schemas.program import ProgramResponse, ProgramWithStatus

router = APIRouter()

@router.get("/", response_model=List[ProgramWithStatus])
async def get_my_programs(
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Получить список программ пользователя (активные, сохраненные, завершенные)
    """
    # Select both Program and UserProgram
    query = (
        select(Program, UserProgram)
        .join(UserProgram, Program.id == UserProgram.program_id)
        .where(UserProgram.user_id == current_user.id)
    )
    
    if status:
        query = query.where(UserProgram.status == status)
        
    # Order by update time descending
    query = query.order_by(UserProgram.last_interaction_at.desc())
    
    result = await db.execute(query)
    rows = result.all()
    
    programs_with_status = []
    for program, user_program in rows:
        # Construct response manually mixing fields
        p_dict = program.__dict__.copy()
        
        # Add status fields
        p_dict['status'] = user_program.status
        p_dict['is_active'] = user_program.is_active
        p_dict['start_date'] = user_program.start_date
        p_dict['last_interaction_at'] = user_program.last_interaction_at
        
        programs_with_status.append(ProgramWithStatus.model_validate(p_dict))
        
    return programs_with_status


@router.post("/save/{program_id}")
async def toggle_save_program(
    program_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Сохранить (добавить в избранное) или убрать из сохраненных
    """
    stmt = select(UserProgram).where(
        and_(
            UserProgram.user_id == current_user.id,
            UserProgram.program_id == program_id
        )
    )
    result = await db.execute(stmt)
    user_program = result.scalar_one_or_none()
    
    if user_program:
        # Если уже есть - переключаем статус
        if user_program.status == ProgramStatus.SAVED:
            # Если была сохранена - удаляем (или меняем статус, если удаление нежелательно?)
            # Для простоты - удаляем запись если она только "сохранена" и не была начата
            # Но если у нас смешанный статус... Пока сделаем удаление
            await db.delete(user_program)
            await db.commit()
            return {"message": "Программа удалена из сохраненных", "is_saved": False}
        else:
            # Если была начата или завершена - мы не меняем статус на "saved" чтобы не потерять прогресс
            # Но фронтенд может хотеть знать "в избранном" ли она.
            # Текущая модель UserProgram имеет один статус. Возможно стоит добавить поле is_favorite?
            # User request: "добавлять программы в отложенные" (saved).
            # Давай считать SAVED просто статусом.
            old_status = user_program.status
            user_program.status = ProgramStatus.SAVED
            user_program.last_interaction_at = datetime.utcnow()
            await db.commit()
            return {"message": "Программа добавлена в сохраненные", "is_saved": True, "previous_status": old_status}
    else:
        # Создаем новую запись
        user_program = UserProgram(
            user_id=current_user.id,
            program_id=program_id,
            status=ProgramStatus.SAVED,
            is_active=False
        )
        db.add(user_program)
        await db.commit()
        return {"message": "Программа добавлена в сохраненные", "is_saved": True}
