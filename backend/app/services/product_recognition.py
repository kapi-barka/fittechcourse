import base64
import io
import logging
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

try:
    from PIL import Image
except ImportError:
    Image = None

try:
    import pytesseract
except ImportError:
    pytesseract = None

async def recognize_product_huggingface(image_data: bytes, api_key: Optional[str] = None) -> Optional[Dict[str, Any]]:
    try:
        import httpx

        if Image is None:
            logger.error("PIL/Pillow not installed")
            return None

        image_base64 = base64.b64encode(image_data).decode('utf-8')

        model_id = "google/vit-base-patch16-224"

        url = f"https://api-inference.huggingface.co/models/{model_id}"
        headers = {}

        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"

        payload = image_base64

        print(f"    🤗 [Hugging Face] Sending request to Hugging Face API...")
        print(f"       Model: {model_id}")
        print(f"       Image size: {len(image_data)} bytes")

        async with httpx.AsyncClient(timeout=30.0) as client:

            try:

                response = await client.post(
                    url,
                    headers={**headers, "Content-Type": "image/jpeg"},
                    content=image_data,
                    timeout=30.0
                )
            except Exception as e:
                print(f"    ⚠️  [Hugging Face] Bytes method failed: {e}, trying JSON base64 method...")

                response = await client.post(
                    url,
                    headers={**headers, "Content-Type": "application/json"},
                    json={"inputs": image_base64},
                    timeout=30.0
                )

            if response.status_code == 503:

                print(f"    ⏳ [Hugging Face] Model is loading, waiting...")
                await __import__('asyncio').sleep(5)

                response = await client.post(
                    url,
                    headers={**headers, "Content-Type": "application/json"},
                    json={"inputs": image_base64},
                    timeout=30.0
                )

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

            if isinstance(result, list) and len(result) > 0:
                predictions = result[0] if isinstance(result[0], list) else result

                sorted_predictions = sorted(predictions, key=lambda x: x.get('score', 0), reverse=True)
                top_prediction = sorted_predictions[0]

                product_name = top_prediction.get('label', 'Продукт питания')
                confidence_score = top_prediction.get('score', 0)

                confidence = "высокая" if confidence_score > 0.7 else "средняя" if confidence_score > 0.4 else "низкая"

                estimated_calories = None
                estimated_proteins = None
                estimated_fats = None
                estimated_carbs = None

                product_name_lower = product_name.lower()

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
    return "gemini-2.5-flash"

