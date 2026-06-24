import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from app.core.config import settings
from app.api import api_router
from app.db.database import init_db

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    description="API для фитнес-приложения с трекингом тренировок, питания и прогресса",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

logger = logging.getLogger(__name__)

cors_origins = settings.CORS_ORIGINS
if not isinstance(cors_origins, list):
    cors_origins = [cors_origins] if cors_origins else []

logger.info(f"🔍 CORS Configuration:")
logger.info(f"   - CORS_ORIGINS from settings: {settings.CORS_ORIGINS}")
logger.info(f"   - CORS_ORIGINS type: {type(settings.CORS_ORIGINS)}")
logger.info(f"   - Parsed cors_origins: {cors_origins}")
logger.info(f"   - Environment: {settings.ENVIRONMENT}")

if not cors_origins:
    logger.warning("⚠️  CORS_ORIGINS is empty!")

    cors_origins = ["https://fittech-psi.vercel.app"]
    logger.info(f"   - Using fallback origin: {cors_origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

logger.info(f"✅ CORS middleware configured with origins: {cors_origins}")

@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.error(f"Unhandled exception on {request.method} {request.url.path}: {exc}", exc_info=True)
    origin = request.headers.get("origin", "")
    cors_header = origin if origin in cors_origins else (cors_origins[0] if cors_origins else "*")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
        headers={
            "Access-Control-Allow-Origin": cors_header,
            "Access-Control-Allow-Credentials": "true",
        },
    )

@app.on_event("startup")
async def startup_event():
    logger = logging.getLogger(__name__)
    logger.info(f"🚀 Starting {settings.APP_NAME} v{settings.VERSION}")
    logger.info(f"Environment: {settings.ENVIRONMENT}")
    logger.info(f"CORS Origins: {settings.CORS_ORIGINS}")

    try:
        from app.db.database import engine
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        logger.info("✅ Database connection successful")
    except Exception as e:
        logger.error(f"❌ Database connection failed: {e}")

@app.get("/")
async def root():
    return {
        "app": settings.APP_NAME,
        "version": settings.VERSION,
        "status": "running",
        "docs": "/api/docs"
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

app.include_router(api_router, prefix="/api")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG
    )
