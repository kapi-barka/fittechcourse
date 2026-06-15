"""
API для умных рекомендаций тренировок.

Движок рекомендаций использует три угла анализа:
  1. Weak Point     — дельта между целевыми и текущими замерами тела
  2. Recovery       — исключает мышцы, нагруженные за последние 48ч
  3. Nutrition Sync — корректирует объём нагрузки по вчерашнему белку
"""
import logging
from fastapi import APIRouter, Depends, HTTPException

logger = logging.getLogger(__name__)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, or_, desc
from sqlalchemy.orm import selectinload
from typing import List, Optional
from datetime import datetime, date, timedelta
from uuid import UUID

from app.db.database import get_db
from app.core.dependencies import get_current_active_user
from app.models.user import User, UserProfile
from app.models.metrics import BodyMetric
from app.models.exercise import Exercise
from app.models.program import ProgramDetail, WorkoutLog
from app.models.recommendation import (
    WorkoutRecommendation, ExercisePerformanceLog,
    RecommendationReason, RecommendationStatus,
)
from app.models.nutrition import NutritionLog
from app.schemas.recommendation import (
    WorkoutRecommendationResponse,
    ExercisePerformanceLogCreate,
    ExercisePerformanceLogResponse,
)

router = APIRouter()

# ──────────────────────────────────────────────────────
# Mapping: measurement key → muscle keyword substrings
# ──────────────────────────────────────────────────────
MEASUREMENT_MUSCLE_MAP: dict[str, list[str]] = {
    "chest":  ["chest", "pectoral"],
    "biceps": ["bicep", "forearm"],
    "waist":  ["abs", "oblique", "core"],
    "hips":   ["glute", "hamstring"],
    "thigh":  ["quad", "hamstring", "glute"],
}

MEASUREMENT_NAMES_RU: dict[str, str] = {
    "chest":  "Грудь",
    "biceps": "Бицепс",
    "waist":  "Талия",
    "hips":   "Бёдра",
    "thigh":  "Бедро (нога)",
}


# ──────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────

async def _get_fatigued_muscles(user_id: UUID, db: AsyncSession) -> list[str]:
    """
    Возвращает список мышечных групп (lower-case), которые были
    нагружены за последние 48 часов.
    Источники: WorkoutLog (программы) + ExercisePerformanceLog (рекомендации / свободные).
    """
    try:
        since = datetime.utcnow() - timedelta(hours=48)
        fatigued: set[str] = set()

        # Источник 1: тренировки по программе
        logs_result = await db.execute(
            select(WorkoutLog).where(
                and_(WorkoutLog.user_id == user_id, WorkoutLog.completed_at >= since)
            )
        )
        recent_logs = logs_result.scalars().all()

        for log in recent_logs:
            details_result = await db.execute(
                select(ProgramDetail)
                .options(selectinload(ProgramDetail.exercise))
                .where(
                    and_(
                        ProgramDetail.program_id == log.program_id,
                        ProgramDetail.day_number == log.day_number,
                    )
                )
            )
            for detail in details_result.scalars().all():
                if detail.exercise and detail.exercise.muscle_groups:
                    fatigued.update(m.lower() for m in detail.exercise.muscle_groups)

        # Источник 2: выполненные упражнения из рекомендаций и свободных тренировок
        perf_result = await db.execute(
            select(ExercisePerformanceLog)
            .options(selectinload(ExercisePerformanceLog.exercise))
            .where(
                and_(
                    ExercisePerformanceLog.user_id == user_id,
                    ExercisePerformanceLog.logged_at >= since,
                )
            )
        )
        for perf in perf_result.scalars().all():
            if perf.exercise and perf.exercise.muscle_groups:
                fatigued.update(m.lower() for m in perf.exercise.muscle_groups)

        return list(fatigued)
    except Exception as e:
        logger.warning(f"_get_fatigued_muscles failed: {e}")
        return []


