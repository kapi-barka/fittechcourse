/**
 * Страница текущей тренировки и расписания
 */
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AuthGuard } from '@/components/AuthGuard'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { scheduleAPI, exercisesAPI, ProgramWithDetails, Exercise, WorkoutLog } from '@/lib/api'
import { getDayName, cn } from '@/lib/utils'
import { MuscleMap } from '@/components/ui/MuscleMap'
import { Modal } from '@/components/ui/Modal'
import { toast } from 'react-toastify'
import {
  Calendar,
  Clock,
  CheckCircle2,
  Play,
  Trophy,
  Dumbbell,
  Info,
  ChevronDown,
  ChevronUp,
  RotateCcw
} from 'lucide-react'

export default function SchedulePage() {
  const router = useRouter()
  const [program, setProgram] = useState<ProgramWithDetails | null>(null)
  const [history, setHistory] = useState<WorkoutLog[]>([])
  const [exercises, setExercises] = useState<Record<string, Exercise>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [notes, setNotes] = useState('')
  const [duration, setDuration] = useState('')
  const [showHistory, setShowHistory] = useState(false)

  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [mapMode, setMapMode] = useState<'front' | 'back'>('front')
  const [completedExercises, setCompletedExercises] = useState<Set<string>>(new Set())

  const [scheduleStatus, setScheduleStatus] = useState<{
    current_week: number;
    current_day_of_week: number;
    is_completed_today: boolean;
    start_date: string;
    completed_workouts?: number;
  } | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [progRes, statusRes, exRes] = await Promise.all([
        scheduleAPI.getActiveProgram(),
        scheduleAPI.getScheduleStatus(),
        exercisesAPI.list()
      ])

      setProgram(progRes.data)
      setScheduleStatus(statusRes.data)

      // Map exercises by ID
      const exMap: Record<string, Exercise> = {}
      exRes.data.forEach(e => exMap[e.id] = e)
      setExercises(exMap)

      if (progRes.data) {
        const histRes = await scheduleAPI.getHistory({ program_id: progRes.data.id })
        setHistory(histRes.data)
      }
    } catch (error) {
      console.error('Error fetching schedule data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleFinishWorkout = async () => {
    if (!program || !scheduleStatus) return

    setIsSubmitting(true)
    try {
      await scheduleAPI.logWorkout({
        program_id: program.id,
        day_number: scheduleStatus.current_day_of_week,
        duration_minutes: duration ? parseInt(duration) : undefined,
        notes: notes
      })

      // Refresh data
      await fetchData()
      setNotes('')
      setDuration('')
      toast.success('Тренировка успешно сохранена')

    } catch (error) {
      console.error('Error logging workout:', error)
      toast.error('Ошибка при сохранении тренировки')
    } finally {
      setIsSubmitting(false)
    }
  }

  const openExerciseDetails = (exerciseId: string) => {
    const exercise = exercises[exerciseId]
    if (exercise) {
      setSelectedExercise(exercise)
      // Auto-switch map mode based on muscle group
      const backMuscles = ['traps', 'lats', 'lowerback', 'glutes', 'hamstrings', 'calves', 'triceps', 'rear-shoulders', 'traps-middle']
      const hasBackMuscle = exercise.muscle_groups?.some(mg => backMuscles.some(m => mg.includes(m)))

      if (hasBackMuscle) {
        setMapMode('back')
      } else {
        setMapMode('front')
      }
      setIsDetailsOpen(true)
    }
  }

  const toggleExerciseCompleted = (detailId: string) => {
    setCompletedExercises(prev => {
      const newSet = new Set(prev)
      if (newSet.has(detailId)) {
        newSet.delete(detailId)
      } else {
        newSet.add(detailId)
      }
      return newSet
    })
  }

  if (isLoading) {
    return (
      <AuthGuard>
        <div className="min-h-screen">
          <main className="container mx-auto px-4 py-8">
            <div className="text-center py-12">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
              <p className="mt-4 text-muted-foreground">Загрузка расписания...</p>
            </div>
          </main>
        </div>
      </AuthGuard>
    )
  }

  const currentWeek = scheduleStatus?.current_week || 1
  const currentDay = scheduleStatus?.current_day_of_week || 1
  const totalWeeks = program?.duration_weeks || 4
  const isFinished = currentWeek > totalWeeks

  // Find exercises for today (day number matches weekday)
  const todaysExercises = program?.details
    .filter(d => d.day_number === currentDay)
    .sort((a, b) => a.order - b.order) || []


  // Calculate total workout days
  const workoutsPerWeek = program ? new Set(program.details.map(d => d.day_number)).size : 0
  const totalWorkoutDays = workoutsPerWeek * (program?.duration_weeks || 1)

  // Completed workouts (from status)
  const completedWorkouts = scheduleStatus?.completed_workouts || 0

  // Progress
  const progressPercent = totalWorkoutDays > 0
    ? Math.min(100, (completedWorkouts / totalWorkoutDays) * 100)
    : 0

  return (
    <AuthGuard>
      <div className="min-h-screen">

        <main className="container mx-auto px-4 py-8">
          {!program ? (
            <Card className="border-0 shadow-lg">
              <CardContent className="text-center py-12">
                <Calendar className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h2 className="text-xl font-semibold mb-2">Нет активной программы</h2>
                <p className="text-muted-foreground mb-6">
                  Выберите программу тренировок, чтобы начать заниматься
                </p>
                <Button onClick={() => router.push('/programs')} size="lg">
                  Перейти к программам
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-8">
              {/* Верхняя панель: Прогресс и Информация */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="border-0 shadow-md">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">{program.title}</CardTitle>
                    <CardDescription>Прогресс программы</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Тренировка {completedWorkouts} из {totalWorkoutDays}</span>
                          <span className="font-medium">{Math.round(progressPercent)}%</span>
                        </div>
                        <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all duration-500"
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                      </div>

                      {isFinished && (
                        <div className="bg-green-100 dark:bg-green-900/15 text-green-700 dark:text-green-400/80 p-3 rounded-lg flex items-start text-sm">
                          <Trophy className="h-4 w-4 mr-2 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium">Программа завершена!</p>
                            <Button
                              variant="link"
                              className="px-0 h-auto text-green-600 dark:text-green-400/70 p-0 text-xs"
                              onClick={() => router.push('/programs')}
                            >
                              Выбрать новую
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-md">
                  <CardHeader className="pb-2 cursor-pointer" onClick={() => setShowHistory(!showHistory)}>
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-lg">Последние тренировки</CardTitle>
                      {showHistory ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </CardHeader>
                  {showHistory && (
                    <CardContent>
                      {history.length === 0 ? (
                        <p className="text-sm text-muted-foreground">История пуста</p>
                      ) : (
                        <div className="space-y-2">
                          {history.slice(0, 3).map(log => (
                            <div key={log.id} className="flex items-center justify-between pb-2 border-b last:border-0 text-sm">
                              <div className="flex items-center">
                                <CheckCircle2 className="h-3 w-3 text-primary mr-2" />
                                <span>{getDayName(log.day_number)}</span>
                              </div>
                              <span className="text-muted-foreground">
                                {new Date(log.completed_at).toLocaleDateString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  )}
                  {!showHistory && (
                    <CardContent className="py-2">
                      <p className="text-sm text-muted-foreground">
                        {history.length > 0
                          ? `Последняя: ${new Date(history[0].completed_at).toLocaleDateString()}`
                          : 'Нет записей'}
                      </p>
                    </CardContent>
                  )}
                </Card>
              </div>

              {/* Основная секция: Текущая тренировка */}
              <div>
                {isFinished ? (
                  <div className="h-64 flex items-center justify-center p-12 border-2 border-dashed rounded-lg">
                    <div className="text-center">
                      <Trophy className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
                      <h3 className="text-2xl font-bold mb-2">Программа завершена!</h3>
                      <Button onClick={() => router.push('/programs')}>
                        Выбрать новую программу
                      </Button>
                    </div>
                  </div>
                ) : scheduleStatus?.is_completed_today ? (
                  <div className="h-64 flex items-center justify-center p-12 border-2 border-dashed rounded-lg bg-green-50/50 dark:bg-green-900/10">
                    <div className="text-center">
                      <CheckCircle2 className="h-16 w-16 text-green-400 mx-auto mb-4" />
                      <h3 className="2xl font-semibold mb-2">Тренировка выполнена!</h3>
                      <p className="text-muted-foreground">
                        Отдыхайте до завтра!
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-semibold flex items-center">
                        <Calendar className="mr-2 h-6 w-6 text-primary" />
                        {getDayName(currentDay)}
                      </h2>
                      {todaysExercises.length > 0 && (
                        <div className="text-sm text-muted-foreground">
                          Выполнено: {completedExercises.size} из {todaysExercises.length}
                        </div>
                      )}
                    </div>

                    {todaysExercises.length === 0 ? (
                      <Card className="border-0 shadow">
                        <CardContent className="py-12 text-center">
                          <div className="bg-blue-100 dark:bg-blue-900/20 p-4 rounded-full inline-flex mb-4">
                            <Clock className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                          </div>
                          <h3 className="text-xl font-semibold mb-2">День отдыха</h3>
                          <p className="text-muted-foreground max-w-md mx-auto">
                            Сегодня в программе нет запланированных упражнений.
                          </p>
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="space-y-4">
                        {todaysExercises.map((detail, index) => {
                          const isCompleted = completedExercises.has(detail.id)
                          return (
                            <Card 
                              key={detail.id} 
                              className={cn(
                                "border-0 shadow-md hover:shadow-lg transition-all",
                                isCompleted && "bg-green-50/50 dark:bg-green-900/10 border-green-200 dark:border-green-800"
                              )}
                            >
                              <CardContent className="p-6">
                                <div className="flex items-start gap-4">
                                  <div className="flex items-center gap-3">
                                    <button
                                      type="button"
                                      onClick={() => toggleExerciseCompleted(detail.id)}
                                      className={cn(
                                        "relative flex items-center justify-center w-6 h-6 rounded-md border-2 transition-all duration-200 cursor-pointer",
                                        "focus:outline-none active:scale-95",
                                        isCompleted
                                          ? "bg-primary border-primary text-primary-foreground"
                                          : "bg-background border-muted-foreground/30 hover:border-primary/50"
                                      )}
                                      aria-label={isCompleted ? "Отметить как невыполненное" : "Отметить как выполненное"}
                                    >
                                      {isCompleted && (
                                        <CheckCircle2 className="h-4 w-4 text-primary-foreground" />
                                      )}
                                    </button>
                                    <div className="bg-purple-100 dark:bg-purple-900/30 p-3 rounded-xl hidden sm:block">
                                      <Dumbbell className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                                    </div>
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex justify-between items-start">
                                      <h3 className={cn(
                                        "text-lg font-semibold mb-1 transition-all",
                                        isCompleted && "line-through text-muted-foreground"
                                      )}>
                                        {index + 1}. {exercises[detail.exercise_id]?.name || 'Упражнение'}
                                      </h3>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0 rounded-full"
                                        onClick={() => openExerciseDetails(detail.exercise_id)}
                                        title="Подробнее"
                                      >
                                        <Info className="h-5 w-5 text-primary" />
                                      </Button>
                                    </div>

                                  <div className="grid grid-cols-3 gap-4 mt-3 text-sm">
                                    <div className="bg-muted/50 p-2 rounded text-center">
                                      <span className="block text-muted-foreground text-xs">Подходы</span>
                                      <span className="font-semibold text-base">{detail.sets}</span>
                                    </div>
                                    <div className="bg-muted/50 p-2 rounded text-center">
                                      <span className="block text-muted-foreground text-xs">Повторения</span>
                                      <span className="font-semibold text-base">{detail.reps}</span>
                                    </div>
                                    <div className="bg-muted/50 p-2 rounded text-center">
                                      <span className="block text-muted-foreground text-xs">Отдых</span>
                                      <span className="font-semibold text-base">{detail.rest_time || 60}с</span>
                                    </div>
                                  </div>

                                  {detail.notes && (
                                    <p className="text-sm text-muted-foreground mt-3 bg-yellow-50 dark:bg-yellow-900/10 p-2 rounded border border-yellow-100 dark:border-yellow-900/30">
                                      💡 {detail.notes}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                          )
                        })}

                        <Card className="border-0 shadow-lg bg-primary/5 mt-8">
                          <CardContent className="p-6">
                            <h3 className="font-semibold mb-4">Завершение тренировки</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                              <div>
                                <label className="text-sm font-medium mb-1 block">Длительность (мин)</label>
                                <Input
                                  type="number"
                                  placeholder="Например: 45"
                                  value={duration}
                                  onChange={(e) => setDuration(e.target.value)}
                                />
                              </div>
                              <div>
                                <label className="text-sm font-medium mb-1 block">Заметки</label>
                                <Input
                                  placeholder="Как прошла тренировка?"
                                  value={notes}
                                  onChange={(e) => setNotes(e.target.value)}
                                />
                              </div>
                            </div>

                            <Button
                              className="w-full text-lg h-12"
                              onClick={handleFinishWorkout}
                              disabled={isSubmitting}
                              isLoading={isSubmitting}
                            >
                              <CheckCircle2 className="mr-2 h-5 w-5" />
                              Завершить тренировку
                            </Button>
                          </CardContent>
                        </Card>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>

        {/* Modal Details */}
        <Modal
          isOpen={isDetailsOpen}
          onClose={() => setIsDetailsOpen(false)}
          title={selectedExercise?.name || 'Детали упражнения'}
          className="max-w-6xl"
        >
          <div className="space-y-6">
            {/* Описание и видео рядом */}
            {(selectedExercise?.description || (selectedExercise?.video_urls && selectedExercise.video_urls.length > 0)) && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Описание */}
                {selectedExercise?.description && (
                  <div>
                    <h4 className="font-semibold mb-2">Описание техники</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {selectedExercise.description}
                    </p>
                  </div>
                )}

                {/* Видео */}
                {selectedExercise?.video_urls && selectedExercise.video_urls.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-3">Видео</h4>
                    <div className="space-y-4">
                      {selectedExercise.video_urls.map((url, vidIndex) => {
                        const videoUrlsLength = selectedExercise.video_urls?.length ?? 0
                        const isYouTube = url.includes('youtube.com') || url.includes('youtu.be')
                        const isVideoFile = url.match(/\.(mp4|webm|ogg|mov)$/i) || url.includes('cloudinary')

                        if (isYouTube) {
                          let videoId = ''
                          if (url.includes('youtu.be')) {
                            videoId = url.split('/').pop() || ''
                          } else {
                            videoId = url.split('v=')[1]?.split('&')[0] || ''
                          }

                          return (
                            <div key={vidIndex} className="aspect-video rounded-lg overflow-hidden bg-black border">
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
                            <div key={vidIndex} className="aspect-video rounded-lg overflow-hidden bg-black border">
                              <video
                                controls
                                loop
                                className="w-full h-full"
                                preload="metadata"
                              >
                                <source src={url} />
                                Ваш браузер не поддерживает видео тег.
                              </video>
                            </div>
                          )
                        }

                        return (
                          <div key={vidIndex} className="aspect-video rounded-lg overflow-hidden bg-black/10 border relative group">
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors"
                            >
                              <Play className="h-12 w-12 text-white opacity-80 group-hover:opacity-100 transition-opacity" />
                            </a>
                            <div className="w-full h-full flex items-center justify-center text-muted-foreground bg-gray-100 dark:bg-gray-800">
                              Видео упражнения {videoUrlsLength > 1 ? vidIndex + 1 : ''} (В новой вкладке)
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Карта мышц */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-semibold">Задействованные мышцы</h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMapMode(mapMode === 'front' ? 'back' : 'front')}
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Повернуть
                </Button>
              </div>
              <div className="bg-muted/10 rounded-lg p-4 flex justify-center">
                <MuscleMap
                  mode={mapMode}
                  highlightedMuscles={selectedExercise?.muscle_groups || []}
                  className="h-64 w-full"
                />
              </div>
              {selectedExercise?.muscle_groups && (
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  Группа: {selectedExercise.muscle_groups.join(', ')}
                </p>
              )}
            </div>
          </div>
        </Modal>
      </div>
    </AuthGuard>
  )
}
