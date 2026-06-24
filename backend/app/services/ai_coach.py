from __future__ import annotations

import asyncio
import json
import logging
from datetime import date, datetime, timedelta
from typing import Any, AsyncGenerator, Callable, Optional

from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

_CHUNK_SIZE   = 12
_MAX_ITERS    = 8

_SYSTEM_PROMPT = f"""Ты — личный тренер. Отвечаешь коротко и по делу, как живой человек в переписке. Сегодня: {date.today().strftime('%d.%m.%Y')}.

СТИЛЬ:
- Никаких вступлений типа "Конечно!", "Отличный вопрос!", "Давай разберёмся".
- Никаких выводов типа "Надеюсь, это помогло!", "Удачи!", "Если есть вопросы — пиши".
- Сразу к сути. Максимум 4-5 предложений или коротких пунктов.
- Пиши как человек: без списков с тире, без заголовков, без markdown (**текст**, ##заголовок).
- Если нужно перечислить — просто через запятую или с новой строки без символов.

ДАННЫЕ:
- Перед ответом всегда запрашивай нужные инструменты.

- При любом вопросе о тренировках, питании или прогрессе — СНАЧАЛА вызови get_user_profile, чтобы знать цель пользователя (набор массы / похудение / рекомпозиция и т.д.) и уровень опыта.
- Для трендов питания за период — get_nutrition_summary; для конкретных продуктов и приёмов пищи («что ел вчера», «что на завтрак») — get_nutrition_logs.
- Все рекомендации должны соответствовать fitness_goal и experience_level пользователя.
- Каждый тезис — конкретная цифра из данных. Никаких общих фраз.
- "8 тренировок из 12 за месяц" — хорошо. "Тренируйся чаще" — плохо.
- "98г белка при цели 160г" — хорошо. "Следи за белком" — плохо.
- Если данных нет — скажи прямо."""

TOOL_DECLARATIONS = [
    {
        "name": "get_user_profile",
        "description": (
            "Получить профиль пользователя: имя, возраст, рост, пол, "
            "фитнес-цель (набор массы / похудение / поддержание / рельеф), "
            "уровень опыта (новичок / средний / продвинутый), "
            "уровень активности, целевой вес, дневные цели по калориям и макронутриентам, "
            "целевые замеры тела."
        ),
        "parameters": {"type": "OBJECT", "properties": {}},
    },
    {
        "name": "get_workout_history",
        "description": (
            "Получить историю тренировок пользователя за последние N дней. "
            "Возвращает дату, название программы, номер дня и длительность каждой тренировки."
        ),
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "days": {
                    "type": "INTEGER",
                    "description": "За сколько дней назад показать историю (по умолчанию 30)",
                }
            },
        },
    },
    {
        "name": "get_nutrition_summary",
        "description": (
            "Получить сводку питания за последние N дней: "
            "ежедневное потребление калорий, белков, жиров и углеводов "
            "с сравнением относительно целей пользователя."
        ),
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "days": {
                    "type": "INTEGER",
                    "description": "За сколько дней назад (по умолчанию 7)",
                }
            },
        },
    },
    {
        "name": "get_nutrition_logs",
        "description": (
            "Получить детальные записи дневника питания: продукт, порция в граммах, "
            "тип приёма пищи (завтрак/обед/ужин/перекус), дата и время, калории порции. "
            "Используй, когда пользователь спрашивает, что он ел, какие были приёмы пищи "
            "за конкретный день или период."
        ),
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "days": {
                    "type": "INTEGER",
                    "description": "За сколько последних дней показать записи (по умолчанию 7, игнорируется если указан target_date)",
                },
                "target_date": {
                    "type": "STRING",
                    "description": "Конкретная дата в формате YYYY-MM-DD (например день «вчера»). Только записи за этот день.",
                },
            },
        },
    },
    {
        "name": "get_body_metrics",
        "description": (
            "Получить историю замеров тела: вес, грудь, талия, бёдра, бицепс, бедро. "
            "Используй для анализа прогресса и сравнения с целями."
        ),
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "days": {
                    "type": "INTEGER",
                    "description": "За сколько дней назад (по умолчанию 90)",
                }
            },
        },
    },
    {
        "name": "get_active_program",
        "description": (
            "Получить текущую активную программу тренировок пользователя: "
            "название, описание, сложность, длительность, список упражнений по дням."
        ),
        "parameters": {"type": "OBJECT", "properties": {}},
    },
]

