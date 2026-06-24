

export const STANDARD_MUSCLE_GROUPS = [
  'chest',
  'lats',
  'lowerback',
  'quads',
  'hamstrings',
  'calves',
  'glutes',
  'shoulders',
  'rear-shoulders',
  'triceps',
  'biceps',
  'abdominals',
  'obliques',
  'traps',
  'traps-middle',
  'forearms',
  'hands',
] as const

export type StandardMuscleGroup = typeof STANDARD_MUSCLE_GROUPS[number]

const SVG_TO_STANDARD_MAPPING: Record<string, StandardMuscleGroup[]> = {

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

  'lats': ['lats'],
  'lowerback': ['lowerback'],
  'rear-shoulders': ['rear-shoulders'],
  'triceps': ['triceps'],
  'glutes': ['glutes'],
  'hamstrings': ['hamstrings'],
  'traps-middle': ['traps-middle'],
}

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

export function svgIdToStandardMuscleGroups(svgId: string): StandardMuscleGroup[] {
  return SVG_TO_STANDARD_MAPPING[svgId.toLowerCase()] || []
}

export function standardMuscleGroupToSvgIds(
  muscleGroup: StandardMuscleGroup,
  mode: 'front' | 'back'
): string[] {
  const mapping = STANDARD_TO_SVG_MAPPING[muscleGroup]
  if (!mapping) return []
  return mode === 'front' ? mapping.front : mapping.back
}

export function normalizeMuscleGroup(muscleGroup: string): StandardMuscleGroup | null {
  const normalized = muscleGroup.toLowerCase().trim()

  if (STANDARD_MUSCLE_GROUPS.includes(normalized as StandardMuscleGroup)) {
    return normalized as StandardMuscleGroup
  }

  const svgMapping = SVG_TO_STANDARD_MAPPING[normalized]
  if (svgMapping && svgMapping.length > 0) {

    return svgMapping[0]
  }

  const alternativeMapping: Record<string, StandardMuscleGroup> = {

    'arms': 'biceps',
    'arm': 'biceps',
    'back': 'lats',
    'legs': 'quads',
    'abs': 'abdominals',
    'abdominal': 'abdominals',
    'core': 'abdominals',
    'quadriceps': 'quads',
    'hamstring': 'hamstrings',
    'lat': 'lats',
    'rear-shoulder': 'rear-shoulders',
    'trapezius': 'traps',
    'trapezii': 'traps',
  }

  return alternativeMapping[normalized] || null
}

export const MUSCLE_GROUP_LABELS: Record<string, string> = {

  'chest': 'Грудь',
  'lats': 'Широчайшие',
  'lowerback': 'Поясница',
  'quads': 'Квадрицепсы',
  'hamstrings': 'Бицепс бедра',
  'calves': 'Икры',
  'glutes': 'Ягодицы',
  'shoulders': 'Плечи',
  'rear-shoulders': 'Задние дельты',
  'triceps': 'Трицепс',
  'biceps': 'Бицепс',
  'abdominals': 'Пресс',
  'obliques': 'Косые мышцы',
  'traps': 'Трапеции',
  'traps-middle': 'Средняя трапеция',
  'forearms': 'Предплечья',
  'hands': 'Руки',

  'back': 'Спина',
  'legs': 'Ноги',
  'arms': 'Руки',
  'abs': 'Пресс',
  'quadriceps': 'Квадрицепсы',
  'hamstring': 'Бицепс бедра',
}

export function translateMuscleGroup(name: string): string {
  return MUSCLE_GROUP_LABELS[name.toLowerCase()] ?? name
}

export function translateMuscleGroups(names: string[], separator = ', '): string {
  return names.map(translateMuscleGroup).join(separator)
}

export function parseMuscleGroupsString(muscleGroupsString: string): StandardMuscleGroup[] {
  if (!muscleGroupsString) return []

  return muscleGroupsString
    .split(',')
    .map(mg => normalizeMuscleGroup(mg.trim()))
    .filter((mg): mg is StandardMuscleGroup => mg !== null)
}

export function formatMuscleGroupsString(muscleGroups: StandardMuscleGroup[]): string {
  return muscleGroups.join(',')
}

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
