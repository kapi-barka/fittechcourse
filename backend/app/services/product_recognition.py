"""
Сервис для распознавания продуктов по фотографии с помощью AI
Поддерживает несколько провайдеров: OpenAI, Google Vision, Spoonacular
"""
import base64
import io
import logging
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

# Опциональные импорты
try:
    from PIL import Image
except ImportError:
    Image = None

try:
    import pytesseract
except ImportError:
    pytesseract = None


async def recognize_product_openai(image_data: bytes, api_key: str) -> Optional[Dict[str, Any]]:
    """
    Распознавание продукта с помощью OpenAI GPT-4 Vision
    Анализирует изображение и определяет продукт + КБЖУ напрямую
    
    Args:
        image_data: Байты изображения
        api_key: OpenAI API ключ
        
    Returns:
        Dict с информацией о продукте или None
    """
    try:
        import httpx
        import json
        import re
        
        if Image is None:
            logger.error("PIL/Pillow not installed")
            return None
        
        # Конвертируем изображение в base64
        image_base64 = base64.b64encode(image_data).decode('utf-8')
        
        # Определяем MIME тип
        image = Image.open(io.BytesIO(image_data))
        mime_type = f"image/{image.format.lower()}" if image.format else "image/jpeg"
        
        url = "https://api.openai.com/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        
        prompt = """Ты эксперт по питанию и распознаванию продуктов. Проанализируй это изображение и определи продукт питания.

АНАЛИЗИРУЙ:
1. Что изображено на фото (продукт, упаковка, готовое блюдо и т.д.)
2. Название продукта на русском языке (максимально точное)
3. Бренд (если виден на упаковке/этикетке)
4. Категорию продукта
5. КБЖУ на 100г:
   - Если видна информация о КБЖУ на упаковке/этикетке - используй ТОЧНЫЕ значения оттуда
   - Если информации нет - оцени на основе визуального анализа и типичных значений для этого продукта
   - Учитывай способ приготовления (сырое, вареное, жареное и т.д.)

ВЕРНИ ОТВЕТ ТОЛЬКО В ФОРМАТЕ JSON, БЕЗ ДОПОЛНИТЕЛЬНОГО ТЕКСТА:
{
    "name": "точное название продукта на русском языке",
    "description": "краткое описание продукта (1-2 предложения)",
    "estimated_calories_per_100g": число или null,
    "estimated_proteins_per_100g": число или null,
    "estimated_fats_per_100g": число или null,
    "estimated_carbs_per_100g": число или null,
    "brand": "бренд" или null,
    "category": "категория продукта (овощи, фрукты, мясо, молочные продукты и т.д.)",
    "confidence": "высокая" или "средняя" или "низкая"
}

ПРАВИЛА:
- Все числа должны быть числовыми значениями (не строками), например: 41, а не "41" или "41 ккал"
- Если не можешь определить значение - используй null
- Название продукта должно быть максимально точным (например, "Морковь", а не "Овощ")
- Если видишь текст на упаковке с КБЖУ - используй эти значения
- Будь максимально точным и внимательным"""

        payload = {
            "model": "gpt-4o",
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": prompt
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{mime_type};base64,{image_base64}",
                                "detail": "high"  # Высокое качество для лучшего распознавания
                            }
                        }
                    ]
                }
            ],
            "max_tokens": 800,
            "temperature": 0.2,  # Низкая температура для более точных ответов
            "response_format": {"type": "json_object"}  # Принудительный JSON формат
        }
        
        print(f"    📤 [OpenAI] Sending request to OpenAI API...")
        print(f"       Model: gpt-4o")
        print(f"       Image size: {len(image_data)} bytes")
        print(f"       Image format: {mime_type}")
        print(f"       API Key (first 10 chars): {api_key[:10]}...")
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(url, headers=headers, json=payload)
            
            # Проверяем статус ответа и выводим детальную информацию об ошибке
            if response.status_code != 200:
                error_detail = response.text
                print(f"    ❌ [OpenAI] API Error {response.status_code}: {error_detail[:500]}")
                logger.error(f"OpenAI API error {response.status_code}: {error_detail}")
                
                if response.status_code == 403:
                    error_msg = "Доступ запрещен. Проверьте API ключ OpenAI и убедитесь, что у вас есть доступ к GPT-4 Vision API."
                elif response.status_code == 401:
                    error_msg = "Неверный API ключ OpenAI. Проверьте правильность ключа в настройках."
                elif response.status_code == 429:
                    error_msg = "Превышен лимит запросов к OpenAI API. Попробуйте позже."
                elif response.status_code == 500:
                    error_msg = "Внутренняя ошибка сервера OpenAI. Попробуйте позже."
                else:
                    error_msg = f"Ошибка OpenAI API (код {response.status_code}): {error_detail[:200]}"
                
                raise ValueError(error_msg)
            
            response.raise_for_status()
            
            result = response.json()
            content = result["choices"][0]["message"]["content"]
            
            print(f"    📥 [OpenAI] Received response from OpenAI")
            print(f"       Response length: {len(content)} chars")
            print(f"       Response preview: {content[:200]}...")
            
            # Парсим JSON из ответа
            try:
                # Пробуем распарсить как чистый JSON
                product_data = json.loads(content)
                print(f"    ✅ [OpenAI] Successfully parsed JSON response")
            except json.JSONDecodeError:
                print(f"    ⚠️  [OpenAI] Failed to parse as JSON, trying regex extraction...")
                # Если не получилось, пытаемся извлечь JSON из текста
                json_match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', content, re.DOTALL)
                if json_match:
                    product_data = json.loads(json_match.group())
                    print(f"    ✅ [OpenAI] Successfully extracted JSON with regex")
                else:
                    print(f"    ❌ [OpenAI] Could not extract JSON from response")
                    logger.error(f"Could not parse JSON from OpenAI response: {content[:200]}")
                    return None
            
            # Валидация и нормализация данных
            if not isinstance(product_data, dict):
                print(f"    ❌ [OpenAI] Response is not a dict")
                logger.error("OpenAI returned non-dict response")
                return None
            
            # Убеждаемся, что числовые значения действительно числа
            for key in ['estimated_calories_per_100g', 'estimated_proteins_per_100g', 
                       'estimated_fats_per_100g', 'estimated_carbs_per_100g']:
                if key in product_data and product_data[key] is not None:
                    try:
                        product_data[key] = float(product_data[key])
                    except (ValueError, TypeError):
                        product_data[key] = None
            
            print(f"    ✅ [OpenAI] Recognition completed!")
            print(f"       Product: {product_data.get('name')}")
            print(f"       Confidence: {product_data.get('confidence')}")
            print(f"       Calories: {product_data.get('estimated_calories_per_100g')}")
            print(f"       Brand: {product_data.get('brand')}")
            logger.info(f"[OpenAI GPT-4 Vision] Recognition completed: product='{product_data.get('name')}', confidence={product_data.get('confidence')}, calories={product_data.get('estimated_calories_per_100g')}, brand={product_data.get('brand')}")
            return product_data
            
    except ValueError as e:
        # Это наши кастомные ошибки с понятными сообщениями
        print(f"    ❌ [OpenAI] Error: {e}")
        logger.error(f"Error recognizing product with OpenAI: {e}")
        return None
    except Exception as e:
        # Проверяем, является ли это HTTP ошибкой
        import httpx
        if isinstance(e, httpx.HTTPStatusError):
            error_msg = str(e)
            if "403" in error_msg:
                error_msg = "Доступ запрещен к OpenAI API. Проверьте API ключ и права доступа."
            elif "401" in error_msg:
                error_msg = "Неверный API ключ OpenAI."
            elif "429" in error_msg:
                error_msg = "Превышен лимит запросов к OpenAI API."
            else:
                error_msg = f"Ошибка OpenAI API: {error_msg}"
        else:
            error_msg = str(e)
        print(f"    ❌ [OpenAI] Unexpected error: {error_msg}")
        logger.error(f"Error recognizing product with OpenAI: {error_msg}", exc_info=True)
        return None


