/**
 * Главная страница дашборда с обзором прогресса
 */
'use client'

import { useEffect, useState } from 'react'
import { AuthGuard } from '@/components/AuthGuard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { metricsAPI, nutritionAPI, analyticsAPI, BodyMetric, NutritionLog, WeightPrediction } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { WeightChart } from '@/components/dashboard/WeightChart'
import { CaloriesChart } from '@/components/dashboard/CaloriesChart'
import { GoalsModal } from '@/components/dashboard/GoalsModal'
import {
  Flame,
  Target,
  ArrowRight,
  Scale,
  Ruler,
} from 'lucide-react'
import Link from 'next/link'
import { subDays, format } from 'date-fns'

// ── Calorie Ring (SVG) ──────────────────────────────────────────────
function CalorieRing({
  consumed,
  target,
  size = 100,
}: {
  consumed: number
  target: number
  size?: number
}) {
  const r = (size - 12) / 2
  const circ = 2 * Math.PI * r
  const pct = target > 0 ? Math.min(consumed / target, 1) : 0
  const dash = pct * circ

  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor"
        strokeWidth={8} className="text-white/8" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="hsl(var(--primary))" strokeWidth={8}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circ}`}
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
    </svg>
  )
}

// ── Macro Bar ───────────────────────────────────────────────────────
function MacroBar({
  label,
  value,
  target,
  color,
}: {
  label: string
  value: number
  target: number
  color: string
}) {
  const pct = target > 0 ? Math.min((value / target) * 100, 100) : 0
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{Math.round(value)}<span className="text-muted-foreground">/{target}г</span></span>
      </div>
      <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

// ── Stat Chip ───────────────────────────────────────────────────────
function StatChip({
  label,
  value,
  sub,
}: {
  label?: string
  value: string
  sub?: string
}) {
  return (
    <div className="flex w-[140px] shrink-0 flex-col justify-center rounded-xl border border-white/8 bg-card/60 px-4 py-3">
      {label && <p className="text-xs text-muted-foreground mb-0.5">{label}</p>}
      <p className="text-sm font-bold leading-snug whitespace-normal">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5 whitespace-normal leading-tight">{sub}</p>}
    </div>
  )
}

// ── Measurement Row ─────────────────────────────────────────────────
function MeasurementRow({
  label,
  value,
  target,
}: {
  label: string
  value: number
  target?: number | null
}) {
  const pct = target && target > 0 ? Math.min((value / target) * 100, 100) : null
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">
          {value}
          {target ? <span className="text-muted-foreground"> / {target} см</span> : ' см'}
        </span>
      </div>
      {pct !== null && (
        <div className="h-1 bg-white/8 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  )
}

// ── Main Page ───────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user } = useAuthStore()
  const [latestMetric, setLatestMetric] = useState<BodyMetric | null>(null)
  const [todayCalories, setTodayCalories] = useState(0)
  const [todayProteins, setTodayProteins] = useState(0)
  const [todayFats, setTodayFats] = useState(0)
  const [todayCarbs, setTodayCarbs] = useState(0)
  const [weightHistory, setWeightHistory] = useState<BodyMetric[]>([])
  const [nutritionHistory, setNutritionHistory] = useState<NutritionLog[]>([])
  const [tdeeData, setTdeeData] = useState<{
    bmr: number; tdee: number; activity_level: string
    fitness_goal?: string | null
    body_fat_pct?: number | null
  } | null>(null)
  const [weightPrediction, setWeightPrediction] = useState<WeightPrediction | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isGoalsModalOpen, setIsGoalsModalOpen] = useState(false)

  const fetchData = async () => {
    const today = new Date()
    const thirtyDaysAgo = subDays(today, 30)
    const sevenDaysAgo = subDays(today, 7)

    await Promise.allSettled([
      metricsAPI.latest().then(r => setLatestMetric(r.data)).catch(() => {}),
      metricsAPI.list({ from_date: format(thirtyDaysAgo, 'yyyy-MM-dd') }).then(r => setWeightHistory(r.data)).catch(() => {}),
      nutritionAPI.getDailySummary(format(new Date(), 'yyyy-MM-dd')).then(r => {
        setTodayCalories(r.data.total_calories || 0)
        setTodayProteins(r.data.total_proteins || 0)
        setTodayFats(r.data.total_fats || 0)
        setTodayCarbs(r.data.total_carbs || 0)
      }).catch(() => {}),
      nutritionAPI.listLogs({ from_date: format(sevenDaysAgo, 'yyyy-MM-dd') }).then(r => setNutritionHistory(r.data)).catch(() => {}),
      analyticsAPI.getTDEE().then(r => setTdeeData(r.data)).catch(() => {}),
      analyticsAPI.getWeightPrediction().then(r => setWeightPrediction(r.data)).catch(() => {}),
    ])

    setIsLoading(false)
  }

  useEffect(() => {
    fetchData()
    const onVisible = () => { if (!document.hidden) fetchData() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', fetchData)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', fetchData)
    }
  }, [])

  const profile = user?.profile

  const activityLabels: Record<string, string> = {
    sedentary: 'Сидячий',
    lightly_active: 'Легкая',
    moderately_active: 'Умеренная',
    very_active: 'Высокая',
    extremely_active: 'Очень высокая',
  }

  const goalLabels: Record<string, string> = {
    lose_fat: 'Похудение',
    gain_muscle: 'Набор массы',
    recomposition: 'Рекомпозиция',
    maintain: 'Поддержание',
  }

  return (
    <AuthGuard>
      <div className="min-h-screen">
        <main className="container mx-auto max-w-5xl px-4 py-6 space-y-6">

          {/* ── TDEE / BMR Chips ─────────────────────── */}
          {(tdeeData || latestMetric?.weight) && (
            <div className="flex items-stretch gap-3 flex-wrap">
              {tdeeData && (
                <>
                  <StatChip
                    label="BMR"
                    value={`${Math.round(tdeeData.bmr)} ккал`}
                    sub="базовый обмен"
                  />
                  <StatChip
                    label="TDEE"
                    value={`${Math.round(tdeeData.tdee)} ккал`}
                    sub="с учётом активности"
                  />
                  <StatChip
                    value={activityLabels[tdeeData.activity_level] || tdeeData.activity_level}
                    sub="активность"
                  />
                  {tdeeData.fitness_goal && (
                    <StatChip
                      value={goalLabels[tdeeData.fitness_goal] || tdeeData.fitness_goal}
                      sub="цель"
                    />
                  )}
                  {tdeeData.body_fat_pct !== null && tdeeData.body_fat_pct !== undefined && (
                    <StatChip
                      value={`${tdeeData.body_fat_pct}%`}
                      sub="жир тела"
                    />
                  )}
                </>
              )}
              {latestMetric?.weight && (
                <StatChip
                  value={`${latestMetric.weight} кг`}
                  sub={profile?.target_weight ? `цель: ${profile.target_weight} кг` : 'вес'}
                />
              )}
              <Button
                variant="outline"
                size="sm"
                className="text-xs shrink-0 self-center"
                onClick={() => setIsGoalsModalOpen(true)}
              >
                <Target className="h-3 w-3 mr-1.5" />
                Изменить цели
              </Button>
            </div>
          )}

          {/* ── Main Cards Row ────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            {/* Питание */}
            {(profile?.target_calories || profile?.target_proteins || profile?.target_fats || profile?.target_carbs) && (
              <Link href="/diary?tab=nutrition" className="group">
                <Card className="h-full border-white/8 bg-card/60 hover:bg-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg cursor-pointer">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Flame className="h-4 w-4 text-orange-400" />
                        <CardTitle className="text-base">Питание сегодня</CardTitle>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    {/* Ring + calories */}
                    {profile?.target_calories && (
                      <div className="flex items-center gap-4">
                        <div className="relative shrink-0">
                          <CalorieRing
                            consumed={todayCalories}
                            target={profile.target_calories}
                            size={88}
                          />
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-base font-bold leading-none">
                              {isLoading ? '…' : Math.round(todayCalories)}
                            </span>
                            <span className="text-[9px] text-muted-foreground">ккал</span>
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-muted-foreground">Из {profile.target_calories} ккал</p>
                          <p className="text-lg font-bold mt-0.5">
                            {profile.target_calories - Math.round(todayCalories) > 0
                              ? `ещё ${profile.target_calories - Math.round(todayCalories)} ккал`
                              : 'цель выполнена!'
                            }
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {Math.round((todayCalories / profile.target_calories) * 100)}% от дневной нормы
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Macro bars */}
                    {(profile?.target_proteins || profile?.target_fats || profile?.target_carbs) && (
                      <div className="space-y-2.5 pt-1 border-t border-white/8">
                        {profile?.target_proteins && profile.target_proteins > 0 && (
                          <MacroBar label="Белки" value={todayProteins} target={profile.target_proteins} color="#3b82f6" />
                        )}
                        {profile?.target_fats && profile.target_fats > 0 && (
                          <MacroBar label="Жиры" value={todayFats} target={profile.target_fats} color="#eab308" />
                        )}
                        {profile?.target_carbs && profile.target_carbs > 0 && (
                          <MacroBar label="Углеводы" value={todayCarbs} target={profile.target_carbs} color="#10b981" />
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            )}

            {/* Замеры тела */}
            <Link href="/diary?tab=metrics" className="group">
              <Card className="h-full border-white/8 bg-card/60 hover:bg-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg cursor-pointer">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Ruler className="h-4 w-4 text-violet-400" />
                      <CardTitle className="text-base">Замеры тела</CardTitle>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </div>
                </CardHeader>
                <CardContent>
                  {latestMetric ? (
                    <div className="space-y-3">
                      {/* Вес — крупно */}
                      {latestMetric.weight && (
                        <div className="flex items-end gap-2 pb-3 border-b border-white/8 flex-wrap">
                          <span className="text-3xl font-bold">{latestMetric.weight}</span>
                          <span className="text-sm text-muted-foreground pb-1">кг</span>
                          {profile?.target_weight && (
                            <span className="text-xs text-muted-foreground pb-1 ml-1">
                              / цель {profile.target_weight} кг
                            </span>
                          )}
                        </div>
                      )}

                      {/* Остальные замеры */}
                      <div className="space-y-2.5">
                        {latestMetric.chest && (
                          <MeasurementRow label="Грудь" value={latestMetric.chest} target={profile?.target_chest} />
                        )}
                        {latestMetric.waist && (
                          <MeasurementRow label="Талия" value={latestMetric.waist} target={profile?.target_waist} />
                        )}
                        {latestMetric.hips && (
                          <MeasurementRow label="Бёдра" value={latestMetric.hips} target={profile?.target_hips} />
                        )}
                        {latestMetric.biceps && (
                          <MeasurementRow label="Бицепс" value={latestMetric.biceps} target={profile?.target_biceps} />
                        )}
                        {latestMetric.thigh && (
                          <MeasurementRow label="Бедро" value={latestMetric.thigh} target={profile?.target_thigh} />
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <Scale className="h-8 w-8 text-muted-foreground/30 mb-2" />
                      <p className="text-sm text-muted-foreground">Нет замеров</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">Добавьте первый замер в дневнике</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          </div>

          {/* ── Charts ───────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="h-[320px] sm:h-[360px]">
              <WeightChart
                data={weightHistory}
                targetWeight={profile?.target_weight}
                targetChest={profile?.target_chest}
                targetWaist={profile?.target_waist}
                targetHips={profile?.target_hips}
                targetBiceps={profile?.target_biceps}
                targetThigh={profile?.target_thigh}
                prediction={weightPrediction}
              />
            </div>
            <div className="h-[320px] sm:h-[360px]">
              <CaloriesChart
                logs={nutritionHistory}
                targetCalories={profile?.target_calories}
              />
            </div>
          </div>

        </main>

        <GoalsModal
          isOpen={isGoalsModalOpen}
          onClose={(open) => setIsGoalsModalOpen(open)}
          onSaved={() => analyticsAPI.getWeightPrediction().then(r => setWeightPrediction(r.data)).catch(() => {})}
        />
      </div>
    </AuthGuard>
  )
}
