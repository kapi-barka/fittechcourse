/**
 * Утилиты для работы с группами мышц
 * Единая система названий групп мышц для всего приложения
 */

/**
 * Стандартные названия групп мышц (используются в упражнениях и программах)
 * Только конкретные группы мышц, без общих названий (arms, back, legs)
 */
export const STANDARD_MUSCLE_GROUPS = [
  'chest',          // Грудь
  'lats',           // Широчайшие мышцы спины
  'lowerback',      // Поясница
  'quads',          // Квадрицепсы
  'hamstrings',     // Бицепс бедра
  'calves',         // Икры
  'glutes',         // Ягодицы
  'shoulders',      // Передние/средние дельты
  'rear-shoulders', // Задние дельты
  'triceps',        // Трицепсы
  'biceps',         // Бицепсы
  'abdominals',     // Пресс
  'obliques',       // Косые мышцы живота
  'traps',          // Трапеции
  'traps-middle',   // Средняя трапеция
  'forearms',       // Предплечья
  'hands',          // Руки
] as const

export type StandardMuscleGroup = typeof STANDARD_MUSCLE_GROUPS[number]

/**
 * Маппинг из ID SVG в стандартные названия групп мышц
 * Теперь каждая мышца маппится в свою уникальную группу для точной фильтрации
 */
const SVG_TO_STANDARD_MAPPING: Record<string, StandardMuscleGroup[]> = {
  // Front
  'chest': ['chest'],
  'shoulders': ['shoulders'],
  'biceps': ['biceps'],
  'forearms': ['forearms'],
  'abdominals': ['abdominals'],
  'obliques': ['obliques'],
  'quads': ['quads'],
  'calves': ['calves'],
  'traps': ['traps'],
  'hands': ['hands'],
  
  // Back
  'lats': ['lats'],
  'lowerback': ['lowerback'],
  'rear-shoulders': ['rear-shoulders'],
  'triceps': ['triceps'],
  'glutes': ['glutes'],
  'hamstrings': ['hamstrings'],
  'traps-middle': ['traps-middle'],
}

/**
 * Маппинг из стандартных названий в ID SVG (для отображения на карте)
 * Только конкретные группы мышц
 */
const STANDARD_TO_SVG_MAPPING: Record<StandardMuscleGroup, { front: string[], back: string[] }> = {
  'chest': { front: ['chest'], back: [] },
  'lats': { front: [], back: ['lats'] },
  'lowerback': { front: [], back: ['lowerback'] },
  'quads': { front: ['quads'], back: [] },
  'hamstrings': { front: [], back: ['hamstrings'] },
  'calves': { front: ['calves'], back: ['calves'] },
  'glutes': { front: [], back: ['glutes'] },
  'shoulders': { front: ['shoulders'], back: [] },
  'rear-shoulders': { front: [], back: ['rear-shoulders'] },
  'triceps': { front: [], back: ['triceps'] },
  'biceps': { front: ['biceps'], back: [] },
  'abdominals': { front: ['abdominals'], back: ['lowerback'] },
  'obliques': { front: ['obliques'], back: [] },
  'traps': { front: ['traps'], back: ['traps', 'traps-middle'] },
  'traps-middle': { front: [], back: ['traps-middle'] },
  'forearms': { front: ['forearms'], back: [] },
  'hands': { front: ['hands'], back: ['hands'] },
}

/**
 * Преобразует ID из SVG в стандартные названия групп мышц
 */
export function svgIdToStandardMuscleGroups(svgId: string): StandardMuscleGroup[] {
  return SVG_TO_STANDARD_MAPPING[svgId.toLowerCase()] || []
}

/**
 * Преобразует стандартное название группы мышц в ID SVG для отображения на карте
 */
export function standardMuscleGroupToSvgIds(
  muscleGroup: StandardMuscleGroup,
  mode: 'front' | 'back'
): string[] {
  const mapping = STANDARD_TO_SVG_MAPPING[muscleGroup]
  if (!mapping) return []
  return mode === 'front' ? mapping.front : mapping.back
}

/**
 * Нормализует название группы мышц к стандартному формату
 * Поддерживает различные варианты написания, включая SVG ID
 * Гарантирует, что каждая мышца из SVG будет кликабельна
 */
export function normalizeMuscleGroup(muscleGroup: string): StandardMuscleGroup | null {
  const normalized = muscleGroup.toLowerCase().trim()
  
  // Прямое совпадение со стандартными названиями
  if (STANDARD_MUSCLE_GROUPS.includes(normalized as StandardMuscleGroup)) {
    return normalized as StandardMuscleGroup
  }
  
  // Проверяем маппинг из SVG ID в стандартные названия
  const svgMapping = SVG_TO_STANDARD_MAPPING[normalized]
  if (svgMapping && svgMapping.length > 0) {
    // Возвращаем первую группу (можно было бы вернуть все, но для фильтрации достаточно одной)
    return svgMapping[0]
  }
  
  // Маппинг альтернативных и общих названий в конкретные группы
  const alternativeMapping: Record<string, StandardMuscleGroup> = {
    // Общие названия преобразуем в конкретные (для обратной совместимости)
    'arms': 'biceps', // "arms" → бицепсы (можно было бы добавить и трицепсы, но для фильтрации выбираем одну)
    'arm': 'biceps',
    'back': 'lats', // "back" → широчайшие (основная часть спины)
    'legs': 'quads', // "legs" → квадрицепсы (основная часть ног)
    'abs': 'abdominals', // Преобразуем abs в abdominals для единообразия
    'abdominal': 'abdominals',
    'core': 'abdominals', // "core" → пресс
    'quadriceps': 'quads',
    'hamstring': 'hamstrings',
    'lat': 'lats',
    'rear-shoulder': 'rear-shoulders',
    'trapezius': 'traps',
    'trapezii': 'traps',
  }
  
  return alternativeMapping[normalized] || null
}

/**
 * Преобразует строку с группами мышц (через запятую) в массив стандартных названий
 */
export function parseMuscleGroupsString(muscleGroupsString: string): StandardMuscleGroup[] {
  if (!muscleGroupsString) return []
  
  return muscleGroupsString
    .split(',')
    .map(mg => normalizeMuscleGroup(mg.trim()))
    .filter((mg): mg is StandardMuscleGroup => mg !== null)
}

/**
 * Преобразует массив стандартных названий в строку (через запятую)
 */
export function formatMuscleGroupsString(muscleGroups: StandardMuscleGroup[]): string {
  return muscleGroups.join(',')
}

/**
 * Получает все уникальные группы мышц из массива упражнений
 */
export function extractMuscleGroupsFromExercises(exercises: { muscle_groups?: string[] }[]): StandardMuscleGroup[] {
  const allGroups = new Set<StandardMuscleGroup>()
  
  exercises.forEach(exercise => {
    if (exercise.muscle_groups) {
      exercise.muscle_groups.forEach(mg => {
        const normalized = normalizeMuscleGroup(mg)
        if (normalized) {
          allGroups.add(normalized)
        }
      })
    }
  })
  
  return Array.from(allGroups)
}

