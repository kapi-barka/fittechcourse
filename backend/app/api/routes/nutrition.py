"""
API роутер для питания и трекинга калорий
"""
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List
from datetime import date, datetime
from uuid import UUID
import io
import logging

from app.db.database import get_db
from app.core.dependencies import get_current_active_user, require_admin
from app.models.nutrition import FoodProduct, NutritionLog
from app.models.user import User, UserProfile
from app.schemas.nutrition import (
    FoodProductCreate,
    FoodProductResponse,
    NutritionLogCreate,
    NutritionLogUpdate,
    NutritionLogResponse,
    DailyNutritionSummary,
    BarcodeLookupRequest,
    BarcodeLogCreate
)
from pydantic import BaseModel, Field
from app.services.openfoodfacts import get_product_by_barcode
from app.services.product_recognition import recognize_product
from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()


# ============ Продукты ============

@router.get("/products", response_model=List[FoodProductResponse])
async def list_products(
    skip: int = 0,
    limit: int = 100,
    search: str = None,
    category: str = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Получить список продуктов с поиском
    """
    query = select(FoodProduct)
    
    if search:
        query = query.where(FoodProduct.name.ilike(f"%{search}%"))
    
    if category:
        query = query.where(FoodProduct.category == category)
    
    query = query.offset(skip).limit(limit).order_by(FoodProduct.name)
    
    result = await db.execute(query)
    products = result.scalars().all()
    
    return products


@router.post("/products", response_model=FoodProductResponse, status_code=status.HTTP_201_CREATED)
async def create_product(
    product_data: FoodProductCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Создать новый продукт (только администраторы)
    """
    # Проверяем уникальность
    result = await db.execute(
        select(FoodProduct).where(FoodProduct.name == product_data.name)
    )
    existing = result.scalar_one_or_none()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Продукт с таким названием уже существует"
        )
    
    product = FoodProduct(**product_data.model_dump())
    db.add(product)
    await db.commit()
    await db.refresh(product)
    
    return product


# ============ Barcode Scanning ============

# Тестовый роут для проверки (можно удалить после проверки)
@router.get("/test-barcode")
async def test_barcode(current_user: User = Depends(get_current_active_user)):
    """Тестовый роут для проверки работы"""
    return {"message": "Barcode routes are working", "user_id": str(current_user.id)}


@router.post("/scan-barcode-image")
async def scan_barcode_from_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user)
):
    """
    Распознать штрихкод из загруженного изображения
    Использует серверную обработку для более надежного распознавания
    """
    try:
        # Проверяем тип файла
        if not file.content_type or not file.content_type.startswith('image/'):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Файл должен быть изображением"
            )
        
        # Читаем файл
        image_data = await file.read()
        logger.info(f"Received image file: {file.filename}, size: {len(image_data)} bytes, type: {file.content_type}")
        
        # Пробуем распознать штрихкод с помощью pyzbar
        try:
            from pyzbar.pyzbar import decode as pyzbar_decode
            from PIL import Image
            
            # Открываем изображение
            image = Image.open(io.BytesIO(image_data))
            logger.info(f"Image opened: size={image.size}, mode={image.mode}")
            
            # Конвертируем в RGB, если нужно
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            # Распознаем штрихкоды
            barcodes = pyzbar_decode(image)
            
            if not barcodes:
                logger.warning("No barcodes found in image")
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Штрихкод не найден на изображении. Убедитесь, что фото четкое и штрихкод хорошо виден."
                )
            
            # Берем первый найденный штрихкод
            barcode = barcodes[0]
            barcode_data = barcode.data.decode('utf-8')
            barcode_type = barcode.type
            
            logger.info(f"Barcode found: {barcode_data} (type: {barcode_type})")
            
            return {
                "barcode": barcode_data,
                "type": barcode_type,
                "quality": barcode.quality if hasattr(barcode, 'quality') else None
            }
            
        except ImportError:
            logger.error("pyzbar or PIL not installed")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Библиотека для распознавания штрихкодов не установлена"
            )
        except Exception as e:
            logger.error(f"Error scanning barcode: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Ошибка при распознавании штрихкода: {str(e)}"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in scan_barcode_from_image: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Неожиданная ошибка: {str(e)}"
        )


