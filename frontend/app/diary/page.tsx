/**
 * Дневник — питание, замеры, вода
 */
'use client'

import React, { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { AuthGuard } from '@/components/AuthGuard'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { AddMealModal } from '@/components/AddMealModal'
import { EditMetricModal } from '@/components/EditMetricModal'
import { EditLogModal } from '@/components/EditLogModal'
import { WaterTracker } from '@/components/nutrition/WaterTracker'
import { metricsAPI, nutritionAPI, usersAPI, BodyMetric, NutritionLog, UserProfile } from '@/lib/api'
import {
  Apple, Activity, Plus, Trash2, Scale, Flame,
  Sun, UtensilsCrossed, Moon, Coffee, Droplet,
  Edit, Beef, Droplets, Wheat, ChevronDown,
} from 'lucide-react'
import { format } from 'date-fns'
import { formatDate, round, cn } from '@/lib/utils'
import { toast } from 'react-toastify'

// ── Утилиты ─────────────────────────────────────────────────

function todayDateStr() {
  return format(new Date(), 'yyyy-MM-dd')
}

function todayLabel() {
  return new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
}

const MEAL_CONFIG: Record<string, { label: string; icon: React.ElementType; accent: string; bg: string }> = {
  breakfast: { label: 'Завтрак',  icon: Sun,            accent: 'border-yellow-400/60', bg: 'bg-yellow-400/10' },
  lunch:     { label: 'Обед',     icon: UtensilsCrossed, accent: 'border-orange-400/60', bg: 'bg-orange-400/10' },
  dinner:    { label: 'Ужин',     icon: Moon,            accent: 'border-blue-400/60',   bg: 'bg-blue-400/10'   },
  snack:     { label: 'Перекус',  icon: Coffee,          accent: 'border-green-400/60',  bg: 'bg-green-400/10'  },
  other:     { label: 'Другое',   icon: Apple,           accent: 'border-white/20',      bg: 'bg-white/5'       },
}

const MEAL_ORDER = ['breakfast', 'lunch', 'dinner', 'snack', 'other']

// ── Кольцо калорий ──────────────────────────────────────────

function CalorieRing({ value, target }: { value: number; target: number }) {
  const r = 42
  const circ = 2 * Math.PI * r
  const pct = target > 0 ? Math.min(value / target, 1) : 0
  const dash = pct * circ
  const color = pct > 1.05 ? '#f87171' : pct >= 0.85 ? '#4ade80' : '#64748b'

  return (
    <svg width="100" height="100" viewBox="0 0 100 100" className="shrink-0">
      <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
      <circle
        cx="50" cy="50" r={r} fill="none"
        stroke={color} strokeWidth="10"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 50 50)"
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
      <text x="50" y="46" textAnchor="middle" fill="white" fontSize="13" fontWeight="700">
        {round(value, 0)}
      </text>
      <text x="50" y="60" textAnchor="middle" fill="rgba(255,255,255,0.45)" fontSize="9">
        из {target || '—'}
      </text>
    </svg>
  )
}

// ── Прогресс макроса ────────────────────────────────────────

