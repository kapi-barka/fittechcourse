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

HISTORY_WINDOW = 20

class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)

class ChatMessageOut(BaseModel):
    id: str
    role: str
    content: str
    created_at: str

    class Config:
        from_attributes = True

@router.post("/chat")
async def chat_with_coach(
    request: ChatRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    async def generate():

        user_msg = ChatMessage(
            user_id=current_user.id,
            role="user",
            content=request.message,
        )
        db.add(user_msg)
        await db.commit()

        hist_res = await db.execute(
            select(ChatMessage)
            .where(ChatMessage.user_id == current_user.id)
            .order_by(ChatMessage.created_at.desc())
            .limit(HISTORY_WINDOW)
        )
        history = list(reversed(hist_res.scalars().all()))

        gemini_messages = [
            {
                "role": "user" if m.role == "user" else "model",
                "parts": [{"text": m.content}],
            }
            for m in history
        ]

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

@router.get("/history")
async def get_chat_history(
    limit: int = 50,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
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

@router.delete("/history")
async def clear_chat_history(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(
        delete(ChatMessage).where(ChatMessage.user_id == current_user.id)
    )
    await db.commit()
    return {"message": "История чата очищена"}
