'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { nutritionAPI } from '@/lib/api'
import { Droplet, Plus, Minus } from 'lucide-react'
import { toast } from 'react-toastify'
import { AxiosError } from 'axios'

export function WaterTracker() {
  const [amount, setAmount] = useState(250)
  const [hydration, setHydration] = useState<{
    total_ml: number
    recommended_ml: number
    percentage: number
  } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(true)

  const fetchHydration = async () => {
    try {
      setIsFetching(true)
      const response = await nutritionAPI.getTodayHydration()
      console.log('Hydration data fetched:', response.data)
      setHydration(response.data)
    } catch (error) {
      console.error('Failed to fetch hydration:', error)
    } finally {
      setIsFetching(false)
    }
  }

  useEffect(() => {
    fetchHydration()
  }, [])

  const handleLogWater = async () => {
    if (amount < 50 || amount > 5000) {
      toast.error('Количество воды должно быть от 50 до 5000 мл')
      return
    }

    setIsLoading(true)
    try {
      const response = await nutritionAPI.logWater(amount)
      console.log('Water logged successfully:', response.data)
      // Обновляем данные после успешного добавления
      await fetchHydration()
      setAmount(250) // Сброс к стандартному значению
      toast.success(`Добавлено ${amount} мл воды`)
    } catch (error) {
      console.error('Failed to log water:', error)
      const errorMessage = error instanceof AxiosError 
        ? error.response?.data?.detail || 'Ошибка при записи воды'
        : 'Ошибка при записи воды'
      toast.error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const quickAmounts = [100, 250, 500, 1000]

  if (isFetching) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Droplet className="h-5 w-5" />
            Трекинг воды
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">Загрузка...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Droplet className="h-5 w-5" />
          Трекинг воды
        </CardTitle>
        <CardDescription>
          Отслеживайте потребление воды в течение дня
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Прогресс */}
        {hydration && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Выпито сегодня</span>
              <span className="font-medium">
                {hydration.total_ml.toFixed(0)} мл / {hydration.recommended_ml.toFixed(0)} мл
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
              <div
                className="bg-blue-500 h-full transition-all duration-300 rounded-full"
                style={{ width: `${Math.min(hydration.percentage, 100)}%` }}
              />
            </div>
            <div className="text-center text-sm text-muted-foreground">
              {hydration.percentage.toFixed(1)}% от нормы
            </div>
          </div>
        )}

        {/* Быстрые кнопки */}
        <div>
          <label className="block text-sm font-medium mb-2">Быстрый выбор (мл)</label>
          <div className="grid grid-cols-4 gap-2">
            {quickAmounts.map((quickAmount) => (
              <Button
                key={quickAmount}
                variant="outline"
                size="sm"
                onClick={() => setAmount(quickAmount)}
                className={amount === quickAmount ? 'bg-primary text-white' : ''}
              >
                {quickAmount}
              </Button>
            ))}
          </div>
        </div>

        {/* Ручной ввод */}
        <div>
          <label className="block text-sm font-medium mb-2">Количество (мл)</label>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setAmount(Math.max(50, amount - 50))}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <Input
              type="number"
              value={amount}
              onChange={(e) => {
                const value = parseInt(e.target.value) || 0
                setAmount(Math.max(50, Math.min(5000, value)))
              }}
              min="50"
              max="5000"
              step="50"
              className="text-center"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => setAmount(Math.min(5000, amount + 50))}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center">От 50 до 5000 мл</p>

        {/* Кнопка добавления */}
        <Button
          onClick={handleLogWater}
          disabled={isLoading || amount < 50 || amount > 5000}
          className="w-full"
        >
          <Plus className="mr-2 h-4 w-4" />
          {isLoading ? 'Добавление...' : `Добавить ${amount} мл`}
        </Button>
      </CardContent>
    </Card>
  )
}

