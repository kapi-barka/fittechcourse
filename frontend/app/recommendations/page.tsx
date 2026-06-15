/**
 * Страница умных рекомендаций тренировок
 */
'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { AuthGuard } from '@/components/AuthGuard'
import { Button } from '@/components/ui/Button'
import { recommendationsAPI, exercisesAPI, WorkoutRecommendation, RecommendedExercise, Exercise } from '@/lib/api'
import { cn } from '@/lib/utils'
import { toast } from 'react-toastify'
import { translateMuscleGroup } from '@/lib/muscleGroups'
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
  Timer,
  PlayCircle,
  Activity,
  TrendingUp,
} from 'lucide-react'
import { MuscleMap } from '@/components/ui/MuscleMap'

const REASON_CONFIG = {
  weak_point: {
    label: 'Фокус на отстающих мышцах',
    description: 'На основе разницы между твоими целевыми и текущими замерами тела.',
    icon: Flame,
    color: 'text-orange-400',
    gradient: 'from-orange-500/20 to-orange-900/10',
    border: 'border-orange-500/30',
    badgeBg: 'bg-orange-500',
  },
  recovery: {
    label: 'Восстановительная тренировка',
    description: 'Основные мышечные группы ещё не отдохнули. Прорабатываем свежие зоны.',
    icon: RotateCcw,
    color: 'text-primary',
    gradient: 'from-primary/20 to-primary/5',
    border: 'border-primary/30',
    badgeBg: 'bg-primary',
  },
  nutrition_sync: {
    label: 'Синхронизация с питанием',
    description: 'Нагрузка подобрана под вчерашнее потребление питательных веществ.',
    icon: Beef,
    color: 'text-emerald-400',
    gradient: 'from-emerald-500/20 to-emerald-900/10',
    border: 'border-emerald-500/30',
    badgeBg: 'bg-emerald-500',
  },
  free_day: {
    label: 'Свободная тренировка',
    description: 'Данных для персонализации пока недостаточно. Заполни профиль и замеры.',
    icon: Dumbbell,
    color: 'text-purple-400',
    gradient: 'from-purple-500/20 to-purple-900/10',
    border: 'border-purple-500/30',
    badgeBg: 'bg-purple-500',
  },
}

const MEASUREMENT_LABELS: Record<string, string> = {
  weight: 'Вес',
  waist: 'Талия',
  hips: 'Бёдра',
  chest: 'Грудь',
  biceps: 'Бицепс',
  thigh: 'Бедро',
  neck: 'Шея',
  shoulders: 'Плечи',
  calf: 'Икра',
  forearm: 'Предплечье',
  wrist: 'Запястье',
  ankle: 'Лодыжка',
}

