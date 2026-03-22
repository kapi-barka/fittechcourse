/**
 * Страница программ тренировок — каталог и личные программы
 */
'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { AuthGuard } from '@/components/AuthGuard'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { programsAPI, userProgramsAPI, scheduleAPI, Program, ProgramWithStatus } from '@/lib/api'
import { MuscleMap } from '@/components/ui/MuscleMap'
import { normalizeMuscleGroup, standardMuscleGroupToSvgIds, StandardMuscleGroup, translateMuscleGroup, translateMuscleGroups } from '@/lib/muscleGroups'
import {
  Dumbbell,
  Plus,
  Search,
  Clock,
  TrendingUp,
  Lock,
  Globe,
  RotateCcw,
  Activity,
  Bookmark,
  Calendar,
  PlayCircle,
  Trash2,
  Loader2,
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'react-toastify'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDifficultyLabel(difficulty?: string | null) {
  switch (difficulty) {
    case 'beginner':    return 'Начинающий'
    case 'intermediate': return 'Средний'
    case 'advanced':    return 'Продвинутый'
    default:            return 'Не указан'
  }
}

// ---------------------------------------------------------------------------
// Цвет фона по сложности (для карточек без изображения)
// ---------------------------------------------------------------------------
function getDifficultyGradient(difficulty?: string | null) {
  switch (difficulty) {
    case 'beginner':     return 'from-emerald-600 to-teal-800'
    case 'intermediate': return 'from-amber-500 to-orange-700'
    case 'advanced':     return 'from-rose-600 to-red-900'
    default:             return 'from-primary/60 to-primary/90'
  }
}

function getDifficultyBadgeBg(difficulty?: string | null) {
  switch (difficulty) {
    case 'beginner':     return 'bg-emerald-500'
    case 'intermediate': return 'bg-amber-500'
    case 'advanced':     return 'bg-rose-500'
    default:             return 'bg-primary'
  }
}

// ---------------------------------------------------------------------------
// Карточка каталога — magazine style
// ---------------------------------------------------------------------------
function CatalogCard({ program }: { program: Program }) {
  return (
    <Link href={`/programs/${program.id}`}>
      <div className="group relative rounded-2xl overflow-hidden cursor-pointer h-60 hover:ring-2 hover:ring-primary/40 transition-all duration-200 shadow-md">
        {/* Фон: фото или градиент */}
        {program.image_url ? (
          <Image
            src={program.image_url}
            alt={program.title}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            unoptimized
          />
        ) : (
          <div className={`absolute inset-0 bg-gradient-to-br ${getDifficultyGradient(program.difficulty)}`} />
        )}

        {/* Тёмный оверлей снизу */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />

        {/* Верхние бейджи */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
          <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full text-white ${getDifficultyBadgeBg(program.difficulty)}`}>
            {getDifficultyLabel(program.difficulty)}
          </span>
          {program.is_public
            ? <Globe className="h-4 w-4 text-white/60" />
            : <Lock className="h-4 w-4 text-white/50" />
          }
        </div>

        {/* Нижний контент */}
        <div className="absolute bottom-0 left-0 right-0 p-3.5">
          <p className="text-white font-semibold text-sm leading-snug line-clamp-2 mb-2">
            {program.title}
          </p>
          <div className="flex items-center justify-between text-white/60 text-[11px]">
            {program.duration_weeks ? (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {program.duration_weeks} нед.
              </span>
            ) : <span />}
            <span className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              {program.author?.profile?.full_name || 'Неизвестный'}
            </span>
          </div>
          {program.target_muscle_groups && (
            <p className="text-white/40 text-[10px] mt-1.5 line-clamp-1">
              {translateMuscleGroups(program.target_muscle_groups.split(','))}
            </p>
          )}
        </div>
      </div>
    </Link>
  )
}

// ---------------------------------------------------------------------------
// Карточка «Мои программы»
// ---------------------------------------------------------------------------
function MyProgramCard({
  program,
  showResume,
  onToggleSave,
  onResume,
}: {
  program: ProgramWithStatus
  showResume?: boolean
  onToggleSave: (id: string) => void
  onResume: (id: string) => void
}) {
  return (
    <div className="group relative rounded-2xl overflow-hidden h-52 shadow-md hover:ring-2 hover:ring-primary/40 transition-all duration-200">
      {/* Фон */}
      {program.image_url ? (
        <Image src={program.image_url} alt={program.title} fill className="object-cover transition-transform duration-300 group-hover:scale-105" unoptimized />
      ) : (
        <div className={`absolute inset-0 bg-gradient-to-br ${getDifficultyGradient(program.difficulty)}`} />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

      {/* Бейдж АКТИВНАЯ */}
      {program.is_active && (
        <span className="absolute top-3 left-3 bg-green-500 text-white text-[10px] px-2.5 py-0.5 rounded-full font-bold animate-pulse shadow">
          АКТИВНАЯ
        </span>
      )}

      {/* Уровень сложности */}
      {program.difficulty && (
        <span className={`absolute top-3 ${program.is_active ? 'left-24' : 'left-3'} text-[11px] font-semibold px-2.5 py-0.5 rounded-full text-white ${getDifficultyBadgeBg(program.difficulty)}`}>
          {getDifficultyLabel(program.difficulty)}
        </span>
      )}

      {/* Нижний контент */}
      <div className="absolute bottom-0 left-0 right-0 p-3.5">
        <p className="text-white font-semibold text-sm line-clamp-1 mb-1">{program.title}</p>
        <div className="flex items-center gap-2 text-white/50 text-[11px] mb-2.5">
          {program.duration_weeks && (
            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{program.duration_weeks} нед.</span>
          )}
          <span className="text-white/30">·</span>
          <span>{new Date(program.last_interaction_at || program.created_at).toLocaleDateString('ru-RU')}</span>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            className="flex-1 h-7 text-xs rounded-xl"
            variant={showResume ? 'default' : 'outline'}
            onClick={() => showResume ? onResume(program.id) : window.location.assign(`/programs/${program.id}`)}
          >
            {showResume ? <><PlayCircle className="mr-1 h-3 w-3" />Продолжить</> : 'Подробнее'}
          </Button>
          {program.status === 'saved' ? (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 rounded-xl text-destructive hover:text-destructive hover:bg-destructive/20"
              onClick={() => onToggleSave(program.id)}
              title="Убрать из отложенных"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          ) : !program.is_active && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 rounded-xl text-white/70 hover:text-white hover:bg-white/10"
              onClick={() => onResume(program.id)}
              title="Сделать активной"
            >
              <PlayCircle className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Главный компонент
// ---------------------------------------------------------------------------
export default function ProgramsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeTab = (searchParams.get('tab') ?? 'catalog') as 'catalog' | 'my'

  const setTab = (tab: 'catalog' | 'my') => {
    router.push(tab === 'catalog' ? '/programs' : '/programs?tab=my')
  }

  // --- Каталог ---
  const [programs, setPrograms] = useState<Program[]>([])
  const [myCreated, setMyCreated] = useState<Program[]>([])
  const [isCatalogLoading, setIsCatalogLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [difficultyFilter, setDifficultyFilter] = useState('')
  const [showPublicOnly, setShowPublicOnly] = useState(true)
  const [muscleFilter, setMuscleFilter] = useState('')
  const [mapMode, setMapMode] = useState<'front' | 'back'>('front')

  const fetchCatalog = useCallback(async () => {
    setIsCatalogLoading(true)
    try {
      const [res, myRes] = await Promise.all([
        programsAPI.list({ difficulty: difficultyFilter || undefined, public_only: showPublicOnly, muscle_group: muscleFilter || undefined }),
        programsAPI.getMy(),
      ])
      setPrograms(res.data)
      setMyCreated(myRes.data)
    } catch (e) {
      console.error(e)
    }
    setIsCatalogLoading(false)
  }, [difficultyFilter, showPublicOnly, muscleFilter])

  // --- Мои программы ---
  const [activePrograms, setActivePrograms] = useState<ProgramWithStatus[]>([])
  const [savedPrograms, setSavedPrograms] = useState<ProgramWithStatus[]>([])
  const [historyPrograms, setHistoryPrograms] = useState<ProgramWithStatus[]>([])
  const [isMyLoading, setIsMyLoading] = useState(true)

  const fetchMy = useCallback(async () => {
    setIsMyLoading(true)
    try {
      const res = await userProgramsAPI.list()
      const all = res.data
      setActivePrograms(all.filter(p => p.is_active))
      setSavedPrograms(all.filter(p => p.status === 'saved'))
      setHistoryPrograms(all.filter(p => (p.status === 'completed' || p.status === 'started') && !p.is_active))
    } catch (e) {
      console.error(e)
    }
    setIsMyLoading(false)
  }, [])

  useEffect(() => { fetchCatalog() }, [fetchCatalog])
  useEffect(() => { if (activeTab === 'my') fetchMy() }, [activeTab, fetchMy])

  const handleMuscleSelect = (svgId: string) => {
    const normalized = normalizeMuscleGroup(svgId)
    if (!normalized) return
    setMuscleFilter(prev => prev === normalized ? '' : normalized)
  }

  const handleResume = async (programId: string) => {
    try {
      await scheduleAPI.startProgram(programId)
      router.push('/schedule')
    } catch {
      toast.error('Не удалось запустить программу')
    }
  }

  const handleToggleSave = async (programId: string) => {
    try {
      await userProgramsAPI.toggleSave(programId)
      fetchMy()
    } catch {
      toast.error('Ошибка при изменении статуса')
    }
  }

  const filteredPrograms = programs.filter(p =>
    p.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const hasMyFilters = !muscleFilter && !difficultyFilter && !searchQuery

  // ---------------------------------------------------------------------------
  return (
    <AuthGuard>
      <div className="min-h-screen">
        <main className="container mx-auto px-4 py-4 sm:py-8">

          {/* Заголовок */}
          <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-bold">Программы</h1>
            <Link href="/programs/create">
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Создать программу</span>
                <span className="sm:hidden">Создать</span>
              </Button>
            </Link>
          </div>

          {/* Табы */}
          <div className="flex gap-1 mb-6 border-b border-white/10">
            {([
              { id: 'catalog', label: 'Каталог', icon: Globe },
              { id: 'my',      label: 'Мои программы', icon: Bookmark },
            ] as const).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all border-b-2 -mb-px ${
                  activeTab === id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>

          {/* ================================================================
              ТАБ: КАТАЛОГ
          ================================================================ */}
          {activeTab === 'catalog' && (
            <>
              {/* Фильтры — компактная строка */}
              <div className="flex flex-wrap gap-2 mb-6 items-center">
                <div className="relative flex-1 min-w-[180px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Поиск..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-9 h-9 rounded-xl"
                  />
                </div>
                <select
                  value={difficultyFilter}
                  onChange={e => setDifficultyFilter(e.target.value)}
                  className="h-9 rounded-xl border border-input bg-background px-3 text-sm"
                >
                  <option value="">Любая сложность</option>
                  <option value="beginner">Начинающий</option>
                  <option value="intermediate">Средний</option>
                  <option value="advanced">Продвинутый</option>
                </select>
                <div className="flex rounded-xl overflow-hidden border border-input">
                  <button
                    onClick={() => setShowPublicOnly(true)}
                    className={`flex items-center gap-1.5 px-3 h-9 text-sm transition-colors ${showPublicOnly ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:text-foreground'}`}
                  >
                    <Globe className="h-3.5 w-3.5" />Публичные
                  </button>
                  <button
                    onClick={() => setShowPublicOnly(false)}
                    className={`flex items-center gap-1.5 px-3 h-9 text-sm border-l border-input transition-colors ${!showPublicOnly ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:text-foreground'}`}
                  >
                    <Lock className="h-3.5 w-3.5" />Все
                  </button>
                </div>
                {muscleFilter && (
                  <button
                    onClick={() => setMuscleFilter('')}
                    className="flex items-center gap-1.5 h-9 px-3 rounded-xl bg-primary/10 text-primary text-sm hover:bg-primary/20 transition-colors"
                  >
                    {translateMuscleGroup(muscleFilter)}
                    <span className="text-primary/60 text-xs">✕</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6 mb-8">
                {/* Карта мышц — компактная боковая */}
                <div className="lg:sticky lg:top-20 lg:self-start">
                  <div className="rounded-2xl border border-white/8 bg-card/60 overflow-hidden">
                    <div className="flex items-center justify-between px-4 pt-3 pb-1">
                      <span className="text-sm font-medium">Мышцы</span>
                      <button
                        onClick={() => setMapMode(m => m === 'front' ? 'back' : 'front')}
                        className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
                        title="Повернуть"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <MuscleMap
                      mode={mapMode}
                      selectedMuscles={muscleFilter ? standardMuscleGroupToSvgIds(muscleFilter as StandardMuscleGroup, mapMode) : []}
                      onSelect={handleMuscleSelect}
                      className="h-[260px] lg:h-[340px] w-full"
                    />
                    <p className="text-center text-[11px] text-muted-foreground pb-3">
                      {muscleFilter ? translateMuscleGroup(muscleFilter) : 'Нажмите для фильтрации'}
                    </p>
                  </div>
                </div>

                {/* Список */}
                <div className="space-y-8">
                  {/* Мои созданные (без фильтров) */}
                  {myCreated.length > 0 && hasMyFilters && (
                    <div>
                      <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">Созданные мной</h2>
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                        {myCreated.map(p => <CatalogCard key={p.id} program={p} />)}
                      </div>
                    </div>
                  )}

                  {/* Публичные / все */}
                  <div>
                    <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">
                      {showPublicOnly ? 'Публичные программы' : 'Все доступные программы'}
                    </h2>
                    {isCatalogLoading ? (
                      <div className="flex justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      </div>
                    ) : filteredPrograms.length === 0 ? (
                      <div className="text-center py-16 rounded-2xl border border-dashed border-white/10">
                        <Dumbbell className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                        <p className="font-medium mb-1">Программы не найдены</p>
                        <p className="text-sm text-muted-foreground mb-4">Измените фильтры или создайте свою</p>
                        <Link href="/programs/create">
                          <Button size="sm" className="rounded-xl"><Plus className="mr-2 h-4 w-4" />Создать программу</Button>
                        </Link>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                        {filteredPrograms.map(p => <CatalogCard key={p.id} program={p} />)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ================================================================
              ТАБ: МОИ ПРОГРАММЫ
          ================================================================ */}
          {activeTab === 'my' && (
            isMyLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-10">
                {activePrograms.length === 0 && savedPrograms.length === 0 && historyPrograms.length === 0 ? (
                  <div className="text-center py-12 rounded-xl border-2 border-dashed">
                    <Dumbbell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium">У вас пока нет программ</h3>
                    <p className="text-muted-foreground text-sm mb-4">Найдите программу в каталоге или создайте свою</p>
                    <Button onClick={() => setTab('catalog')}>
                      <Globe className="mr-2 h-4 w-4" />Открыть каталог
                    </Button>
                  </div>
                ) : (
                  <>
                    {activePrograms.length > 0 && (
                      <section>
                        <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                          <Activity className="h-3.5 w-3.5 text-green-500" />Сейчас тренируюсь
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {activePrograms.map(p => (
                            <MyProgramCard key={p.id} program={p} showResume onToggleSave={handleToggleSave} onResume={handleResume} />
                          ))}
                        </div>
                      </section>
                    )}

                    {savedPrograms.length > 0 && (
                      <section>
                        <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                          <Bookmark className="h-3.5 w-3.5 text-primary" />Отложенные
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {savedPrograms.map(p => (
                            <MyProgramCard key={p.id} program={p} onToggleSave={handleToggleSave} onResume={handleResume} />
                          ))}
                        </div>
                      </section>
                    )}

                    {historyPrograms.length > 0 && (
                      <section>
                        <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                          <Calendar className="h-3.5 w-3.5" />История
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {historyPrograms.map(p => (
                            <MyProgramCard key={p.id} program={p} onToggleSave={handleToggleSave} onResume={handleResume} />
                          ))}
                        </div>
                      </section>
                    )}
                  </>
                )}
              </div>
            )
          )}

        </main>
      </div>
    </AuthGuard>
  )
}
