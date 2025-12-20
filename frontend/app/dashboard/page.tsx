/**
 * Главная страница дашборда с обзором прогресса
 */
'use client'

import { useEffect, useState } from 'react'
import { AuthGuard } from '@/components/AuthGuard'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { metricsAPI, nutritionAPI, usersAPI, BodyMetric, NutritionLog } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { WeightChart } from '@/components/dashboard/WeightChart'
import { CaloriesChart } from '@/components/dashboard/CaloriesChart'
import { TDEECalculator } from '@/components/analytics/TDEECalculator'
import { GoalsModal } from '@/components/dashboard/GoalsModal'
import {
  Activity,
  TrendingUp,
  Flame,
  Dumbbell,
  Apple,
  Target,
  ArrowRight,
  Sparkles,
  Loader2,
  RefreshCw,
  Scale,
  Ruler
} from 'lucide-react'
import Link from 'next/link'
import { subDays, format } from 'date-fns'

export default function DashboardPage() {
  const { user } = useAuthStore()
  const [latestMetric, setLatestMetric] = useState<BodyMetric | null>(null)
  const [todayCalories, setTodayCalories] = useState(0)
  const [todayProteins, setTodayProteins] = useState(0)
  const [todayFats, setTodayFats] = useState(0)
  const [todayCarbs, setTodayCarbs] = useState(0)
  const [weightHistory, setWeightHistory] = useState<BodyMetric[]>([])
  const [nutritionHistory, setNutritionHistory] = useState<NutritionLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [dailyAdvice, setDailyAdvice] = useState<string>('')
  const [isLoadingAdvice, setIsLoadingAdvice] = useState(true)
  const [adviceError, setAdviceError] = useState<string | null>(null)
  const [isGoalsModalOpen, setIsGoalsModalOpen] = useState(false)

  const fetchData = async () => {
    const today = new Date()
    const thirtyDaysAgo = subDays(today, 30)
    const sevenDaysAgo = subDays(today, 7)

    try {
      // Получаем последние замеры
      const metricsRes = await metricsAPI.latest()
      if (metricsRes.data) {
        setLatestMetric(metricsRes.data)
      }
    } catch {
      // Нет замеров
    }

    try {
      // Получаем историю веса за 30 дней
      const metricsHistoryRes = await metricsAPI.list({
        from_date: format(thirtyDaysAgo, 'yyyy-MM-dd')
      })
      setWeightHistory(metricsHistoryRes.data)
    } catch (error) {
      console.error('Failed to fetch weight history', error)
    }

    try {
      // Получаем калории и макронутриенты за сегодня
      const nutritionRes = await nutritionAPI.getDailySummary()
      setTodayCalories(nutritionRes.data.total_calories || 0)
      setTodayProteins(nutritionRes.data.total_proteins || 0)
      setTodayFats(nutritionRes.data.total_fats || 0)
      setTodayCarbs(nutritionRes.data.total_carbs || 0)
    } catch {
      // Нет записей
    }

    try {
      // Получаем историю питания за 7 дней для графика
      const nutritionHistoryRes = await nutritionAPI.listLogs({
        from_date: format(sevenDaysAgo, 'yyyy-MM-dd')
      })
      setNutritionHistory(nutritionHistoryRes.data)
    } catch (error) {
      console.error('Failed to fetch nutrition history', error)
    }

    setIsLoading(false)
  }

  const fetchAdvice = async () => {
    setIsLoadingAdvice(true)
    setAdviceError(null)
    try {
      const adviceRes = await usersAPI.getDailyAdvice()
      setDailyAdvice(adviceRes.data.advice)
      setAdviceError(null)
    } catch (error: unknown) {
      console.error('Failed to fetch daily advice', error)
      const axiosError = error as { response?: { status?: number; data?: { detail?: string } } }
      
      if (axiosError.response?.status === 503) {
        setAdviceError('Сервис советов временно недоступен')
        setDailyAdvice('Продолжай следить за своим питанием и тренировками. Каждый день - это шаг к твоей цели!')
      } else {
        setAdviceError('Не удалось загрузить совет')
        setDailyAdvice('Продолжай следить за своим питанием и тренировками. Каждый день - это шаг к твоей цели!')
      }
    } finally {
      setIsLoadingAdvice(false)
    }
  }

  useEffect(() => {
    fetchData()
    fetchAdvice()

    // Обновляем данные при возврате фокуса на страницу
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchData()
        fetchAdvice() // Обновляем совет при возврате на страницу
      }
    }

    // Обновляем данные при возврате на страницу через Next.js
    const handleFocus = () => {
      fetchData()
      fetchAdvice() // Обновляем совет при возврате на страницу
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [])

  // Вычисляем прогресс для визуализации
  const weightProgress = user?.profile?.target_weight && latestMetric?.weight
    ? Math.min(100, Math.max(0, (latestMetric.weight / user.profile.target_weight) * 100))
    : null

  const caloriesProgress = user?.profile?.target_calories
    ? Math.min(100, Math.max(0, (todayCalories / user.profile.target_calories) * 100))
    : null

  const proteinsProgress = user?.profile?.target_proteins
    ? Math.min(100, Math.max(0, (todayProteins / user.profile.target_proteins) * 100))
    : null

  const fatsProgress = user?.profile?.target_fats
    ? Math.min(100, Math.max(0, (todayFats / user.profile.target_fats) * 100))
    : null

  const carbsProgress = user?.profile?.target_carbs
    ? Math.min(100, Math.max(0, (todayCarbs / user.profile.target_carbs) * 100))
    : null

  const quickActions = [
    {
      title: 'Программы тренировок',
      description: 'Просмотри или создай программу',
      icon: Dumbbell,
      href: '/programs',
      color: 'bg-primary'
    },
    {
      title: 'Дневник питания',
      description: 'Отслеживай свое питание',
      icon: Apple,
      href: '/diary?tab=nutrition',
      color: 'bg-primary'
    },
    {
      title: 'Замеры тела',
      description: 'Добавь новые замеры',
      icon: TrendingUp,
      href: '/diary?tab=metrics',
      color: 'bg-primary'
    },
  ]

  // const backgroundImages = [
  //   '/dashboard-bg.jpg',
  //   '/dashboard-bg-2.jpg'
  // ]

  return (
    <AuthGuard>
      <div className="min-h-screen">

        <main className="container mx-auto px-4 py-8">
          {/* Ежедневный совет от ИИ */}
          <div className="mb-6">
            <Card className="bg-primary/10 border-primary/30">
              <CardContent className="p-4">
                <div className="flex items-start space-x-3">
                  <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    {isLoadingAdvice ? (
                      <div className="flex items-center space-x-2 text-muted-foreground text-sm">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span>Генерирую персональный совет...</span>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm leading-relaxed">{dailyAdvice}</p>
                        {adviceError && (
                          <p className="text-xs text-muted-foreground mt-2">{adviceError}</p>
                        )}
                      </>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={fetchAdvice}
                    disabled={isLoadingAdvice}
                    title="Обновить совет"
                  >
                    <RefreshCw className={`h-3 w-3 ${isLoadingAdvice ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Компактная статистика */}
          <div className="mb-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-4">
              {/* Секция: Питание */}
              {(user?.profile?.target_calories || user?.profile?.target_proteins || user?.profile?.target_fats || user?.profile?.target_carbs) && (
                <Link href="/diary?tab=nutrition">
                  <Card className="hover:shadow-lg transition-all cursor-pointer border bg-primary/10 border-primary/30 h-full">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Flame className="h-5 w-5 text-primary" />
                          <CardTitle className="text-lg">Питание</CardTitle>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Калории */}
                      {user?.profile?.target_calories && (
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-sm font-medium text-muted-foreground">Калории</span>
                            <span className="text-xs text-muted-foreground">
                              {caloriesProgress !== null ? `${Math.round(caloriesProgress)}%` : '—'}
                            </span>
                          </div>
                          <div className="flex items-baseline space-x-2 mb-1">
                            <span className="text-xl font-bold text-primary">
                          {isLoading ? '...' : Math.round(todayCalories)}
                        </span>
                            <span className="text-sm text-muted-foreground">/ {user.profile.target_calories} ккал</span>
                      </div>
                      {caloriesProgress !== null && (
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all duration-300"
                            style={{ width: `${caloriesProgress}%` }}
                          />
                        </div>
                      )}
                        </div>
                      )}

                      {/* Макронутриенты в одну строку */}
                      {((user?.profile?.target_proteins && user.profile.target_proteins > 0) || 
                        (user?.profile?.target_fats && user.profile.target_fats > 0) || 
                        (user?.profile?.target_carbs && user.profile.target_carbs > 0)) && (
                        <div className="grid grid-cols-3 gap-3 pt-2 border-t">
                          {user?.profile?.target_proteins && user.profile.target_proteins > 0 && (
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-muted-foreground">Белки</span>
                                <span className="text-xs text-muted-foreground">
                                  {proteinsProgress !== null ? `${Math.round(proteinsProgress)}%` : '—'}
                                </span>
                      </div>
                              <div className="text-sm font-semibold text-primary">
                                {Math.round(todayProteins)} / {user.profile.target_proteins}г
                      </div>
                      {proteinsProgress !== null && (
                                <div className="mt-1 h-1 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all duration-300"
                            style={{ width: `${proteinsProgress}%` }}
                          />
                        </div>
                      )}
                            </div>
                )}

                          {user?.profile?.target_fats && user.profile.target_fats > 0 && (
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-muted-foreground">Жиры</span>
                                <span className="text-xs text-muted-foreground">
                                  {fatsProgress !== null ? `${Math.round(fatsProgress)}%` : '—'}
                                </span>
                        </div>
                              <div className="text-sm font-semibold text-primary">
                                {Math.round(todayFats)} / {user.profile.target_fats}г
                      </div>
                      {fatsProgress !== null && (
                                <div className="mt-1 h-1 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all duration-300"
                            style={{ width: `${fatsProgress}%` }}
                          />
                        </div>
                      )}
                            </div>
                )}

                          {user?.profile?.target_carbs && user.profile.target_carbs > 0 && (
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-muted-foreground">Углеводы</span>
                                <span className="text-xs text-muted-foreground">
                                  {carbsProgress !== null ? `${Math.round(carbsProgress)}%` : '—'}
                                </span>
                        </div>
                              <div className="text-sm font-semibold text-primary">
                                {Math.round(todayCarbs)} / {user.profile.target_carbs}г
                      </div>
                      {carbsProgress !== null && (
                                <div className="mt-1 h-1 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all duration-300"
                            style={{ width: `${carbsProgress}%` }}
                          />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              )}

              {/* Секция: Замеры тела */}
              <Link href="/diary?tab=metrics">
                <Card className="hover:shadow-lg transition-all cursor-pointer border bg-primary/10 border-primary/30 h-full">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Ruler className="h-5 w-5 text-primary" />
                        <CardTitle className="text-lg">Замеры тела</CardTitle>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Вес */}
                    {user?.profile?.target_weight && (
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                            <Scale className="h-3.5 w-3.5" />
                            Вес
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {weightProgress !== null ? `${Math.round(weightProgress)}%` : '—'}
                          </span>
                        </div>
                        <div className="flex items-baseline space-x-2 mb-1">
                          <span className="text-xl font-bold text-primary">
                            {isLoading ? '...' : (latestMetric?.weight ? `${latestMetric.weight}` : '—')}
                          </span>
                          <span className="text-sm text-muted-foreground">/ {user.profile.target_weight} кг</span>
                        </div>
                        {weightProgress !== null && (
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary transition-all duration-300"
                              style={{ width: `${weightProgress}%` }}
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Остальные замеры с прогрессом к целям */}
                    <div className="space-y-3 pt-2 border-t">
                      {user?.profile?.target_chest && latestMetric?.chest && (
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-sm font-medium text-muted-foreground">Грудь</span>
                            <span className="text-xs text-muted-foreground">
                              {latestMetric.chest} / {user.profile.target_chest} см
                            </span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary transition-all duration-300"
                              style={{ 
                                width: `${Math.min(100, Math.max(0, (latestMetric.chest / user.profile.target_chest) * 100))}%` 
                              }}
                            />
                          </div>
                        </div>
                      )}
                      {user?.profile?.target_waist && latestMetric?.waist && (
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-sm font-medium text-muted-foreground">Талия</span>
                            <span className="text-xs text-muted-foreground">
                              {latestMetric.waist} / {user.profile.target_waist} см
                            </span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary transition-all duration-300"
                              style={{ 
                                width: `${Math.min(100, Math.max(0, (latestMetric.waist / user.profile.target_waist) * 100))}%` 
                              }}
                            />
                          </div>
                        </div>
                      )}
                      {user?.profile?.target_hips && latestMetric?.hips && (
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-sm font-medium text-muted-foreground">Бедра</span>
                            <span className="text-xs text-muted-foreground">
                              {latestMetric.hips} / {user.profile.target_hips} см
                            </span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary transition-all duration-300"
                              style={{ 
                                width: `${Math.min(100, Math.max(0, (latestMetric.hips / user.profile.target_hips) * 100))}%` 
                              }}
                            />
                          </div>
                        </div>
                      )}
                      {user?.profile?.target_biceps && latestMetric?.biceps && (
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-sm font-medium text-muted-foreground">Бицепс</span>
                            <span className="text-xs text-muted-foreground">
                              {latestMetric.biceps} / {user.profile.target_biceps} см
                            </span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary transition-all duration-300"
                              style={{ 
                                width: `${Math.min(100, Math.max(0, (latestMetric.biceps / user.profile.target_biceps) * 100))}%` 
                              }}
                            />
                          </div>
                        </div>
                      )}
                      {user?.profile?.target_thigh && latestMetric?.thigh && (
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-sm font-medium text-muted-foreground">Бедро</span>
                            <span className="text-xs text-muted-foreground">
                              {latestMetric.thigh} / {user.profile.target_thigh} см
                            </span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary transition-all duration-300"
                              style={{ 
                                width: `${Math.min(100, Math.max(0, (latestMetric.thigh / user.profile.target_thigh) * 100))}%` 
                              }}
                            />
                          </div>
                        </div>
                      )}
                      
                      {/* Замеры без целей */}
                      {(!user?.profile?.target_chest || !latestMetric?.chest) && latestMetric?.chest && (
                        <div className="text-xs text-muted-foreground">
                          Грудь: <span className="font-semibold text-primary">{latestMetric.chest} см</span>
                        </div>
                      )}
                      {(!user?.profile?.target_waist || !latestMetric?.waist) && latestMetric?.waist && (
                        <div className="text-xs text-muted-foreground">
                          Талия: <span className="font-semibold text-primary">{latestMetric.waist} см</span>
                        </div>
                      )}
                      {(!user?.profile?.target_hips || !latestMetric?.hips) && latestMetric?.hips && (
                        <div className="text-xs text-muted-foreground">
                          Бедра: <span className="font-semibold text-primary">{latestMetric.hips} см</span>
                        </div>
                      )}
                      {(!user?.profile?.target_biceps || !latestMetric?.biceps) && latestMetric?.biceps && (
                        <div className="text-xs text-muted-foreground">
                          Бицепс: <span className="font-semibold text-primary">{latestMetric.biceps} см</span>
                        </div>
                      )}
                      {(!user?.profile?.target_thigh || !latestMetric?.thigh) && latestMetric?.thigh && (
                        <div className="text-xs text-muted-foreground">
                          Бедро: <span className="font-semibold text-primary">{latestMetric.thigh} см</span>
                        </div>
                      )}
                    </div>

                    {!latestMetric && (
                      <div className="text-sm text-muted-foreground text-center py-4">
                        Нет замеров. Добавь первый замер!
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            </div>

            {/* Кнопка изменения целей */}
            <div className="flex justify-end">
              <Button variant="outline" size="sm" className="text-xs" onClick={() => setIsGoalsModalOpen(true)}>
                <Target className="h-3 w-3 mr-1.5" />
                Изменить цели
              </Button>
            </div>
          </div>

          {/* Модальное окно целей */}
          <GoalsModal isOpen={isGoalsModalOpen} onClose={(open) => setIsGoalsModalOpen(open)} />

          {/* TDEE Calculator */}
          <div className="mb-8">
            <TDEECalculator />
          </div>

          {/* Графики */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="h-[400px]">
              <WeightChart
                data={weightHistory}
                targetWeight={user?.profile?.target_weight}
                targetChest={user?.profile?.target_chest}
                targetWaist={user?.profile?.target_waist}
                targetHips={user?.profile?.target_hips}
                targetBiceps={user?.profile?.target_biceps}
                targetThigh={user?.profile?.target_thigh}
              />
            </div>
            <div className="h-[400px]">
              <CaloriesChart
                logs={nutritionHistory}
                targetCalories={user?.profile?.target_calories}
              />
            </div>
          </div>

          {/* Быстрые действия */}
          <div className="mb-8">
            <h2 className="text-2xl font-extrabold mb-4">Быстрые действия</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {quickActions.map((action) => {
                const Icon = action.icon
                return (
                  <Link key={action.title} href={action.href}>
                    <Card className="hover:shadow-lg transition-all cursor-pointer h-full border-0">
                      <CardHeader>
                        <div className={`w-12 h-12 rounded-lg ${action.color} flex items-center justify-center mb-4`}>
                          <Icon className="h-6 w-6 text-white" />
                        </div>
                        <CardTitle>{action.title}</CardTitle>
                        <CardDescription>{action.description}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Button variant="ghost" className="w-full justify-between">
                          Перейти
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </CardContent>
                    </Card>
                  </Link>
                )
              })}
            </div>
          </div>

        </main>
      </div>
    </AuthGuard>
  )
}
