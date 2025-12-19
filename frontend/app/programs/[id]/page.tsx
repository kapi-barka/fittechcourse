/**
 * Страница просмотра программы тренировок
 */
'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

import { AuthGuard } from '@/components/AuthGuard'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { programsAPI, exercisesAPI, scheduleAPI, Exercise } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent
} from '@/components/ui/Accordion'
import {
  Dumbbell,
  ArrowLeft,
  Edit,
  Trash2,
  TrendingUp,
  Globe,
  Lock,
  Calendar,
  Activity,
  PlayCircle,
  CheckCircle,
  Bookmark
} from 'lucide-react'
import { MuscleMap } from '@/components/ui/MuscleMap'
import { getDayName } from '@/lib/utils'
import { toast } from 'react-toastify'

interface ProgramDetail {
  id: string
  exercise_id: string
  day_number: number
  sets: number
  reps: number
  rest_time: number | null
  order: number
  notes: string | null
}

interface ProgramData {
  id: string
  author_id: string
  title: string
  description: string | null
  is_public: boolean
  difficulty: string | null
  target_muscle_groups?: string | null
  image_url?: string | null
  duration_weeks: number | null
  created_at: string
  updated_at: string
  details: ProgramDetail[]
}

import { Modal } from '@/components/ui/Modal'

