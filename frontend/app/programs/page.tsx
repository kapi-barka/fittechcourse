/**
 * Страница тренировочных программ
 */
'use client'

import { useEffect, useState } from 'react'
import { AuthGuard } from '@/components/AuthGuard'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { programsAPI, Program } from '@/lib/api'
import { MuscleMap } from '@/components/ui/MuscleMap'
import { normalizeMuscleGroup, standardMuscleGroupToSvgIds, StandardMuscleGroup } from '@/lib/muscleGroups'

const MUSCLE_GROUP_LABELS: Record<string, string> = {
  'chest': 'Грудь',
  'lats': 'Широчайшие',
  'lowerback': 'Поясница',
  'quads': 'Квадрицепсы',
  'hamstrings': 'Бицепс бедра',
  'calves': 'Икры',
  'glutes': 'Ягодицы',
  'shoulders': 'Плечи',
  'rear-shoulders': 'Задние дельты',
  'triceps': 'Трицепсы',
  'biceps': 'Бицепсы',
  'abdominals': 'Пресс',
  'obliques': 'Косые мышцы',
  'traps': 'Трапеции',
  'traps-middle': 'Средняя трапеция',
  'forearms': 'Предплечья',
  'hands': 'Руки',
}
import {
  Dumbbell,
  Plus,
  Search,
  Clock,
  TrendingUp,
  Lock,
  Globe,
  RotateCcw
} from 'lucide-react'
import Link from 'next/link'

