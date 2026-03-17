/**
 * Страница умных рекомендаций тренировок
 */
'use client'

import { useEffect, useState } from 'react'
import { AuthGuard } from '@/components/AuthGuard'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { recommendationsAPI, WorkoutRecommendation, RecommendedExercise } from '@/lib/api'
import { cn } from '@/lib/utils'
import { toast } from 'react-toastify'
import {
  Sparkles,
  Dumbbell,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Trophy,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Flame,
  Beef,
  RotateCcw,
} from 'lucide-react'

const REASON_CONFIG = {
  weak_point: {
    label: 'Фокус на отстающих мышцах',
    description: 'На основе разницы между твоими целевыми и текущими замерами тела.',
    icon: Flame,
    color: 'text-orange-500',
    bg: 'bg-orange-50 dark:bg-orange-900/15',
    border: 'border-orange-200 dark:border-orange-800',
  },
  recovery: {
    label: 'Восстановительная тренировка',
    description: 'Основные мышечные группы ещё не отдохнули. Прорабатываем свежие зоны.',
    icon: RotateCcw,
    color: 'text-blue-500',
    bg: 'bg-blue-50 dark:bg-blue-900/15',
    border: 'border-blue-200 dark:border-blue-800',
  },
  nutrition_sync: {
    label: 'Синхронизация с питанием',
    description: 'Нагрузка подобрана под вчерашнее потребление питательных веществ.',
    icon: Beef,
    color: 'text-green-500',
    bg: 'bg-green-50 dark:bg-green-900/15',
    border: 'border-green-200 dark:border-green-800',
  },
  free_day: {
    label: 'Свободная тренировка',
    description: 'Данных для персонализации пока недостаточно. Заполни профиль и замеры.',
    icon: Dumbbell,
    color: 'text-purple-500',
    bg: 'bg-purple-50 dark:bg-purple-900/15',
    border: 'border-purple-200 dark:border-purple-800',
  },
}

const STATUS_LABEL: Record<string, string> = {
  pending:   'Ожидает',
  accepted:  'В работе',
  completed: 'Выполнена',
  skipped:   'Пропущена',
}

