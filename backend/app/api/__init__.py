"""
API роутеры
"""
from fastapi import APIRouter
from app.api.routes import auth, users, programs, nutrition, articles, exercises, metrics, schedule, upload, user_programs, analytics

api_router = APIRouter()

# Подключаем все роутеры
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(upload.router, prefix="/upload", tags=["Upload"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
api_router.include_router(exercises.router, prefix="/exercises", tags=["Exercises"])
api_router.include_router(programs.router, prefix="/programs", tags=["Programs"])
api_router.include_router(schedule.router, prefix="/schedule", tags=["Schedule"])
api_router.include_router(metrics.router, prefix="/metrics", tags=["Body Metrics"])
api_router.include_router(nutrition.router, prefix="/nutrition", tags=["Nutrition"])
api_router.include_router(articles.router, prefix="/articles", tags=["Articles"])
api_router.include_router(user_programs.router, prefix="/my", tags=["User Programs"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["Analytics"])