async def _tool_get_user_profile(user_id: str, db: AsyncSession) -> dict:
    from app.models.user import User, UserProfile

    res = await db.execute(
        select(User, UserProfile)
        .outerjoin(UserProfile, UserProfile.user_id == User.id)
        .where(User.id == user_id)
    )
    row = res.first()
    if not row:
        return {"error": "Профиль не найден"}

    user, p = row[0], row[1]

    def age(bd):
        if not bd:
            return None
        t = date.today()
        return t.year - bd.year - ((t.month, t.day) < (bd.month, bd.day))

    activity_map = {
        "sedentary": "сидячий", "lightly_active": "лёгкая активность",
        "moderately_active": "умеренная активность", "very_active": "высокая активность",
        "extremely_active": "очень высокая активность",
    }
    fitness_goal_map = {
        "weight_loss": "похудение", "muscle_gain": "набор мышечной массы",
        "maintenance": "поддержание формы", "body_recomposition": "рекомпозиция тела",
        "endurance": "развитие выносливости",
    }
    experience_map = {
        "beginner": "новичок", "intermediate": "средний уровень", "advanced": "продвинутый",
    }

    return {
        "name":            p.full_name if p else None,
        "email":           user.email,
        "gender":          str(p.gender) if p and p.gender else None,
        "age":             age(p.birth_date) if p else None,
        "height_cm":       p.height if p else None,
        "activity_level":  activity_map.get(str(p.activity_level or ""), str(p.activity_level)) if p else None,
        "fitness_goal":    fitness_goal_map.get(str(p.fitness_goal.value if p and p.fitness_goal else ""), None) if p and p.fitness_goal else None,
        "experience_level": experience_map.get(str(p.experience_level.value if p and p.experience_level else ""), None) if p and p.experience_level else None,
        "goals": {
            "target_weight_kg":    p.target_weight if p else None,
            "calories_per_day":    p.target_calories if p else None,
            "proteins_g":          p.target_proteins if p else None,
            "fats_g":              p.target_fats if p else None,
            "carbs_g":             p.target_carbs if p else None,
        },
        "target_measurements_cm": {
            "chest":   p.target_chest if p else None,
            "waist":   p.target_waist if p else None,
            "hips":    p.target_hips if p else None,
            "biceps":  p.target_biceps if p else None,
            "thigh":   p.target_thigh if p else None,
        },
    }

async def _tool_get_workout_history(user_id: str, db: AsyncSession, days: int = 30) -> dict:
    from app.models.program import WorkoutLog, Program

    since = datetime.combine(date.today() - timedelta(days=days), datetime.min.time())
    res = await db.execute(
        select(WorkoutLog, Program.title)
        .join(Program, WorkoutLog.program_id == Program.id, isouter=True)
        .where(WorkoutLog.user_id == user_id, WorkoutLog.completed_at >= since)
        .order_by(desc(WorkoutLog.completed_at))
        .limit(50)
    )
    rows = res.all()

    workouts = [
        {
            "date":             wl.completed_at.strftime("%d.%m.%Y"),
            "program":          title or "—",
            "day_number":       wl.day_number,
            "duration_minutes": wl.duration_minutes,
            "notes":            wl.notes,
        }
        for wl, title in rows
    ]
    return {
        "period_days": days,
        "total_workouts": len(workouts),
        "workouts": workouts,
    }

async def _tool_get_nutrition_summary(user_id: str, db: AsyncSession, days: int = 7) -> dict:
    from app.models.nutrition import NutritionLog, FoodProduct
    from app.models.user import UserProfile

    since = datetime.combine(date.today() - timedelta(days=days), datetime.min.time())

    profile_res = await db.execute(select(UserProfile).where(UserProfile.user_id == user_id))
    profile = profile_res.scalar_one_or_none()

    res = await db.execute(
        select(NutritionLog, FoodProduct)
        .join(FoodProduct, NutritionLog.product_id == FoodProduct.id)
        .where(NutritionLog.user_id == user_id, NutritionLog.eaten_at >= since)
        .order_by(NutritionLog.eaten_at)
    )
    rows = res.all()

    daily: dict[str, dict] = {}
    for log, prod in rows:
        day = log.eaten_at.strftime("%d.%m")
        if day not in daily:
            daily[day] = {"calories": 0.0, "proteins": 0.0, "fats": 0.0, "carbs": 0.0}
        f = log.weight_g / 100.0
        daily[day]["calories"] += prod.calories * f
        daily[day]["proteins"] += prod.proteins * f
        daily[day]["fats"]     += prod.fats     * f
        daily[day]["carbs"]    += prod.carbs     * f

    for d in daily.values():
        for k in d:
            d[k] = round(d[k], 1)

    return {
        "period_days": days,
        "targets": {
            "calories": profile.target_calories if profile else None,
            "proteins": profile.target_proteins if profile else None,
            "fats":     profile.target_fats     if profile else None,
            "carbs":    profile.target_carbs     if profile else None,
        },
        "daily": daily,
        "days_tracked": len(daily),
    }

_MEAL_TYPE_LABELS = {
    "breakfast": "завтрак",
    "lunch": "обед",
    "dinner": "ужин",
    "snack": "перекус",
    "other": "другое",
}

