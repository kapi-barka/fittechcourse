'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { usersAPI, UserProfile } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { Loader2, Target } from 'lucide-react'
import { toast } from 'react-toastify'

interface GoalsModalProps {
  isOpen: boolean
  onClose: (open: boolean) => void
}

export function GoalsModal({ isOpen, onClose }: GoalsModalProps) {
  const { user, refreshUser } = useAuthStore()
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    target_weight: '',
    target_calories: '',
    target_proteins: '',
    target_fats: '',
    target_carbs: '',
    target_chest: '',
    target_waist: '',
    target_hips: '',
    target_biceps: '',
    target_thigh: '',
  })

  useEffect(() => {
    if (user?.profile && isOpen) {
      setFormData({
        target_weight: user.profile.target_weight?.toString() || '',
        target_calories: user.profile.target_calories?.toString() || '',
        target_proteins: user.profile.target_proteins?.toString() || '',
        target_fats: user.profile.target_fats?.toString() || '',
        target_carbs: user.profile.target_carbs?.toString() || '',
        target_chest: user.profile.target_chest?.toString() || '',
        target_waist: user.profile.target_waist?.toString() || '',
        target_hips: user.profile.target_hips?.toString() || '',
        target_biceps: user.profile.target_biceps?.toString() || '',
        target_thigh: user.profile.target_thigh?.toString() || '',
      })
    }
  }, [user, isOpen])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const validateForm = (): string | null => {
    if (formData.target_weight) {
      const weight = parseFloat(formData.target_weight)
      if (isNaN(weight) || weight < 20 || weight > 300) {
        return 'Целевой вес должен быть от 20 до 300 кг'
      }
    }
    if (formData.target_calories) {
      const calories = parseInt(formData.target_calories)
      if (isNaN(calories) || calories < 800 || calories > 8000) {
        return 'Цель по калориям должна быть от 800 до 8000 ккал/день'
      }
    }
    if (formData.target_proteins) {
      const proteins = parseFloat(formData.target_proteins)
      if (isNaN(proteins) || proteins < 0 || proteins > 500) {
        return 'Цель по белкам должна быть от 0 до 500 г/день'
      }
    }
    if (formData.target_fats) {
      const fats = parseFloat(formData.target_fats)
      if (isNaN(fats) || fats < 0 || fats > 500) {
        return 'Цель по жирам должна быть от 0 до 500 г/день'
      }
    }
    if (formData.target_carbs) {
      const carbs = parseFloat(formData.target_carbs)
      if (isNaN(carbs) || carbs < 0 || carbs > 1000) {
        return 'Цель по углеводам должна быть от 0 до 1000 г/день'
      }
    }
    if (formData.target_chest) {
      const chest = parseFloat(formData.target_chest)
      if (isNaN(chest) || chest < 50 || chest > 200) {
        return 'Целевой обхват груди должен быть от 50 до 200 см'
      }
    }
    if (formData.target_waist) {
      const waist = parseFloat(formData.target_waist)
      if (isNaN(waist) || waist < 40 || waist > 200) {
        return 'Целевой обхват талии должен быть от 40 до 200 см'
      }
    }
    if (formData.target_hips) {
      const hips = parseFloat(formData.target_hips)
      if (isNaN(hips) || hips < 50 || hips > 200) {
        return 'Целевой обхват бедер должен быть от 50 до 200 см'
      }
    }
    if (formData.target_biceps) {
      const biceps = parseFloat(formData.target_biceps)
      if (isNaN(biceps) || biceps < 15 || biceps > 80) {
        return 'Целевой обхват бицепса должен быть от 15 до 80 см'
      }
    }
    if (formData.target_thigh) {
      const thigh = parseFloat(formData.target_thigh)
      if (isNaN(thigh) || thigh < 30 || thigh > 150) {
        return 'Целевой обхват бедра должен быть от 30 до 150 см'
      }
    }
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const validationError = validateForm()
    if (validationError) {
      toast.error(validationError)
      return
    }
    
    setIsLoading(true)

    try {
      const updateData: Partial<UserProfile> = {}
      
      if (formData.target_weight) {
        updateData.target_weight = parseFloat(formData.target_weight)
      }
      if (formData.target_calories) {
        updateData.target_calories = parseInt(formData.target_calories)
      }
      if (formData.target_proteins) {
        updateData.target_proteins = parseFloat(formData.target_proteins)
      }
      if (formData.target_fats) {
        updateData.target_fats = parseFloat(formData.target_fats)
      }
      if (formData.target_carbs) {
        updateData.target_carbs = parseFloat(formData.target_carbs)
      }
      if (formData.target_chest) {
        updateData.target_chest = parseFloat(formData.target_chest)
      }
      if (formData.target_waist) {
        updateData.target_waist = parseFloat(formData.target_waist)
      }
      if (formData.target_hips) {
        updateData.target_hips = parseFloat(formData.target_hips)
      }
      if (formData.target_biceps) {
        updateData.target_biceps = parseFloat(formData.target_biceps)
      }
      if (formData.target_thigh) {
        updateData.target_thigh = parseFloat(formData.target_thigh)
      }

      await usersAPI.updateProfile(updateData)
      await refreshUser()
      toast.success('Цели успешно обновлены')
      onClose(false)
    } catch (error) {
      console.error('Error updating goals:', error)
      toast.error('Ошибка при сохранении целей')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Мои цели
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Целевой вес (кг)</label>
            <Input
              type="number"
              name="target_weight"
              value={formData.target_weight}
              onChange={handleChange}
              placeholder="70.5"
              step="0.1"
              min="20"
              max="300"
            />
            <p className="text-xs text-muted-foreground">От 20 до 300 кг</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Калории в день (ккал)</label>
            <Input
              type="number"
              name="target_calories"
              value={formData.target_calories}
              onChange={handleChange}
              placeholder="2000"
              min="800"
              max="8000"
            />
            <p className="text-xs text-muted-foreground">От 800 до 8000 ккал/день</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Белки в день (г)</label>
            <Input
              type="number"
              name="target_proteins"
              value={formData.target_proteins}
              onChange={handleChange}
              placeholder="150"
              step="0.1"
              min="0"
              max="500"
            />
            <p className="text-xs text-muted-foreground">От 0 до 500 г/день</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Жиры в день (г)</label>
            <Input
              type="number"
              name="target_fats"
              value={formData.target_fats}
              onChange={handleChange}
              placeholder="65"
              step="0.1"
              min="0"
              max="500"
            />
            <p className="text-xs text-muted-foreground">От 0 до 500 г/день</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Углеводы в день (г)</label>
            <Input
              type="number"
              name="target_carbs"
              value={formData.target_carbs}
              onChange={handleChange}
              placeholder="250"
              step="0.1"
              min="0"
              max="1000"
            />
            <p className="text-xs text-muted-foreground">От 0 до 1000 г/день</p>
          </div>

          <div className="border-t pt-4 mt-4">
            <h3 className="text-sm font-semibold mb-4">Целевые замеры тела</h3>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Обхват груди (см)</label>
                <Input
                  type="number"
                  name="target_chest"
                  value={formData.target_chest}
                  onChange={handleChange}
                  placeholder="100"
                  step="0.1"
                  min="50"
                  max="200"
                />
                <p className="text-xs text-muted-foreground">От 50 до 200 см</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Обхват талии (см)</label>
                <Input
                  type="number"
                  name="target_waist"
                  value={formData.target_waist}
                  onChange={handleChange}
                  placeholder="80"
                  step="0.1"
                  min="40"
                  max="200"
                />
                <p className="text-xs text-muted-foreground">От 40 до 200 см</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Обхват бедер (см)</label>
                <Input
                  type="number"
                  name="target_hips"
                  value={formData.target_hips}
                  onChange={handleChange}
                  placeholder="95"
                  step="0.1"
                  min="50"
                  max="200"
                />
                <p className="text-xs text-muted-foreground">От 50 до 200 см</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Обхват бицепса (см)</label>
                <Input
                  type="number"
                  name="target_biceps"
                  value={formData.target_biceps}
                  onChange={handleChange}
                  placeholder="35"
                  step="0.1"
                  min="15"
                  max="80"
                />
                <p className="text-xs text-muted-foreground">От 15 до 80 см</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Обхват бедра (см)</label>
                <Input
                  type="number"
                  name="target_thigh"
                  value={formData.target_thigh}
                  onChange={handleChange}
                  placeholder="60"
                  step="0.1"
                  min="30"
                  max="150"
                />
                <p className="text-xs text-muted-foreground">От 30 до 150 см</p>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onClose(false)} disabled={isLoading}>
              Отмена
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Сохранить
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

