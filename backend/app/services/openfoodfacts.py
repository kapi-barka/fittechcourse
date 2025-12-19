"""
Сервис для интеграции с Open Food Facts API
"""
import httpx
from typing import Optional, Dict
import logging

logger = logging.getLogger(__name__)

# URL Open Food Facts API
OPENFOODFACTS_API_URL = "https://world.openfoodfacts.org/api/v2"


async def get_product_by_barcode(barcode: str) -> Optional[Dict]:
    """
    Получить информацию о продукте по штрихкоду из Open Food Facts
    
    Args:
        barcode: Штрихкод продукта (EAN-13, UPC и др.)
    
    Returns:
        Dict с данными о продукте или None если не найден
    """
    url = f"{OPENFOODFACTS_API_URL}/product/{barcode}.json"
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url)
            
            if response.status_code == 200:
                data = response.json()
                
                # Проверяем статус ответа
                if data.get("status") == 1:
                    return parse_openfoodfacts_response(data)
                else:
                    logger.info(f"Product with barcode {barcode} not found in Open Food Facts (status: {data.get('status')})")
                    return None
            elif response.status_code == 404:
                logger.info(f"Product with barcode {barcode} not found in Open Food Facts (404)")
                return None
            else:
                logger.warning(f"Open Food Facts API returned status {response.status_code} for barcode {barcode}")
                return None
                
    except httpx.TimeoutException:
        logger.error(f"Timeout while fetching product {barcode} from Open Food Facts")
        return None
    except Exception as e:
        logger.error(f"Error fetching product from Open Food Facts: {e}")
        return None


def parse_openfoodfacts_response(data: Dict) -> Dict:
    """
    Парсинг ответа от Open Food Facts API и преобразование в формат нашей БД
    
    Args:
        data: JSON ответ от Open Food Facts API
    
    Returns:
        Dict с данными продукта для создания FoodProduct
    """
    product = data.get("product", {})
    nutriments = product.get("nutriments", {})
    
    # Получаем КБЖУ на 100г
    # Сначала пробуем получить калории напрямую
    calories = nutriments.get("energy-kcal_100g")
    # Если нет, конвертируем из кДж (1 ккал = 4.184 кДж)
    if calories is None or calories == 0:
        energy_kj = nutriments.get("energy_100g", 0)
        if energy_kj and energy_kj > 0:
            calories = energy_kj / 4.184
        else:
            calories = 0
    
    proteins = nutriments.get("proteins_100g", 0) or 0
    fats = nutriments.get("fat_100g", 0) or 0
    carbs = nutriments.get("carbohydrates_100g", 0) or 0
    
    # Получаем название (предпочитаем русское, если есть)
    name = (
        product.get("product_name_ru") or 
        product.get("product_name") or 
        product.get("generic_name") or 
        "Неизвестный продукт"
    )
    
    # Бренд и категория
    brand = product.get("brands")
    category = product.get("categories")
    
    # Штрихкод
    barcode = product.get("code")
    
    return {
        "name": name,
        "calories": round(float(calories), 2) if calories else 0.0,
        "proteins": round(float(proteins), 2) if proteins else 0.0,
        "fats": round(float(fats), 2) if fats else 0.0,
        "carbs": round(float(carbs), 2) if carbs else 0.0,
        "brand": brand,
        "category": category,
        "barcode": barcode,
        "source": "openfoodfacts"
    }