async def _tool_get_nutrition_logs(
    user_id: str,
    db: AsyncSession,
    days: int = 7,
    target_date: Optional[str] = None,
) -> dict:
    from app.models.nutrition import NutritionLog, FoodProduct

    query = (
        select(NutritionLog, FoodProduct)
        .join(FoodProduct, NutritionLog.product_id == FoodProduct.id)
        .where(NutritionLog.user_id == user_id)
    )

    period_label: str
    if target_date:
        try:
            day = datetime.strptime(target_date, "%Y-%m-%d").date()
        except ValueError:
            return {"error": "target_date должен быть в формате YYYY-MM-DD", "entries": []}
        day_start = datetime.combine(day, datetime.min.time())
        day_end = datetime.combine(day, datetime.max.time())
        query = query.where(
            NutritionLog.eaten_at >= day_start,
            NutritionLog.eaten_at <= day_end,
        )
        period_label = day.strftime("%d.%m.%Y")
    else:
        since = datetime.combine(date.today() - timedelta(days=days), datetime.min.time())
        query = query.where(NutritionLog.eaten_at >= since)
        period_label = f"последние {days} дн."

    res = await db.execute(
        query.order_by(desc(NutritionLog.eaten_at)).limit(80)
    )
    rows = res.all()

    entries = []
    for log, prod in rows:
        factor = log.weight_g / 100.0
        entries.append({
            "date": log.eaten_at.strftime("%d.%m.%Y"),
            "time": log.eaten_at.strftime("%H:%M"),
            "meal_type": _MEAL_TYPE_LABELS.get(log.meal_type or "", log.meal_type or "—"),
            "product": prod.name,
            "brand": prod.brand,
            "weight_g": round(log.weight_g, 1),
            "calories": round(prod.calories * factor, 1),
            "proteins_g": round(prod.proteins * factor, 1),
            "notes": log.notes,
        })

    return {
        "period": period_label,
        "total_entries": len(entries),
        "entries": entries,
    }

async def _tool_get_body_metrics(user_id: str, db: AsyncSession, days: int = 90) -> dict:
    from app.models.metrics import BodyMetric
    from app.models.user import UserProfile

    since = date.today() - timedelta(days=days)
    res = await db.execute(
        select(BodyMetric)
        .where(BodyMetric.user_id == user_id, BodyMetric.date >= since)
        .order_by(desc(BodyMetric.date))
        .limit(20)
    )
    metrics = res.scalars().all()

    profile_res = await db.execute(select(UserProfile).where(UserProfile.user_id == user_id))
    profile = profile_res.scalar_one_or_none()

    return {
        "period_days": days,
        "targets": {
            "weight_kg": profile.target_weight  if profile else None,
            "chest_cm":  profile.target_chest   if profile else None,
            "waist_cm":  profile.target_waist   if profile else None,
            "hips_cm":   profile.target_hips    if profile else None,
            "biceps_cm": profile.target_biceps  if profile else None,
            "thigh_cm":  profile.target_thigh   if profile else None,
        },
        "measurements": [
            {
                "date":      str(m.date),
                "weight":    m.weight,
                "chest":     m.chest,
                "waist":     m.waist,
                "hips":      m.hips,
                "biceps":    m.biceps,
                "thigh":     m.thigh,
            }
            for m in metrics
        ],
    }

async def _tool_get_active_program(user_id: str, db: AsyncSession) -> dict:
    from app.models.user import UserProfile
    from app.models.program import Program, ProgramDetail
    from app.models.exercise import Exercise

    profile_res = await db.execute(select(UserProfile).where(UserProfile.user_id == user_id))
    profile = profile_res.scalar_one_or_none()

    if not profile or not profile.current_program_id:
        return {"active_program": None, "message": "Программа не выбрана"}

    prog_res = await db.execute(select(Program).where(Program.id == profile.current_program_id))
    program = prog_res.scalar_one_or_none()
    if not program:
        return {"active_program": None, "message": "Программа не найдена"}

    details_res = await db.execute(
        select(ProgramDetail, Exercise)
        .join(Exercise, ProgramDetail.exercise_id == Exercise.id)
        .where(ProgramDetail.program_id == program.id)
        .order_by(ProgramDetail.day_number, ProgramDetail.order)
    )
    details = details_res.all()

    days: dict[int, list] = {}
    for det, ex in details:
        days.setdefault(det.day_number, []).append({
            "exercise":    ex.name,
            "sets":        det.sets,
            "reps":        det.reps,
            "rest_sec":    det.rest_time,
            "muscle_groups": ex.muscle_groups,
        })

    return {
        "name":        program.title,
        "description": program.description,
        "difficulty":  program.difficulty,
        "weeks":       program.duration_weeks,
        "days":        days,
    }