async def recognize_product_huggingface(image_data: bytes, api_key: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """
    Распознавание продукта с помощью Hugging Face Inference API (БЕСПЛАТНО, но нестабильно)
    ВНИМАНИЕ: Hugging Face изменил API, текущая реализация может не работать.
    Рекомендуется использовать Google Vision API (1000 запросов/месяц бесплатно) или OpenAI.
    
    Использует модели для распознавания объектов и продуктов
    
    Args:
        image_data: Байты изображения
        api_key: Hugging Face API ключ (опционально, для бесплатного tier не обязателен)
        
    Returns:
        Dict с информацией о продукте или None
    """
    try:
        import httpx
        
        if Image is None:
            logger.error("PIL/Pillow not installed")
            return None
        
        # Конвертируем изображение в base64
        image_base64 = base64.b64encode(image_data).decode('utf-8')
        
        # Используем модель для распознавания объектов
        # Модель "google/vit-base-patch16-224" хорошо распознает объекты
        # Или используем более специализированную модель для продуктов питания
        model_id = "google/vit-base-patch16-224"  # Бесплатная модель для классификации изображений
        
        # Пробуем использовать новый router endpoint
        # Формат: https://router.huggingface.co/{model_id} или https://api-inference.huggingface.co/models/{model_id}
        # Начнем с router, если не сработает - попробуем старый endpoint
        url = f"https://api-inference.huggingface.co/models/{model_id}"
        headers = {}
        
        # Если есть API ключ, добавляем его (для увеличения лимитов)
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"
        
        # Hugging Face Inference API для изображений принимает base64 напрямую
        # Или можно отправить как bytes через multipart/form-data
        # Попробуем отправить base64 строку напрямую
        payload = image_base64
        
        print(f"    🤗 [Hugging Face] Sending request to Hugging Face API...")
        print(f"       Model: {model_id}")
        print(f"       Image size: {len(image_data)} bytes")
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Новый router endpoint принимает изображение как bytes напрямую
            # Или как JSON с base64 в поле "inputs"
            try:
                # Вариант 1: Отправляем изображение как bytes (предпочтительно для router)
                response = await client.post(
                    url,
                    headers={**headers, "Content-Type": "image/jpeg"},
                    content=image_data,
                    timeout=30.0
                )
            except Exception as e:
                print(f"    ⚠️  [Hugging Face] Bytes method failed: {e}, trying JSON base64 method...")
                # Вариант 2: Отправляем base64 как JSON
                response = await client.post(
                    url, 
                    headers={**headers, "Content-Type": "application/json"},
                    json={"inputs": image_base64},
                    timeout=30.0
                )
            
            if response.status_code == 503:
                # Модель загружается, нужно подождать
                print(f"    ⏳ [Hugging Face] Model is loading, waiting...")
                await __import__('asyncio').sleep(5)
                # Повторяем запрос с JSON форматом
                response = await client.post(
                    url, 
                    headers={**headers, "Content-Type": "application/json"},
                    json={"inputs": image_base64},
                    timeout=30.0
                )
            
            # Если получили 404 или 410, пробуем альтернативные URL
            if response.status_code in [404, 410]:
                print(f"    ⚠️  [Hugging Face] Got {response.status_code}, trying alternative URL formats...")
                alt_urls = [
                    f"https://router.huggingface.co/{model_id}",
                    f"https://api-inference.huggingface.co/models/{model_id}",
                    f"https://huggingface.co/api/models/{model_id}/inference"
                ]
                
                for alt_url in alt_urls:
                    if alt_url == url:
                        continue
                    try:
                        print(f"    🔄 [Hugging Face] Trying: {alt_url}")
                        response = await client.post(
                            alt_url,
                            headers={**headers, "Content-Type": "application/json"},
                            json={"inputs": image_base64},
                            timeout=30.0
                        )
                        if response.status_code == 200:
                            print(f"    ✅ [Hugging Face] Alternative URL worked: {alt_url}")
                            break
                        print(f"    ⚠️  [Hugging Face] Alternative URL returned {response.status_code}")
                    except Exception as e:
                        print(f"    ❌ [Hugging Face] Alternative URL failed: {e}")
                        continue
            
            if response.status_code != 200:
                error_detail = response.text
                print(f"    ❌ [Hugging Face] API Error {response.status_code}: {error_detail[:500]}")
                logger.error(f"Hugging Face API error {response.status_code}: {error_detail}")
                return None
            
            result = response.json()
            
            # Результат - это список предсказаний с вероятностями
            # Берем топ-3 наиболее вероятных класса
            if isinstance(result, list) and len(result) > 0:
                predictions = result[0] if isinstance(result[0], list) else result
                
                # Сортируем по вероятности
                sorted_predictions = sorted(predictions, key=lambda x: x.get('score', 0), reverse=True)
                top_prediction = sorted_predictions[0]
                
                product_name = top_prediction.get('label', 'Продукт питания')
                confidence_score = top_prediction.get('score', 0)
                
                # Преобразуем английское название в русское (базовая логика)
                # В реальности можно использовать словарь или переводчик
                confidence = "высокая" if confidence_score > 0.7 else "средняя" if confidence_score > 0.4 else "низкая"
                
                # Пытаемся определить КБЖУ на основе типа продукта
                # Это базовая эвристика, можно расширить
                estimated_calories = None
                estimated_proteins = None
                estimated_fats = None
                estimated_carbs = None
                
                product_name_lower = product_name.lower()
                
                # Простая эвристика для некоторых категорий продуктов
                if any(word in product_name_lower for word in ['milk', 'cheese', 'yogurt', 'dairy']):
                    estimated_calories = 60
                    estimated_proteins = 3.5
                    estimated_fats = 3.5
                    estimated_carbs = 4.5
                elif any(word in product_name_lower for word in ['bread', 'bun', 'roll']):
                    estimated_calories = 250
                    estimated_proteins = 8
                    estimated_fats = 3
                    estimated_carbs = 50
                elif any(word in product_name_lower for word in ['apple', 'banana', 'fruit']):
                    estimated_calories = 50
                    estimated_proteins = 0.5
                    estimated_fats = 0.3
                    estimated_carbs = 12
                elif any(word in product_name_lower for word in ['meat', 'chicken', 'beef', 'pork']):
                    estimated_calories = 200
                    estimated_proteins = 20
                    estimated_fats = 12
                    estimated_carbs = 0
                
                print(f"    ✅ [Hugging Face] Recognition completed!")
                print(f"       Product: {product_name}")
                print(f"       Confidence: {confidence} ({confidence_score:.2%})")
                print(f"       Top predictions: {[p.get('label') for p in sorted_predictions[:3]]}")
                
                return {
                    "name": product_name,
                    "description": f"Распознано как {product_name} (уверенность: {confidence_score:.1%})",
                    "estimated_calories_per_100g": estimated_calories,
                    "estimated_proteins_per_100g": estimated_proteins,
                    "estimated_fats_per_100g": estimated_fats,
                    "estimated_carbs_per_100g": estimated_carbs,
                    "brand": None,
                    "category": product_name,
                    "confidence": confidence,
                    "note": "Оценка КБЖУ приблизительная, основана на типе продукта. Рекомендуется уточнить данные вручную."
                }
            else:
                print(f"    ❌ [Hugging Face] Unexpected response format")
                logger.error(f"Hugging Face returned unexpected format: {result}")
                return None
                
    except Exception as e:
        print(f"    ❌ [Hugging Face] Error: {e}")
        logger.error(f"Error recognizing product with Hugging Face: {e}", exc_info=True)
        return None


async def get_available_gemini_model(api_key: str) -> Optional[str]:
    """
    Определяет доступную модель Gemini API через ListModels
    """
    try:
        import httpx
        
        # Пробуем разные endpoints для ListModels
        list_endpoints = [
            "https://generativelanguage.googleapis.com/v1/models",
            "https://generativelanguage.googleapis.com/v1beta/models",
        ]
        
        for endpoint in list_endpoints:
            url = f"{endpoint}?key={api_key}"
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    response = await client.get(url)
                    if response.status_code == 200:
                        models_data = response.json()
                        models = models_data.get("models", [])
                        
                        # Ищем модель с поддержкой generateContent и изображений
                        for model in models:
                            model_name = model.get("name", "")
                            supported_methods = model.get("supportedGenerationMethods", [])
                            
                            if "generateContent" in supported_methods:
                                # Приоритет моделям с поддержкой изображений
                                if "vision" in model_name.lower() or "1.5" in model_name.lower() or "flash" in model_name.lower():
                                    print(f"    ✅ [Gemini] Found available model: {model_name}")
                                    return model_name.split("/")[-1]  # Возвращаем только имя модели
                        
                        # Если не нашли специальную, берем первую с generateContent
                        for model in models:
                            model_name = model.get("name", "")
                            supported_methods = model.get("supportedGenerationMethods", [])
                            if "generateContent" in supported_methods:
                                print(f"    ✅ [Gemini] Found available model: {model_name}")
                                return model_name.split("/")[-1]
            except Exception as e:
                continue
        
        print(f"    ⚠️  [Gemini] Could not determine available models")
        return None
    except Exception as e:
        print(f"    ⚠️  [Gemini] Error getting available models: {e}")
        return None


async def recognize_product_gemini(image_data: bytes, api_key: str, product_name: str = None, model_name: str = None) -> Optional[Dict[str, Any]]:
    """
    Распознавание КБЖУ продукта с помощью Google Gemini API (генеративная модель)
    БЕСПЛАТНО: 1000 запросов в месяц (бесплатный tier)
    Для получения API ключа: https://makersuite.google.com/app/apikey
    
    Args:
        image_data: Байты изображения
        api_key: Google Gemini API ключ
        product_name: Название продукта (если уже определено через Vision API)
        
    Returns:
        Dict с КБЖУ или None
    """
    try:
        import httpx
        
        if Image is None:
            logger.error("PIL/Pillow not installed")
            return None
        
        # Конвертируем изображение в base64
        image_base64 = base64.b64encode(image_data).decode('utf-8')
        
        # Определяем MIME тип
        image = Image.open(io.BytesIO(image_data))
        mime_type = f"image/{image.format.lower()}" if image.format else "image/jpeg"
        
        # Определяем модель и версию API
        if not model_name:
            # Пробуем определить доступную модель
            model_name = await get_available_gemini_model(api_key)
        
        if not model_name:
            # Fallback: пробуем стандартные варианты
            model_name = "gemini-1.5-flash"
            api_version = "v1beta"
        else:
            # Определяем версию API из имени модели
            if "1.5" in model_name:
                api_version = "v1beta"
            else:
                api_version = "v1"
        
        url = f"https://generativelanguage.googleapis.com/{api_version}/models/{model_name}:generateContent?key={api_key}"
        
        # Промпт для определения КБЖУ
        prompt = f"""Ты эксперт по питанию. Проанализируй это изображение продукта питания и определи КБЖУ на 100г.

{"Продукт уже определен как: " + product_name + ". " if product_name else ""}Проанализируй изображение и определи:

1. Название продукта (на русском языке, если еще не определено)
2. КБЖУ на 100г:
   - Если видна информация о КБЖУ на упаковке/этикетке - используй ТОЧНЫЕ значения оттуда
   - Если информации нет - оцени на основе визуального анализа и типичных значений для этого продукта
   - Учитывай способ приготовления (сырое, вареное, жареное и т.д.)

ВАЖНО: Верни ПОЛНЫЙ JSON ответ со ВСЕМИ полями. Не обрезай ответ!

Верни ответ ТОЛЬКО в формате JSON, без дополнительного текста:
{{
    "name": "название продукта на русском"{" или \"" + product_name + "\"" if product_name else ""},
    "estimated_calories_per_100g": число или null,
    "estimated_proteins_per_100g": число или null,
    "estimated_fats_per_100g": число или null,
    "estimated_carbs_per_100g": число или null
}}

ПРАВИЛА:
- Все числа должны быть числовыми значениями (не строками), например: 41, а не "41" или "41 ккал"
- Если не можешь определить значение - используй null
- Если видишь текст на упаковке с КБЖУ - используй эти значения
- Будь максимально точным
- ОБЯЗАТЕЛЬНО верни ВСЕ поля, даже если некоторые значения null"""
        
        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": prompt},
                        {"inline_data": {"mime_type": mime_type, "data": image_base64}},
                    ]
                }
            ],
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": 2000,  # Увеличено для полного JSON ответа (было 1000, но ответ все равно обрезается)
                # "responseMimeType" не поддерживается в этом API, поэтому убираем
            }
        }
        
        print(f"    🤖 [Gemini] Sending request to Gemini API...")
        print(f"       Model: {model_name} (v1 API)")
        print(f"       Product: {product_name or 'не определен'}")
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(url, json=payload)
            
            # Если получили 404, пробуем альтернативные варианты
            if response.status_code == 404:
                print(f"    ⚠️  [Gemini] Model {model_name} not found, trying alternatives...")
                alternative_configs = [
                    ("v1", "gemini-pro"),  # Без vision в названии
                    ("v1beta", "gemini-1.5-pro"),  # v1beta с другой моделью
                    ("v1beta", "gemini-1.5-flash"),  # v1beta с flash
                ]
                
                for api_version, alt_model in alternative_configs:
                    alt_url = f"https://generativelanguage.googleapis.com/{api_version}/models/{alt_model}:generateContent?key={api_key}"
                    print(f"    🔄 [Gemini] Trying {api_version}/{alt_model}...")
                    try:
                        alt_response = await client.post(alt_url, json=payload, timeout=30.0)
                        if alt_response.status_code == 200:
                            print(f"    ✅ [Gemini] Success with {api_version}/{alt_model}")
                            response = alt_response
                            model_name = alt_model  # Обновляем для логирования
                            break
                    except Exception as e:
                        print(f"    ⚠️  [Gemini] Error trying {alt_model}: {e}")
                        continue
            
            if response.status_code != 200:
                error_detail = response.text
                error_json = {}
                try:
                    error_json = response.json()
                except:
                    pass
                
                error_message = error_json.get("error", {}).get("message", error_detail) if error_json else error_detail
                print(f"    ❌ [Gemini] API Error {response.status_code}: {error_message[:500]}")
                logger.error(f"Gemini API error {response.status_code}: {error_message}")
                return None
            
            result = response.json()
            
            # Извлекаем текст ответа
            candidates = result.get("candidates", [])
            if not candidates:
                print(f"    ❌ [Gemini] No candidates in response")
                logger.error(f"Gemini returned no candidates: {result}")
                return None
            
            content = candidates[0].get("content", {})
            parts = content.get("parts", [])
            if not parts:
                print(f"    ❌ [Gemini] No parts in response")
                logger.error(f"Gemini returned no parts: {result}")
                return None
            
            # Собираем весь текст (иногда Gemini отдает несколько parts)
            text_parts = [p.get("text", "") for p in parts if p.get("text")]
            text_response = "\n".join(text_parts)
            
            print(f"    📝 [Gemini] Full response length: {len(text_response)} chars")
            print(f"    📝 [Gemini] Full response:\n{text_response}")
            
            # Проверяем, не обрезан ли ответ
            if len(text_response) < 100:
                print(f"    ⚠️  [Gemini] WARNING: Response seems too short ({len(text_response)} chars), might be truncated!")
                print(f"    ⚠️  [Gemini] This usually means maxOutputTokens is too low or response was cut off")
            
            # Парсим JSON из ответа
            import json
            import re
            
            # Пытаемся достать JSON. Gemini иногда возвращает ```json ... ``` с переносами.
            nutrition_data = None
            
            # 1) Парсим code-blockи ```json ... ``` (многострочные)
            # Ищем как ```json ... ``` так и ``` ... ``` с JSON внутри
            code_block_patterns = [
                r"```json\s*([\s\S]*?)```",  # С явным json
                r"```\s*([\s\S]*?)```",  # Без явного json
            ]
            
            for pattern in code_block_patterns:
                code_blocks = re.findall(pattern, text_response, re.DOTALL)
                for block in code_blocks:
                    block = block.strip()
                    # Пробуем найти JSON внутри блока
                    json_start = block.find("{")
                    if json_start != -1:
                        block = block[json_start:]
                        # Пробуем найти закрывающую скобку или использовать весь блок
                        json_end = block.rfind("}")
                        if json_end != -1:
                            block = block[:json_end+1]
                        try:
                            nutrition_data = json.loads(block)
                            print(f"    ✅ [Gemini] Parsed nutrition data from code block")
                            break
                        except json.JSONDecodeError as e:
                            # Если JSON неполный, пробуем дополнить его
                            if not block.strip().endswith("}"):
                                # Пробуем добавить недостающие закрывающие скобки
                                open_braces = block.count("{")
                                close_braces = block.count("}")
                                missing = open_braces - close_braces
                                if missing > 0:
                                    try:
                                        test_block = block + "}" * missing
                                        nutrition_data = json.loads(test_block)
                                        print(f"    ✅ [Gemini] Parsed nutrition data from code block (auto-completed)")
                                        break
                                    except:
                                        pass
                            continue
                if nutrition_data:
                    break
            
            # 2) Если не нашли, пытаемся найти первый {...} блок в тексте
            if not nutrition_data:
                start = text_response.find("{")
                end = text_response.rfind("}")
                if start != -1 and end != -1 and end > start:
                    candidate = text_response[start:end+1]
                    try:
                        nutrition_data = json.loads(candidate)
                        print(f"    ✅ [Gemini] Parsed nutrition data from braces block")
                    except json.JSONDecodeError:
                        pass
            
            # Если не нашли, пробуем очистить текст и еще раз распарсить как JSON
            if not nutrition_data:
                cleaned = (
                    text_response
                    .replace("```json", "")
                    .replace("```", "")
                    .strip()
                )
                try:
                    nutrition_data = json.loads(cleaned)
                    print(f"    ✅ [Gemini] Parsed nutrition data from cleaned response")
                except json.JSONDecodeError:
                    pass
            
            # Regex fallback: вытаскиваем поля даже если JSON частично обрезан
            if not nutrition_data:
                try:
                    def to_float_val(match):
                        if not match:
                            return None
                        try:
                            return float(match.group(1).replace(',', '.'))
                        except ValueError:
                            return None
                    
                    # Более гибкие паттерны для поиска значений
                    name_match = re.search(r'"name"\s*:\s*"([^"\n\r]+)"?', text_response, re.MULTILINE)
                    cal_match = re.search(r'"estimated_calories_per_100g"\s*:\s*([0-9.,]+|null)', text_response, re.IGNORECASE)
                    prot_match = re.search(r'"estimated_proteins_per_100g"\s*:\s*([0-9.,]+|null)', text_response, re.IGNORECASE)
                    fat_match = re.search(r'"estimated_fats_per_100g"\s*:\s*([0-9.,]+|null)', text_response, re.IGNORECASE)
                    carb_match = re.search(r'"estimated_carbs_per_100g"\s*:\s*([0-9.,]+|null)', text_response, re.IGNORECASE)
                    
                    nutrition_data = {
                        "name": name_match.group(1) if name_match else None,
                        "estimated_calories_per_100g": to_float_val(cal_match) if cal_match and cal_match.group(1) != "null" else None,
                        "estimated_proteins_per_100g": to_float_val(prot_match) if prot_match and prot_match.group(1) != "null" else None,
                        "estimated_fats_per_100g": to_float_val(fat_match) if fat_match and fat_match.group(1) != "null" else None,
                        "estimated_carbs_per_100g": to_float_val(carb_match) if carb_match and carb_match.group(1) != "null" else None,
                    }
                    
                    # Если нашли хотя бы имя — возвращаем, даже без КБЖУ
                    if nutrition_data.get("name") is not None or any(
                        v for k, v in nutrition_data.items() if k != "name" and v is not None
                    ):
                        print(f"    ✅ [Gemini] Parsed nutrition data via regex fallback (may be partial)")
                        print(f"       Found: name={nutrition_data.get('name')}, calories={nutrition_data.get('estimated_calories_per_100g')}, proteins={nutrition_data.get('estimated_proteins_per_100g')}, fats={nutrition_data.get('estimated_fats_per_100g')}, carbs={nutrition_data.get('estimated_carbs_per_100g')}")
                    else:
                        print(f"    ⚠️  [Gemini] Regex fallback found no data")
                        nutrition_data = None
                except Exception as e:
                    print(f"    ⚠️  [Gemini] Regex fallback error: {e}")
                    nutrition_data = None
            
            if nutrition_data:
                # Проверяем, есть ли все поля КБЖУ в ответе
                calories = nutrition_data.get('estimated_calories_per_100g')
                proteins = nutrition_data.get('estimated_proteins_per_100g')
                fats = nutrition_data.get('estimated_fats_per_100g')
                carbs = nutrition_data.get('estimated_carbs_per_100g')
                
                has_all_nutrition = all(v is not None for v in [calories, proteins, fats, carbs])
                
                # Если есть калории, но нет других значений - оцениваем их на основе калорий
                if calories is not None and not has_all_nutrition:
                    print(f"    ⚠️  [Gemini] Got calories ({calories}) but missing other values. Estimating based on calories...")
                    
                    product_name_lower = nutrition_data.get("name", "").lower()
                    
                    # Оценка на основе калорий и типа продукта
                    if "котлет" in product_name_lower or "cutlet" in product_name_lower:
                        # Для котлет: белки ~15г, жиры ~18г, углеводы ~8г на 100г (250 ккал)
                        # Масштабируем на основе найденных калорий
                        ratio = calories / 250.0 if calories else 1.0
                        if proteins is None:
                            nutrition_data["estimated_proteins_per_100g"] = round(15.0 * ratio, 1)
                        if fats is None:
                            nutrition_data["estimated_fats_per_100g"] = round(18.0 * ratio, 1)
                        if carbs is None:
                            nutrition_data["estimated_carbs_per_100g"] = round(8.0 * ratio, 1)
                        print(f"    📊 [Gemini] Estimated КБЖУ based on calories: proteins={nutrition_data.get('estimated_proteins_per_100g')}, fats={nutrition_data.get('estimated_fats_per_100g')}, carbs={nutrition_data.get('estimated_carbs_per_100g')}")
                    else:
                        # Общая оценка: если есть калории, но нет других значений
                        # Используем типичное соотношение: белки 20%, жиры 30%, углеводы 50% от калорий
                        # 1г белка = 4 ккал, 1г жира = 9 ккал, 1г углеводов = 4 ккал
                        if proteins is None:
                            # Белки: ~20% от калорий
                            estimated_proteins = (calories * 0.20) / 4.0
                            nutrition_data["estimated_proteins_per_100g"] = round(estimated_proteins, 1)
                        if fats is None:
                            # Жиры: ~30% от калорий
                            estimated_fats = (calories * 0.30) / 9.0
                            nutrition_data["estimated_fats_per_100g"] = round(estimated_fats, 1)
                        if carbs is None:
                            # Углеводы: оставшиеся калории
                            used_calories = (nutrition_data.get("estimated_proteins_per_100g") or 0) * 4 + (nutrition_data.get("estimated_fats_per_100g") or 0) * 9
                            remaining_calories = calories - used_calories
                            estimated_carbs = max(0, remaining_calories) / 4.0
                            nutrition_data["estimated_carbs_per_100g"] = round(estimated_carbs, 1)
                        print(f"    📊 [Gemini] Estimated КБЖУ based on calories ratio: proteins={nutrition_data.get('estimated_proteins_per_100g')}, fats={nutrition_data.get('estimated_fats_per_100g')}, carbs={nutrition_data.get('estimated_carbs_per_100g')}")
                
                # Если вообще нет КБЖУ, но есть название - используем fallback
                elif not has_all_nutrition and nutrition_data.get("name"):
                    print(f"    ⚠️  [Gemini] Got product name but no КБЖУ. Response might be truncated.")
                    print(f"    ⚠️  [Gemini] Will try to estimate КБЖУ based on product name.")
                    
                    product_name_lower = nutrition_data.get("name", "").lower()
                    
                    # Базовая оценка КБЖУ для некоторых продуктов (если ответ обрезан)
                    if "котлет" in product_name_lower or "cutlet" in product_name_lower:
                        nutrition_data.update({
                            "estimated_calories_per_100g": 250.0,
                            "estimated_proteins_per_100g": 15.0,
                            "estimated_fats_per_100g": 18.0,
                            "estimated_carbs_per_100g": 8.0,
                        })
                        print(f"    📊 [Gemini] Using estimated КБЖУ for {nutrition_data.get('name')} (response was truncated)")
                
                return nutrition_data
            
            print(f"    ❌ [Gemini] No valid JSON found in response")
            print(f"       Response preview: {text_response[:300]}")
            logger.error(f"Gemini returned no valid JSON: {text_response[:500]}")
            return None
            
    except Exception as e:
        print(f"    ❌ [Gemini] Error: {e}")
        logger.error(f"Error recognizing product with Gemini: {e}", exc_info=True)
        return None


