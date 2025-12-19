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
  RefreshCw
} from 'lucide-react'
import Link from 'next/link'
import { subDays, format } from 'date-fns'

export default function DashboardPage() {
  const { user } = useAuthStore()
  const [latestWeight, setLatestWeight] = useState<number | null>(null)
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
      // Получаем последний вес
      const metricsRes = await metricsAPI.latest()
      if (metricsRes.data.weight) {
        setLatestWeight(metricsRes.data.weight)
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
  const weightProgress = user?.profile?.target_weight && latestWeight
    ? Math.min(100, Math.max(0, (latestWeight / user.profile.target_weight) * 100))
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

          {/* Быстрая статистика */}
          <div className="mb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {/* Вес - показываем только если цель установлена */}
              {user?.profile?.target_weight && (
                <Link href="/diary?tab=metrics">
                  <Card className="hover:shadow-md transition-all cursor-pointer border bg-primary/10 border-primary/30">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <Activity className="h-4 w-4 text-primary" />
                          <span className="text-sm font-medium text-muted-foreground">Вес</span>
                        </div>
                        {weightProgress !== null && (
                          <span className="text-xs text-muted-foreground">{Math.round(weightProgress)}%</span>
                        )}
                      </div>
                      <div className="flex items-baseline space-x-2">
                        <span className="text-2xl font-bold text-primary">
                          {isLoading ? '...' : (latestWeight ? `${latestWeight}` : '?')}
                        </span>
                        <span className="text-muted-foreground">/</span>
                        <span className="text-lg text-muted-foreground">{user.profile.target_weight} кг</span>
                      </div>
                      {weightProgress !== null && (
                        <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all duration-300"
                            style={{ width: `${weightProgress}%` }}
                          />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              )}

              {/* Калории - показываем только если цель установлена */}
              {user?.profile?.target_calories && (
                <Link href="/diary?tab=nutrition">
                  <Card className="hover:shadow-md transition-all cursor-pointer border bg-primary/10 border-primary/30">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <Flame className="h-4 w-4 text-primary" />
                          <span className="text-sm font-medium text-muted-foreground">Калории</span>
                        </div>
                        {caloriesProgress !== null && (
                          <span className="text-xs text-muted-foreground">{Math.round(caloriesProgress)}%</span>
                        )}
                      </div>
                      <div className="flex items-baseline space-x-2">
                        <span className="text-2xl font-bold text-primary">
                          {isLoading ? '...' : Math.round(todayCalories)}
                        </span>
                        <span className="text-muted-foreground">/</span>
                        <span className="text-lg text-muted-foreground">{user.profile.target_calories} ккал</span>
                      </div>
                      {caloriesProgress !== null && (
                        <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all duration-300"
                            style={{ width: `${caloriesProgress}%` }}
                          />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              )}
            </div>

            {/* Макронутриенты - показываем только если цели установлены */}
            {(user?.profile?.target_proteins || user?.profile?.target_fats || user?.profile?.target_carbs) && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                {user?.profile?.target_proteins && (
                  <Card className="border bg-primary/10 border-primary/30">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <Activity className="h-4 w-4 text-primary" />
                          <span className="text-sm font-medium text-muted-foreground">Белки</span>
                        </div>
                        {proteinsProgress !== null && (
                          <span className="text-xs text-muted-foreground">{Math.round(proteinsProgress)}%</span>
                        )}
                      </div>
                      <div className="flex items-baseline space-x-2">
                        <span className="text-xl font-bold text-primary">
                          {Math.round(todayProteins)}
                        </span>
                        <span className="text-muted-foreground">/</span>
                        <span className="text-lg text-muted-foreground">{user.profile.target_proteins} г</span>
                      </div>
                      {proteinsProgress !== null && (
                        <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all duration-300"
                            style={{ width: `${proteinsProgress}%` }}
                          />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {user?.profile?.target_fats && (
                  <Card className="border bg-primary/10 border-primary/30">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <Activity className="h-4 w-4 text-primary" />
                          <span className="text-sm font-medium text-muted-foreground">Жиры</span>
                        </div>
                        {fatsProgress !== null && (
                          <span className="text-xs text-muted-foreground">{Math.round(fatsProgress)}%</span>
                        )}
                      </div>
                      <div className="flex items-baseline space-x-2">
                        <span className="text-xl font-bold text-primary">
                          {Math.round(todayFats)}
                        </span>
                        <span className="text-muted-foreground">/</span>
                        <span className="text-lg text-muted-foreground">{user.profile.target_fats} г</span>
                      </div>
                      {fatsProgress !== null && (
                        <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all duration-300"
                            style={{ width: `${fatsProgress}%` }}
                          />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {user?.profile?.target_carbs && (
                  <Card className="border bg-primary/10 border-primary/30">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <Activity className="h-4 w-4 text-primary" />
                          <span className="text-sm font-medium text-muted-foreground">Углеводы</span>
                        </div>
                        {carbsProgress !== null && (
                          <span className="text-xs text-muted-foreground">{Math.round(carbsProgress)}%</span>
                        )}
                      </div>
                      <div className="flex items-baseline space-x-2">
                        <span className="text-xl font-bold text-primary">
                          {Math.round(todayCarbs)}
                        </span>
                        <span className="text-muted-foreground">/</span>
                        <span className="text-lg text-muted-foreground">{user.profile.target_carbs} г</span>
                      </div>
                      {carbsProgress !== null && (
                        <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all duration-300"
                            style={{ width: `${carbsProgress}%` }}
                          />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

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