export default function ProgramsPage() {
  // const { user } = useAuthStore()
  const [programs, setPrograms] = useState<Program[]>([])
  const [myPrograms, setMyPrograms] = useState<Program[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [difficultyFilter, setDifficultyFilter] = useState<string>('')
  const [showPublicOnly, setShowPublicOnly] = useState(true)
  const [muscleFilter, setMuscleFilter] = useState<string>('')
  const [mapMode, setMapMode] = useState<'front' | 'back'>('front')

  useEffect(() => {
    fetchPrograms()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [difficultyFilter, showPublicOnly, muscleFilter])

  const fetchPrograms = async () => {
    setIsLoading(true)
    try {
      // Получаем программы
      const res = await programsAPI.list({
        difficulty: difficultyFilter || undefined,
        public_only: showPublicOnly,
        muscle_group: muscleFilter || undefined
      })
      setPrograms(res.data)

      // Получаем свои программы
      const myRes = await programsAPI.getMy()
      setMyPrograms(myRes.data)
    } catch (error) {
      console.error('Error fetching programs:', error)
    }
    setIsLoading(false)
  }

  const handleMuscleSelect = (svgId: string) => {
    // Преобразуем SVG ID в стандартное название группы мышц
    const normalized = normalizeMuscleGroup(svgId)
    if (!normalized) return
    
    if (muscleFilter === normalized) {
      setMuscleFilter('')
    } else {
      setMuscleFilter(normalized)
    }
  }

  const getDifficultyColor = (difficulty?: string | null) => {
    switch (difficulty) {
      case 'beginner':
        return 'text-green-400 border-green-400'
      case 'intermediate':
        return 'text-yellow-400 border-yellow-400'
      case 'advanced':
        return 'text-red-400 border-red-400'
      default:
        return 'text-gray-400 border-gray-400'
    }
  }

  const getDifficultyLabel = (difficulty?: string | null) => {
    switch (difficulty) {
      case 'beginner':
        return 'Начинающий'
      case 'intermediate':
        return 'Средний'
      case 'advanced':
        return 'Продвинутый'
      default:
        return 'Не указан'
    }
  }

  const filteredPrograms = programs.filter(program =>
    program.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <AuthGuard>
      <div className="min-h-screen">

        <main className="container mx-auto px-4 py-8">
          {/* Фильтры сверху */}
          <Card className="border-0 shadow-sm mb-8 bg-background">
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Поиск */}
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                  <Input
                    placeholder="Поиск по названию..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {/* Сложность */}
                <select
                  value={difficultyFilter}
                  onChange={(e) => setDifficultyFilter(e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Любая сложность</option>
                  <option value="beginner">Начинающий</option>
                  <option value="intermediate">Средний</option>
                  <option value="advanced">Продвинутый</option>
                </select>

                {/* Тип */}
                <div className="flex rounded-md shadow-sm">
                  <Button
                    variant={showPublicOnly ? 'default' : 'outline'}
                    className="w-1/2 rounded-r-none"
                    onClick={() => setShowPublicOnly(true)}
                  >
                    <Globe className="mr-2 h-4 w-4" />
                    Публичные
                  </Button>
                  <Button
                    variant={!showPublicOnly ? 'default' : 'outline'}
                    className="w-1/2 rounded-l-none border-l-0"
                    onClick={() => setShowPublicOnly(false)}
                  >
                    <Lock className="mr-2 h-4 w-4" />
                    Все
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 mb-8">
            {/* Левая колонка: Карта мышц */}
            <div className="lg:col-span-1">
              <Card className="border-0 shadow-md overflow-hidden sticky top-4">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Мышцы</CardTitle>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setMapMode(mapMode === 'front' ? 'back' : 'front')}
                        title="Повернуть"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                      {muscleFilter && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setMuscleFilter('')}
                          className="text-destructive hover:text-destructive"
                        >
                          Сброс
                        </Button>
                      )}
                    </div>
                  </div>
                  <CardDescription>
                    {muscleFilter ? `Выбрано: ${MUSCLE_GROUP_LABELS[muscleFilter] || muscleFilter}` : 'Нажмите для фильтрации'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex justify-center p-0 pb-4">
                  <MuscleMap
                    mode={mapMode}
                    selectedMuscles={muscleFilter ? standardMuscleGroupToSvgIds(muscleFilter as StandardMuscleGroup, mapMode) : []}
                    onSelect={handleMuscleSelect}
                    className="h-[500px] w-full"
                  />
                </CardContent>
              </Card>
            </div>

            {/* Правая колонка: Список программ */}
            <div className="lg:col-span-3">
              {/* Мои программы */}
              {myPrograms.length > 0 && !muscleFilter && !difficultyFilter && !searchQuery && (
                <div className="mb-8">
                  <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Мои программы</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {myPrograms.map((program) => (
                      <Link key={program.id} href={`/programs/${program.id}`}>
                        <Card className="hover:shadow-lg transition-all cursor-pointer h-full border-0 flex flex-col overflow-hidden">
                          {program.image_url && (
                            <div
                              className="h-32 w-full bg-cover bg-center"
                              style={{ backgroundImage: `url(${program.image_url})` }}
                            />
                          )}
                          <CardHeader>
                            <div className="flex items-start justify-between mb-2">
                              <div className={`px-2 py-1 rounded text-xs font-medium border ${getDifficultyColor(program.difficulty)}`}>
                                {getDifficultyLabel(program.difficulty)}
                              </div>
                              {!program.is_public && <Lock className="h-4 w-4 text-muted-foreground" />}
                            </div>
                            <CardTitle className="line-clamp-2">{program.title}</CardTitle>
                            <CardDescription className="line-clamp-2">
                              {program.description || 'Без описания'}
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="mt-auto">
                            <div className="flex items-center justify-between text-sm text-muted-foreground">
                              {program.duration_weeks && (
                                <div className="flex items-center">
                                  <Clock className="h-4 w-4 mr-1" />
                                  {program.duration_weeks} нед.
                                </div>
                              )}
                              <div className="flex items-center">
                                <Dumbbell className="h-4 w-4 mr-1" />
                                Моя
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Все программы */}
              <div>
                <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
                  {showPublicOnly ? 'Публичные программы' : 'Все доступные программы'}
                </h2>
                {isLoading ? (
                  <div className="text-center py-12">
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
                    <p className="mt-4 text-muted-foreground">Загрузка...</p>
                  </div>
                ) : filteredPrograms.length === 0 ? (
                  <Card className="border-0">
                    <CardContent className="text-center py-12">
                      <Dumbbell className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                      <p className="text-lg font-medium mb-2">Программы не найдены</p>
                      <p className="text-muted-foreground mb-4">
                        Измените фильтры или создайте свою программу
                      </p>
                      <Link href="/programs/create">
                        <Button>
                          <Plus className="mr-2 h-4 w-4" />
                          Создать программу
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredPrograms.map((program) => (
                      <Link key={program.id} href={`/programs/${program.id}`}>
                        <Card className="hover:shadow-lg transition-all cursor-pointer h-full border-0 flex flex-col overflow-hidden">
                          {program.image_url && (
                            <div
                              className="h-32 w-full bg-cover bg-center"
                              style={{ backgroundImage: `url(${program.image_url})` }}
                            />
                          )}
                          <CardHeader>
                            <div className="flex items-start justify-between mb-2">
                              <div className={`px-2 py-1 rounded text-xs font-medium border ${getDifficultyColor(program.difficulty)}`}>
                                {getDifficultyLabel(program.difficulty)}
                              </div>
                              {program.is_public && <Globe className="h-4 w-4 text-green-400" />}
                            </div>
                            <CardTitle className="line-clamp-2">{program.title}</CardTitle>
                            <CardDescription className="line-clamp-2">
                              {program.description || 'Без описания'}
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="mt-auto">
                            <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                              <div className="flex items-center justify-between">
                                {program.duration_weeks && (
                                  <div className="flex items-center">
                                    <Clock className="h-4 w-4 mr-1" />
                                    {program.duration_weeks} нед.
                                  </div>
                                )}
                                <div className="flex items-center text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
                                  <TrendingUp className="h-3 w-3 mr-1" />
                                  {program.author?.profile?.full_name || 'Неизвестный'}
                                </div>
                              </div>
                              {program.target_muscle_groups && (
                                <div className="text-xs bg-secondary/50 px-2 py-1 rounded mt-2 line-clamp-1">
                                  {program.target_muscle_groups.split(',').join(', ')}
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </AuthGuard>
  )
}
