
'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'

import { AuthGuard } from '@/components/AuthGuard'
import { Button } from '@/components/ui/Button'
import { programsAPI, exercisesAPI, scheduleAPI, Exercise } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
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
  Bookmark,
  ChevronDown,
  Timer,
} from 'lucide-react'
import { MuscleMap } from '@/components/ui/MuscleMap'
import { getDayName } from '@/lib/utils'
import { translateMuscleGroups } from '@/lib/muscleGroups'
import { toast } from 'react-toastify'
import { Modal } from '@/components/ui/Modal'

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

function getDifficultyLabel(difficulty?: string | null) {
  switch (difficulty) {
    case 'beginner':     return 'Начинающий'
    case 'intermediate': return 'Средний'
    case 'advanced':     return 'Продвинутый'
    default:             return 'Не указан'
  }
}

function getDifficultyBadge(difficulty?: string | null) {
  switch (difficulty) {
    case 'beginner':     return 'bg-emerald-500/80 text-white'
    case 'intermediate': return 'bg-amber-500/80 text-white'
    case 'advanced':     return 'bg-rose-500/80 text-white'
    default:             return 'bg-white/20 text-white'
  }
}

function getDifficultyGradient(difficulty?: string | null) {
  switch (difficulty) {
    case 'beginner':     return 'from-emerald-600 to-teal-900'
    case 'intermediate': return 'from-amber-500 to-orange-900'
    case 'advanced':     return 'from-rose-600 to-red-900'
    default:             return 'from-primary/60 to-primary/90'
  }
}

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

  }, [programId])

  const checkIfSaved = async () => {
    try {
      const res = await import('@/lib/api').then(m => m.userProgramsAPI.list('saved'))
      setIsSaved(res.data.some(p => p.id === programId))
    } catch (err) {
      console.error('Failed to check saved status', err)
    }
  }

  const handleToggleSave = async () => {
    try {
      const api = await import('@/lib/api').then(m => m.userProgramsAPI)
      const res = await api.toggleSave(programId)
      setIsSaved(res.data.is_saved)
      toast.success(res.data.is_saved ? 'Программа сохранена' : 'Программа удалена из сохраненных')
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      toast.error(e.response?.data?.detail || 'Ошибка при сохранении')
    }
  }

  const fetchProgram = async () => {
    try {
      const res = await programsAPI.get(programId)
      setProgram(res.data)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      setError(e.response?.data?.detail || 'Ошибка загрузки программы')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchExercises = async () => {
    try {
      const res = await exercisesAPI.list()
      const map: Record<string, Exercise> = {}
      res.data.forEach(ex => { map[ex.id] = ex })
      setExercisesMap(map)
    } catch (error) {
      console.error('Error fetching exercises:', error)
    }
  }

  const toggleAccordion = (id: string) => {
    setOpenItems(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }

  const handleDelete = async () => {
    if (!confirm('Вы уверены, что хотите удалить эту программу?')) return
    try {
      await programsAPI.delete(programId)
      toast.success('Программа успешно удалена')
      router.push('/programs')
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      toast.error(e.response?.data?.detail || 'Ошибка при удалении программы')
    }
  }

  const handleStartProgramClick = () => {
    if (user?.profile?.current_program_id) setShowConfirmDialog(true)
    else startProgram()
  }

  const startProgram = async () => {
    try {
      await scheduleAPI.startProgram(programId)
      await fetchUser()
      toast.success('Программа успешно запущена')
      router.push('/schedule')
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      toast.error(e.response?.data?.detail || 'Ошибка при запуске программы')
    }
  }

  const groupByDay = (details: ProgramDetail[]) => {
    const grouped: Record<number, ProgramDetail[]> = {}
    details.forEach(d => {
      if (!grouped[d.day_number]) grouped[d.day_number] = []
      grouped[d.day_number].push(d)
    })
    return grouped
  }

  const isOwner = program && user && program.author_id === user.id
  const canEdit = isOwner || user?.role === 'admin'

  if (isLoading) {
    return (
      <AuthGuard>
        <div className="min-h-screen flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent" />
        </div>
      </AuthGuard>
    )
  }

  if (error || !program) {
    return (
      <AuthGuard>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <Dumbbell className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-medium mb-2">Программа не найдена</p>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => router.push('/programs')}>
              <ArrowLeft className="mr-2 h-4 w-4" />Вернуться к программам
            </Button>
          </div>
        </div>
      </AuthGuard>
    )
  }

  const groupedDetails = groupByDay(program.details)
  const days = Object.keys(groupedDetails).sort((a, b) => parseInt(a) - parseInt(b))
  const totalExercises = program.details.length

  return (
    <AuthGuard>
      <div className="min-h-screen">
        <main className="container mx-auto px-4 py-6 max-w-6xl">

          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-5"
          >
            <ArrowLeft className="h-4 w-4" />
            Назад
          </button>

          <div className="relative rounded-2xl overflow-hidden mb-8 shadow-2xl h-64 md:h-80">
            {program.image_url ? (
              <Image
                src={program.image_url}
                alt={program.title}
                fill
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className={`absolute inset-0 bg-gradient-to-br ${getDifficultyGradient(program.difficulty)}`} />
            )}

            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10" />

            {canEdit && (
              <div className="absolute top-4 right-4 flex gap-2">
                <button
                  onClick={() => router.push(`/programs/${programId}/edit`)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white backdrop-blur-sm transition-colors"
                >
                  <Edit className="h-3.5 w-3.5" />Редактировать
                </button>
                <button
                  onClick={handleDelete}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-destructive/40 hover:bg-destructive/60 text-white backdrop-blur-sm transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />Удалить
                </button>
              </div>
            )}

            <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">

              <div className="flex flex-wrap gap-2 mb-3">
                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${getDifficultyBadge(program.difficulty)}`}>
                  {getDifficultyLabel(program.difficulty)}
                </span>
                {program.is_public ? (
                  <span className="flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    <Globe className="h-3 w-3" />Публичная
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full bg-white/10 text-white/60 border border-white/20">
                    <Lock className="h-3 w-3" />Приватная
                  </span>
                )}
              </div>

              <h1 className="text-2xl md:text-4xl font-bold text-white mb-4 leading-tight">
                {program.title}
              </h1>

              <div className="flex flex-wrap gap-2 text-sm text-white/70">
                {program.duration_weeks && (
                  <span className="flex items-center gap-1.5 bg-black/30 backdrop-blur-sm px-3 py-1 rounded-full">
                    <Calendar className="h-3.5 w-3.5" />{program.duration_weeks} нед.
                  </span>
                )}
                <span className="flex items-center gap-1.5 bg-black/30 backdrop-blur-sm px-3 py-1 rounded-full">
                  <Activity className="h-3.5 w-3.5" />{totalExercises} упражнений
                </span>
                {program.target_muscle_groups && (
                  <span className="flex items-center gap-1.5 bg-black/30 backdrop-blur-sm px-3 py-1 rounded-full">
                    <Dumbbell className="h-3.5 w-3.5" />
                    {translateMuscleGroups(program.target_muscle_groups.split(','))}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-[1fr_280px] gap-6 items-start">

            <div className="space-y-8 min-w-0">

              {program.description && (
                <div>
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Описание</h2>
                  <p className="text-foreground/80 leading-relaxed whitespace-pre-wrap text-sm">
                    {program.description}
                  </p>
                </div>
              )}

              {days.length === 0 ? (
                <div className="text-center py-16 rounded-2xl border border-dashed border-white/10">
                  <Dumbbell className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="font-medium mb-1">Упражнения не добавлены</p>
                  <p className="text-sm text-muted-foreground">В этой программе пока нет упражнений</p>
                </div>
              ) : (
                <div className="space-y-8">
                  {days.map(day => {
                    const dayExercises = groupedDetails[parseInt(day)].sort((a, b) => a.order - b.order)
                    return (
                      <div key={day}>

                        <div className="flex items-center gap-3 mb-3">
                          <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full shrink-0">
                            День {day}
                          </span>
                          <span className="font-semibold text-base">{getDayName(parseInt(day))}</span>
                          <div className="h-px bg-white/8 flex-1" />
                          <span className="text-xs text-muted-foreground shrink-0">{dayExercises.length} упр.</span>
                        </div>

                        <div className="space-y-2">
                          {dayExercises.map((detail, index) => {
                            const exercise = exercisesMap[detail.exercise_id]
                            const isOpen = openItems.includes(detail.id)

                            return (
                              <div
                                key={detail.id}
                                className="rounded-xl border border-white/8 overflow-hidden bg-card/40 backdrop-blur-sm"
                              >

                                <button
                                  onClick={() => toggleAccordion(detail.id)}
                                  className="w-full flex items-center gap-3 p-4 hover:bg-white/3 transition-colors text-left"
                                >
                                  <span className="w-7 h-7 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                                    {index + 1}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm leading-snug truncate">
                                      {exercise?.name || '...'}
                                    </p>
                                    <div className="flex flex-wrap gap-1.5 mt-1">
                                      <span className="text-[11px] text-muted-foreground bg-white/5 px-2 py-0.5 rounded-full">
                                        {detail.sets} подх.
                                      </span>
                                      <span className="text-[11px] text-muted-foreground bg-white/5 px-2 py-0.5 rounded-full">
                                        {detail.reps} повт.
                                      </span>
                                      {detail.rest_time && (
                                        <span className="text-[11px] text-muted-foreground bg-white/5 px-2 py-0.5 rounded-full">
                                          {detail.rest_time}с отдых
                                        </span>
                                      )}
                                      {exercise?.muscle_groups && exercise.muscle_groups.length > 0 && (
                                        <span className="text-[11px] text-muted-foreground/60 px-1">
                                          · {translateMuscleGroups(exercise.muscle_groups)}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {isOpen && (
                                  <div className="border-t border-white/6 p-4 space-y-4">

                                    <div className="grid grid-cols-3 gap-2">
                                      {[
                                        { label: 'Подходы', value: detail.sets },
                                        { label: 'Повторения', value: detail.reps },
                                        { label: 'Отдых', value: detail.rest_time ? `${detail.rest_time}с` : '—' },
                                      ].map(stat => (
                                        <div key={stat.label} className="bg-white/4 rounded-xl p-3 text-center">
                                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{stat.label}</p>
                                          <p className="text-lg font-semibold">{stat.value}</p>
                                        </div>
                                      ))}
                                    </div>

                                    {detail.notes && (
                                      <div className="bg-amber-500/10 border border-amber-500/20 px-3 py-2 rounded-xl text-sm">
                                        <span className="text-amber-500 font-semibold text-xs block mb-0.5">Примечание</span>
                                        {detail.notes}
                                      </div>
                                    )}

                                    <div className="grid md:grid-cols-2 gap-4">
                                      <div className="space-y-3">
                                        {exercise?.video_urls?.map((url, vidIndex) => {
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
                                              <a
                                                href={url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="absolute inset-0 flex items-center justify-center hover:bg-black/20 transition-colors"
                                              >
                                                <PlayCircle className="h-12 w-12 text-white/70 group-hover:text-white transition-colors" />
                                              </a>
                                            </div>
                                          )
                                        })}

                                        {exercise?.muscle_groups && exercise.muscle_groups.length > 0 && (
                                          <div className="bg-white/4 rounded-xl p-3">
                                            <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                                              <Activity className="h-3.5 w-3.5" />Задействованные мышцы
                                            </p>
                                            <div className="flex justify-center gap-4">
                                              <MuscleMap mode="front" highlightedMuscles={exercise.muscle_groups} className="h-32 w-auto" />
                                              <MuscleMap mode="back"  highlightedMuscles={exercise.muscle_groups} className="h-32 w-auto" />
                                            </div>
                                          </div>
                                        )}
                                      </div>

                                      {exercise?.description && (
                                        <div>
                                          <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                                            <TrendingUp className="h-3.5 w-3.5" />Техника выполнения
                                          </p>
                                          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                                            {exercise.description}
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="md:sticky md:top-20 space-y-3">

              <div className="rounded-2xl border border-white/8 bg-card/60 backdrop-blur-sm p-4 space-y-2">
                {isActiveProgram ? (
                  <>
                    <div className="flex items-center gap-2 text-emerald-400 mb-3">
                      <CheckCircle className="h-5 w-5" />
                      <span className="font-semibold text-sm">Активная программа</span>
                    </div>
                    <Button className="w-full rounded-xl" onClick={() => router.push('/schedule')}>
                      <Calendar className="mr-2 h-4 w-4" />Перейти к расписанию
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      className="w-full rounded-xl"
                      onClick={handleStartProgramClick}
                    >
                      <PlayCircle className="mr-2 h-4 w-4" />Начать программу
                    </Button>
                    <Button
                      variant={isSaved ? 'secondary' : 'outline'}
                      className={`w-full rounded-xl ${isSaved ? 'text-primary border-primary/40' : ''}`}
                      onClick={handleToggleSave}
                    >
                      <Bookmark className={`mr-2 h-4 w-4 ${isSaved ? 'fill-current' : ''}`} />
                      {isSaved ? 'В сохраненных' : 'Сохранить'}
                    </Button>
                  </>
                )}
              </div>

              <div className="rounded-2xl border border-white/8 bg-card/60 backdrop-blur-sm p-4 grid grid-cols-2 gap-2">
                {[
                  { label: 'Недель',     value: program.duration_weeks ?? '—', icon: Calendar },
                  { label: 'Упражнений', value: totalExercises,                icon: Dumbbell },
                  { label: 'Уровень',    value: getDifficultyLabel(program.difficulty), icon: TrendingUp },
                  { label: 'Дни',        value: days.length,                   icon: Timer },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="bg-white/4 rounded-xl p-3 text-center">
                    <Icon className="h-4 w-4 text-primary mx-auto mb-1.5" />
                    <p className="text-base font-bold leading-none mb-0.5">{value}</p>
                    <p className="text-[11px] text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>

              {program.target_muscle_groups && (
                <div className="rounded-2xl border border-white/8 bg-card/60 backdrop-blur-sm p-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Группы мышц</p>
                  <div className="flex justify-center gap-3">
                    <MuscleMap
                      mode="front"
                      highlightedMuscles={program.target_muscle_groups.split(',').map(m => m.trim())}
                      className="h-28 w-auto"
                    />
                    <MuscleMap
                      mode="back"
                      highlightedMuscles={program.target_muscle_groups.split(',').map(m => m.trim())}
                      className="h-28 w-auto"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground text-center mt-2">
                    {translateMuscleGroups(program.target_muscle_groups.split(','))}
                  </p>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      <Modal
        isOpen={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
        title="Смена программы"
        description="У вас уже есть активная программа. Вы уверены, что хотите сменить её? Текущий прогресс расписания будет приостановлен."
        footer={
          <>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>Отмена</Button>
            <Button variant="default" onClick={() => { setShowConfirmDialog(false); startProgram() }}>Подтвердить</Button>
          </>
        }
      />
    </AuthGuard>
  )
}
