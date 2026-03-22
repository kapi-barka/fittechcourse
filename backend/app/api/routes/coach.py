"""
AI-тренер: эндпоинты для чата, истории и очистки истории.

POST /coach/chat        — стримит ответ AI через SSE
GET  /coach/history     — последние N сообщений
DELETE /coach/history   — очистить историю чата
"""
import json
import logging
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.dependencies import get_current_active_user
from app.db.database import get_db
from app.models.user import User
from app.models.chat import ChatMessage
from app.services.ai_coach import stream_coach_response

logger = logging.getLogger(__name__)
router = APIRouter()

HISTORY_WINDOW = 20  # кол-во сообщений, передаваемых в контекст Gemini


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)


class ChatMessageOut(BaseModel):
    id: str
    role: str
    content: str
    created_at: str

    class Config:
        from_attributes = True


# ─────────────────────────────────────────────────
# POST /coach/chat  — SSE-стрим
# ─────────────────────────────────────────────────

@router.post("/chat")
async def chat_with_coach(
    request: ChatRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Принимает сообщение пользователя, формирует контекст из его данных,
    запрашивает Gemini и возвращает ответ в виде Server-Sent Events.

    Формат событий:
      data: {"type": "chunk", "text": "..."}  — порция текста
      data: {"type": "done"}                  — конец стрима
      data: {"type": "error", "text": "..."}  — ошибка
    """
    async def generate():
        # 1. Сохраняем сообщение пользователя
        user_msg = ChatMessage(
            user_id=current_user.id,
            role="user",
            content=request.message,
        )
        db.add(user_msg)
        await db.commit()

        # 2. Загружаем историю (последние HISTORY_WINDOW сообщений)
        hist_res = await db.execute(
            select(ChatMessage)
            .where(ChatMessage.user_id == current_user.id)
            .order_by(ChatMessage.created_at.desc())
            .limit(HISTORY_WINDOW)
        )
        history = list(reversed(hist_res.scalars().all()))

        # 4. Конвертируем в формат Gemini
        gemini_messages = [
            {
                "role": "user" if m.role == "user" else "model",
                "parts": [{"text": m.content}],
            }
            for m in history
        ]

        # 5. Стримим ответ (agentic loop с function calling)
        full_response = ""
        try:
            async for chunk in stream_coach_response(
                messages=gemini_messages,
                user_id=str(current_user.id),
                db=db,
                gemini_api_key=settings.GOOGLE_GEMINI_API_KEY,
                vertex_project=getattr(settings, "GOOGLE_CLOUD_PROJECT", None),
                vertex_location=getattr(settings, "GOOGLE_CLOUD_LOCATION", "us-central1"),
            ):
                full_response += chunk
                yield f"data: {json.dumps({'type': 'chunk', 'text': chunk}, ensure_ascii=False)}\n\n"
        except Exception as exc:
            logger.error(f"Coach stream error: {exc}")
            err_text = "Ошибка соединения с AI. Попробуйте позже."
            yield f"data: {json.dumps({'type': 'error', 'text': err_text})}\n\n"
            return

        # 6. Сохраняем ответ ассистента
        if full_response:
            assistant_msg = ChatMessage(
                user_id=current_user.id,
                role="assistant",
                content=full_response,
            )
            db.add(assistant_msg)
            await db.commit()

        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


# ─────────────────────────────────────────────────
# GET /coach/history
# ─────────────────────────────────────────────────

@router.get("/history")
async def get_chat_history(
    limit: int = 50,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Возвращает последние `limit` сообщений чата."""
    res = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.user_id == current_user.id)
        .order_by(ChatMessage.created_at.asc())
        .limit(limit)
    )
    messages = res.scalars().all()
    return [
        {
            "id": str(m.id),
            "role": m.role,
            "content": m.content,
            "created_at": m.created_at.isoformat(),
        }
        for m in messages
    ]


# ─────────────────────────────────────────────────
# DELETE /coach/history
# ─────────────────────────────────────────────────

@router.delete("/history")
async def clear_chat_history(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Удаляет всю историю чата текущего пользователя."""
    await db.execute(
        delete(ChatMessage).where(ChatMessage.user_id == current_user.id)
    )
    await db.commit()
    return {"message": "История чата очищена"}