@router.post("/recognize-product-image")
async def recognize_product_from_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user)
):
    """
    Распознать продукт из загруженного изображения с помощью AI
    Возвращает название продукта и оценку КБЖУ
    """
    try:
        # Проверяем тип файла
        if not file.content_type or not file.content_type.startswith('image/'):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Файл должен быть изображением"
            )
        
        # Читаем файл
        image_data = await file.read()
        print(f"\n{'='*80}")
        print(f"🖼️  RECEIVED IMAGE FOR RECOGNITION")
        print(f"{'='*80}")
        print(f"📁 File: {file.filename}")
        print(f"📏 Size: {len(image_data)} bytes")
        print(f"👤 User ID: {current_user.id}")
        print(f"📧 User Email: {current_user.email}")
        logger.info(f"Received image for product recognition: {file.filename}, size: {len(image_data)} bytes, user: {current_user.id}")
        
        # Получаем API ключ в зависимости от провайдера
        provider = settings.PRODUCT_RECOGNITION_PROVIDER
        
        # ВРЕМЕННО ОТКЛЮЧЕН: Spoonacular выдает одинаковые результаты
        # Используем OpenAI вместо Spoonacular
        if provider == "spoonacular":
            print(f"⚠️  WARNING: Spoonacular temporarily disabled (returns same results for all images)")
            print(f"   Falling back to OpenAI instead")
            logger.warning(f"Spoonacular provider requested but temporarily disabled, using OpenAI instead")
            provider = "openai"
        
        api_key = None
        
        if provider == "openai":
            api_key = settings.OPENAI_API_KEY
        elif provider == "google":
            api_key = settings.GOOGLE_VISION_API_KEY
        elif provider == "gemini":
            api_key = settings.GOOGLE_GEMINI_API_KEY
        elif provider == "huggingface":
            api_key = settings.HUGGINGFACE_API_KEY  # Опционально, для бесплатного tier не обязателен
        elif provider == "spoonacular":
            api_key = settings.SPOONACULAR_API_KEY
        
        print(f"🔧 Provider: {provider}")
        print(f"🔑 API Key present: {api_key is not None and len(api_key) > 0 if api_key else False}")
        logger.info(f"Using recognition provider: {provider} for user {current_user.id}")
        
        if not api_key:
            print(f"❌ ERROR: API key not configured for provider: {provider}")
            logger.error(f"API key not configured for provider: {provider}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"API ключ для провайдера {provider} не настроен. Добавьте соответствующий ключ в настройки."
            )
        
        # Распознаем продукт
        print(f"🚀 Starting recognition with provider: {provider}")
        logger.info(f"Starting product recognition with provider: {provider}")
        product_data = await recognize_product(
            image_data=image_data,
            provider=provider,
            api_key=api_key
        )
        
        if not product_data:
            print(f"❌ Recognition FAILED for provider: {provider}")
            logger.warning(f"Product recognition failed for provider: {provider}, user: {current_user.id}")
            
            # Более информативное сообщение об ошибке
            error_detail = "Не удалось распознать продукт на изображении"
            if provider == "openai":
                error_detail = "Не удалось распознать продукт. Возможные причины: неверный API ключ OpenAI, проблемы с доступом к API, или превышен лимит запросов. Проверьте настройки API ключа."
            
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=error_detail
            )
        
        print(f"✅ Recognition SUCCESS by {provider}")
        print(f"   Product: {product_data.get('name')}")
        print(f"   Confidence: {product_data.get('confidence', 'unknown')}")
        print(f"   Calories: {product_data.get('estimated_calories_per_100g')}")
        print(f"   Proteins: {product_data.get('estimated_proteins_per_100g')}")
        print(f"   Fats: {product_data.get('estimated_fats_per_100g')}")
        print(f"   Carbs: {product_data.get('estimated_carbs_per_100g')}")
        print(f"{'='*80}\n")
        logger.info(f"Product recognized successfully by {provider}: '{product_data.get('name')}' (confidence: {product_data.get('confidence', 'unknown')}), user: {current_user.id}")
        
        return product_data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error recognizing product from image: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при распознавании продукта: {str(e)}"
        )