export default function RecommendationsPage() {
  const [rec, setRec] = useState<WorkoutRecommendation | null>(null)
  const [history, setHistory] = useState<WorkoutRecommendation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isActioning, setIsActioning] = useState(false)
  const [showContext, setShowContext] = useState(false)
  const [completedExercises, setCompletedExercises] = useState<Set<string>>(new Set())
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setIsLoading(true)
    try {
      const [todayRes, histRes] = await Promise.all([
        recommendationsAPI.getToday(),
        recommendationsAPI.getHistory({ limit: 5 }),
      ])
      setRec(todayRes.data)
      setHistory(histRes.data)
    } catch {
      toast.error('Не удалось загрузить рекомендацию')
    } finally {
      setIsLoading(false)
    }
  }

  const handleGenerate = async () => {
    setIsGenerating(true)
    try {
      const res = await recommendationsAPI.generate()
      setRec(res.data)
      setCompletedExercises(new Set())
      toast.success('Новая рекомендация сгенерирована')
    } catch {
      toast.error('Ошибка при генерации')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleAccept = async () => {
    if (!rec) return
    setIsActioning(true)
    try {
      await recommendationsAPI.accept(rec.id)
      setRec({ ...rec, status: 'accepted' })
    } catch {
      toast.error('Ошибка')
    } finally {
      setIsActioning(false)
    }
  }

  const handleComplete = async () => {
    if (!rec) return
    setIsActioning(true)
    try {
      await recommendationsAPI.complete(rec.id)
      setRec({ ...rec, status: 'completed' })
      toast.success('Тренировка отмечена как выполненная!')
    } catch {
      toast.error('Ошибка')
    } finally {
      setIsActioning(false)
    }
  }

  const handleSkip = async () => {
    if (!rec) return
    setIsActioning(true)
    try {
      await recommendationsAPI.skip(rec.id)
      setRec({ ...rec, status: 'skipped' })
    } catch {
      toast.error('Ошибка')
    } finally {
      setIsActioning(false)
    }
  }

  const toggleExercise = (exerciseId: string) => {
    setCompletedExercises(prev => {
      const next = new Set(prev)
      next.has(exerciseId) ? next.delete(exerciseId) : next.add(exerciseId)
      return next
    })
  }

  if (isLoading) {
    return (
      <AuthGuard>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent" />
            <p className="mt-4 text-muted-foreground">Анализируем твои данные...</p>
          </div>
        </div>
      </AuthGuard>
    )
  }

  const config = rec ? REASON_CONFIG[rec.reason] : null
  const ReasonIcon = config?.icon ?? Sparkles
  const allDone = rec && completedExercises.size >= rec.exercises.length && rec.exercises.length > 0

  return (
    <AuthGuard>
      <div className="min-h-screen">
        <main className="container mx-auto px-4 py-8 max-w-3xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Sparkles className="h-6 w-6 text-primary" />
                Умные рекомендации
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                Персональные тренировки на основе твоих данных
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerate}
              disabled={isGenerating}
              isLoading={isGenerating}
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Обновить
            </Button>
          </div>

          {!rec ? (
            <Card className="border-0 shadow-lg">
              <CardContent className="text-center py-12">
                <AlertCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h2 className="text-xl font-semibold mb-2">Нет данных для рекомендации</h2>
                <p className="text-muted-foreground mb-6">
                  Заполни профиль, добавь замеры тела и залогируй несколько тренировок
                </p>
                <Button onClick={handleGenerate} isLoading={isGenerating}>
                  Сгенерировать всё равно
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Reason banner */}
              <div className={cn(
                'rounded-xl border p-4 flex items-start gap-3',
                config?.bg, config?.border
              )}>
                <ReasonIcon className={cn('h-5 w-5 mt-0.5 shrink-0', config?.color)} />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className={cn('font-semibold text-sm', config?.color)}>
                      {config?.label}
                    </p>
                    <span className={cn(
                      'text-xs px-2 py-0.5 rounded-full font-medium',
                      rec.status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                      rec.status === 'accepted'  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                      rec.status === 'skipped'   ? 'bg-muted text-muted-foreground' :
                      'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                    )}>
                      {STATUS_LABEL[rec.status]}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{config?.description}</p>

                  {/* Weak points detail */}
                  {rec.context?.weak_points && rec.context.weak_points.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {rec.context.weak_points.slice(0, 3).map(wp => (
                        <span key={wp.measurement} className="text-xs bg-background/60 border rounded px-2 py-0.5">
                          {wp.measurement}: {wp.current} → {wp.target} см
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Nutrition context */}
              {rec.context?.nutrition && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Beef className="h-3.5 w-3.5" />
                  <span>
                    Вчера белок: {rec.context.nutrition.yesterday_protein}г
                    {rec.context.nutrition.target_protein ? ` / ${rec.context.nutrition.target_protein}г` : ''}
                    {' '}·{' '}
                    Объём: {
                      rec.context.nutrition.volume_modifier === 'low'  ? '▼ снижен' :
                      rec.context.nutrition.volume_modifier === 'high' ? '▲ повышен' :
                      '— норма'
                    }
                  </span>
                  <button
                    className="ml-auto flex items-center gap-1 hover:text-foreground transition-colors"
                    onClick={() => setShowContext(!showContext)}
                  >
                    Детали {showContext ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>
                </div>
              )}

              {/* Context details (collapsible) */}
              {showContext && rec.context && (
                <Card className="border-0 bg-muted/30">
                  <CardContent className="p-4 text-xs space-y-2">
                    {rec.context.fatigued_muscles.length > 0 && (
                      <div>
                        <span className="font-medium">Нагруженные мышцы (48ч):</span>{' '}
                        {rec.context.fatigued_muscles.join(', ')}
                      </div>
                    )}
                    {rec.context.weak_points.map(wp => (
                      <div key={wp.measurement}>
                        <span className="font-medium capitalize">{wp.measurement}:</span>{' '}
                        дефицит {wp.deficit} см (текущий {wp.current} → цель {wp.target})
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Exercise list */}
              {rec.status !== 'skipped' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="font-semibold text-lg">Упражнения</h2>
                    {rec.status === 'accepted' && (
                      <span className="text-sm text-muted-foreground">
                        {completedExercises.size} / {rec.exercises.length}
                      </span>
                    )}
                  </div>

                  {rec.exercises.map((ex, idx) => (
                    <ExerciseCard
                      key={ex.exercise_id}
                      exercise={ex}
                      index={idx}
                      isCheckable={rec.status === 'accepted'}
                      isChecked={completedExercises.has(ex.exercise_id)}
                      onToggle={() => toggleExercise(ex.exercise_id)}
                    />
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                {rec.status === 'pending' && (
                  <>
                    <Button className="flex-1" onClick={handleAccept} disabled={isActioning} isLoading={isActioning}>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Начать тренировку
                    </Button>
                    <Button variant="outline" onClick={handleSkip} disabled={isActioning}>
                      <XCircle className="h-4 w-4 mr-2" />
                      Пропустить
                    </Button>
                  </>
                )}

                {rec.status === 'accepted' && (
                  <Button
                    className="flex-1"
                    onClick={handleComplete}
                    disabled={isActioning}
                    isLoading={isActioning}
                  >
                    <Trophy className={cn('h-4 w-4 mr-2', allDone && 'text-yellow-400')} />
                    Завершить тренировку
                  </Button>
                )}

                {rec.status === 'completed' && (
                  <div className="w-full rounded-xl bg-green-50 dark:bg-green-900/15 border border-green-200 dark:border-green-800 p-4 text-center">
                    <Trophy className="h-8 w-8 text-yellow-500 mx-auto mb-1" />
                    <p className="font-semibold text-green-700 dark:text-green-400">Тренировка выполнена!</p>
                  </div>
                )}

                {rec.status === 'skipped' && (
                  <Button className="flex-1" variant="outline" onClick={handleGenerate} isLoading={isGenerating}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Сгенерировать новую
                  </Button>
                )}
              </div>

              {/* History */}
              {history.length > 1 && (
                <div className="pt-4">
                  <button
                    className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-3"
                    onClick={() => setShowHistory(!showHistory)}
                  >
                    История рекомендаций
                    {showHistory ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                  {showHistory && (
                    <div className="space-y-2">
                      {history.slice(1).map(h => {
                        const hConfig = REASON_CONFIG[h.reason]
                        const HIcon = hConfig.icon
                        return (
                          <div
                            key={h.id}
                            className="flex items-center gap-3 rounded-lg border p-3 text-sm"
                          >
                            <HIcon className={cn('h-4 w-4 shrink-0', hConfig.color)} />
                            <span className="flex-1">{hConfig.label}</span>
                            <span className="text-muted-foreground text-xs">
                              {new Date(h.generated_at).toLocaleDateString('ru-RU')}
                            </span>
                            <span className={cn(
                              'text-xs px-2 py-0.5 rounded-full',
                              h.status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                              h.status === 'skipped'   ? 'bg-muted text-muted-foreground' :
                              'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                            )}>
                              {STATUS_LABEL[h.status]}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </AuthGuard>
  )
}

function ExerciseCard({
  exercise,
  index,
  isCheckable,
  isChecked,
  onToggle,
}: {
  exercise: RecommendedExercise
  index: number
  isCheckable: boolean
  isChecked: boolean
  onToggle: () => void
}) {
  return (
    <Card className={cn(
      'border-0 shadow-sm transition-all',
      isChecked && 'bg-green-50/50 dark:bg-green-900/10'
    )}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {isCheckable && (
            <button
              onClick={onToggle}
              className={cn(
                'mt-0.5 flex items-center justify-center w-6 h-6 rounded-md border-2 transition-all shrink-0',
                isChecked
                  ? 'bg-primary border-primary text-primary-foreground'
                  : 'border-muted-foreground/30 hover:border-primary/50'
              )}
            >
              {isChecked && <CheckCircle2 className="h-4 w-4" />}
            </button>
          )}

          <div className={cn(!isCheckable && 'pl-0', 'flex-1')}>
            <div className="flex items-center justify-between mb-1">
              <h3 className={cn(
                'font-semibold',
                isChecked && 'line-through text-muted-foreground'
              )}>
                {index + 1}. {exercise.exercise_name}
              </h3>
            </div>

            <div className="grid grid-cols-3 gap-2 text-sm mb-2">
              <div className="bg-muted/50 rounded p-1.5 text-center">
                <span className="block text-xs text-muted-foreground">Подходы</span>
                <span className="font-semibold">{exercise.sets}</span>
              </div>
              <div className="bg-muted/50 rounded p-1.5 text-center">
                <span className="block text-xs text-muted-foreground">Повторения</span>
                <span className="font-semibold">{exercise.reps}</span>
              </div>
              <div className="bg-muted/50 rounded p-1.5 text-center">
                <span className="block text-xs text-muted-foreground">Отдых</span>
                <span className="font-semibold">{exercise.rest_time}с</span>
              </div>
            </div>

            {exercise.reason !== 'Свободная тренировка' && (
              <p className="text-xs text-muted-foreground italic">{exercise.reason}</p>
            )}

            {exercise.muscle_groups.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {exercise.muscle_groups.map(mg => (
                  <span key={mg} className="text-xs bg-primary/10 text-primary rounded px-1.5 py-0.5">
                    {mg}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
