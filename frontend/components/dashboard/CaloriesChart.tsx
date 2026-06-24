'use client'

import { useMemo, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
  Legend,
} from 'recharts'
import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { NutritionLog } from '@/lib/api'
import { cn } from '@/lib/utils'

interface CaloriesChartProps {
  logs: NutritionLog[]
  targetCalories?: number | null
}

type NutritionType = 'calories' | 'proteins' | 'fats' | 'carbs'

const nutritionConfig: Record<NutritionType, { label: string; color: string; unit: string }> = {
  calories: { label: 'Калории', color: '#f97316', unit: ' ккал' },
  proteins: { label: 'Белки', color: '#3b82f6', unit: ' г' },
  fats: { label: 'Жиры', color: '#eab308', unit: ' г' },
  carbs: { label: 'Углеводы', color: '#10b981', unit: ' г' },
}

export function CaloriesChart({ logs, targetCalories }: CaloriesChartProps) {
  const [selectedMetrics, setSelectedMetrics] = useState<Set<NutritionType>>(new Set<NutritionType>(['calories']))

  const chartData = useMemo(() => {
    if (logs.length === 0) return []

    const dailyMap = new Map<string, { calories: number; proteins: number; fats: number; carbs: number }>()

    logs.forEach(log => {
      if (!log.eaten_at) return

      const dateKey = format(parseISO(log.eaten_at), 'yyyy-MM-dd')
      const current = dailyMap.get(dateKey) || { calories: 0, proteins: 0, fats: 0, carbs: 0 }

      dailyMap.set(dateKey, {
        calories: current.calories + (log.calories || 0),
        proteins: current.proteins + (log.proteins || 0),
        fats: current.fats + (log.fats || 0),
        carbs: current.carbs + (log.carbs || 0),
      })
    })

    return Array.from(dailyMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([dateStr, values]) => ({
        date: format(parseISO(dateStr), 'd MMM', { locale: ru }),
        calories: Math.round(values.calories),
        proteins: Math.round(values.proteins),
        fats: Math.round(values.fats),
        carbs: Math.round(values.carbs),
        fullDate: format(parseISO(dateStr), 'd MMMM yyyy', { locale: ru }),
      }))
      .slice(-7)
  }, [logs])

  const toggleMetric = (metric: NutritionType) => {
    setSelectedMetrics(prev => {
      const newSet = new Set(prev)
      if (newSet.has(metric)) {

        if (newSet.size > 1) {
          newSet.delete(metric)
        }
      } else {
        newSet.add(metric)
      }
      return newSet
    })
  }

  const hasData = useMemo(() => {
    if (chartData.length === 0) return false
    return Array.from(selectedMetrics).some(metric =>
      chartData.some(d => d[metric] != null && d[metric] > 0)
    )
  }, [chartData, selectedMetrics])

  if (chartData.length === 0) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader>
          <CardTitle>График питания</CardTitle>
          <CardDescription>Нет данных для отображения</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center text-muted-foreground">
          Начните вести дневник питания
        </CardContent>
      </Card>
    )
  }

  if (!hasData) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader>
          <CardTitle>График питания</CardTitle>
          <CardDescription>Нет данных для выбранных метрик</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center text-muted-foreground">
          Выберите метрики для отображения
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2 shrink-0">
        <CardTitle>Потребление КБЖУ</CardTitle>
        <CardDescription>Последние 7 активных дней</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col overflow-hidden pt-0">

        <div className="flex flex-wrap gap-1.5 mb-2 shrink-0">
          {(Object.keys(nutritionConfig) as NutritionType[]).map((metric) => {
            const config = nutritionConfig[metric]
            const isSelected = selectedMetrics.has(metric)
            const hasDataForMetric = chartData.some(d => d[metric] != null && d[metric] > 0)

            return (
              <button
                key={metric}
                type="button"
                onClick={() => toggleMetric(metric)}
                disabled={!hasDataForMetric}
                className={cn(
                  "px-2 py-1 rounded-md text-xs font-medium transition-all",
                  "focus:outline-none disabled:opacity-30 disabled:cursor-not-allowed",
                  isSelected
                    ? "text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
                style={isSelected ? { backgroundColor: config.color } : undefined}
              >
                {config.label}
              </button>
            )
          })}
        </div>

        <div className="flex-1 min-h-0 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 20, left: 5 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10 }}
                tickMargin={6}
                axisLine={false}
                tickLine={false}
                style={{ fill: 'currentColor' }}
              />
              <YAxis
                tick={{ fontSize: 10 }}
                width={50}
                style={{ fill: 'currentColor' }}
              />
              <Tooltip
                cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                labelStyle={{ color: '#6b7280', marginBottom: '0.25rem' }}
                formatter={(value: number, name: string) => {
                  const metric = name as NutritionType
                  const config = nutritionConfig[metric]
                  return [`${value}${config.unit}`, config.label]
                }}
              />
              <Legend
                wrapperStyle={{ paddingTop: '4px', fontSize: '11px' }}
                formatter={(value: string) => {
                  const metric = value as NutritionType
                  return nutritionConfig[metric]?.label || value
                }}
              />
              {targetCalories && selectedMetrics.has('calories') && (
                <ReferenceLine
                  y={targetCalories}
                  stroke="#10b981"
                  strokeDasharray="3 3"
                  label={{ value: 'Цель', position: 'insideTopLeft', fill: '#10b981', fontSize: 10 }}
                />
              )}
              {selectedMetrics.has('calories') && (
                <Bar dataKey="calories" radius={[4, 4, 0, 0]} fill={nutritionConfig.calories.color} name="calories">
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-calories-${index}`}
                      fill={targetCalories && entry.calories > targetCalories ? '#ef4444' : nutritionConfig.calories.color}
                    />
                  ))}
                </Bar>
              )}
              {selectedMetrics.has('proteins') && (
                <Bar dataKey="proteins" radius={[4, 4, 0, 0]} fill={nutritionConfig.proteins.color} name="proteins" />
              )}
              {selectedMetrics.has('fats') && (
                <Bar dataKey="fats" radius={[4, 4, 0, 0]} fill={nutritionConfig.fats.color} name="fats" />
              )}
              {selectedMetrics.has('carbs') && (
                <Bar dataKey="carbs" radius={[4, 4, 0, 0]} fill={nutritionConfig.carbs.color} name="carbs" />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
