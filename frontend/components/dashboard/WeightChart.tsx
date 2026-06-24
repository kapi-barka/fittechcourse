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
import { BodyMetric, WeightPrediction } from '@/lib/api'
import { cn } from '@/lib/utils'

interface WeightChartProps {
  data: BodyMetric[]
  targetWeight?: number | null
  targetChest?: number | null
  targetWaist?: number | null
  targetHips?: number | null
  targetBiceps?: number | null
  targetThigh?: number | null
  prediction?: WeightPrediction | null
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
  targetThigh,
  prediction,
}: WeightChartProps) {
  const [selectedMetrics, setSelectedMetrics] = useState<Set<MetricType>>(new Set<MetricType>(['weight']))
  const [showProjection, setShowProjection] = useState(true)

  const hasValidPrediction = !!(
    prediction?.has_enough_data &&
    !prediction.goal_reached &&
    !prediction.wrong_direction &&
    prediction.projection &&
    prediction.projection.length > 0
  )

  const chartData = useMemo(() => {
    const sorted = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    const realPoints = sorted.map((metric) => ({
      dateRaw: metric.date,
      date: format(new Date(metric.date), 'd MMM', { locale: ru }),
      fullDate: format(new Date(metric.date), 'd MMMM yyyy', { locale: ru }),
      weight: metric.weight ?? null,
      chest: metric.chest ?? null,
      waist: metric.waist ?? null,
      hips: metric.hips ?? null,
      biceps: metric.biceps ?? null,
      thigh: metric.thigh ?? null,
      projWeight: null as number | null,
      isProjection: false,
    }))

    if (!showProjection || !hasValidPrediction) return realPoints

    const lastIdx = realPoints.length - 1
    if (lastIdx >= 0 && realPoints[lastIdx].weight !== null) {
      realPoints[lastIdx] = { ...realPoints[lastIdx], projWeight: realPoints[lastIdx].weight }
    }

    const lastRealDate = lastIdx >= 0 ? realPoints[lastIdx].dateRaw : ''

    for (const p of prediction!.projection!) {
      if (p.date <= lastRealDate) continue
      realPoints.push({
        dateRaw: p.date,
        date: format(new Date(p.date), 'd MMM', { locale: ru }),
        fullDate: format(new Date(p.date), 'd MMMM yyyy', { locale: ru }),
        weight: null,
        chest: null,
        waist: null,
        hips: null,
        biceps: null,
        thigh: null,
        projWeight: p.weight,
        isProjection: true,
      })
    }

    return realPoints
  }, [data, prediction, showProjection, hasValidPrediction])

  const toggleMetric = (metric: MetricType) => {
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
      chartData.some(d => (d as Record<string, unknown>)[metric] != null)
    )
  }, [chartData, selectedMetrics])

  const predictionLabel = useMemo(() => {
    if (!prediction?.has_enough_data) return null
    if (prediction.goal_reached) return `Цель достигнута — ${prediction.current_weight} кг`
    if (prediction.wrong_direction) {
      const direction = prediction.weekly_rate && prediction.weekly_rate > 0 ? 'растёт' : 'падает'
      return `Вес ${direction}, цель не достигается`
    }
    if (!hasValidPrediction) return null
    const dateStr = format(new Date(prediction.predicted_date!), 'd MMMM yyyy', { locale: ru })
    const rateSign = prediction.weekly_rate! > 0 ? '+' : ''
    return `${rateSign}${prediction.weekly_rate} кг/нед — ${prediction.target_weight} кг к ${dateStr}`
  }, [prediction, hasValidPrediction])

  if (data.length === 0) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader>
          <CardTitle>График метрик тела</CardTitle>
          <CardDescription>Нет данных для отображения</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center text-muted-foreground">
          Добавьте замеры в дневнике
        </CardContent>
      </Card>
    )
  }

  if (!hasData) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader>
          <CardTitle>График метрик тела</CardTitle>
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
        <CardTitle>Динамика метрик тела</CardTitle>
        {predictionLabel ? (
          <CardDescription className={cn(
            "text-xs",
            prediction?.goal_reached ? "text-emerald-500" :
            prediction?.wrong_direction ? "text-amber-500" :
            "text-muted-foreground"
          )}>
            {predictionLabel}
          </CardDescription>
        ) : (
          <CardDescription>За последние 30 дней</CardDescription>
        )}
      </CardHeader>
      <CardContent className="flex-1 flex flex-col overflow-hidden pt-0">

        <div className="flex flex-wrap gap-1.5 mb-2 shrink-0">
          {(Object.keys(metricConfig) as MetricType[]).map((metric) => {
            const config = metricConfig[metric]
            const isSelected = selectedMetrics.has(metric)
            const hasDataForMetric = chartData.some(d => (d as Record<string, unknown>)[metric] != null)

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
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
                style={isSelected ? { backgroundColor: config.color } : undefined}
              >
                {config.label}
              </button>
            )
          })}

          {selectedMetrics.has('weight') && hasValidPrediction && (
            <button
              type="button"
              onClick={() => setShowProjection(p => !p)}
              className={cn(
                "px-2 py-1 rounded-md text-xs font-medium transition-all focus:outline-none",
                showProjection
                  ? "text-white"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
              style={showProjection ? { backgroundColor: '#6366f1' } : undefined}
            >
              Прогноз
            </button>
          )}
        </div>

        <div className="flex-1 min-h-0 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 20, left: 5 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10 }}
                tickMargin={6}
                style={{ fill: 'currentColor' }}
              />
              <YAxis
                domain={['auto', 'auto']}
                tick={{ fontSize: 10 }}
                width={45}
                style={{ fill: 'currentColor' }}
              />
              <Tooltip
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                labelStyle={{ color: '#6b7280', marginBottom: '0.25rem' }}
                formatter={(value: number, name: string) => {
                  if (name === 'projWeight') return [`${value} кг`, 'Прогноз']
                  const metric = name as MetricType
                  const config = metricConfig[metric]
                  return [`${value}${config.unit}`, config.label]
                }}
              />
              <Legend
                wrapperStyle={{ paddingTop: '4px', fontSize: '11px' }}
                iconType="line"
                formatter={(value: string) => {
                  const metric = value as MetricType
                  return metricConfig[metric]?.label || value
                }}
              />

              {targetWeight && selectedMetrics.has('weight') && (
                <ReferenceLine
                  y={targetWeight}
                  stroke="#10b981"
                  strokeDasharray="3 3"
                  label={{ value: 'Цель', position: 'insideTopLeft', fill: '#10b981', fontSize: 10 }}
                />
              )}
              {targetChest && selectedMetrics.has('chest') && (
                <ReferenceLine
                  y={targetChest}
                  stroke="#10b981"
                  strokeDasharray="3 3"
                  label={{ value: 'Цель', position: 'insideTopLeft', fill: '#10b981', fontSize: 10 }}
                />
              )}
              {targetWaist && selectedMetrics.has('waist') && (
                <ReferenceLine
                  y={targetWaist}
                  stroke="#10b981"
                  strokeDasharray="3 3"
                  label={{ value: 'Цель', position: 'insideTopLeft', fill: '#10b981', fontSize: 10 }}
                />
              )}
              {targetHips && selectedMetrics.has('hips') && (
                <ReferenceLine
                  y={targetHips}
                  stroke="#10b981"
                  strokeDasharray="3 3"
                  label={{ value: 'Цель', position: 'insideTopLeft', fill: '#10b981', fontSize: 10 }}
                />
              )}
              {targetBiceps && selectedMetrics.has('biceps') && (
                <ReferenceLine
                  y={targetBiceps}
                  stroke="#10b981"
                  strokeDasharray="3 3"
                  label={{ value: 'Цель', position: 'insideTopLeft', fill: '#10b981', fontSize: 10 }}
                />
              )}
              {targetThigh && selectedMetrics.has('thigh') && (
                <ReferenceLine
                  y={targetThigh}
                  stroke="#10b981"
                  strokeDasharray="3 3"
                  label={{ value: 'Цель', position: 'insideTopLeft', fill: '#10b981', fontSize: 10 }}
                />
              )}

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

              {selectedMetrics.has('weight') && showProjection && hasValidPrediction && (
                <Line
                  type="monotone"
                  dataKey="projWeight"
                  stroke="#6366f1"
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                  name="projWeight"
                  legendType="none"
                  connectNulls={false}
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