@router.post("/lookup-barcode", response_model=FoodProductResponse)
async def lookup_barcode(
    request: BarcodeLookupRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Поиск продукта по штрихкоду
    Сначала ищет в локальной БД, если не находит - запрашивает из Open Food Facts
    """
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"Lookup barcode request: {request.barcode} from user {current_user.id}")
    
    # Ищем в локальной БД
    result = await db.execute(
        select(FoodProduct).where(FoodProduct.barcode == request.barcode)
    )
    product = result.scalar_one_or_none()
    
    if product:
        logger.info(f"Product found in local DB: {product.name} (ID: {product.id})")
        return product
    
    logger.info(f"Product not found in local DB, querying Open Food Facts for barcode: {request.barcode}")
    
    # Если не нашли в БД - запрашиваем из Open Food Facts
    product_data = await get_product_by_barcode(request.barcode)
    
    if not product_data:
        logger.warning(f"Product not found in Open Food Facts: {request.barcode}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Продукт со штрихкодом {request.barcode} не найден"
        )
    
    logger.info(f"Product found in Open Food Facts: {product_data.get('name')}, creating in DB")
    
    # Создаем новый продукт в БД
    try:
        product = FoodProduct(**product_data)
        db.add(product)
        await db.commit()
        await db.refresh(product)
        
        logger.info(f"Product created in DB: {product.name} (ID: {product.id})")
        
        return product
    except Exception as e:
        logger.error(f"Error creating product in DB: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при создании продукта: {str(e)}"
        )


@router.post("/products/from-recognition", response_model=FoodProductResponse, status_code=status.HTTP_201_CREATED)
async def create_product_from_recognition(
    product_data: FoodProductCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Создать продукт из распознавания (для обычных пользователей)
    Автоматически создает продукт с source='ai_recognition' и user_id
    """
    # Проверяем, не существует ли уже такой продукт
    result = await db.execute(
        select(FoodProduct).where(FoodProduct.name == product_data.name)
    )
    existing = result.scalar_one_or_none()
    
    if existing:
        return existing
    
    # Создаем новый продукт
    product_dict = product_data.model_dump()
    product_dict['source'] = 'ai_recognition'
    product_dict['user_id'] = current_user.id
    
    product = FoodProduct(**product_dict)
    db.add(product)
    await db.commit()
    await db.refresh(product)
    
    return product


@router.post("/logs/from-barcode", response_model=NutritionLogResponse, status_code=status.HTTP_201_CREATED)
async def create_log_from_barcode(
    log_data: BarcodeLogCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Создать запись о питании из штрихкода
    Автоматически находит/создает продукт и добавляет запись в дневник
    """
    # Ищем продукт по штрихкоду в локальной БД
    result = await db.execute(
        select(FoodProduct).where(FoodProduct.barcode == log_data.barcode)
    )
    product = result.scalar_one_or_none()
    
    # Если не нашли - запрашиваем из Open Food Facts
    if not product:
        product_data = await get_product_by_barcode(log_data.barcode)
        
        if not product_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Продукт со штрихкодом {log_data.barcode} не найден"
            )
        
        # Создаем новый продукт
        product = FoodProduct(**product_data)
        db.add(product)
        await db.commit()
        await db.refresh(product)
    
    # Создаем запись в дневнике питания
    nutrition_log = NutritionLog(
        user_id=current_user.id,
        product_id=product.id,
        weight_g=log_data.weight_g,
        eaten_at=log_data.eaten_at,
        meal_type=log_data.meal_type,
        notes=log_data.notes
    )
    
    db.add(nutrition_log)
    await db.commit()
    await db.refresh(nutrition_log)
    
    # Возвращаем с рассчитанными значениями
    multiplier = nutrition_log.weight_g / 100.0
    log_dict = {
        "id": nutrition_log.id,
        "user_id": nutrition_log.user_id,
        "product_id": nutrition_log.product_id,
        "weight_g": nutrition_log.weight_g,
        "eaten_at": nutrition_log.eaten_at,
        "meal_type": nutrition_log.meal_type,
        "notes": nutrition_log.notes,
        "calories": round(product.calories * multiplier, 2),
        "proteins": round(product.proteins * multiplier, 2),
        "fats": round(product.fats * multiplier, 2),
        "carbs": round(product.carbs * multiplier, 2),
        "product_name": product.name,
    }
    
    return log_dict


# ============ Дневник питания ============

@router.get("/logs", response_model=List[NutritionLogResponse])
async def get_nutrition_logs(
    from_date: date = None,
    to_date: date = None,
    meal_type: str = None,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Получить записи о питании с фильтрацией
    """
    # Используем join для оптимизации запросов
    query = (
        select(NutritionLog, FoodProduct)
        .join(FoodProduct, NutritionLog.product_id == FoodProduct.id)
        .where(NutritionLog.user_id == current_user.id)
    )
    
    if from_date:
        query = query.where(func.date(NutritionLog.eaten_at) >= from_date)
    
    if to_date:
        query = query.where(func.date(NutritionLog.eaten_at) <= to_date)
    
    if meal_type:
        query = query.where(NutritionLog.meal_type == meal_type)
    
    query = query.order_by(NutritionLog.eaten_at.desc()).offset(skip).limit(limit)
    
    result = await db.execute(query)
    rows = result.all()
    
    enriched_logs = []
    for log, product in rows:
            # Рассчитываем на основе веса порции
            multiplier = log.weight_g / 100.0
            log_dict = {
                "id": log.id,
                "user_id": log.user_id,
                "product_id": log.product_id,
                "weight_g": log.weight_g,
                "eaten_at": log.eaten_at,
                "meal_type": log.meal_type,
                "notes": log.notes,
                "calories": round(product.calories * multiplier, 2),
                "proteins": round(product.proteins * multiplier, 2),
                "fats": round(product.fats * multiplier, 2),
                "carbs": round(product.carbs * multiplier, 2),
            "product_name": product.name,  # Добавляем название продукта
            }
            enriched_logs.append(log_dict)
    
    return enriched_logs


@router.post("/logs", response_model=NutritionLogResponse, status_code=status.HTTP_201_CREATED)
async def create_nutrition_log(
    log_data: NutritionLogCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Добавить запись о приеме пищи
    """
    # Проверяем существование продукта
    result = await db.execute(
        select(FoodProduct).where(FoodProduct.id == log_data.product_id)
    )
    product = result.scalar_one_or_none()
    
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Продукт не найден"
        )
    
    log = NutritionLog(
        user_id=current_user.id,
        **log_data.model_dump()
    )
    
    db.add(log)
    await db.commit()
    await db.refresh(log)
    
    # Возвращаем с рассчитанными значениями
    multiplier = log.weight_g / 100.0
    log_dict = {
        "id": log.id,
        "user_id": log.user_id,
        "product_id": log.product_id,
        "weight_g": log.weight_g,
        "eaten_at": log.eaten_at,
        "meal_type": log.meal_type,
        "notes": log.notes,
        "calories": round(product.calories * multiplier, 2),
        "proteins": round(product.proteins * multiplier, 2),
        "fats": round(product.fats * multiplier, 2),
        "carbs": round(product.carbs * multiplier, 2),
        "product_name": product.name,  # Добавляем название продукта
    }
    
    return log_dict


@router.put("/logs/{log_id}", response_model=NutritionLogResponse)
async def update_nutrition_log(
    log_id: UUID,
    log_data: NutritionLogUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Изменить запись о питании
    """
    result = await db.execute(
        select(NutritionLog)
        .where(NutritionLog.id == log_id, NutritionLog.user_id == current_user.id)
    )
    log = result.scalar_one_or_none()
    
    if not log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Запись не найдена"
        )
    
    # Обновляем только переданные поля
    update_data = log_data.model_dump(exclude_unset=True)
    
    # Если меняется продукт, проверяем его существование
    if 'product_id' in update_data:
        product_result = await db.execute(
            select(FoodProduct).where(FoodProduct.id == update_data['product_id'])
        )
        product = product_result.scalar_one_or_none()
        
        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Продукт не найден"
            )
    
    for field, value in update_data.items():
        setattr(log, field, value)
    
    await db.commit()
    await db.refresh(log)
    
    # Загружаем продукт для расчета калорий и БЖУ
    product_result = await db.execute(
        select(FoodProduct).where(FoodProduct.id == log.product_id)
    )
    product = product_result.scalar_one_or_none()
    
    if not product:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ошибка при загрузке продукта"
        )
    
    # Возвращаем с рассчитанными значениями
    multiplier = log.weight_g / 100.0
    log_dict = {
        "id": log.id,
        "user_id": log.user_id,
        "product_id": log.product_id,
        "weight_g": log.weight_g,
        "eaten_at": log.eaten_at,
        "meal_type": log.meal_type,
        "notes": log.notes,
        "calories": round(product.calories * multiplier, 2),
        "proteins": round(product.proteins * multiplier, 2),
        "fats": round(product.fats * multiplier, 2),
        "carbs": round(product.carbs * multiplier, 2),
        "product_name": product.name,
    }
    
    return log_dict


