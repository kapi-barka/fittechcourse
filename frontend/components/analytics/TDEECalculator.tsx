'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { analyticsAPI } from '@/lib/api'
import { Calculator, Loader2, AlertCircle } from 'lucide-react'

export function TDEECalculator() {
  const [tdeeData, setTdeeData] = useState<{
    bmr: number
    tdee: number
    weight_kg: number
    height_cm: number
    age: number
    activity_level: string
  } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchTDEE = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await analyticsAPI.getTDEE()
      setTdeeData(response.data)
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || 'Ошибка при расчете TDEE'
      setError(errorMessage)
      setTdeeData(null)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchTDEE()
  }, [])

  const activityLevelNames: Record<string, string> = {
    sedentary: 'Сидячий образ жизни',
    lightly_active: 'Легкая активность',
    moderately_active: 'Умеренная активность',
    very_active: 'Высокая активность',
    extremely_active: 'Очень высокая активность',
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calculator className="h-4 w-4" />
            TDEE и BMR
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-3">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calculator className="h-4 w-4" />
            TDEE и BMR
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 p-3 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 rounded-lg text-sm">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <div className="min-w-0">
              <p className="font-medium text-xs">Недостаточно данных</p>
              <p className="text-xs truncate">{error}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!tdeeData) {
    return null
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Calculator className="h-4 w-4" />
          TDEE и BMR
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Основные показатели */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="text-xs text-muted-foreground mb-0.5">BMR</div>
            <div className="text-xl font-bold">{tdeeData.bmr.toFixed(0)}</div>
            <div className="text-xs text-muted-foreground">ккал/день</div>
          </div>
          <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <div className="text-xs text-muted-foreground mb-0.5">TDEE</div>
            <div className="text-xl font-bold">{tdeeData.tdee.toFixed(0)}</div>
            <div className="text-xs text-muted-foreground">ккал/день</div>
          </div>
        </div>

        {/* Детали - компактно в одну строку */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Вес:</span>
            <span className="font-medium">{tdeeData.weight_kg} кг</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Рост:</span>
            <span className="font-medium">{tdeeData.height_cm} см</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Возраст:</span>
            <span className="font-medium">{tdeeData.age} лет</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Активность:</span>
            <span className="font-medium text-right">
              {activityLevelNames[tdeeData.activity_level]?.split(' ')[0] || tdeeData.activity_level}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

