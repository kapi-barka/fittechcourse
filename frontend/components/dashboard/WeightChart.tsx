'use client'

import { useMemo, useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from 'recharts'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { BodyMetric } from '@/lib/api'
import { cn } from '@/lib/utils'

interface WeightChartProps {
  data: BodyMetric[]
  targetWeight?: number | null
  targetChest?: number | null
  targetWaist?: number | null
  targetHips?: number | null
  targetBiceps?: number | null
  targetThigh?: number | null
}

type MetricType = 'weight' | 'chest' | 'waist' | 'hips' | 'biceps' | 'thigh'

const metricConfig: Record<MetricType, { label: string; color: string; unit: string }> = {
  weight: { label: 'Вес', color: '#3b82f6', unit: ' кг' },
  chest: { label: 'Грудь', color: '#8b5cf6', unit: ' см' },
  waist: { label: 'Талия', color: '#ec4899', unit: ' см' },
  hips: { label: 'Бедра', color: '#f59e0b', unit: ' см' },
  biceps: { label: 'Бицепс', color: '#10b981', unit: ' см' },
  thigh: { label: 'Бедро', color: '#ef4444', unit: ' см' },
}

export function WeightChart({ 
  data, 
  targetWeight,
  targetChest,
  targetWaist,
  targetHips,
  targetBiceps,
  targetThigh
}: WeightChartProps) {
  const [selectedMetrics, setSelectedMetrics] = useState<Set<MetricType>>(new Set<MetricType>(['weight']))

  const chartData = useMemo(() => {
    return [...data]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((metric) => ({
        date: format(new Date(metric.date), 'd MMM', { locale: ru }),
        weight: metric.weight,
        chest: metric.chest,
        waist: metric.waist,
        hips: metric.hips,
        biceps: metric.biceps,
        thigh: metric.thigh,
        fullDate: format(new Date(metric.date), 'd MMMM yyyy', { locale: ru }),
      }))
  }, [data])

  const toggleMetric = (metric: MetricType) => {
    setSelectedMetrics(prev => {
      const newSet = new Set(prev)
      if (newSet.has(metric)) {
        // Не позволяем убрать последнюю метрику
        if (newSet.size > 1) {
          newSet.delete(metric)
        }
      } else {
        newSet.add(metric)
      }
      return newSet
    })
  }

  // Проверяем наличие данных для выбранных метрик
  const hasData = useMemo(() => {
    if (chartData.length === 0) return false
    return Array.from(selectedMetrics).some(metric => 
      chartData.some(d => d[metric] != null)
    )
  }, [chartData, selectedMetrics])

  if (data.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>График метрик тела</CardTitle>
          <CardDescription>Нет данных для отображения</CardDescription>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center text-muted-foreground">
          Добавьте замеры в дневнике
        </CardContent>
      </Card>
    )
  }

  if (!hasData) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>График метрик тела</CardTitle>
          <CardDescription>Нет данных для выбранных метрик</CardDescription>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center text-muted-foreground">
          Выберите метрики для отображения
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Динамика метрик тела</CardTitle>
        <CardDescription>За последние 30 дней</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Фильтры метрик */}
        <div className="flex flex-wrap gap-2 mb-4">
          {(Object.keys(metricConfig) as MetricType[]).map((metric) => {
            const config = metricConfig[metric]
            const isSelected = selectedMetrics.has(metric)
            const hasDataForMetric = chartData.some(d => d[metric] != null)
            
            return (
              <button
                key={metric}
                type="button"
                onClick={() => toggleMetric(metric)}
                disabled={!hasDataForMetric}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                  "focus:outline-none disabled:opacity-30 disabled:cursor-not-allowed",
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
                style={isSelected ? { backgroundColor: config.color } : undefined}
              >
                {config.label}
              </button>
            )
          })}
        </div>

        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 40, right: 20, bottom: 50, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12 }} 
                tickMargin={10}
                style={{ fill: 'currentColor' }}
              />
              <YAxis 
                domain={['auto', 'auto']} 
                tick={{ fontSize: 12 }}
                style={{ fill: 'currentColor' }}
              />
              <Tooltip 
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                labelStyle={{ color: '#6b7280', marginBottom: '0.5rem' }}
                formatter={(value: number, name: string) => {
                  const metric = name as MetricType
                  const config = metricConfig[metric]
                  return [`${value}${config.unit}`, config.label]
                }}
              />
              <Legend 
                wrapperStyle={{ paddingTop: '10px' }}
                iconType="line"
                formatter={(value: string) => {
                  const metric = value as MetricType
                  return metricConfig[metric]?.label || value
                }}
              />
              {/* Целевые линии */}
              {targetWeight && selectedMetrics.has('weight') && (
                <ReferenceLine 
                  y={targetWeight} 
                  stroke="#10b981" 
                  strokeDasharray="3 3" 
                  label={{ value: 'Цель (вес)', position: 'right', fill: '#10b981', fontSize: 12 }} 
                />
              )}
              {targetChest && selectedMetrics.has('chest') && (
                <ReferenceLine 
                  y={targetChest} 
                  stroke="#10b981" 
                  strokeDasharray="3 3" 
                  label={{ value: 'Цель (грудь)', position: 'right', fill: '#10b981', fontSize: 12 }} 
                />
              )}
              {targetWaist && selectedMetrics.has('waist') && (
                <ReferenceLine 
                  y={targetWaist} 
                  stroke="#10b981" 
                  strokeDasharray="3 3" 
                  label={{ value: 'Цель (талия)', position: 'right', fill: '#10b981', fontSize: 12 }} 
                />
              )}
              {targetHips && selectedMetrics.has('hips') && (
                <ReferenceLine 
                  y={targetHips} 
                  stroke="#10b981" 
                  strokeDasharray="3 3" 
                  label={{ value: 'Цель (бедра)', position: 'right', fill: '#10b981', fontSize: 12 }} 
                />
              )}
              {targetBiceps && selectedMetrics.has('biceps') && (
                <ReferenceLine 
                  y={targetBiceps} 
                  stroke="#10b981" 
                  strokeDasharray="3 3" 
                  label={{ value: 'Цель (бицепс)', position: 'right', fill: '#10b981', fontSize: 12 }} 
                />
              )}
              {targetThigh && selectedMetrics.has('thigh') && (
                <ReferenceLine 
                  y={targetThigh} 
                  stroke="#10b981" 
                  strokeDasharray="3 3" 
                  label={{ value: 'Цель (бедро)', position: 'right', fill: '#10b981', fontSize: 12 }} 
                />
              )}
              
              {/* Линии данных */}
              {selectedMetrics.has('weight') && (
                <Line
                  type="monotone"
                  dataKey="weight"
                  stroke={metricConfig.weight.color}
                  strokeWidth={3}
                  dot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                  name="weight"
                />
              )}
              {selectedMetrics.has('chest') && (
                <Line
                  type="monotone"
                  dataKey="chest"
                  stroke={metricConfig.chest.color}
                  strokeWidth={3}
                  dot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                  name="chest"
                />
              )}
              {selectedMetrics.has('waist') && (
                <Line
                  type="monotone"
                  dataKey="waist"
                  stroke={metricConfig.waist.color}
                  strokeWidth={3}
                  dot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                  name="waist"
                />
              )}
              {selectedMetrics.has('hips') && (
                <Line
                  type="monotone"
                  dataKey="hips"
                  stroke={metricConfig.hips.color}
                  strokeWidth={3}
                  dot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                  name="hips"
                />
              )}
              {selectedMetrics.has('biceps') && (
                <Line
                  type="monotone"
                  dataKey="biceps"
                  stroke={metricConfig.biceps.color}
                  strokeWidth={3}
                  dot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                  name="biceps"
                />
              )}
              {selectedMetrics.has('thigh') && (
                <Line
                  type="monotone"
                  dataKey="thigh"
                  stroke={metricConfig.thigh.color}
                  strokeWidth={3}
                  dot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                  name="thigh"
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