async def recognize_product_google_vision(image_data: bytes, api_key: str) -> Optional[Dict[str, Any]]:
    """
    Распознавание продукта с помощью Google Vision API
    БЕСПЛАТНО: 1000 запросов в месяц (бесплатный tier)
    Для получения API ключа: https://cloud.google.com/vision/docs/setup
    
    Args:
        image_data: Байты изображения
        api_key: Google Cloud API ключ
        
    Returns:
        Dict с информацией о продукте или None
    """
    try:
        import httpx
        
        image_base64 = base64.b64encode(image_data).decode('utf-8')
        
        url = f"https://vision.googleapis.com/v1/images:annotate?key={api_key}"
        
        payload = {
            "requests": [
                {
                    "image": {
                        "content": image_base64
                    },
                    "features": [
                        {"type": "LABEL_DETECTION", "maxResults": 20},  # Увеличено для более точного распознавания
                        {"type": "TEXT_DETECTION", "maxResults": 50},  # Больше текста для анализа
                        {"type": "OBJECT_LOCALIZATION", "maxResults": 20}  # Больше объектов
                    ]
                }
            ]
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(url, json=payload)
            
            # Обрабатываем ошибки до raise_for_status
            if response.status_code != 200:
                error_detail = response.text
                error_json = {}
                try:
                    error_json = response.json()
                except:
                    pass
                
                error_message = error_json.get("error", {}).get("message", error_detail) if error_json else error_detail
                
                # Детальная обработка ошибок
                if response.status_code == 403:
                    detailed_error = "403 Forbidden - Проверьте:\n"
                    detailed_error += "1. Vision API включен в Google Cloud Console\n"
                    detailed_error += "2. API ключ имеет права доступа к Vision API\n"
                    detailed_error += "3. Биллинг активирован (требуется для Vision API)\n"
                    detailed_error += f"4. Детали ошибки: {error_message}"
                    print(f"    ❌ [Google Vision] {detailed_error}")
                    logger.error(f"Google Vision API 403 Forbidden: {error_message}")
                elif response.status_code == 401:
                    detailed_error = "401 Unauthorized - Неверный API ключ"
                    print(f"    ❌ [Google Vision] {detailed_error}")
                    logger.error(f"Google Vision API 401 Unauthorized: {error_message}")
                elif response.status_code == 429:
                    detailed_error = "429 Too Many Requests - Превышен лимит запросов (1000/месяц бесплатно)"
                    print(f"    ❌ [Google Vision] {detailed_error}")
                    logger.error(f"Google Vision API 429 Too Many Requests: {error_message}")
                else:
                    print(f"    ❌ [Google Vision] API Error {response.status_code}: {error_message[:500]}")
                    logger.error(f"Google Vision API error {response.status_code}: {error_message}")
                
                return None
            
            result = response.json()
            annotations = result.get("responses", [{}])[0]
            
            # Извлекаем информацию
            labels_data = annotations.get("labelAnnotations", [])
            labels = [label["description"] for label in labels_data]
            label_scores = {label["description"]: label.get("score", 0) for label in labels_data}
            
            texts_data = annotations.get("textAnnotations", [])
            texts = [text["description"] for text in texts_data[1:]] if texts_data else []  # Первый элемент - весь текст
            full_text = texts_data[0]["description"] if texts_data else ""
            
            # Извлекаем объекты из OBJECT_LOCALIZATION
            # OBJECT_LOCALIZATION определяет конкретные объекты на изображении визуально, даже без текста
            objects = annotations.get("localizedObjectAnnotations", [])
            object_names = [obj["name"] for obj in objects]
            object_scores = {obj["name"]: obj.get("score", 0) for obj in objects}
            
            # Сортируем объекты по уверенности для приоритета
            objects_sorted = sorted(objects, key=lambda x: x.get("score", 0), reverse=True)
            
            print(f"    📋 [Google Vision] Found {len(labels)} labels, {len(texts)} text blocks, {len(objects)} objects")
            print(f"       Labels: {labels[:5]}")
            print(f"       Objects: {object_names[:5]}")
            if full_text:
                print(f"       Text preview: {full_text[:100]}...")
            
            # Исключаем общие метки для более точного определения
            general_keywords = ["food", "product", "package", "label", "container", "packaging", 
                              "ingredient", "nutrition", "text", "font", "design", "graphics"]
            
            # Ищем специфичные метки (исключаем общие)
            specific_labels = []
            for label in labels:
                label_lower = label.lower()
                if not any(keyword in label_lower for keyword in general_keywords):
                    specific_labels.append(label)
            
            # ПРИОРИТЕТ 1: Визуальное распознавание продукта по изображению (без текста)
            # Определяем продукт: приоритет объектам > специфичным меткам > всем меткам
            product_name = None
            confidence = "средняя"
            
            # 1. Пробуем найти в объектах (наиболее точные, работают даже без текста)
            # OBJECT_LOCALIZATION может распознать конкретные продукты: "Carrot", "Apple", "Banana" и т.д.
            # Это работает визуально, даже если на изображении нет текста
            if objects_sorted:
                for obj in objects_sorted:
                    obj_name = obj["name"]
                    obj_score = obj.get("score", 0)
                    obj_lower = obj_name.lower()
                    
                    # Пропускаем общие метки
                    if not any(keyword in obj_lower for keyword in general_keywords):
                        product_name = obj_name
                        confidence = "высокая" if obj_score > 0.7 else "средняя" if obj_score > 0.5 else "низкая"
                        print(f"    ✅ [Google Vision] Found product from OBJECT_LOCALIZATION (visual, score: {obj_score:.2f}): {product_name}")
                        break
            
            # 2. Если не нашли, ищем в специфичных метках (визуальное распознавание)
            if not product_name and specific_labels:
                if label_scores:
                    specific_labels.sort(key=lambda x: label_scores.get(x, 0), reverse=True)
                product_name = specific_labels[0]
                confidence = "высокая" if label_scores.get(product_name, 0) > 0.7 else "средняя"
                print(f"    ✅ [Google Vision] Found product from LABEL_DETECTION (visual): {product_name}")
            
            # 3. Если не нашли, берем первую метку (но не "Food")
            if not product_name:
                for label in labels:
                    if label.lower() not in ["food", "product", "package"]:
                        product_name = label
                        break
                if not product_name and labels:
                    product_name = labels[0]
                    print(f"    ✅ [Google Vision] Found product from labels (fallback): {product_name}")
            
            # ПРИОРИТЕТ 2: Определение КБЖУ на основе визуального анализа
            # Пробуем использовать Google Gemini API для определения КБЖУ по изображению с промптом
            estimated_calories = None
            estimated_proteins = None
            estimated_fats = None
            estimated_carbs = None
            
            # Используем Gemini API для определения КБЖУ (если доступен)
            try:
                from app.core.config import settings
                gemini_api_key = settings.GOOGLE_GEMINI_API_KEY
            except:
                gemini_api_key = None
            
            if gemini_api_key and product_name:
                print(f"    🤖 [Google Vision] Используем Gemini API для определения КБЖУ по изображению...")
                try:
                    # Сначала пробуем определить доступные модели
                    available_model = await get_available_gemini_model(gemini_api_key)
                    if available_model:
                        gemini_result = await recognize_product_gemini(image_data, gemini_api_key, product_name, available_model)
                    else:
                        gemini_result = await recognize_product_gemini(image_data, gemini_api_key, product_name)
                    if gemini_result:
                        estimated_calories = gemini_result.get("estimated_calories_per_100g")
                        estimated_proteins = gemini_result.get("estimated_proteins_per_100g")
                        estimated_fats = gemini_result.get("estimated_fats_per_100g")
                        estimated_carbs = gemini_result.get("estimated_carbs_per_100g")
                        if estimated_calories or estimated_proteins:
                            print(f"    ✅ [Google Vision + Gemini] КБЖУ определено через Gemini API")
                except Exception as e:
                    print(f"    ⚠️  [Google Vision] Не удалось использовать Gemini API: {e}")
            
            # ПРИОРИТЕТ 3: Извлечение КБЖУ из текста на упаковке (если есть)
            # Это вторичный источник, используется только если Gemini не дал результата
            if not (estimated_calories or estimated_proteins or estimated_fats or estimated_carbs) and full_text:
                # Ищем КБЖУ в тексте с упаковки
                import re
                
                # Паттерны для поиска КБЖУ в тексте
                # Калории: "ккал", "kcal", "калории", "энергетическая ценность"
                calories_patterns = [
                    r'(\d+(?:[.,]\d+)?)\s*(?:ккал|kcal|калории|калорий)',
                    r'энергетическая\s+ценность[:\s]+(\d+(?:[.,]\d+)?)',
                    r'калории[:\s]+(\d+(?:[.,]\d+)?)',
                ]
                
                # Белки: "белки", "proteins", "protein"
                proteins_patterns = [
                    r'белки[:\s]+(\d+(?:[.,]\d+)?)\s*(?:г|g)',
                    r'proteins?[:\s]+(\d+(?:[.,]\d+)?)\s*(?:г|g)',
                ]
                
                # Жиры: "жиры", "fats", "fat"
                fats_patterns = [
                    r'жиры?[:\s]+(\d+(?:[.,]\d+)?)\s*(?:г|g)',
                    r'fats?[:\s]+(\d+(?:[.,]\d+)?)\s*(?:г|g)',
                ]
                
                # Углеводы: "углеводы", "carbs", "carbohydrates"
                carbs_patterns = [
                    r'углеводы?[:\s]+(\d+(?:[.,]\d+)?)\s*(?:г|g)',
                    r'carbs?|carbohydrates?[:\s]+(\d+(?:[.,]\d+)?)\s*(?:г|g)',
                ]
                
                text_lower = full_text.lower()
                
                # Ищем калории
                for pattern in calories_patterns:
                    match = re.search(pattern, text_lower, re.IGNORECASE)
                    if match:
                        try:
                            estimated_calories = float(match.group(1).replace(',', '.'))
                            print(f"    📊 [Google Vision] Found calories in text: {estimated_calories}")
                            break
                        except:
                            pass
                
                # Ищем белки
                for pattern in proteins_patterns:
                    match = re.search(pattern, text_lower, re.IGNORECASE)
                    if match:
                        try:
                            estimated_proteins = float(match.group(1).replace(',', '.'))
                            print(f"    📊 [Google Vision] Found proteins in text: {estimated_proteins}")
                            break
                        except:
                            pass
                
                # Ищем жиры
                for pattern in fats_patterns:
                    match = re.search(pattern, text_lower, re.IGNORECASE)
                    if match:
                        try:
                            estimated_fats = float(match.group(1).replace(',', '.'))
                            print(f"    📊 [Google Vision] Found fats in text: {estimated_fats}")
                            break
                        except:
                            pass
                
                # Ищем углеводы
                for pattern in carbs_patterns:
                    match = re.search(pattern, text_lower, re.IGNORECASE)
                    if match:
                        try:
                            estimated_carbs = float(match.group(1).replace(',', '.'))
                            print(f"    📊 [Google Vision] Found carbs in text: {estimated_carbs}")
                            break
                        except:
                            pass
            
            # Формируем сообщение о способе определения
            # ПРИОРИТЕТ: Визуальное распознавание (объекты/метки) - работает без текста
            if objects_sorted and product_name in object_names:
                recognition_method = "визуальное распознавание объектов (OBJECT_LOCALIZATION)"
            elif specific_labels and product_name in specific_labels:
                recognition_method = "визуальное распознавание меток (LABEL_DETECTION)"
            else:
                recognition_method = "распознавание меток"
            
            # Формируем сообщение о способе определения
            kbru_source = None
            if estimated_calories or estimated_proteins or estimated_fats or estimated_carbs:
                # Определяем источник КБЖУ
                if gemini_api_key and (estimated_calories or estimated_proteins):
                    kbru_source = "определено через Gemini API (генеративная модель с промптом)"
                elif full_text:
                    kbru_source = "извлечено из текста на упаковке"
                note = f"Продукт определен через {recognition_method} (визуально, без текста). КБЖУ {kbru_source}."
            else:
                note = f"Продукт определен через {recognition_method} (визуально, без текста). КБЖУ не найдено. Добавьте GOOGLE_GEMINI_API_KEY в .env для автоматического определения КБЖУ через Gemini API (бесплатно: 1000 запросов/месяц) или укажите вручную."
            
            result = {
                "name": product_name or "Неизвестный продукт",
                "description": ", ".join(specific_labels[:3]) if specific_labels else ", ".join(labels[:3]),
                "detected_text": full_text[:500] if full_text else None,
                "labels": labels,
                "objects": object_names,
                "confidence": confidence,
                "estimated_calories_per_100g": estimated_calories,
                "estimated_proteins_per_100g": estimated_proteins,
                "estimated_fats_per_100g": estimated_fats,
                "estimated_carbs_per_100g": estimated_carbs,
                "note": note
            }
            
            logger.info(f"Google Vision recognition completed: product='{result.get('name')}', confidence={confidence}, labels={len(labels)}, objects={len(objects)}, texts={len(texts)}")
            return result
            
    except Exception as e:
        error_msg = str(e)
        # Проверяем, является ли это HTTP ошибкой
        import httpx
        if isinstance(e, httpx.HTTPStatusError):
            if e.response.status_code == 403:
                error_msg = "403 Forbidden - Проверьте настройки API ключа и включен ли Vision API в Google Cloud Console"
            elif e.response.status_code == 401:
                error_msg = "401 Unauthorized - Неверный API ключ Google Vision"
            elif e.response.status_code == 429:
                error_msg = "429 Too Many Requests - Превышен лимит запросов (1000/месяц бесплатно)"
        print(f"    ❌ [Google Vision] Error: {error_msg}")
        logger.error(f"Error recognizing product with Google Vision: {error_msg}", exc_info=True)
        return None


async def recognize_product_spoonacular(image_data: bytes, api_key: str) -> Optional[Dict[str, Any]]:
    """
    ВРЕМЕННО ОТКЛЮЧЕНО: Spoonacular выдает одинаковые результаты для всех изображений.
    Код оставлен для возможного использования в будущем.
    
    Распознавание продукта с помощью Spoonacular API
    Использует комбинированный подход: 
    1. Извлекает штрихкод (если есть)
    2. Извлекает текст через OCR (если доступен)
    3. Ищет продукт в Spoonacular по названию/штрихкоду
    
    Args:
        image_data: Байты изображения
        api_key: Spoonacular API ключ
        
    Returns:
        Dict с информацией о продукте или None
    """
    # ВРЕМЕННО ОТКЛЮЧЕНО - возвращает одинаковые результаты для всех изображений
    logger.warning("Spoonacular recognition is temporarily disabled (returns same results for all images)")
    print(f"    ⚠️  [Spoonacular] TEMPORARILY DISABLED - returns same results for all images")
    return None
    
    # Код ниже временно не выполняется, но оставлен для будущего использования
    # Раскомментируйте код ниже, когда будете готовы использовать Spoonacular
    # Код ниже временно не выполняется, но оставлен для будущего использования
    # Раскомментируйте код ниже, когда будете готовы использовать Spoonacular
    # Для включения: замените "if False:" на "if True:" или просто уберите условие
    pass  # Весь код Spoonacular временно отключен


async def recognize_product(
    image_data: bytes,
    provider: str = "openai",
    api_key: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """
    Универсальная функция для распознавания продукта
    
    Args:
        image_data: Байты изображения
        provider: Провайдер ("openai", "google", "gemini", "spoonacular", "huggingface")
        api_key: API ключ провайдера (опционально для huggingface)
        
    Returns:
        Dict с информацией о продукте или None
    """
    print(f"  🔍 [recognize_product] Provider: {provider}, Image size: {len(image_data)} bytes")
    logger.info(f"Recognizing product with provider: {provider}, image size: {len(image_data)} bytes")
    
    # Hugging Face не требует обязательный API ключ (работает бесплатно)
    if not api_key and provider != "huggingface":
        print(f"  ❌ [recognize_product] No API key provided for provider {provider}")
        logger.warning(f"No API key provided for provider {provider}")
        return None
    
    start_time = __import__('time').time()
    result = None
    
    try:
        if provider == "openai":
            print(f"  🤖 [recognize_product] Calling OpenAI GPT-4 Vision API...")
            logger.info("Calling OpenAI GPT-4 Vision API...")
            result = await recognize_product_openai(image_data, api_key)
        elif provider == "google":
            print(f"  👁️  [recognize_product] Calling Google Vision API...")
            logger.info("Calling Google Vision API...")
            result = await recognize_product_google_vision(image_data, api_key)
        elif provider == "gemini":
            print(f"  🤖 [recognize_product] Calling Google Gemini API (direct)...")
            logger.info("Calling Google Gemini API directly (without Vision)...")
            result = await recognize_product_gemini(image_data, api_key)
        elif provider == "huggingface":
            print(f"  🤗 [recognize_product] Calling Hugging Face API (FREE)...")
            logger.info("Calling Hugging Face API...")
            result = await recognize_product_huggingface(image_data, api_key)
        elif provider == "spoonacular":
            print(f"  🥄 [recognize_product] Calling Spoonacular API...")
            logger.info("Calling Spoonacular API...")
            result = await recognize_product_spoonacular(image_data, api_key)
        else:
            print(f"  ❌ [recognize_product] Unknown provider: {provider}")
            logger.error(f"Unknown provider: {provider}")
            return None
        
        elapsed_time = __import__('time').time() - start_time
        
        if result:
            print(f"  ✅ [recognize_product] Success by {provider} in {elapsed_time:.2f}s")
            print(f"     Product: {result.get('name')}")
            print(f"     Confidence: {result.get('confidence', 'unknown')}")
            logger.info(f"Recognition successful by {provider} in {elapsed_time:.2f}s: product='{result.get('name')}', confidence={result.get('confidence', 'unknown')}")
        else:
            print(f"  ❌ [recognize_product] Failed by {provider} after {elapsed_time:.2f}s")
            logger.warning(f"Recognition failed by {provider} after {elapsed_time:.2f}s")
        
        return result

    except Exception as e:
        elapsed_time = __import__('time').time() - start_time
        print(f"  ❌ [recognize_product] ERROR in {provider} after {elapsed_time:.2f}s: {e}")
        logger.error(f"Error in {provider} recognition after {elapsed_time:.2f}s: {e}", exc_info=True)
        return None


async def recognize_product_from_text(
    dish_name: str,
    api_key: str,
) -> Optional[Dict[str, Any]]:
    """
    Определяет КБЖУ блюда/продукта по его текстовому названию через Google Gemini.

    Args:
        dish_name: Название блюда или продукта (введённое пользователем)
        api_key:   Google Gemini API ключ

    Returns:
        Dict с информацией о продукте или None
    """
    try:
        import httpx
        import json
        import re

        prompt = f"""Ты эксперт-диетолог. Пользователь ввёл название блюда или продукта: "{dish_name}".

Определи КБЖУ на 100 граммов этого блюда/продукта.

Верни ответ ТОЛЬКО в формате JSON, без дополнительного текста:
{{
    "name": "точное название на русском языке",
    "description": "краткое описание (1-2 предложения о составе или способе приготовления)",
    "estimated_calories_per_100g": число или null,
    "estimated_proteins_per_100g": число или null,
    "estimated_fats_per_100g": число или null,
    "estimated_carbs_per_100g": число или null,
    "brand": null,
    "category": "категория продукта (мясо, крупы, молочные продукты, готовое блюдо и т.д.)",
    "confidence": "высокая" или "средняя" или "низкая"
}}

ПРАВИЛА:
- Все числа должны быть числовыми значениями, не строками (например: 41, а не "41 ккал")
- Если блюдо сложное — указывай средние значения для типичного рецепта
- Если не уверен — используй null и снижай confidence
- Исправь опечатки в названии при необходимости"""

        # Пробуем модели по приоритету
        model_candidates = [
            ("v1beta", "gemini-1.5-flash"),
            ("v1beta", "gemini-1.5-pro"),
            ("v1beta", "gemini-2.0-flash"),
            ("v1", "gemini-pro"),
        ]

        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.2, "maxOutputTokens": 600},
        }

        content = None
        async with httpx.AsyncClient(timeout=30.0) as client:
            for api_version, model_name in model_candidates:
                url = (
                    f"https://generativelanguage.googleapis.com/{api_version}"
                    f"/models/{model_name}:generateContent?key={api_key}"
                )
                try:
                    response = await client.post(url, json=payload)
                    if response.status_code == 200:
                        content = response.json()["candidates"][0]["content"]["parts"][0]["text"]
                        logger.info(f"Gemini text recognition using {model_name}")
                        break
                    logger.warning(f"Gemini {model_name} returned {response.status_code}")
                except Exception as e:
                    logger.warning(f"Gemini {model_name} error: {e}")
                    continue

        if not content:
            logger.error("All Gemini models failed for text recognition")
            return None

        # Парсим JSON
        try:
            product_data = json.loads(content)
        except json.JSONDecodeError:
            match = re.search(r'\{.*\}', content, re.DOTALL)
            if match:
                product_data = json.loads(match.group())
            else:
                logger.error(f"Could not parse JSON from Gemini response: {content[:200]}")
                return None

        # Нормализация числовых полей
        for key in ['estimated_calories_per_100g', 'estimated_proteins_per_100g',
                    'estimated_fats_per_100g', 'estimated_carbs_per_100g']:
            if key in product_data and product_data[key] is not None:
                try:
                    product_data[key] = float(product_data[key])
                except (ValueError, TypeError):
                    product_data[key] = None

        logger.info(f"Text recognition: '{product_data.get('name')}' confidence={product_data.get('confidence')}")
        return product_data

    except Exception as e:
        logger.error(f"Error in text recognition: {e}", exc_info=True)
        return None

