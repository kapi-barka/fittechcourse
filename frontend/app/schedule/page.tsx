
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AuthGuard } from '@/components/AuthGuard'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { scheduleAPI, exercisesAPI, ProgramWithDetails, Exercise } from '@/lib/api'
import { getDayName, cn } from '@/lib/utils'
import { MuscleMap } from '@/components/ui/MuscleMap'
import { translateMuscleGroups } from '@/lib/muscleGroups'
import { Modal } from '@/components/ui/Modal'
import { toast } from 'react-toastify'
import {
  Calendar,
  Clock,
  CheckCircle2,
  Play,
  Trophy,
  Info,
  RotateCcw
} from 'lucide-react'

export default function SchedulePage() {
  const router = useRouter()
  const [program, setProgram] = useState<ProgramWithDetails | null>(null)
  const [exercises, setExercises] = useState<Record<string, Exercise>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [notes, setNotes] = useState('')
  const [duration, setDuration] = useState('')

  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [mapMode, setMapMode] = useState<'front' | 'back'>('front')
  const [completedExercises, setCompletedExercises] = useState<Set<string>>(new Set())

  const [scheduleStatus, setScheduleStatus] = useState<{
    current_week: number;
    current_day_of_week: number;
    completed_workouts: number;
    total_workout_days: number;
    workouts_per_week: number;
    duration_weeks: number;
    training_days: number[];
    progress_percent: number;
    is_completed_today: boolean;
    start_date: string;
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

      const exMap: Record<string, Exercise> = {}
      exRes.data.forEach(e => exMap[e.id] = e)
      setExercises(exMap)

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
        day_number: currentDay,
        duration_minutes: duration ? parseInt(duration) : undefined,
        notes: notes
      })

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
          <main className="container mx-auto px-4 py-4 sm:py-8">
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
  const totalWeeks = scheduleStatus?.duration_weeks || program?.duration_weeks || 4
  const isFinished = scheduleStatus ? scheduleStatus.completed_workouts >= scheduleStatus.total_workout_days && scheduleStatus.total_workout_days > 0 : false

  const todaysExercises = program?.details
    .filter(d => d.day_number === currentDay)
    .sort((a, b) => a.order - b.order) || []

  const completedWorkouts = scheduleStatus?.completed_workouts || 0
  const workoutsPerWeek = scheduleStatus?.workouts_per_week || 0
  const totalWorkoutDays = scheduleStatus?.total_workout_days || 0
  const progressPercent = scheduleStatus?.progress_percent || 0

  return (
    <AuthGuard>
      <div className="min-h-screen">

        <main className="container mx-auto px-4 py-4 sm:py-8">
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
            <div className="space-y-4">

              <Card className="border-0 shadow-md">
                <CardContent className="p-4">

                  <div className="flex items-center justify-between gap-4 mb-2">
                    <div className="min-w-0">
                      <h2 className="font-bold text-sm leading-tight truncate">{program.title}</h2>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {completedWorkouts} из {totalWorkoutDays} тренировок
                      </p>
                    </div>
                    <span className="text-2xl font-bold text-primary shrink-0">
                      {Math.round(progressPercent)}%
                    </span>
                  </div>

                  <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden mb-4">
                    <div
                      className="h-full bg-primary transition-all duration-500"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>

                  {isFinished && (
                    <div className="bg-green-100 dark:bg-green-900/15 text-green-700 dark:text-green-400/80 px-3 py-2 rounded-lg flex items-center gap-2 text-sm mb-4">
                      <Trophy className="h-4 w-4 shrink-0" />
                      <span className="font-medium">Программа завершена!</span>
                      <Button variant="link" className="px-0 h-auto text-green-600 dark:text-green-400/70 p-0 text-xs ml-auto" onClick={() => router.push('/programs')}>
                        Выбрать новую
                      </Button>
                    </div>
                  )}

                  {workoutsPerWeek > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2">
                      {Array.from({ length: totalWeeks }, (_, weekIndex) => {
                        const weekNumber = weekIndex + 1
                        const doneInThisWeek = Math.min(
                          workoutsPerWeek,
                          Math.max(0, completedWorkouts - weekIndex * workoutsPerWeek)
                        )
                        const isCurrentWeek = weekNumber === currentWeek
                        return (
                          <div key={weekIndex} className="flex items-center gap-1.5">
                            <span className={cn(
                              "text-[10px] w-9 shrink-0 whitespace-nowrap",
                              isCurrentWeek ? "text-primary font-bold" : "text-muted-foreground"
                            )}>
                              Нед {weekNumber}
                            </span>
                            <div className="flex gap-1">
                              {Array.from({ length: workoutsPerWeek }, (_, dayIndex) => {
                                const isDone = dayIndex < doneInThisWeek
                                const isCurrent = isCurrentWeek && dayIndex === doneInThisWeek
                                return (
                                  <div
                                    key={dayIndex}
                                    title={isDone ? `Тренировка ${weekIndex * workoutsPerWeek + dayIndex + 1} выполнена` : undefined}
                                    className={cn(
                                      "w-5 h-5 rounded-full flex items-center justify-center transition-all",
                                      isDone
                                        ? "bg-primary text-primary-foreground"
                                        : isCurrent
                                          ? "border-2 border-primary bg-primary/10"
                                          : "bg-muted text-muted-foreground"
                                    )}
                                  >
                                    {isDone
                                      ? <CheckCircle2 className="h-3 w-3" />
                                      : <span className="text-[9px]">{weekIndex * workoutsPerWeek + dayIndex + 1}</span>
                                    }
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

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
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <h2 className="text-lg sm:text-xl font-semibold flex items-center">
                        <Calendar className="mr-2 h-5 w-5 sm:h-6 sm:w-6 text-primary" />
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
                          <div className="bg-primary/10 p-4 rounded-full inline-flex mb-4">
                            <Clock className="h-8 w-8 text-primary" />
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
                              <CardContent className="p-3 sm:p-4">
                                <div className="flex items-center gap-3">
                                  <button
                                    type="button"
                                    onClick={() => toggleExerciseCompleted(detail.id)}
                                    className={cn(
                                      "relative flex items-center justify-center w-5 h-5 rounded border-2 transition-all duration-200 cursor-pointer shrink-0",
                                      "focus:outline-none active:scale-95",
                                      isCompleted
                                        ? "bg-primary border-primary text-primary-foreground"
                                        : "bg-background border-muted-foreground/30 hover:border-primary/50"
                                    )}
                                    aria-label={isCompleted ? "Отметить как невыполненное" : "Отметить как выполненное"}
                                  >
                                    {isCompleted && (
                                      <CheckCircle2 className="h-3 w-3 text-primary-foreground" />
                                    )}
                                  </button>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-center">
                                      <h3 className={cn(
                                        "text-sm font-semibold transition-all truncate",
                                        isCompleted && "line-through text-muted-foreground"
                                      )}>
                                        {index + 1}. {exercises[detail.exercise_id]?.name || 'Упражнение'}
                                      </h3>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 p-0 rounded-full shrink-0 ml-2"
                                        onClick={() => openExerciseDetails(detail.exercise_id)}
                                        title="Подробнее"
                                      >
                                        <Info className="h-4 w-4 text-primary" />
                                      </Button>
                                    </div>
                                    <div className="flex gap-3 mt-1.5 text-xs">
                                      <span className="bg-muted/50 px-2 py-1 rounded">
                                        <span className="text-muted-foreground">Подходы: </span>
                                        <span className="font-semibold">{detail.sets}</span>
                                      </span>
                                      <span className="bg-muted/50 px-2 py-1 rounded">
                                        <span className="text-muted-foreground">Повторения: </span>
                                        <span className="font-semibold">{detail.reps}</span>
                                      </span>
                                      <span className="bg-muted/50 px-2 py-1 rounded">
                                        <span className="text-muted-foreground">Отдых: </span>
                                        <span className="font-semibold">{detail.rest_time || 60}с</span>
                                      </span>
                                    </div>
                                    {detail.notes && (
                                      <p className="text-xs text-muted-foreground mt-1.5 bg-yellow-50 dark:bg-yellow-900/10 px-2 py-1 rounded border border-yellow-100 dark:border-yellow-900/30">
                                        💡 {detail.notes}
                                      </p>
                                    )}
                                  </div>
                                </div>
                            </CardContent>
                          </Card>
                          )
                        })}

                        <Card className="border-0 shadow-lg bg-primary/5 mt-3">
                          <CardContent className="p-4">
                            <h3 className="font-semibold mb-3 text-sm">Завершение тренировки</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
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
                              className="w-full text-base sm:text-lg h-11 sm:h-12"
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

        <Modal
          isOpen={isDetailsOpen}
          onClose={() => setIsDetailsOpen(false)}
          title={selectedExercise?.name || 'Детали упражнения'}
          className="max-w-6xl"
        >
          <div className="space-y-6">

            {(selectedExercise?.description || (selectedExercise?.video_urls && selectedExercise.video_urls.length > 0)) && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {selectedExercise?.description && (
                  <div>
                    <h4 className="font-semibold mb-2">Описание техники</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {selectedExercise.description}
                    </p>
                  </div>
                )}

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
                  Группа: {translateMuscleGroups(selectedExercise.muscle_groups)}
                </p>
              )}
            </div>
          </div>
        </Modal>
      </div>
    </AuthGuard>
  )
}