def _make_executor(user_id: str, db: AsyncSession) -> Callable:
    async def execute(name: str, args: dict) -> dict:
        days = int(args.get("days", 30))
        try:
            if name == "get_user_profile":
                return await _tool_get_user_profile(user_id, db)
            elif name == "get_workout_history":
                return await _tool_get_workout_history(user_id, db, days)
            elif name == "get_nutrition_summary":
                return await _tool_get_nutrition_summary(user_id, db, days)
            elif name == "get_nutrition_logs":
                target_date = args.get("target_date")
                if isinstance(target_date, str):
                    target_date = target_date.strip() or None
                else:
                    target_date = None
                return await _tool_get_nutrition_logs(
                    user_id, db, days=days, target_date=target_date
                )
            elif name == "get_body_metrics":
                return await _tool_get_body_metrics(user_id, db, days)
            elif name == "get_active_program":
                return await _tool_get_active_program(user_id, db)
            else:
                return {"error": f"Неизвестный инструмент: {name}"}
        except Exception as exc:
            logger.error(f"Tool {name} failed: {exc}", exc_info=True)
            return {"error": str(exc)}
    return execute

async def _get_available_gemini_model(api_key: str) -> Optional[tuple[str, str]]:
    return "v1beta", "gemini-2.5-flash"

async def _gemini_request(
    contents: list[dict],
    api_ver: str,
    model: str,
    api_key: str,
) -> dict:
    import httpx

    payload: dict[str, Any] = {
        "contents": contents,
        "tools": [{"functionDeclarations": TOOL_DECLARATIONS}],
        "generationConfig": {"temperature": 0.7, "maxOutputTokens": 8192},
    }

    url = (
        f"https://generativelanguage.googleapis.com/{api_ver}"
        f"/models/{model}:generateContent?key={api_key}"
    )
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(url, json=payload)
        if resp.status_code != 200:
            raise RuntimeError(f"Gemini HTTP {resp.status_code}: {resp.text[:300]}")
        return resp.json()

async def _agentic_loop(
    conversation: list[dict],
    executor: Callable,
    api_ver: str,
    model: str,
    api_key: str,
) -> AsyncGenerator[str, None]:
    for iteration in range(_MAX_ITERS):
        response = await _gemini_request(conversation, api_ver, model, api_key)

        logger.info(f"Gemini raw response: {json.dumps(response, ensure_ascii=False)[:800]}")

        candidate = response.get("candidates", [{}])[0]
        finish_reason = candidate.get("finishReason", "")
        content = candidate.get("content") or {}
        parts = content.get("parts", [])

        logger.info(f"finishReason={finish_reason}, parts_count={len(parts)}, parts={json.dumps(parts, ensure_ascii=False)[:400]}")

        function_calls = [p["functionCall"] for p in parts if "functionCall" in p]
        text_parts     = [p["text"] for p in parts if "text" in p]

        if function_calls:

            conversation.append({"role": "model", "parts": parts})

            responses = []
            for fc in function_calls:
                name = fc["name"]
                args = fc.get("args", {})
                logger.info(f"Tool call [{iteration+1}]: {name}({args})")
                result = await executor(name, args)
                responses.append({
                    "functionResponse": {
                        "name": name,
                        "response": result,
                    }
                })

            conversation.append({"role": "user", "parts": responses})

        elif text_parts:

            text = "".join(text_parts)
            logger.info(f"AI coach final answer ({len(text)} chars, {iteration+1} iters)")
            for i in range(0, len(text), _CHUNK_SIZE):
                yield text[i: i + _CHUNK_SIZE]
                await asyncio.sleep(0.015)
            return

        else:

            yield "Не удалось получить ответ от AI."
            return

    yield "\n\n⚠️ Достигнут лимит итераций. Попробуйте переформулировать вопрос."

async def stream_coach_response(
    messages: list[dict],
    user_id: str,
    db: AsyncSession,
    gemini_api_key: Optional[str],
    vertex_project: Optional[str] = None,
    vertex_location: str = "us-central1",
) -> AsyncGenerator[str, None]:
    if not gemini_api_key and not vertex_project:
        raise ValueError("Не задан ни GOOGLE_GEMINI_API_KEY, ни GOOGLE_CLOUD_PROJECT")

    model_info = await _get_available_gemini_model(gemini_api_key)
    if not model_info:
        raise RuntimeError("Не удалось определить доступную Gemini-модель")
    api_ver, model = model_info

    conversation: list[dict] = [
        {"role": "user",  "parts": [{"text": _SYSTEM_PROMPT}]},
        {"role": "model", "parts": [{"text": "Понял, готов помогать."}]},
        *messages,
    ]

    executor = _make_executor(user_id, db)

    async for chunk in _agentic_loop(conversation, executor, api_ver, model, api_key=gemini_api_key):
        yield chunk