@router.delete("/logs/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_nutrition_log(
    log_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Удалить запись о питании
    """
    result = await db.execute(
        select(NutritionLog)
        .where(NutritionLog.id == log_id, NutritionLog.user_id == current_user.id)
    )
    log = result.scalar_one_or_none()
    
    if not log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Запись не найдена"
        )
    
    await db.delete(log)
    await db.commit()
    
    return None


@router.get("/summary/daily", response_model=DailyNutritionSummary)
async def get_daily_summary(
    target_date: date = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Получить итоговую статистику питания за день
    """
    if not target_date:
        target_date = date.today()
    
    # Получаем все записи за день
    result = await db.execute(
        select(NutritionLog)
        .where(
            NutritionLog.user_id == current_user.id,
            func.date(NutritionLog.eaten_at) == target_date
        )
    )
    logs = result.scalars().all()
    
    # Рассчитываем суммарные значения
    total_calories = 0.0
    total_proteins = 0.0
    total_fats = 0.0
    total_carbs = 0.0
    
    for log in logs:
        # Загружаем продукт
        product_result = await db.execute(
            select(FoodProduct).where(FoodProduct.id == log.product_id)
        )
        product = product_result.scalar_one_or_none()
        
        if product:
            multiplier = log.weight_g / 100.0
            total_calories += product.calories * multiplier
            total_proteins += product.proteins * multiplier
            total_fats += product.fats * multiplier
            total_carbs += product.carbs * multiplier
    
    return {
        "date": target_date.isoformat(),
        "total_calories": round(total_calories, 2),
        "total_proteins": round(total_proteins, 2),
        "total_fats": round(total_fats, 2),
        "total_carbs": round(total_carbs, 2),
        "meals_count": len(logs)
    }


# ============ Гидратация ============

class HydrationLogRequest(BaseModel):
    amount_ml: float = Field(..., ge=50, le=5000, description="Количество воды в мл (от 50 до 5000)")


@router.post("/hydration/log")
async def log_hydration(
    request: HydrationLogRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Записать выпитую воду
    """
    from app.models.nutrition import HydrationLog
    
    log = HydrationLog(
        user_id=current_user.id,
        amount_ml=request.amount_ml,
        logged_at=datetime.utcnow()
    )
    
    db.add(log)
    await db.commit()
    await db.refresh(log)
    
    return {"id": str(log.id), "amount_ml": log.amount_ml, "logged_at": log.logged_at}


@router.get("/hydration/today")
async def get_today_hydration(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Получить количество воды за сегодня
    """
    from app.models.nutrition import HydrationLog
    from datetime import datetime, timedelta
    from sqlalchemy import desc
    
    # Используем UTC для консистентности с log_hydration
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    
    result = await db.execute(
        select(func.sum(HydrationLog.amount_ml))
        .where(HydrationLog.user_id == current_user.id)
        .where(HydrationLog.logged_at >= today_start)
    )
    total_ml = result.scalar() or 0
    
    # Рекомендуемая норма (упрощенно: 30мл на кг веса)
    profile_result = await db.execute(
        select(UserProfile).where(UserProfile.user_id == current_user.id)
    )
    profile = profile_result.scalar_one_or_none()
    
    recommended_ml = 2000  # По умолчанию
    if profile:
        from app.models.metrics import BodyMetric
        weight_result = await db.execute(
            select(BodyMetric)
            .where(BodyMetric.user_id == current_user.id)
            .where(BodyMetric.weight.isnot(None))
            .order_by(desc(BodyMetric.date))
            .limit(1)
        )
        weight_metric = weight_result.scalar_one_or_none()
        
        if weight_metric and weight_metric.weight:
            recommended_ml = weight_metric.weight * 30  # 30мл на кг
    
    return {
        "total_ml": round(total_ml, 1),
        "recommended_ml": round(recommended_ml, 1),
        "percentage": round((total_ml / recommended_ml * 100) if recommended_ml > 0 else 0, 1)
    }
