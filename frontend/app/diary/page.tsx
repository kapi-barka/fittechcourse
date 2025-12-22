/**
 * Страница дневника - питание и метрики
 */
'use client'

import React, { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { AuthGuard } from '@/components/AuthGuard'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { AddMealModal } from '@/components/AddMealModal'
import { EditMetricModal } from '@/components/EditMetricModal'
import { EditLogModal } from '@/components/EditLogModal'
import { WaterTracker } from '@/components/nutrition/WaterTracker'
import { metricsAPI, nutritionAPI, BodyMetric, NutritionLog } from '@/lib/api'
import {
  Apple,
  Activity,
  Plus,
  Trash2,
  Scale,
  Flame,
  ChevronRight,
  Sun,
  UtensilsCrossed,
  Moon,
  Coffee,
  Droplet,
  Edit,
  Pencil
} from 'lucide-react'
import { formatDate, round } from '@/lib/utils'
import { toast } from 'react-toastify'

function DiaryContent() {
  const searchParams = useSearchParams()
  const initialTab = searchParams.get('tab') || 'nutrition'

  const [activeTab, setActiveTab] = useState<'nutrition' | 'metrics' | 'hydration'>(
    (initialTab as 'nutrition' | 'metrics' | 'hydration') || 'nutrition'
  )
  const [metrics, setMetrics] = useState<BodyMetric[]>([])
  const [nutritionLogs, setNutritionLogs] = useState<NutritionLog[]>([])
  const [dailySummary, setDailySummary] = useState({
    total_calories: 0,
    total_proteins: 0,
    total_fats: 0,
    total_carbs: 0
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isAddMealModalOpen, setIsAddMealModalOpen] = useState(false)
  const [editingMetric, setEditingMetric] = useState<BodyMetric | null>(null)
  const [editingLog, setEditingLog] = useState<NutritionLog | null>(null)

  // Форма добавления замера
  const [newMetric, setNewMetric] = useState({
    weight: '',
    chest: '',
    waist: '',
    hips: '',
    biceps: '',
    thigh: '',
    date: new Date().toISOString().split('T')[0]
  })

  useEffect(() => {
    if (activeTab === 'nutrition') {
      fetchNutrition()
    } else if (activeTab === 'metrics') {
      fetchMetrics()
    }
    // hydration не требует загрузки данных при переключении
  }, [activeTab])

  const fetchMetrics = async () => {
    setIsLoading(true)
    try {
      const res = await metricsAPI.list()
      setMetrics(res.data)
    } catch (error) {
      console.error('Error fetching metrics:', error)
    }
    setIsLoading(false)
  }

  const fetchNutrition = async () => {
    setIsLoading(true)
    try {
      const today = new Date().toISOString().split('T')[0]
      const [logsRes, summaryRes] = await Promise.all([
        nutritionAPI.listLogs({ from_date: today, to_date: today }),
        nutritionAPI.getDailySummary(today)
      ])

      setNutritionLogs(logsRes.data)
      setDailySummary(summaryRes.data)
    } catch (error) {
      console.error('Error fetching nutrition:', error)
    }
    setIsLoading(false)
  }

  const validateMetric = (): string | null => {
    if (newMetric.weight) {
      const weight = parseFloat(newMetric.weight)
      if (isNaN(weight) || weight < 20 || weight > 300) {
        return 'Вес должен быть от 20 до 300 кг'
      }
    }
    if (newMetric.chest) {
      const chest = parseFloat(newMetric.chest)
      if (isNaN(chest) || chest < 50 || chest > 200) {
        return 'Обхват груди должен быть от 50 до 200 см'
      }
    }
    if (newMetric.waist) {
      const waist = parseFloat(newMetric.waist)
      if (isNaN(waist) || waist < 40 || waist > 200) {
        return 'Обхват талии должен быть от 40 до 200 см'
      }
    }
    if (newMetric.hips) {
      const hips = parseFloat(newMetric.hips)
      if (isNaN(hips) || hips < 50 || hips > 200) {
        return 'Обхват бедер должен быть от 50 до 200 см'
      }
    }
    if (newMetric.biceps) {
      const biceps = parseFloat(newMetric.biceps)
      if (isNaN(biceps) || biceps < 15 || biceps > 80) {
        return 'Обхват бицепса должен быть от 15 до 80 см'
      }
    }
    if (newMetric.thigh) {
      const thigh = parseFloat(newMetric.thigh)
      if (isNaN(thigh) || thigh < 30 || thigh > 150) {
        return 'Обхват бедра должен быть от 30 до 150 см'
      }
    }
    return null
  }

  const handleAddMetric = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const validationError = validateMetric()
    if (validationError) {
      toast.error(validationError)
      return
    }
    
    try {
      await metricsAPI.create({
        date: newMetric.date,
        weight: newMetric.weight ? parseFloat(newMetric.weight) : undefined,
        chest: newMetric.chest ? parseFloat(newMetric.chest) : undefined,
        waist: newMetric.waist ? parseFloat(newMetric.waist) : undefined,
        hips: newMetric.hips ? parseFloat(newMetric.hips) : undefined,
        biceps: newMetric.biceps ? parseFloat(newMetric.biceps) : undefined,
        thigh: newMetric.thigh ? parseFloat(newMetric.thigh) : undefined,
      })

      setNewMetric({ 
        weight: '', 
        chest: '', 
        waist: '', 
        hips: '',
        biceps: '',
        thigh: '',
        date: new Date().toISOString().split('T')[0] 
      })
      fetchMetrics()
      toast.success('Замер успешно добавлен')
    } catch (error) {
      console.error('Error adding metric:', error)
      toast.error('Ошибка при добавлении замера')
    }
  }

  const handleDeleteLog = async (id: string) => {
    if (!confirm('Вы уверены, что хотите удалить эту запись?')) return
    
    try {
      await nutritionAPI.deleteLog(id)
      fetchNutrition()
      toast.success('Запись удалена')
    } catch (error) {
      console.error('Error deleting log:', error)
      toast.error('Ошибка при удалении записи')
    }
  }

  const handleUpdateLog = async (logId: string, data: Partial<NutritionLog>) => {
    try {
      await nutritionAPI.updateLog(logId, data)
      fetchNutrition()
      setEditingLog(null)
      toast.success('Запись обновлена')
    } catch (error) {
      console.error('Error updating log:', error)
      toast.error('Ошибка при обновлении записи')
    }
  }

  const handleDeleteMetric = async (id: string) => {
    if (!confirm('Вы уверены, что хотите удалить этот замер?')) return
    
    try {
      await metricsAPI.delete(id)
      fetchMetrics()
      toast.success('Замер удален')
    } catch (error) {
      console.error('Error deleting metric:', error)
      toast.error('Ошибка при удалении замера')
    }
  }

  const handleUpdateMetric = async (metricId: string, data: Partial<BodyMetric>) => {
    try {
      await metricsAPI.update(metricId, data)
      fetchMetrics()
      setEditingMetric(null)
      toast.success('Замер обновлен')
    } catch (error) {
      console.error('Error updating metric:', error)
      toast.error('Ошибка при обновлении замера')
    }
  }

  // Группировка приемов пищи по типам
  const groupMealsByType = (logs: NutritionLog[]) => {
    const grouped: Record<string, NutritionLog[]> = {
      breakfast: [],
      lunch: [],
      dinner: [],
      snack: [],
      other: []
    }

    logs.forEach(log => {
      const mealType = log.meal_type || 'other'
      if (grouped[mealType]) {
        grouped[mealType].push(log)
      } else {
        grouped.other.push(log)
      }
    })

    return grouped
  }

  const mealTypeLabels: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
    breakfast: { label: 'Завтрак', icon: <Sun className="h-5 w-5" />, color: 'text-yellow-600 dark:text-yellow-400' },
    lunch: { label: 'Обед', icon: <UtensilsCrossed className="h-5 w-5" />, color: 'text-orange-600 dark:text-orange-400' },
    dinner: { label: 'Ужин', icon: <Moon className="h-5 w-5" />, color: 'text-blue-600 dark:text-blue-400' },
    snack: { label: 'Перекус', icon: <Coffee className="h-5 w-5" />, color: 'text-green-500 dark:text-green-400/80' },
    other: { label: 'Другое', icon: <Apple className="h-5 w-5" />, color: 'text-muted-foreground' }
  }

  const groupedMeals = groupMealsByType(nutritionLogs)

  return (
    <AuthGuard>
      <div className="min-h-screen">

        <main className="container mx-auto px-4 py-8">
          {/* Табы */}
          <div className="flex space-x-2 mb-8 border-b">
            <button
              onClick={() => setActiveTab('nutrition')}
              className={`px-4 py-2 font-medium transition-colors border-b-2 ${activeTab === 'nutrition'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
            >
              <Apple className="inline-block mr-2 h-4 w-4" />
              Питание
            </button>
            <button
              onClick={() => setActiveTab('metrics')}
              className={`px-4 py-2 font-medium transition-colors border-b-2 ${activeTab === 'metrics'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
            >
              <Activity className="inline-block mr-2 h-4 w-4" />
              Замеры
            </button>
            <button
              onClick={() => setActiveTab('hydration')}
              className={`px-4 py-2 font-medium transition-colors border-b-2 ${activeTab === 'hydration'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
            >
              <Droplet className="inline-block mr-2 h-4 w-4" />
              Вода
            </button>
          </div>

          {/* Контент табов */}
          {activeTab === 'nutrition' ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Левая колонка - КБЖУ (одна панель) */}
              <div className="lg:col-span-3">
                <Card className="border-0">
                  <CardContent className="pt-4 pb-4 space-y-4">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Калории</div>
                      <div className="text-lg font-semibold">{round(dailySummary.total_calories, 0)}</div>
                      <Flame className="h-3 w-3 text-orange-500 mt-1" />
                    </div>
                    <div className="border-t pt-4">
                      <div className="text-xs text-muted-foreground mb-1">Белки</div>
                      <div className="text-lg font-semibold">{round(dailySummary.total_proteins, 1)} г</div>
                    </div>
                    <div className="border-t pt-4">
                      <div className="text-xs text-muted-foreground mb-1">Жиры</div>
                      <div className="text-lg font-semibold">{round(dailySummary.total_fats, 1)} г</div>
                    </div>
                    <div className="border-t pt-4">
                      <div className="text-xs text-muted-foreground mb-1">Углеводы</div>
                      <div className="text-lg font-semibold">{round(dailySummary.total_carbs, 1)} г</div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Правая колонка - Записи питания */}
              <div className="lg:col-span-9">
                <Card className="border-0">
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <CardTitle>Приемы пищи сегодня</CardTitle>
                      <Button
                        size="sm"
                        onClick={() => setIsAddMealModalOpen(true)}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Добавить
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <div className="text-center py-8 text-muted-foreground">Загрузка...</div>
                    ) : nutritionLogs.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        Нет записей за сегодня
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {Object.entries(groupedMeals).map(([mealType, logs]) => {
                          if (logs.length === 0) return null
                          
                          const mealInfo = mealTypeLabels[mealType] || mealTypeLabels.other
                          const mealTotal = logs.reduce((acc, log) => ({
                            calories: acc.calories + (log.calories || 0),
                            proteins: acc.proteins + (log.proteins || 0),
                            fats: acc.fats + (log.fats || 0),
                            carbs: acc.carbs + (log.carbs || 0)
                          }), { calories: 0, proteins: 0, fats: 0, carbs: 0 })

                          return (
                            <div key={mealType} className="space-y-3">
                              {/* Заголовок типа приема пищи */}
                              <div className="flex items-center justify-between pb-2 border-b">
                                <div className="flex items-center gap-2">
                                  <div className={mealInfo.color}>
                                    {mealInfo.icon}
                                  </div>
                                  <h3 className="font-semibold text-lg">{mealInfo.label}</h3>
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {round(mealTotal.calories, 0)} ккал
                                </div>
                              </div>
                              
                              {/* Список продуктов в этом приеме пищи */}
                              <div className="space-y-2">
                                {logs.map((log) => (
                                  <div key={log.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors group">
                                    <div className="flex-1">
                                      <p className="font-medium">{log.product_name || `Продукт #${log.product_id.slice(0, 8)}`}</p>
                                      <p className="text-sm text-muted-foreground">
                                        {log.weight_g ? round(log.weight_g, 0) : 0}г • {log.calories ? round(log.calories, 0) : 0} ккал
                                        {log.proteins && log.fats && log.carbs && (
                                          <span className="ml-2">
                                            Б: {round(log.proteins, 1)}г Ж: {round(log.fats, 1)}г У: {round(log.carbs, 1)}г
                                          </span>
                                        )}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setEditingLog(log)}
                                        className="h-8 px-2"
                                        title="Редактировать"
                                      >
                                        <Edit className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleDeleteLog(log.id)}
                                        className="h-8 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                                        title="Удалить"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : activeTab === 'hydration' ? (
            <div>
              <WaterTracker />
            </div>
          ) : (
            <div>
              {/* Форма добавления замера */}
              <Card className="border-0 mb-8">
                <CardHeader>
                  <CardTitle>Добавить замер</CardTitle>
                  <CardDescription>Введи свои текущие показатели</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleAddMetric} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Input
                        label="Дата"
                        type="date"
                        value={newMetric.date}
                        onChange={(e) => setNewMetric({ ...newMetric, date: e.target.value })}
                        required
                      />
                      <div>
                      <Input
                        label="Вес (кг)"
                        type="number"
                        step="0.1"
                        placeholder="75.5"
                        value={newMetric.weight}
                        onChange={(e) => setNewMetric({ ...newMetric, weight: e.target.value })}
                          min="20"
                          max="300"
                      />
                        <p className="text-xs text-muted-foreground mt-1">От 20 до 300 кг</p>
                      </div>
                      <div>
                      <Input
                        label="Грудь (см)"
                        type="number"
                        step="0.1"
                        placeholder="95"
                        value={newMetric.chest}
                        onChange={(e) => setNewMetric({ ...newMetric, chest: e.target.value })}
                          min="50"
                          max="200"
                      />
                        <p className="text-xs text-muted-foreground mt-1">От 50 до 200 см</p>
                      </div>
                      <div>
                      <Input
                        label="Талия (см)"
                        type="number"
                        step="0.1"
                        placeholder="80"
                        value={newMetric.waist}
                        onChange={(e) => setNewMetric({ ...newMetric, waist: e.target.value })}
                          min="40"
                          max="200"
                        />
                        <p className="text-xs text-muted-foreground mt-1">От 40 до 200 см</p>
                      </div>
                      <div>
                        <Input
                          label="Бедра (см)"
                          type="number"
                          step="0.1"
                          placeholder="100"
                          value={newMetric.hips}
                          onChange={(e) => setNewMetric({ ...newMetric, hips: e.target.value })}
                          min="50"
                          max="200"
                        />
                        <p className="text-xs text-muted-foreground mt-1">От 50 до 200 см</p>
                      </div>
                      <div>
                        <Input
                          label="Бицепс (см)"
                          type="number"
                          step="0.1"
                          placeholder="35"
                          value={newMetric.biceps}
                          onChange={(e) => setNewMetric({ ...newMetric, biceps: e.target.value })}
                          min="15"
                          max="80"
                        />
                        <p className="text-xs text-muted-foreground mt-1">От 15 до 80 см</p>
                      </div>
                      <div>
                        <Input
                          label="Бедро (см)"
                          type="number"
                          step="0.1"
                          placeholder="60"
                          value={newMetric.thigh}
                          onChange={(e) => setNewMetric({ ...newMetric, thigh: e.target.value })}
                          min="30"
                          max="150"
                        />
                        <p className="text-xs text-muted-foreground mt-1">От 30 до 150 см</p>
                      </div>
                    </div>
                    <Button type="submit">
                      <Plus className="mr-2 h-4 w-4" />
                      Добавить замер
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* История замеров */}
              <Card className="border-0">
                <CardHeader>
                  <CardTitle>История замеров</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="text-center py-8 text-muted-foreground">Загрузка...</div>
                  ) : metrics.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Нет замеров. Добавь первый!
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {metrics.map((metric) => (
                        <div key={metric.id} className="flex items-center justify-between p-4 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors group">
                          <div className="flex-1">
                            <p className="font-medium">{formatDate(metric.date)}</p>
                            <div className="flex items-center flex-wrap gap-3 mt-2 text-sm text-muted-foreground">
                              {metric.weight && (
                                <span className="flex items-center">
                                  <Scale className="h-4 w-4 mr-1" />
                                  {metric.weight} кг
                                </span>
                              )}
                              {metric.chest && <span>Грудь: {metric.chest} см</span>}
                              {metric.waist && <span>Талия: {metric.waist} см</span>}
                              {metric.hips && <span>Бедра: {metric.hips} см</span>}
                              {metric.biceps && <span>Бицепс: {metric.biceps} см</span>}
                              {metric.thigh && <span>Бедро: {metric.thigh} см</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setEditingMetric(metric)}
                              className="h-8 px-2"
                              title="Редактировать"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteMetric(metric.id)}
                              className="h-8 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                              title="Удалить"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </main>

        {/* Модальное окно добавления приёма пищи */}
        <AddMealModal
          isOpen={isAddMealModalOpen}
          onClose={() => setIsAddMealModalOpen(false)}
          onSuccess={() => {
            fetchNutrition()
          }}
        />

        {/* Модальное окно редактирования замера */}
        <EditMetricModal
          isOpen={editingMetric !== null}
          onClose={() => setEditingMetric(null)}
          metric={editingMetric}
          onSuccess={() => {
            fetchMetrics()
          }}
        />

        {/* Модальное окно редактирования записи питания */}
        <EditLogModal
          isOpen={editingLog !== null}
          onClose={() => setEditingLog(null)}
          log={editingLog}
          onSuccess={() => {
            fetchNutrition()
          }}
        />
      </div>
    </AuthGuard>
  )
}

export default function DiaryPage() {
  return (
    <Suspense fallback={
      <AuthGuard>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-muted-foreground">Загрузка...</div>
        </div>
      </AuthGuard>
    }>
      <DiaryContent />
    </Suspense>
  )
}

