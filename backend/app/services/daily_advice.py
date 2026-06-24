import httpx
import json
import logging
from typing import Optional, Dict, Any
from datetime import date

logger = logging.getLogger(__name__)

async def get_available_gemini_model(api_key: str) -> Optional[str]:
    return "gemini-2.5-flash"

async def generate_daily_advice(
    user_profile: Dict[str, Any],
    today_calories: float,
    target_calories: Optional[float],
    latest_weight: Optional[float],
    target_weight: Optional[float],
    nutrition_summary: Optional[Dict[str, float]],
    api_key: str
) -> Optional[str]:
    try:

        model_name = await get_available_gemini_model(api_key)
        if not model_name:
            model_name = "gemini-2.5-flash"

        api_version = "v1beta"

        url = f"https://generativelanguage.googleapis.com/{api_version}/models/{model_name}:generateContent?key={api_key}"

        context_parts = []

        if user_profile.get('full_name'):
            context_parts.append(f"Имя: {user_profile['full_name']}")

        if user_profile.get('gender'):
            context_parts.append(f"Пол: {user_profile['gender']}")

        if user_profile.get('height'):
            context_parts.append(f"Рост: {user_profile['height']} см")

        if latest_weight:
            context_parts.append(f"Текущий вес: {latest_weight} кг")

        if target_weight:
            context_parts.append(f"Целевой вес: {target_weight} кг")
            if latest_weight:
                diff = target_weight - latest_weight
                if diff > 0:
                    context_parts.append(f"Нужно набрать: {diff:.1f} кг")
                elif diff < 0:
                    context_parts.append(f"Нужно сбросить: {abs(diff):.1f} кг")

        if target_calories:
            context_parts.append(f"Целевые калории: {target_calories} ккал/день")

        context_parts.append(f"Калории сегодня: {today_calories:.0f} ккал")

        if target_calories:
            remaining = target_calories - today_calories
            if remaining > 0:
                context_parts.append(f"Осталось: {remaining:.0f} ккал")
            elif remaining < 0:
                context_parts.append(f"Превышение: {abs(remaining):.0f} ккал")

        if nutrition_summary:
            proteins = nutrition_summary.get('total_proteins', 0)
            fats = nutrition_summary.get('total_fats', 0)
            carbs = nutrition_summary.get('total_carbs', 0)
            context_parts.append(f"Белки: {proteins:.1f}г, Жиры: {fats:.1f}г, Углеводы: {carbs:.1f}г")

        context = "\n".join(context_parts)

        examples = []
        if target_calories and today_calories < target_calories:
            remaining = target_calories - today_calories
            examples.append(f"- 'Сегодня у тебя осталось {remaining:.0f} ккал до цели. Рекомендую добавить белковый перекус: творог с ягодами или протеиновый коктейль.'")

        if target_calories:
            examples.append(f"- 'Ты уже съел {today_calories:.0f} ккал из {target_calories:.0f}. Для ужина выбери легкий салат с куриной грудкой - это поможет не превысить норму.'")

        if latest_weight and target_weight:
            examples.append(f"- 'Твой вес {latest_weight} кг, цель - {target_weight} кг. Сегодня отличный день для кардио-тренировки 30-40 минут для ускорения метаболизма.'")

        examples_text = "\n".join(examples) if examples else "- 'Продолжай следить за питанием и тренировками. Каждый день приближает тебя к цели!'"

        prompt = f"""Дай краткий персональный совет по фитнесу и питанию (2-3 предложения, до 80 слов).

Данные: {context}

Требования:
- Русский язык, обращение на "ты"
- Один конкретный совет на сегодня
- Без эмодзи и форматирования
- Только текст совета"""

        payload = {
            "contents": [
                {
                    "parts": [
                        {
                            "text": prompt
                        }
                    ]
                }
            ],
            "generationConfig": {
                "temperature": 0.7,
                "maxOutputTokens": 300,
                "topP": 0.95,
                "topK": 40
            }
        }

        headers = {
            "Content-Type": "application/json"
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(url, headers=headers, json=payload)
            response.raise_for_status()

            result = response.json()

            if 'candidates' in result and len(result['candidates']) > 0:
                candidate = result['candidates'][0]

                finish_reason = candidate.get('finishReason', '')
                if finish_reason == 'MAX_TOKENS':
                    logger.warning("Gemini response was truncated due to MAX_TOKENS limit")

                if 'content' in candidate:
                    content = candidate['content']

                    if 'parts' in content and len(content['parts']) > 0:
                        parts = content['parts']
                        if 'text' in parts[0]:
                            advice = parts[0]['text'].strip()
                            if advice:
                                logger.info(f"Generated daily advice with Gemini: {advice[:50]}...")
                                if finish_reason == 'MAX_TOKENS':

                                    advice = advice.rstrip('.') + '...'
                                return advice

                    if 'text' in content:
                        advice = content['text'].strip()
                        if advice:
                            logger.info(f"Generated daily advice with Gemini (alternative path): {advice[:50]}...")
                            return advice

                if finish_reason == 'MAX_TOKENS':
                    logger.warning("Gemini response truncated with no text output. Returning fallback advice.")

                    if target_calories and today_calories < target_calories:
                        remaining = target_calories - today_calories
                        return f"Сегодня у тебя осталось {remaining:.0f} ккал до цели. Добавь белковый перекус для достижения целевых калорий."
                    elif target_calories and today_calories > target_calories:
                        excess = today_calories - target_calories
                        return f"Ты превысил норму на {excess:.0f} ккал. Завтра начни с легкого завтрака и увеличь активность."
                    else:
                        return "Продолжай следить за питанием и тренировками. Каждый день приближает тебя к цели!"

            logger.error(f"Unexpected Gemini response format: {json.dumps(result, indent=2, ensure_ascii=False)}")
            return None

    except Exception as e:
        logger.error(f"Error generating daily advice: {str(e)}")
        return None