export default function ProgramDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user, fetchUser } = useAuthStore()
  const programId = params.id as string

  const [program, setProgram] = useState<ProgramData | null>(null)
  const [exercisesMap, setExercisesMap] = useState<Record<string, Exercise>>({})
  const [openItems, setOpenItems] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [isSaved, setIsSaved] = useState(false)

  const isActiveProgram = user?.profile?.current_program_id === programId

  useEffect(() => {
    if (programId) {
      fetchProgram()
      fetchExercises()
      fetchUser()
      checkIfSaved()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programId])

  const checkIfSaved = async () => {
    try {
      // We fetch list of saved programs to check if this one is there.
      // Not optimal but works with current API.
      const res = await import('@/lib/api').then(m => m.userProgramsAPI.list('saved'))
      const saved = res.data.some(p => p.id === programId)
      setIsSaved(saved)
    } catch (err) {
      console.error("Failed to check saved status", err)
    }
  }

  const handleToggleSave = async () => {
    try {
      const api = await import('@/lib/api').then(m => m.userProgramsAPI)
      const res = await api.toggleSave(programId)
      setIsSaved(res.data.is_saved)
      toast.success(res.data.is_saved ? 'Программа сохранена' : 'Программа удалена из сохраненных')
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      toast.error(error.response?.data?.detail || 'Ошибка при сохранении')
    }
  }

  const fetchProgram = async () => {
    try {
      const res = await programsAPI.get(programId)
      setProgram(res.data)
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      setError(error.response?.data?.detail || 'Ошибка загрузки программы')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchExercises = async () => {
    try {
      const res = await exercisesAPI.list()
      const map: Record<string, Exercise> = {}
      res.data.forEach(exercise => {
        map[exercise.id] = exercise
      })
      setExercisesMap(map)
    } catch (error) {
      console.error('Error fetching exercises:', error)
    }
  }

  const toggleAccordion = (id: string) => {
    setOpenItems(prev =>
      prev.includes(id)
        ? prev.filter(item => item !== id)
        : [...prev, id]
    )
  }

  const handleDelete = async () => {
    if (!confirm('Вы уверены, что хотите удалить эту программу?')) {
      return
    }

    try {
      await programsAPI.delete(programId)
      toast.success('Программа успешно удалена')
      router.push('/programs')
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      toast.error(error.response?.data?.detail || 'Ошибка при удалении программы')
    }
  }

  const handleStartProgramClick = () => {
    if (user?.profile?.current_program_id) {
      setShowConfirmDialog(true)
    } else {
      startProgram()
    }
  }

  const startProgram = async () => {
    try {
      await scheduleAPI.startProgram(programId)
      // Update local user state
      await fetchUser()
      toast.success('Программа успешно запущена')
      router.push('/schedule')
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      toast.error(error.response?.data?.detail || 'Ошибка при запуске программы')
    }
  }

  const handleConfirmSwitch = () => {
    setShowConfirmDialog(false)
    startProgram()
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

  const groupByDay = (details: ProgramDetail[]) => {
    const grouped: Record<number, ProgramDetail[]> = {}
    details.forEach(detail => {
      if (!grouped[detail.day_number]) {
        grouped[detail.day_number] = []
      }
      grouped[detail.day_number].push(detail)
    })
    return grouped
  }

  const isOwner = program && user && program.author_id === user.id
  const canEdit = isOwner || user?.role === 'admin'

  if (isLoading) {
    return (
      <AuthGuard>
        <div className="min-h-screen">
          <main className="container mx-auto px-4 py-8">
            <div className="text-center py-12">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
              <p className="mt-4 text-muted-foreground">Загрузка...</p>
            </div>
          </main>
        </div>
      </AuthGuard>
    )
  }

  if (error || !program) {
    return (
      <AuthGuard>
        <div className="min-h-screen">
          <main className="container mx-auto px-4 py-8">
            <Card className="border-0">
              <CardContent className="text-center py-12">
                <Dumbbell className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium mb-2">Программа не найдена</p>
                <p className="text-muted-foreground mb-4">{error}</p>
                <Button onClick={() => router.push('/programs')}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Вернуться к программам
                </Button>
              </CardContent>
            </Card>
          </main>
        </div>
      </AuthGuard>
    )
  }

  const groupedDetails = groupByDay(program.details)
  const days = Object.keys(groupedDetails).sort((a, b) => parseInt(a) - parseInt(b))

  return (
    <AuthGuard>
      <div className="min-h-screen">

        <main className="container mx-auto px-4 py-8">
          {/* Навигация */}
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Назад
          </Button>

          {/* Заголовок программы с баннером */}
          <div className="relative rounded-xl overflow-hidden shadow-xl mb-8 bg-card">
            {/* Фоновое изображение */}
            <div className="h-48 md:h-64 bg-gray-900 relative">
              {program.image_url ? (
                <img
                  src={program.image_url}
                  alt={program.title}
                  className="w-full h-full object-cover opacity-60"
                />
              ) : (
                <div className="w-full h-full bg-primary/80" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />

              <div className="absolute bottom-0 left-0 p-6 md:p-8 w-full">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getDifficultyColor(program.difficulty)}`}>
                    {getDifficultyLabel(program.difficulty)}
                  </span>
                  {program.is_public ? (
                    <span className="flex items-center text-xs bg-green-500/15 text-green-400/80 px-2 py-0.5 rounded-full backdrop-blur-sm border border-green-500/20">
                      <Globe className="h-3 w-3 mr-1" /> Публичная
                    </span>
                  ) : (
                    <span className="flex items-center text-xs bg-gray-500/20 text-gray-300 px-2 py-0.5 rounded-full backdrop-blur-sm border border-gray-500/30">
                      <Lock className="h-3 w-3 mr-1" /> Приватная
                    </span>
                  )}
                </div>

                <h1 className="text-2xl md:text-3xl font-semibold text-white mb-2 shadow-sm">{program.title}</h1>

                <div className="flex flex-wrap gap-4 text-sm text-gray-200">
                  {program.duration_weeks && (
                    <div className="flex items-center bg-black/30 px-2 py-1 rounded backdrop-blur-sm">
                      <Calendar className="h-4 w-4 mr-1.5 opacity-80" />
                      {program.duration_weeks} недель
                    </div>
                  )}
                  <div className="flex items-center bg-black/30 px-2 py-1 rounded backdrop-blur-sm">
                    <Activity className="h-4 w-4 mr-1.5 opacity-80" />
                    {program.details.length} упражнений
                  </div>
                  {program.target_muscle_groups && (
                    <div className="flex items-center bg-black/30 px-2 py-1 rounded backdrop-blur-sm">
                      <Dumbbell className="h-4 w-4 mr-1.5 opacity-80" />
                      {program.target_muscle_groups.split(',').join(', ')}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 md:p-8 grid md:grid-cols-3 gap-8">
              <div className="md:col-span-2">
                <h3 className="text-lg font-semibold mb-2">Описание</h3>
                <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {program.description || 'Описание отсутствует'}
                </p>
              </div>

              <div className="flex flex-col gap-4 justify-center">
                {isActiveProgram ? (
                  <div className="p-4 bg-primary/10 text-primary rounded-lg border border-primary/20">
                    <div className="flex items-center mb-2">
                      <CheckCircle className="h-5 w-5 mr-2" />
                      <span className="font-semibold">Активная программа</span>
                    </div>
                    <Button
                      className="w-full mt-2"
                      onClick={() => router.push('/schedule')}
                    >
                      Перейти к расписанию
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      size="lg"
                      onClick={handleStartProgramClick}
                      className="flex-1 text-lg shadow-lg transition-all duration-300 transform hover:scale-[1.02]"
                    >
                      <PlayCircle className="mr-2 h-5 w-5" />
                      Начать программу
                    </Button>
                    <Button
                      size="lg"
                      variant={isSaved ? "secondary" : "outline"}
                      className={`shadow-lg border-2 ${isSaved ? 'bg-primary/10 border-primary text-primary' : ''}`}
                      onClick={handleToggleSave}
                      title={isSaved ? "Убрать из сохраненных" : "Сохранить на потом"}
                    >
                      <Bookmark className={`h-6 w-6 ${isSaved ? 'fill-current' : ''}`} />
                    </Button>
                  </div>
                )}

                {canEdit && (
                  <div className="flex gap-2 justify-end mt-2 md:mt-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/programs/${programId}/edit`)}
                    >
                      <Edit className="h-4 w-4 mr-2" /> Редактировать
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDelete}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" /> Удалить
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Тренировочные дни */}
          {days.length === 0 ? (
            <Card className="border-0">
              <CardContent className="text-center py-12">
                <Dumbbell className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium mb-2">Упражнения не добавлены</p>
                <p className="text-muted-foreground">
                  В этой программе пока нет упражнений
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-8">
              {days.map(day => (
                <div key={day} className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/10 p-2 rounded-lg">
                      <Calendar className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold">{getDayName(parseInt(day))}</h3>
                    <div className="h-px bg-border flex-1 ml-4" />
                  </div>

                  <Accordion className="space-y-3">
                    {groupedDetails[parseInt(day)]
                      .sort((a, b) => a.order - b.order)
                      .map((detail, index) => {
                        const exercise = exercisesMap[detail.exercise_id]
                        const isOpen = openItems.includes(detail.id)

                        return (
                          <AccordionItem key={detail.id}>
                            <AccordionTrigger
                              onClick={() => toggleAccordion(detail.id)}
                              isOpen={isOpen}
                              className="hover:bg-muted/50 transition-colors"
                            >
                              <div className="flex items-center gap-4 text-left">
                                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-secondary text-secondary-foreground text-sm font-semibold shrink-0">
                                  {index + 1}
                                </span>
                                <div>
                                  <h4 className="font-semibold text-base md:text-lg">
                                    {exercise?.name || 'Загрузка...'}
                                  </h4>
                                  <p className="text-sm text-muted-foreground mt-0.5">
                                    {detail.sets} подходов × {detail.reps} повторений
                                  </p>
                                </div>
                              </div>
                            </AccordionTrigger>

                            <AccordionContent isOpen={isOpen}>
                              <div className="pt-2 pb-2 space-y-4">
                                {/* Детальные параметры */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                  <div className="bg-muted/30 p-3 rounded-lg text-center">
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Подходы</p>
                                    <p className="text-lg font-semibold">{detail.sets}</p>
                                  </div>
                                  <div className="bg-muted/30 p-3 rounded-lg text-center">
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Повторения</p>
                                    <p className="text-lg font-semibold">{detail.reps}</p>
                                  </div>
                                  {detail.rest_time && (
                                    <div className="bg-muted/30 p-3 rounded-lg text-center">
                                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Отдых</p>
                                      <p className="text-lg font-semibold flex items-center justify-center">
                                        {detail.rest_time}<span className="text-sm ml-0.5 text-muted-foreground font-normal">с</span>
                                      </p>
                                    </div>
                                  )}
                                  <div className="bg-muted/30 p-3 rounded-lg text-center">
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Мышцы</p>
                                    <p className="text-sm font-medium truncate pt-1">{exercise?.muscle_groups?.join(', ') || '-'}</p>
                                  </div>
                                </div>

                                <div className="grid md:grid-cols-2 gap-6 mt-4">
                                  {/* Видео и Muscle Map */}
                                  <div className="space-y-4">
                                    {exercise?.video_urls?.map((url, vidIndex) => {
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
                                            <PlayCircle className="h-12 w-12 text-white opacity-80 group-hover:opacity-100 transition-opacity" />
                                          </a>
                                          <div className="w-full h-full flex items-center justify-center text-muted-foreground bg-gray-100 dark:bg-gray-800">
                                            Видео упражнения {exercise.video_urls!.length > 1 ? vidIndex + 1 : ''} (В новой вкладке)
                                          </div>
                                        </div>
                                      )
                                    })}

                                    {/* Muscle Map Visualization */}
                                    {exercise?.muscle_groups && exercise.muscle_groups.length > 0 && (
                                      <div className="mt-4 p-4 bg-muted/30 rounded-lg border">
                                        <p className="text-sm font-semibold mb-2 flex items-center">
                                          <Activity className="h-4 w-4 mr-2" />
                                          Задействованные мышцы
                                        </p>
                                        <div className="h-48 flex justify-center items-center gap-4 bg-white/50 dark:bg-black/10 rounded-md p-2">
                                          <div className="h-full w-24">
                                            <MuscleMap
                                              mode="front"
                                              highlightedMuscles={exercise.muscle_groups}
                                              className="h-full w-full"
                                            />
                                          </div>
                                          <div className="h-full w-24">
                                            <MuscleMap
                                              mode="back"
                                              highlightedMuscles={exercise.muscle_groups}
                                              className="h-full w-full"
                                            />
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  <div>
                                    {exercise?.description && (
                                      <div className="mb-4">
                                        <h5 className="font-semibold mb-2 flex items-center">
                                          <TrendingUp className="h-4 w-4 mr-2" />
                                          Техника выполнения
                                        </h5>
                                        <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                                          {exercise.description}
                                        </p>
                                      </div>
                                    )}

                                    {detail.notes && (
                                      <div className="bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-lg text-sm">
                                        <span className="font-semibold text-yellow-600 dark:text-yellow-500 block mb-1">
                                          Примечание к программе:
                                        </span>
                                        {detail.notes}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        )
                      })}
                  </Accordion>
                </div>
              ))}
            </div>
          )}
        </main>
      </div >

      <Modal
        isOpen={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
        title="Смена программы"
        description="У вас уже есть активная программа. Вы уверены, что хотите сменить её? Текущий прогресс расписания будет приостановлен."
        footer={
          <>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Отмена
            </Button>
            <Button variant="default" onClick={handleConfirmSwitch}>
              Подтвердить
            </Button>
          </>
        }
      />
    </AuthGuard >
  )
}