async def recognize_product_gemini(image_data: bytes, api_key: str, product_name: str = None, model_name: str = None) -> Optional[Dict[str, Any]]:
    try:
        import httpx

        if Image is None:
            logger.error("PIL/Pillow not installed")
            return None

        image_base64 = base64.b64encode(image_data).decode('utf-8')

        image = Image.open(io.BytesIO(image_data))
        mime_type = f"image/{image.format.lower()}" if image.format else "image/jpeg"

        if not model_name:

            model_name = await get_available_gemini_model(api_key)

        if not model_name:

            model_name = "gemini-2.5-flash"
            api_version = "v1beta"
        else:

            if "1.5" in model_name:
                api_version = "v1beta"
            else:
                api_version = "v1"

        url = f"https://generativelanguage.googleapis.com/{api_version}/models/{model_name}:generateContent?key={api_key}"

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
                "maxOutputTokens": 2000,

            }
        }

        print(f"    🤖 [Gemini] Sending request to Gemini API...")
        print(f"       Model: {model_name} (v1 API)")
        print(f"       Product: {product_name or 'не определен'}")

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(url, json=payload)

            if response.status_code == 404:
                print(f"    ⚠️  [Gemini] Model {model_name} not found, trying alternatives...")
                alternative_configs = [
                    ("v1beta", "gemini-2.5-flash"),
                ]

                for api_version, alt_model in alternative_configs:
                    alt_url = f"https://generativelanguage.googleapis.com/{api_version}/models/{alt_model}:generateContent?key={api_key}"
                    print(f"    🔄 [Gemini] Trying {api_version}/{alt_model}...")
                    try:
                        alt_response = await client.post(alt_url, json=payload, timeout=30.0)
                        if alt_response.status_code == 200:
                            print(f"    ✅ [Gemini] Success with {api_version}/{alt_model}")
                            response = alt_response
                            model_name = alt_model
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

            text_parts = [p.get("text", "") for p in parts if p.get("text")]
            text_response = "\n".join(text_parts)

            print(f"    📝 [Gemini] Full response length: {len(text_response)} chars")
            print(f"    📝 [Gemini] Full response:\n{text_response}")

            if len(text_response) < 100:
                print(f"    ⚠️  [Gemini] WARNING: Response seems too short ({len(text_response)} chars), might be truncated!")
                print(f"    ⚠️  [Gemini] This usually means maxOutputTokens is too low or response was cut off")

            import json
            import re

            nutrition_data = None

            code_block_patterns = [
                r"```json\s*([\s\S]*?)```",
                r"```\s*([\s\S]*?)```",
            ]

            for pattern in code_block_patterns:
                code_blocks = re.findall(pattern, text_response, re.DOTALL)
                for block in code_blocks:
                    block = block.strip()

                    json_start = block.find("{")
                    if json_start != -1:
                        block = block[json_start:]

                        json_end = block.rfind("}")
                        if json_end != -1:
                            block = block[:json_end+1]
                        try:
                            nutrition_data = json.loads(block)
                            print(f"    ✅ [Gemini] Parsed nutrition data from code block")
                            break
                        except json.JSONDecodeError as e:

                            if not block.strip().endswith("}"):

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

            if not nutrition_data:
                try:
                    def to_float_val(match):
                        if not match:
                            return None
                        try:
                            return float(match.group(1).replace(',', '.'))
                        except ValueError:
                            return None

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

                calories = nutrition_data.get('estimated_calories_per_100g')
                proteins = nutrition_data.get('estimated_proteins_per_100g')
                fats = nutrition_data.get('estimated_fats_per_100g')
                carbs = nutrition_data.get('estimated_carbs_per_100g')

                has_all_nutrition = all(v is not None for v in [calories, proteins, fats, carbs])

                if calories is not None and not has_all_nutrition:
                    print(f"    ⚠️  [Gemini] Got calories ({calories}) but missing other values. Estimating based on calories...")

                    product_name_lower = nutrition_data.get("name", "").lower()

                    if "котлет" in product_name_lower or "cutlet" in product_name_lower:

                        ratio = calories / 250.0 if calories else 1.0
                        if proteins is None:
                            nutrition_data["estimated_proteins_per_100g"] = round(15.0 * ratio, 1)
                        if fats is None:
                            nutrition_data["estimated_fats_per_100g"] = round(18.0 * ratio, 1)
                        if carbs is None:
                            nutrition_data["estimated_carbs_per_100g"] = round(8.0 * ratio, 1)
                        print(f"    📊 [Gemini] Estimated КБЖУ based on calories: proteins={nutrition_data.get('estimated_proteins_per_100g')}, fats={nutrition_data.get('estimated_fats_per_100g')}, carbs={nutrition_data.get('estimated_carbs_per_100g')}")
                    else:

                        if proteins is None:

                            estimated_proteins = (calories * 0.20) / 4.0
                            nutrition_data["estimated_proteins_per_100g"] = round(estimated_proteins, 1)
                        if fats is None:

                            estimated_fats = (calories * 0.30) / 9.0
                            nutrition_data["estimated_fats_per_100g"] = round(estimated_fats, 1)
                        if carbs is None:

                            used_calories = (nutrition_data.get("estimated_proteins_per_100g") or 0) * 4 + (nutrition_data.get("estimated_fats_per_100g") or 0) * 9
                            remaining_calories = calories - used_calories
                            estimated_carbs = max(0, remaining_calories) / 4.0
                            nutrition_data["estimated_carbs_per_100g"] = round(estimated_carbs, 1)
                        print(f"    📊 [Gemini] Estimated КБЖУ based on calories ratio: proteins={nutrition_data.get('estimated_proteins_per_100g')}, fats={nutrition_data.get('estimated_fats_per_100g')}, carbs={nutrition_data.get('estimated_carbs_per_100g')}")

                elif not has_all_nutrition and nutrition_data.get("name"):
                    print(f"    ⚠️  [Gemini] Got product name but no КБЖУ. Response might be truncated.")
                    print(f"    ⚠️  [Gemini] Will try to estimate КБЖУ based on product name.")

                    product_name_lower = nutrition_data.get("name", "").lower()

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
                        {"type": "LABEL_DETECTION", "maxResults": 20},
                        {"type": "TEXT_DETECTION", "maxResults": 50},
                        {"type": "OBJECT_LOCALIZATION", "maxResults": 20}
                    ]
                }
            ]
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(url, json=payload)

            if response.status_code != 200:
                error_detail = response.text
                error_json = {}
                try:
                    error_json = response.json()
                except:
                    pass

                error_message = error_json.get("error", {}).get("message", error_detail) if error_json else error_detail

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

            labels_data = annotations.get("labelAnnotations", [])
            labels = [label["description"] for label in labels_data]
            label_scores = {label["description"]: label.get("score", 0) for label in labels_data}

            texts_data = annotations.get("textAnnotations", [])
            texts = [text["description"] for text in texts_data[1:]] if texts_data else []
            full_text = texts_data[0]["description"] if texts_data else ""

            objects = annotations.get("localizedObjectAnnotations", [])
            object_names = [obj["name"] for obj in objects]
            object_scores = {obj["name"]: obj.get("score", 0) for obj in objects}

            objects_sorted = sorted(objects, key=lambda x: x.get("score", 0), reverse=True)

            print(f"    📋 [Google Vision] Found {len(labels)} labels, {len(texts)} text blocks, {len(objects)} objects")
            print(f"       Labels: {labels[:5]}")
            print(f"       Objects: {object_names[:5]}")
            if full_text:
                print(f"       Text preview: {full_text[:100]}...")

            general_keywords = ["food", "product", "package", "label", "container", "packaging",
                              "ingredient", "nutrition", "text", "font", "design", "graphics"]

            specific_labels = []
            for label in labels:
                label_lower = label.lower()
                if not any(keyword in label_lower for keyword in general_keywords):
                    specific_labels.append(label)

            product_name = None
            confidence = "средняя"

            if objects_sorted:
                for obj in objects_sorted:
                    obj_name = obj["name"]
                    obj_score = obj.get("score", 0)
                    obj_lower = obj_name.lower()

                    if not any(keyword in obj_lower for keyword in general_keywords):
                        product_name = obj_name
                        confidence = "высокая" if obj_score > 0.7 else "средняя" if obj_score > 0.5 else "низкая"
                        print(f"    ✅ [Google Vision] Found product from OBJECT_LOCALIZATION (visual, score: {obj_score:.2f}): {product_name}")
                        break

            if not product_name and specific_labels:
                if label_scores:
                    specific_labels.sort(key=lambda x: label_scores.get(x, 0), reverse=True)
                product_name = specific_labels[0]
                confidence = "высокая" if label_scores.get(product_name, 0) > 0.7 else "средняя"
                print(f"    ✅ [Google Vision] Found product from LABEL_DETECTION (visual): {product_name}")

            if not product_name:
                for label in labels:
                    if label.lower() not in ["food", "product", "package"]:
                        product_name = label
                        break
                if not product_name and labels:
                    product_name = labels[0]
                    print(f"    ✅ [Google Vision] Found product from labels (fallback): {product_name}")

            estimated_calories = None
            estimated_proteins = None
            estimated_fats = None
            estimated_carbs = None

            try:
                from app.core.config import settings
                gemini_api_key = settings.GOOGLE_GEMINI_API_KEY
            except:
                gemini_api_key = None

            if gemini_api_key and product_name:
                print(f"    🤖 [Google Vision] Используем Gemini API для определения КБЖУ по изображению...")
                try:

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

            if not (estimated_calories or estimated_proteins or estimated_fats or estimated_carbs) and full_text:

                import re

                calories_patterns = [
                    r'(\d+(?:[.,]\d+)?)\s*(?:ккал|kcal|калории|калорий)',
                    r'энергетическая\s+ценность[:\s]+(\d+(?:[.,]\d+)?)',
                    r'калории[:\s]+(\d+(?:[.,]\d+)?)',
                ]

                proteins_patterns = [
                    r'белки[:\s]+(\d+(?:[.,]\d+)?)\s*(?:г|g)',
                    r'proteins?[:\s]+(\d+(?:[.,]\d+)?)\s*(?:г|g)',
                ]

                fats_patterns = [
                    r'жиры?[:\s]+(\d+(?:[.,]\d+)?)\s*(?:г|g)',
                    r'fats?[:\s]+(\d+(?:[.,]\d+)?)\s*(?:г|g)',
                ]

                carbs_patterns = [
                    r'углеводы?[:\s]+(\d+(?:[.,]\d+)?)\s*(?:г|g)',
                    r'carbs?|carbohydrates?[:\s]+(\d+(?:[.,]\d+)?)\s*(?:г|g)',
                ]

                text_lower = full_text.lower()

                for pattern in calories_patterns:
                    match = re.search(pattern, text_lower, re.IGNORECASE)
                    if match:
                        try:
                            estimated_calories = float(match.group(1).replace(',', '.'))
                            print(f"    📊 [Google Vision] Found calories in text: {estimated_calories}")
                            break
                        except:
                            pass

                for pattern in proteins_patterns:
                    match = re.search(pattern, text_lower, re.IGNORECASE)
                    if match:
                        try:
                            estimated_proteins = float(match.group(1).replace(',', '.'))
                            print(f"    📊 [Google Vision] Found proteins in text: {estimated_proteins}")
                            break
                        except:
                            pass

                for pattern in fats_patterns:
                    match = re.search(pattern, text_lower, re.IGNORECASE)
                    if match:
                        try:
                            estimated_fats = float(match.group(1).replace(',', '.'))
                            print(f"    📊 [Google Vision] Found fats in text: {estimated_fats}")
                            break
                        except:
                            pass

                for pattern in carbs_patterns:
                    match = re.search(pattern, text_lower, re.IGNORECASE)
                    if match:
                        try:
                            estimated_carbs = float(match.group(1).replace(',', '.'))
                            print(f"    📊 [Google Vision] Found carbs in text: {estimated_carbs}")
                            break
                        except:
                            pass

            if objects_sorted and product_name in object_names:
                recognition_method = "визуальное распознавание объектов (OBJECT_LOCALIZATION)"
            elif specific_labels and product_name in specific_labels:
                recognition_method = "визуальное распознавание меток (LABEL_DETECTION)"
            else:
                recognition_method = "распознавание меток"

            kbru_source = None
            if estimated_calories or estimated_proteins or estimated_fats or estimated_carbs:

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

    logger.warning("Spoonacular recognition is temporarily disabled (returns same results for all images)")
    print(f"    ⚠️  [Spoonacular] TEMPORARILY DISABLED - returns same results for all images")
    return None

    pass

