/**
 * Модальное окно для редактирования замера
 */
'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/Dialog'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { metricsAPI, BodyMetric } from '@/lib/api'
import { Loader2, Scale } from 'lucide-react'
import { toast } from 'react-toastify'

interface EditMetricModalProps {
  isOpen: boolean
  onClose: () => void
  metric: BodyMetric | null
  onSuccess: () => void
}

export function EditMetricModal({ isOpen, onClose, metric, onSuccess }: EditMetricModalProps) {
  const [formData, setFormData] = useState({
    weight: '',
    chest: '',
    waist: '',
    hips: '',
    biceps: '',
    thigh: '',
  })
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (metric) {
      setFormData({
        weight: metric.weight?.toString() || '',
        chest: metric.chest?.toString() || '',
        waist: metric.waist?.toString() || '',
        hips: metric.hips?.toString() || '',
        biceps: metric.biceps?.toString() || '',
        thigh: metric.thigh?.toString() || '',
      })
    }
  }, [metric])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!metric) return

    setIsLoading(true)
    try {
      const updateData: Partial<BodyMetric> = {}
      
      if (formData.weight) updateData.weight = parseFloat(formData.weight)
      if (formData.chest) updateData.chest = parseFloat(formData.chest)
      if (formData.waist) updateData.waist = parseFloat(formData.waist)
      if (formData.hips) updateData.hips = parseFloat(formData.hips)
      if (formData.biceps) updateData.biceps = parseFloat(formData.biceps)
      if (formData.thigh) updateData.thigh = parseFloat(formData.thigh)

      await metricsAPI.update(metric.id, updateData)
      onSuccess()
      onClose()
      toast.success('Замер обновлен')
    } catch (error) {
      console.error('Error updating metric:', error)
      toast.error('Ошибка при обновлении замера')
    } finally {
      setIsLoading(false)
    }
  }

  if (!metric) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5" />
            Редактировать замер от {new Date(metric.date).toLocaleDateString('ru-RU')}
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Дата замера не может быть изменена
          </p>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Вес (кг)</label>
            <Input
              type="number"
              name="weight"
              value={formData.weight}
              onChange={handleChange}
              placeholder="70.5"
              step="0.1"
              min="20"
              max="300"
            />
            <p className="text-xs text-muted-foreground">От 20 до 300 кг</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Грудь (см)</label>
              <Input
                type="number"
                name="chest"
                value={formData.chest}
                onChange={handleChange}
                placeholder="100"
                step="0.1"
                min="50"
                max="200"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Талия (см)</label>
              <Input
                type="number"
                name="waist"
                value={formData.waist}
                onChange={handleChange}
                placeholder="80"
                step="0.1"
                min="40"
                max="200"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Бедра (см)</label>
              <Input
                type="number"
                name="hips"
                value={formData.hips}
                onChange={handleChange}
                placeholder="95"
                step="0.1"
                min="50"
                max="200"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Бицепс (см)</label>
              <Input
                type="number"
                name="biceps"
                value={formData.biceps}
                onChange={handleChange}
                placeholder="35"
                step="0.1"
                min="15"
                max="80"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Бедро (см)</label>
            <Input
              type="number"
              name="thigh"
              value={formData.thigh}
              onChange={handleChange}
              placeholder="60"
              step="0.1"
              min="30"
              max="150"
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={isLoading}
            >
              Отмена
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Сохранение...
                </>
              ) : (
                'Сохранить'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