def _compute_weak_points(profile: UserProfile | None, metrics: list[BodyMetric]) -> list[dict]:
    """
    Возвращает список отстающих замеров, отсортированных по дефициту (убывание).
    Для талии — цель снижение (current > target), для остальных — рост (target > current).
    Мёрджит последние 50 замеров: для каждого поля берётся последнее ненулевое значение.
    """
    if not profile or not metrics:
        return []

    def latest(field: str):
        for m in metrics:
            v = getattr(m, field, None)
            if v is not None:
                return v
        return None

    checks = [
        ("chest",  profile.target_chest,  latest("chest")),
        ("biceps", profile.target_biceps, latest("biceps")),
        ("hips",   profile.target_hips,   latest("hips")),
        ("thigh",  profile.target_thigh,  latest("thigh")),
        ("waist",  profile.target_waist,  latest("waist")),
    ]

    weak_points = []
    for key, target, current in checks:
        if target is None or current is None:
            continue
        deficit = (current - target) if key == "waist" else (target - current)
        if deficit > 0.5:
            weak_points.append({
                "measurement": key,
                "current": round(current, 1),
                "target":  round(target, 1),
                "deficit": round(deficit, 1),
                "muscles": MEASUREMENT_MUSCLE_MAP.get(key, []),
            })

    return sorted(weak_points, key=lambda x: x["deficit"], reverse=True)


async def _sum_protein_for_day(user_id: UUID, day: date, db: AsyncSession) -> float:
    logs_result = await db.execute(
        select(NutritionLog)
        .options(selectinload(NutritionLog.product))
        .where(
            and_(
                NutritionLog.user_id == user_id,
                func.date(NutritionLog.eaten_at) == day,
            )
        )
    )
    logs = logs_result.scalars().all()
    return sum(
        (log.product.proteins * log.weight_g / 100)
        for log in logs
        if log.product and log.product.proteins
    )


async def _get_nutrition_modifier(
    user_id: UUID,
    profile: Optional[UserProfile],
    db: AsyncSession,
    reference_date: Optional[date] = None,
) -> dict:
    """
    Вычисляет модификатор объёма нагрузки на основе вчерашнего потребления белка.
    Если за вчера нет записей — использует сегодняшний день (для демо и начала дня).
    """
    _default = {
        "yesterday_protein": 0.0,
        "today_protein": 0.0,
        "display_protein": 0.0,
        "protein_label": "yesterday",
        "target_protein": None,
        "protein_ratio": 1.0,
        "volume_modifier": "normal",
    }
    try:
        today = reference_date or date.today()
        yesterday = today - timedelta(days=1)

        yesterday_protein = await _sum_protein_for_day(user_id, yesterday, db)
        today_protein = await _sum_protein_for_day(user_id, today, db)

        use_today = yesterday_protein <= 0 and today_protein > 0
        protein_for_modifier = today_protein if use_today else yesterday_protein
        display_protein = protein_for_modifier

        target_protein = profile.target_proteins if profile and profile.target_proteins else None
        ratio = (protein_for_modifier / target_protein) if target_protein and target_protein > 0 else 1.0

        return {
            "yesterday_protein": round(yesterday_protein, 1),
            "today_protein": round(today_protein, 1),
            "display_protein": round(display_protein, 1),
            "protein_label": "today" if use_today else "yesterday",
            "target_protein": target_protein,
            "protein_ratio": round(ratio, 2),
            "volume_modifier": "low" if ratio < 0.7 else ("high" if ratio > 1.1 else "normal"),
        }
    except Exception as e:
        logger.warning(f"_get_nutrition_modifier failed: {e}")
        return _default


async def _attach_fresh_nutrition_context(
    rec: WorkoutRecommendation,
    user_id: UUID,
    db: AsyncSession,
    reference_date: date,
) -> WorkoutRecommendation:
    """Обновляет блок nutrition в context актуальными данными питания."""
    profile_result = await db.execute(
        select(UserProfile).where(UserProfile.user_id == user_id)
    )
    profile = profile_result.scalar_one_or_none()
    nutrition_info = await _get_nutrition_modifier(user_id, profile, db, reference_date)
    ctx = dict(rec.context or {})
    ctx["nutrition"] = nutrition_info
    rec.context = ctx
    return rec


def _apply_volume(base_sets: int, modifier: str) -> int:
    if modifier == "low":
        return max(2, base_sets - 1)
    if modifier == "high":
        return base_sets + 1
    return base_sets