async def recognize_product(
    image_data: bytes,
    provider: str = "gemini",
    api_key: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    print(f"  🔍 [recognize_product] Provider: {provider}, Image size: {len(image_data)} bytes")
    logger.info(f"Recognizing product with provider: {provider}, image size: {len(image_data)} bytes")

    if not api_key and provider != "huggingface":
        print(f"  ❌ [recognize_product] No API key provided for provider {provider}")
        logger.warning(f"No API key provided for provider {provider}")
        return None

    start_time = __import__('time').time()
    result = None

    try:
        if provider == "google":
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

        model_candidates = [
            ("v1beta", "gemini-2.5-flash"),
        ]

        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.2, "maxOutputTokens": 8192},
        }

        text_response = None
        async with httpx.AsyncClient(timeout=30.0) as client:
            for api_version, model_name in model_candidates:
                url = (
                    f"https://generativelanguage.googleapis.com/{api_version}"
                    f"/models/{model_name}:generateContent?key={api_key}"
                )
                try:
                    response = await client.post(url, json=payload)
                    if response.status_code == 200:
                        parts = response.json()["candidates"][0]["content"].get("parts", [])
                        text_parts = [p.get("text", "") for p in parts if p.get("text") and not p.get("thought")]
                        text_response = "\n".join(text_parts)
                        logger.info(f"Gemini text recognition using {model_name}")
                        break
                    logger.warning(f"Gemini {model_name} returned {response.status_code}")
                except Exception as e:
                    logger.warning(f"Gemini {model_name} error: {e}")
                    continue

        if not text_response:
            logger.error("All Gemini models failed for text recognition")
            return None

        product_data = None
        for pattern in [r"```json\s*([\s\S]*?)```", r"```\s*([\s\S]*?)```"]:
            match = re.search(pattern, text_response, re.DOTALL)
            if match:
                try:
                    product_data = json.loads(match.group(1).strip())
                    break
                except json.JSONDecodeError:
                    pass

        if not product_data:
            start = text_response.find('{')
            end = text_response.rfind('}')
            if start != -1 and end > start:
                try:
                    product_data = json.loads(text_response[start:end + 1])
                except json.JSONDecodeError:
                    pass

        if not product_data:
            logger.error(f"Could not parse JSON from Gemini response: {text_response[:300]}")
            return None

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