function translateMeasurement(key: string): string {
  return MEASUREMENT_LABELS[key.toLowerCase()] ?? key
}

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  pending:   { label: 'Ожидает',   cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  accepted:  { label: 'В работе',  cls: 'bg-primary/15 text-primary border-primary/30' },
  completed: { label: 'Выполнена', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  skipped:   { label: 'Пропущена', cls: 'bg-white/5 text-muted-foreground border-white/10' },
}

function todayDateStr() {
  return format(new Date(), 'yyyy-MM-dd')
}

export default function RecommendationsPage() {
  const [rec, setRec] = useState<WorkoutRecommendation | null>(null)
  const [history, setHistory] = useState<WorkoutRecommendation[]>([])
  const [exercisesMap, setExercisesMap] = useState<Record<string, Exercise>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isActioning, setIsActioning] = useState(false)
  const [showContext, setShowContext] = useState(false)
  const [completedExercises, setCompletedExercises] = useState<Set<string>>(new Set())
  const [openExercises, setOpenExercises] = useState<Set<string>>(new Set())
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    setIsLoading(true)
    try {
      const dateStr = todayDateStr()
      const [todayRes, histRes, exRes] = await Promise.all([
        recommendationsAPI.getToday(dateStr),
        recommendationsAPI.getHistory({ limit: 6 }),
        exercisesAPI.list(),
      ])
      setRec(todayRes.data)
      setHistory(histRes.data)
      const map: Record<string, Exercise> = {}
      exRes.data.forEach(ex => { map[ex.id] = ex })
      setExercisesMap(map)
    } catch {
      toast.error('Не удалось загрузить рекомендацию')
    } finally {
      setIsLoading(false)
    }
  }

  const handleGenerate = async () => {
    setIsGenerating(true)
    try {
      const res = await recommendationsAPI.generate(todayDateStr())
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
      if (next.has(exerciseId)) next.delete(exerciseId)
      else next.add(exerciseId)
      return next
    })
  }

  const toggleOpen = (exerciseId: string) => {
    setOpenExercises(prev => {
      const next = new Set(prev)
      if (next.has(exerciseId)) next.delete(exerciseId)
      else next.add(exerciseId)
      return next
    })
  }

  if (isLoading) {
    return (
      <AuthGuard>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent" />
            <p className="mt-4 text-muted-foreground text-sm">Анализируем твои данные...</p>
          </div>
        </div>
      </AuthGuard>
    )
  }

  const config = rec ? REASON_CONFIG[rec.reason] : null
  const ReasonIcon = config?.icon ?? Sparkles
  const totalExercises = rec?.exercises.length ?? 0
  const doneCount = completedExercises.size
  const progressPct = totalExercises > 0 ? Math.round((doneCount / totalExercises) * 100) : 0
  const allDone = doneCount >= totalExercises && totalExercises > 0
  const estimatedMins = totalExercises * 5
  const today = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <AuthGuard>
      <div className="min-h-screen">
        <main className="container mx-auto px-4 py-6 max-w-4xl">

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="font-bold text-xl flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Тренировка на сегодня
              </h1>
              <p className="text-muted-foreground text-xs mt-0.5 capitalize">{today}</p>
            </div>
            {(!rec || rec.status === 'pending' || rec.status === 'skipped') && (
              <Button variant="outline" size="sm" onClick={handleGenerate} disabled={isGenerating} isLoading={isGenerating} className="rounded-xl">
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />Обновить
              </Button>
            )}
          </div>

          {!rec ? (
            <div className="text-center py-16 rounded-2xl border border-dashed border-white/10">
              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <h2 className="text-lg font-semibold mb-2">Нет данных для рекомендации</h2>
              <p className="text-muted-foreground text-sm mb-6 max-w-xs mx-auto">
                Заполни профиль, добавь замеры тела и залогируй несколько тренировок
              </p>
              <Button onClick={handleGenerate} isLoading={isGenerating} className="rounded-xl">
                Сгенерировать всё равно
              </Button>
            </div>
          ) : (
            <div className="space-y-4">

              {/* ── Reason hero card ── */}
              <div className={cn(
                'rounded-2xl border p-5 bg-gradient-to-br',
                config?.gradient, config?.border
              )}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className={cn('p-2 rounded-xl', config?.badgeBg + '/20')}>
                      <ReasonIcon className={cn('h-5 w-5', config?.color)} />
                    </div>
                    <div>
                      <p className={cn('font-semibold text-sm', config?.color)}>{config?.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{config?.description}</p>
                    </div>
                  </div>
                  <span className={cn('text-xs px-2.5 py-0.5 rounded-full border font-medium shrink-0', STATUS_CONFIG[rec.status]?.cls)}>
                    {STATUS_CONFIG[rec.status]?.label}
                  </span>
                </div>

                {/* Workout summary chips */}
                <div className="flex flex-wrap gap-2 mt-3">
                  <span className="flex items-center gap-1.5 text-xs bg-black/20 px-2.5 py-1 rounded-full text-white/70">
                    <Dumbbell className="h-3 w-3" />{totalExercises} упражнений
                  </span>
                  <span className="flex items-center gap-1.5 text-xs bg-black/20 px-2.5 py-1 rounded-full text-white/70">
                    <Timer className="h-3 w-3" />~{estimatedMins} мин
                  </span>
                  {rec.context?.nutrition && (
                    <span className="flex items-center gap-1.5 text-xs bg-black/20 px-2.5 py-1 rounded-full text-white/70">
                      <Beef className="h-3 w-3" />
                      Белок {rec.context.nutrition.protein_label === 'today' ? 'сегодня' : 'вчера'}:{' '}
                      {rec.context.nutrition.display_protein ?? rec.context.nutrition.yesterday_protein}г
                      {rec.context.nutrition.target_protein ? ` / ${rec.context.nutrition.target_protein}г` : ''}
                    </span>
                  )}
                </div>

                {/* Weak points */}
                {rec.context?.weak_points && rec.context.weak_points.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {rec.context.weak_points.slice(0, 3).map(wp => (
                      <span key={wp.measurement} className="text-xs bg-black/20 border border-white/10 rounded-lg px-2 py-0.5 text-white/60">
                        {translateMeasurement(wp.measurement)}: {wp.current} → {wp.target} см
                      </span>
                    ))}
                  </div>
                )}

                {/* Context details toggle */}
                {rec.context && (rec.context.fatigued_muscles?.length > 0 || rec.context.weak_points?.length > 0) && (
                  <button
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mt-3"
                    onClick={() => setShowContext(!showContext)}
                  >
                    Детали {showContext ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>
                )}

                {showContext && rec.context && (
                  <div className="mt-3 pt-3 border-t border-white/10 space-y-1.5 text-xs text-muted-foreground">
                    {rec.context.fatigued_muscles?.length > 0 && (
                      <p><span className="text-foreground/70 font-medium">Нагружены (48ч):</span> {rec.context.fatigued_muscles.join(', ')}</p>
                    )}
                    {rec.context.weak_points?.map(wp => (
                      <p key={wp.measurement}>
                        <span className="text-foreground/70 font-medium">{translateMeasurement(wp.measurement)}:</span> дефицит {wp.deficit} см (текущий {wp.current} → цель {wp.target})
                      </p>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Action buttons (pending) ── */}
              {rec.status === 'pending' && (
                <div className="flex gap-2">
                  <Button className="flex-1 rounded-xl" onClick={handleAccept} disabled={isActioning} isLoading={isActioning}>
                    <PlayCircle className="h-4 w-4 mr-2" />Начать тренировку
                  </Button>
                  <Button variant="outline" className="rounded-xl" onClick={handleSkip} disabled={isActioning}>
                    <XCircle className="h-4 w-4 mr-2" />Пропустить
                  </Button>
                </div>
              )}

              {/* ── Skipped state ── */}
              {rec.status === 'skipped' && (
                <Button className="w-full rounded-xl" variant="outline" onClick={handleGenerate} isLoading={isGenerating}>
                  <RefreshCw className="h-4 w-4 mr-2" />Сгенерировать новую тренировку
                </Button>
              )}

              {/* ── Completed state ── */}
              {rec.status === 'completed' && (
                <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-5 text-center">
                  <Trophy className="h-10 w-10 text-yellow-400 mx-auto mb-2" />
                  <p className="font-bold text-emerald-400 text-lg">Тренировка выполнена!</p>
                  <p className="text-sm text-muted-foreground mt-1">Отличная работа, продолжай в том же духе</p>
                </div>
              )}

              {/* ── Exercise list ── */}
              {rec.status !== 'skipped' && (
                <div className="space-y-3">
                  {/* Header with progress */}
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                      Упражнения
                    </h2>
                    {rec.status === 'accepted' && (
                      <span className="text-xs text-muted-foreground">{doneCount} / {totalExercises}</span>
                    )}
                  </div>

                  {/* Progress bar (accepted only) */}
                  {rec.status === 'accepted' && (
                    <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-500"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  )}

                  {rec.exercises.map((ex, idx) => (
                    <ExerciseCard
                      key={ex.exercise_id}
                      exercise={ex}
                      index={idx}
                      exerciseDetail={exercisesMap[ex.exercise_id]}
                      isCheckable={rec.status === 'accepted'}
                      isChecked={completedExercises.has(ex.exercise_id)}
                      isOpen={openExercises.has(ex.exercise_id)}
                      onToggle={() => toggleExercise(ex.exercise_id)}
                      onToggleOpen={() => toggleOpen(ex.exercise_id)}
                    />
                  ))}

                  {/* Finish button (accepted only) */}
                  {rec.status === 'accepted' && (
                    <Button
                      className={cn('w-full rounded-xl mt-2', allDone && 'ring-2 ring-yellow-400/40')}
                      onClick={handleComplete}
                      disabled={isActioning}
                      isLoading={isActioning}
                    >
                      <Trophy className={cn('h-4 w-4 mr-2', allDone && 'text-yellow-400')} />
                      {allDone ? 'Завершить тренировку 🎉' : 'Завершить тренировку'}
                    </Button>
                  )}
                </div>
              )}

              {/* ── History ── */}
              {history.length > 1 && (
                <div className="pt-2">
                  <button
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setShowHistory(!showHistory)}
                  >
                    <span className="text-xs font-semibold uppercase tracking-wider">История</span>
                    {showHistory ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>
                  {showHistory && (
                    <div className="space-y-2 mt-3">
                      {history.slice(1).map(h => {
                        const hConfig = REASON_CONFIG[h.reason]
                        const HIcon = hConfig.icon
                        const sConfig = STATUS_CONFIG[h.status]
                        return (
                          <div key={h.id} className="flex items-center gap-3 rounded-xl border border-white/8 bg-card/40 px-4 py-2.5 text-sm">
                            <HIcon className={cn('h-4 w-4 shrink-0', hConfig.color)} />
                            <span className="flex-1 text-sm">{hConfig.label}</span>
                            <span className="text-muted-foreground text-xs">
                              {new Date(h.generated_at).toLocaleDateString('ru-RU')}
                            </span>
                            <span className={cn('text-xs px-2 py-0.5 rounded-full border', sConfig?.cls)}>
                              {sConfig?.label}
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
  exerciseDetail,
  isCheckable,
  isChecked,
  isOpen,
  onToggle,
  onToggleOpen,
}: {
  exercise: RecommendedExercise
  index: number
  exerciseDetail?: Exercise
  isCheckable: boolean
  isChecked: boolean
  isOpen: boolean
  onToggle: () => void
  onToggleOpen: () => void
}) {
  return (
    <div className={cn(
      'rounded-xl border border-white/8 bg-card/40 overflow-hidden transition-all duration-200',
      isChecked && 'border-emerald-500/30 bg-emerald-500/5'
    )}>
      {/* Trigger row */}
      <div className="flex items-start gap-3 px-4 py-3">
        {/* Number / Checkbox */}
        {isCheckable ? (
          <button
            onClick={onToggle}
            className={cn(
              'mt-0.5 flex items-center justify-center w-6 h-6 rounded-full border-2 transition-all shrink-0',
              isChecked
                ? 'bg-emerald-500 border-emerald-500 text-white'
                : 'border-white/20 hover:border-primary/60'
            )}
          >
            {isChecked && <CheckCircle2 className="h-3.5 w-3.5" />}
          </button>
        ) : (
          <span className="mt-0.5 w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center shrink-0">
            {index + 1}
          </span>
        )}

        <div className="flex-1 min-w-0">
          <p className={cn('font-medium text-sm leading-snug', isChecked && 'line-through text-muted-foreground')}>
            {exercise.exercise_name}
          </p>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            <span className="text-[11px] bg-white/5 text-muted-foreground px-2 py-0.5 rounded-full">{exercise.sets} подх.</span>
            <span className="text-[11px] bg-white/5 text-muted-foreground px-2 py-0.5 rounded-full">{exercise.reps} повт.</span>
            <span className="text-[11px] bg-white/5 text-muted-foreground px-2 py-0.5 rounded-full">{exercise.rest_time}с отдых</span>
          </div>
          {exercise.reason && exercise.reason !== 'Свободная тренировка' && (
            <p className="text-[11px] text-muted-foreground/60 italic mt-1">{exercise.reason}</p>
          )}
          {exercise.muscle_groups.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {exercise.muscle_groups.map(mg => (
                <span key={mg} className="text-[11px] bg-primary/10 text-primary rounded-full px-2 py-0.5">
                  {translateMuscleGroup(mg)}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Expand toggle */}
        {exerciseDetail && (exerciseDetail.description || (exerciseDetail.video_urls && exerciseDetail.video_urls.length > 0)) && (
          <button
            onClick={onToggleOpen}
            className="mt-0.5 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors shrink-0"
          >
            <ChevronDown className={cn('h-4 w-4 transition-transform duration-200', isOpen && 'rotate-180')} />
          </button>
        )}
      </div>

      {/* Expanded content */}
      {isOpen && exerciseDetail && (
        <div className="border-t border-white/6 px-4 py-4 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {/* Left: video + muscle map */}
            <div className="space-y-3">
              {exerciseDetail.video_urls?.map((url, vidIndex) => {
                const isYouTube = url.includes('youtube.com') || url.includes('youtu.be')
                const isVideoFile = url.match(/\.(mp4|webm|ogg|mov)$/i) || url.includes('cloudinary')

                if (isYouTube) {
                  let videoId = ''
                  if (url.includes('youtu.be')) videoId = url.split('/').pop() || ''
                  else videoId = url.split('v=')[1]?.split('&')[0] || ''
                  return (
                    <div key={vidIndex} className="aspect-video rounded-xl overflow-hidden bg-black border border-white/8">
                      <iframe
                        className="w-full h-full"
                        src={`https://www.youtube.com/embed/${videoId}?loop=1&playlist=${videoId}`}
                        title={`Video ${vidIndex + 1}`}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  )
                }

                if (isVideoFile) {
                  return (
                    <div key={vidIndex} className="aspect-video rounded-xl overflow-hidden bg-black border border-white/8">
                      <video controls loop className="w-full h-full" preload="metadata">
                        <source src={url} />
                      </video>
                    </div>
                  )
                }

                return (
                  <div key={vidIndex} className="aspect-video rounded-xl overflow-hidden bg-white/4 border border-white/8 relative group">
                    <a href={url} target="_blank" rel="noopener noreferrer" className="absolute inset-0 flex items-center justify-center hover:bg-black/20 transition-colors">
                      <PlayCircle className="h-12 w-12 text-white/70 group-hover:text-white transition-colors" />
                    </a>
                  </div>
                )
              })}

              {exerciseDetail.muscle_groups && exerciseDetail.muscle_groups.length > 0 && (
                <div className="bg-white/4 rounded-xl p-3">
                  <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5" />Задействованные мышцы
                  </p>
                  <div className="flex justify-center gap-4">
                    <MuscleMap mode="front" highlightedMuscles={exerciseDetail.muscle_groups} className="h-28 w-auto" />
                    <MuscleMap mode="back"  highlightedMuscles={exerciseDetail.muscle_groups} className="h-28 w-auto" />
                  </div>
                </div>
              )}
            </div>

            {/* Right: description */}
            {exerciseDetail.description && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5" />Техника выполнения
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {exerciseDetail.description}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