async def _find_exercises(
    include_keywords: list[str],
    exclude_keywords: list[str],
    db: AsyncSession,
    limit: int = 6,
) -> list[Exercise]:
    try:
        query = select(Exercise)

        if include_keywords:
            include_cond = [
                func.array_to_string(Exercise.muscle_groups, ",").ilike(f"%{kw}%")
                for kw in include_keywords
            ]
            query = query.where(or_(*include_cond))

        if exclude_keywords:
            exclude_cond = [
                func.array_to_string(Exercise.muscle_groups, ",").ilike(f"%{kw}%")
                for kw in exclude_keywords
            ]
            query = query.where(~or_(*exclude_cond))

        query = query.order_by(func.random()).limit(limit)
        result = await db.execute(query)
        return result.scalars().all()
    except Exception as e:
        logger.warning(f"_find_exercises failed: {e}")
        return []


# ──────────────────────────────────────────────────────
# Core recommendation engine
# ──────────────────────────────────────────────────────

async def _generate(
    user_id: UUID,
    db: AsyncSession,
    reference_date: Optional[date] = None,
) -> WorkoutRecommendation:
    # Load profile
    profile_result = await db.execute(
        select(UserProfile).where(UserProfile.user_id == user_id)
    )
    profile = profile_result.scalar_one_or_none()

    # Load last 50 body metrics for merged weak-point analysis
    metric_result = await db.execute(
        select(BodyMetric)
        .where(BodyMetric.user_id == user_id)
        .order_by(desc(BodyMetric.date))
        .limit(50)
    )
    recent_metrics = metric_result.scalars().all()

    # Analysis
    fatigued_muscles = await _get_fatigued_muscles(user_id, db)
    weak_points      = _compute_weak_points(profile, recent_metrics)
    nutrition_info   = await _get_nutrition_modifier(user_id, profile, db, reference_date)
    volume_mod       = nutrition_info["volume_modifier"]

    context = {
        "analyzed_at":    datetime.utcnow().isoformat(),
        "reference_date": (reference_date or date.today()).isoformat(),
        "fatigued_muscles": fatigued_muscles,
        "weak_points":    weak_points,
        "nutrition":      nutrition_info,
    }

    # Filter weak points: remove fatigued muscle groups
    available_weak = [
        wp for wp in weak_points
        if not any(fm in m for fm in fatigued_muscles for m in wp["muscles"])
    ]

    reason = RecommendationReason.FREE_DAY
    rec_exercises: list[dict] = []

    if available_weak:
        reason = RecommendationReason.WEAK_POINT
        target_keywords: list[str] = []
        for wp in available_weak[:2]:  # top-2 weak points
            target_keywords.extend(wp["muscles"])

        exercises = await _find_exercises(target_keywords, fatigued_muscles, db, limit=5)
        for ex in exercises:
            wp_match = next(
                (wp for wp in available_weak if any(m in (ex.muscle_groups or []) for m in wp["muscles"])),
                None,
            )
            reason_text = (
                f"Отставание «{MEASUREMENT_NAMES_RU.get(wp_match['measurement'], '')}»: "
                f"+{wp_match['deficit']} см до цели"
                if wp_match else "Рекомендовано для развития"
            )
            rec_exercises.append({
                "exercise_id":   str(ex.id),
                "exercise_name": ex.name,
                "muscle_groups": ex.muscle_groups or [],
                "sets":     _apply_volume(3, volume_mod),
                "reps":     12,
                "rest_time": 60,
                "reason":   reason_text,
            })

    elif fatigued_muscles:
        # All weak points are fatigued → recovery session on fresh muscles
        reason = RecommendationReason.RECOVERY
        exercises = await _find_exercises([], fatigued_muscles, db, limit=6)
        for ex in exercises:
            rec_exercises.append({
                "exercise_id":   str(ex.id),
                "exercise_name": ex.name,
                "muscle_groups": ex.muscle_groups or [],
                "sets":     _apply_volume(2, volume_mod),
                "reps":     15,
                "rest_time": 45,
                "reason":   "Восстановительная тренировка — целевые мышцы ещё не отдохнули",
            })

    else:
        # No data → free session
        exercises = await _find_exercises([], [], db, limit=5)
        for ex in exercises:
            rec_exercises.append({
                "exercise_id":   str(ex.id),
                "exercise_name": ex.name,
                "muscle_groups": ex.muscle_groups or [],
                "sets":     _apply_volume(3, volume_mod),
                "reps":     12,
                "rest_time": 60,
                "reason":   "Свободная тренировка",
            })

    try:
        rec = WorkoutRecommendation(
            user_id=user_id,
            reason=reason,
            exercises=rec_exercises,
            status=RecommendationStatus.PENDING,
            context=context,
        )
        db.add(rec)
        await db.commit()
        await db.refresh(rec)
        return rec
    except Exception as e:
        await db.rollback()
        logger.error(f"Failed to save recommendation: {e}")
        raise