function MacroBar({
  label, value, target, icon: Icon, color, trackColor,
}: {
  label: string; value: number; target: number
  icon: React.ElementType; color: string; trackColor: string
}) {
  const pct = target > 0 ? Math.min((value / target) * 100, 100) : 0
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1 mb-1">
        <Icon className={cn('h-3 w-3 shrink-0', color)} />
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-sm font-semibold leading-none mb-1.5">
        {round(value, 0)}<span className="text-muted-foreground font-normal text-xs">/{target || '—'}г</span>
      </p>
      <div className="h-1 rounded-full bg-white/8">
        <div className={cn('h-1 rounded-full transition-all', trackColor)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ── Группа приёмов пищи ─────────────────────────────────────

function MealGroup({
  type, logs, onEdit, onDelete,
}: {
  type: string; logs: NutritionLog[]
  onEdit: (l: NutritionLog) => void; onDelete: (id: string) => void
}) {
  const [open, setOpen] = useState(true)
  const cfg = MEAL_CONFIG[type] ?? MEAL_CONFIG.other
  const Icon = cfg.icon
  const total = logs.reduce((s, l) => s + (l.calories || 0), 0)

  return (
    <div className={cn('rounded-xl border-l-4 bg-card/60', cfg.accent)}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3"
      >
        <div className="flex items-center gap-2">
          <div className={cn('flex items-center justify-center w-7 h-7 rounded-lg', cfg.bg)}>
            <Icon className="h-3.5 w-3.5 text-foreground/70" />
          </div>
          <span className="font-semibold text-sm">{cfg.label}</span>
          <span className="text-xs text-muted-foreground">{logs.length} позиц.</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{round(total, 0)} ккал</span>
          <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', !open && '-rotate-90')} />
        </div>
      </button>

      {open && (
        <div className="px-4 pb-3 space-y-1.5">
          {logs.map(log => (
            <div key={log.id} className="flex items-center gap-3 py-2 border-t border-white/5">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{log.product_name || 'Продукт'}</p>
                <p className="text-xs text-muted-foreground">
                  {round(log.weight_g, 0)}г · {round(log.calories || 0, 0)} ккал
                  {log.proteins != null && (
                    <span className="ml-1.5 hidden sm:inline">
                      Б:{round(log.proteins, 0)} Ж:{round(log.fats || 0, 0)} У:{round(log.carbs || 0, 0)}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => onEdit(log)}
                  className="p-1.5 rounded-lg hover:bg-white/8 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Edit className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => onDelete(log.id)}
                  className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Основной компонент ──────────────────────────────────────

function DiaryContent() {
  const searchParams = useSearchParams()
  const initialTab = (searchParams.get('tab') as 'nutrition' | 'metrics' | 'hydration') || 'nutrition'

  const [activeTab, setActiveTab] = useState<'nutrition' | 'metrics' | 'hydration'>(initialTab)
  const [profile, setProfile]         = useState<UserProfile | null>(null)
  const [metrics, setMetrics]         = useState<BodyMetric[]>([])
  const [nutritionLogs, setNutritionLogs] = useState<NutritionLog[]>([])
  const [dailySummary, setDailySummary]   = useState({ total_calories: 0, total_proteins: 0, total_fats: 0, total_carbs: 0 })
  const [isLoading, setIsLoading]         = useState(true)
  const [isAddMealModalOpen, setIsAddMealModalOpen] = useState(false)
  const [editingMetric, setEditingMetric] = useState<BodyMetric | null>(null)
  const [editingLog, setEditingLog]       = useState<NutritionLog | null>(null)

  const [newMetric, setNewMetric] = useState({
    weight: '', chest: '', waist: '', hips: '', biceps: '', thigh: '', neck: '',
    date: todayDateStr(),
  })

  useEffect(() => {
    usersAPI.getMe().then(r => setProfile(r.data.profile ?? null)).catch(() => {})
  }, [])

  useEffect(() => {
    if (activeTab === 'nutrition') fetchNutrition()
    else if (activeTab === 'metrics') fetchMetrics()
  }, [activeTab])

  const fetchNutrition = async () => {
    setIsLoading(true)
    const dateStr = todayDateStr()
    try {
      const [logsRes, sumRes] = await Promise.all([
        nutritionAPI.listLogs({ from_date: dateStr, to_date: dateStr }),
        nutritionAPI.getDailySummary(dateStr),
      ])
      setNutritionLogs(logsRes.data)
      setDailySummary(sumRes.data)
    } catch { /* silent */ }
    setIsLoading(false)
  }

  const fetchMetrics = async () => {
    setIsLoading(true)
    try { setMetrics((await metricsAPI.list()).data) } catch { /* silent */ }
    setIsLoading(false)
  }

  const handleAddMetric = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await metricsAPI.create({
        date: newMetric.date,
        weight:  newMetric.weight  ? parseFloat(newMetric.weight)  : undefined,
        chest:   newMetric.chest   ? parseFloat(newMetric.chest)   : undefined,
        waist:   newMetric.waist   ? parseFloat(newMetric.waist)   : undefined,
        hips:    newMetric.hips    ? parseFloat(newMetric.hips)    : undefined,
        biceps:  newMetric.biceps  ? parseFloat(newMetric.biceps)  : undefined,
        thigh:   newMetric.thigh   ? parseFloat(newMetric.thigh)   : undefined,
        neck:    newMetric.neck    ? parseFloat(newMetric.neck)    : undefined,
      })
      setNewMetric({ weight: '', chest: '', waist: '', hips: '', biceps: '', thigh: '', neck: '', date: todayDateStr() })
      fetchMetrics()
      toast.success('Замер добавлен')
    } catch { toast.error('Ошибка при добавлении замера') }
  }

  const handleDeleteLog = async (id: string) => {
    if (!confirm('Удалить запись?')) return
    try { await nutritionAPI.deleteLog(id); fetchNutrition(); toast.success('Удалено') }
    catch { toast.error('Ошибка') }
  }

  const handleDeleteMetric = async (id: string) => {
    if (!confirm('Удалить замер?')) return
    try { await metricsAPI.delete(id); fetchMetrics(); toast.success('Удалено') }
    catch { toast.error('Ошибка') }
  }

  // Группировка по типу приёма
  const grouped = MEAL_ORDER.reduce<Record<string, NutritionLog[]>>((acc, t) => {
    acc[t] = nutritionLogs.filter(l => (l.meal_type || 'other') === t)
    return acc
  }, {})

  const tabs = [
    { id: 'nutrition',  label: 'Питание',  icon: Apple   },
    { id: 'metrics',    label: 'Замеры',   icon: Activity },
    { id: 'hydration',  label: 'Вода',     icon: Droplet  },
  ] as const

  return (
    <AuthGuard>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">

        {/* ── Табы ──────────────────────────────────── */}
        <div className="flex gap-1 p-1 bg-white/5 rounded-xl">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg transition-all',
                activeTab === id
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4" />{label}
            </button>
          ))}
        </div>

        {/* ══════════════ ПИТАНИЕ ══════════════ */}
        {activeTab === 'nutrition' && (
          <div className="space-y-4">
            {/* Заголовок дня */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Сегодня</p>
                <h1 className="text-lg font-bold capitalize">{todayLabel()}</h1>
              </div>
              <button
                onClick={() => setIsAddMealModalOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                <Plus className="h-4 w-4" />Добавить
              </button>
            </div>

            {/* Сводка: кольцо + макросы */}
            <div className="rounded-2xl border border-white/8 bg-card/60 p-4 flex items-center gap-5">
              <CalorieRing
                value={dailySummary.total_calories}
                target={profile?.target_calories ?? 0}
              />
              <div className="flex-1 grid grid-cols-2 gap-x-6 gap-y-3">
                <MacroBar label="Белки"    value={dailySummary.total_proteins} target={profile?.target_proteins ?? 0} icon={Beef}     color="text-red-400"    trackColor="bg-red-400"    />
                <MacroBar label="Жиры"     value={dailySummary.total_fats}     target={profile?.target_fats     ?? 0} icon={Droplets} color="text-yellow-400" trackColor="bg-yellow-400" />
                <MacroBar label="Углев."   value={dailySummary.total_carbs}    target={profile?.target_carbs    ?? 0} icon={Wheat}    color="text-blue-400"   trackColor="bg-blue-400"   />
                <MacroBar label="Калории"  value={dailySummary.total_calories} target={profile?.target_calories ?? 0} icon={Flame}    color="text-orange-400" trackColor="bg-orange-400" />
              </div>
            </div>

            {/* Приёмы пищи */}
            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground text-sm">Загрузка...</div>
            ) : nutritionLogs.length === 0 ? (
              <div className="rounded-2xl border border-white/8 bg-card/40 py-14 text-center">
                <Apple className="h-8 w-8 mx-auto mb-3 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">Нет записей за сегодня</p>
                <button
                  onClick={() => setIsAddMealModalOpen(true)}
                  className="mt-4 text-sm text-primary hover:underline"
                >
                  Добавить первый приём
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {MEAL_ORDER.map(type =>
                  grouped[type].length > 0 ? (
                    <MealGroup
                      key={type}
                      type={type}
                      logs={grouped[type]}
                      onEdit={setEditingLog}
                      onDelete={handleDeleteLog}
                    />
                  ) : null
                )}
              </div>
            )}
          </div>
        )}

        {/* ══════════════ ЗАМЕРЫ ══════════════ */}
        {activeTab === 'metrics' && (
          <div className="space-y-5">
            {/* Форма */}
            <div className="rounded-2xl border border-white/8 bg-card/60 p-5">
              <p className="text-sm font-semibold mb-4">Новый замер</p>
              <form onSubmit={handleAddMetric} className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="col-span-2 sm:col-span-1">
                    <Input label="Дата" type="date" value={newMetric.date}
                      onChange={e => setNewMetric({ ...newMetric, date: e.target.value })} required />
                  </div>
                  {[
                    { field: 'weight', label: 'Вес (кг)',    ph: '75.5' },
                    { field: 'chest',  label: 'Грудь (см)',  ph: '95'   },
                    { field: 'waist',  label: 'Талия (см)',  ph: '80'   },
                    { field: 'hips',   label: 'Бёдра (см)',  ph: '100'  },
                    { field: 'biceps', label: 'Бицепс (см)', ph: '35'   },
                    { field: 'thigh',  label: 'Бедро (см)',  ph: '60'   },
                    { field: 'neck',   label: 'Шея (см)',    ph: '38'   },
                  ].map(({ field, label, ph }) => (
                    <Input
                      key={field} label={label} type="number" step="0.1"
                      placeholder={ph} value={(newMetric as Record<string, string>)[field]}
                      onChange={e => setNewMetric({ ...newMetric, [field]: e.target.value })}
                    />
                  ))}
                </div>
                <Button type="submit" className="rounded-xl">
                  <Plus className="h-4 w-4 mr-1.5" />Добавить замер
                </Button>
              </form>
            </div>

            {/* История */}
            {isLoading ? (
              <div className="text-center py-10 text-muted-foreground text-sm">Загрузка...</div>
            ) : metrics.length === 0 ? (
              <div className="rounded-2xl border border-white/8 bg-card/40 py-12 text-center">
                <Scale className="h-8 w-8 mx-auto mb-3 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">Нет замеров. Добавь первый!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {metrics.map(m => (
                  <div key={m.id} className="rounded-2xl border border-white/8 bg-card/60 px-4 py-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold mb-2">{formatDate(m.date)}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {m.weight && <span className="flex items-center gap-1"><Scale className="h-3 w-3" />{m.weight} кг</span>}
                        {m.chest  && <span>Грудь {m.chest} см</span>}
                        {m.waist  && <span>Талия {m.waist} см</span>}
                        {m.hips   && <span>Бёдра {m.hips} см</span>}
                        {m.biceps && <span>Бицепс {m.biceps} см</span>}
                        {m.thigh  && <span>Бедро {m.thigh} см</span>}
                        {m.neck   && <span>Шея {m.neck} см</span>}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => setEditingMetric(m)}
                        className="p-1.5 rounded-lg hover:bg-white/8 text-muted-foreground hover:text-foreground transition-colors">
                        <Edit className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => handleDeleteMetric(m.id)}
                        className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══════════════ ВОДА ══════════════ */}
        {activeTab === 'hydration' && <WaterTracker />}
      </div>

      {/* Модалки */}
      <AddMealModal isOpen={isAddMealModalOpen} onClose={() => setIsAddMealModalOpen(false)} onSuccess={fetchNutrition} />
      <EditMetricModal isOpen={editingMetric !== null} onClose={() => setEditingMetric(null)} metric={editingMetric} onSuccess={fetchMetrics} />
      <EditLogModal isOpen={editingLog !== null} onClose={() => setEditingLog(null)} log={editingLog} onSuccess={fetchNutrition} />
    </AuthGuard>
  )
}

export default function DiaryPage() {
  return (
    <Suspense fallback={
      <AuthGuard>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-muted-foreground text-sm">Загрузка...</div>
        </div>
      </AuthGuard>
    }>
      <DiaryContent />
    </Suspense>
  )
}