# ──────────────────────────────────────────────────────
# Routes
# ──────────────────────────────────────────────────────

@router.get("/today", response_model=WorkoutRecommendationResponse)
async def get_today_recommendation(
    target_date: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Вернуть рекомендацию за день или сгенерировать новую."""
    user_id = current_user.id  # cache before try to avoid MissingGreenlet on expired ORM object
    try:
        target = target_date or date.today()
        result = await db.execute(
            select(WorkoutRecommendation)
            .where(
                and_(
                    WorkoutRecommendation.user_id == user_id,
                    func.date(WorkoutRecommendation.generated_at) == target,
                    WorkoutRecommendation.status != RecommendationStatus.SKIPPED,
                )
            )
            .order_by(desc(WorkoutRecommendation.generated_at))
        )
        existing = result.scalars().first()
        if existing:
            return await _attach_fresh_nutrition_context(existing, user_id, db, target)
        return await _generate(user_id, db, reference_date=target)
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"GET /recommendations/today failed for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Не удалось загрузить рекомендацию")


@router.post("/generate", response_model=WorkoutRecommendationResponse)
async def force_generate(
    target_date: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Принудительно сгенерировать новую рекомендацию."""
    user_id = current_user.id
    try:
        return await _generate(user_id, db, reference_date=target_date or date.today())
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"POST /recommendations/generate failed for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Не удалось сгенерировать рекомендацию")


@router.post("/{recommendation_id}/accept")
async def accept_recommendation(
    recommendation_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    result = await db.execute(
        select(WorkoutRecommendation).where(
            and_(
                WorkoutRecommendation.id == recommendation_id,
                WorkoutRecommendation.user_id == current_user.id,
            )
        )
    )
    rec = result.scalar_one_or_none()
    if not rec:
        raise HTTPException(status_code=404, detail="Рекомендация не найдена")
    rec.status = RecommendationStatus.ACCEPTED
    await db.commit()
    return {"status": "accepted"}


@router.post("/{recommendation_id}/complete")
async def complete_recommendation(
    recommendation_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    result = await db.execute(
        select(WorkoutRecommendation).where(
            and_(
                WorkoutRecommendation.id == recommendation_id,
                WorkoutRecommendation.user_id == current_user.id,
            )
        )
    )
    rec = result.scalar_one_or_none()
    if not rec:
        raise HTTPException(status_code=404, detail="Рекомендация не найдена")
    rec.status = RecommendationStatus.COMPLETED
    await db.commit()
    return {"status": "completed"}


@router.post("/{recommendation_id}/skip")
async def skip_recommendation(
    recommendation_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    result = await db.execute(
        select(WorkoutRecommendation).where(
            and_(
                WorkoutRecommendation.id == recommendation_id,
                WorkoutRecommendation.user_id == current_user.id,
            )
        )
    )
    rec = result.scalar_one_or_none()
    if not rec:
        raise HTTPException(status_code=404, detail="Рекомендация не найдена")
    rec.status = RecommendationStatus.SKIPPED
    await db.commit()
    return {"status": "skipped"}


@router.get("/history", response_model=List[WorkoutRecommendationResponse])
async def get_history(
    skip: int = 0,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    result = await db.execute(
        select(WorkoutRecommendation)
        .where(WorkoutRecommendation.user_id == current_user.id)
        .order_by(desc(WorkoutRecommendation.generated_at))
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()


@router.post("/log-exercise", response_model=ExercisePerformanceLogResponse)
async def log_exercise_performance(
    data: ExercisePerformanceLogCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Записать фактическое выполнение упражнения (подходы, повторения, вес)."""
    log = ExercisePerformanceLog(user_id=current_user.id, **data.model_dump())
    db.add(log)
    await db.commit()
    await db.refresh(log)
    return log
