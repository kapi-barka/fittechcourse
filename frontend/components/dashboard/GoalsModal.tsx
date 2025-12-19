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
  })

  useEffect(() => {
    if (user?.profile && isOpen) {
      setFormData({
        target_weight: user.profile.target_weight?.toString() || '',
        target_calories: user.profile.target_calories?.toString() || '',
        target_proteins: user.profile.target_proteins?.toString() || '',
        target_fats: user.profile.target_fats?.toString() || '',
        target_carbs: user.profile.target_carbs?.toString() || '',
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
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
              min="0"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Калории в день (ккал)</label>
            <Input
              type="number"
              name="target_calories"
              value={formData.target_calories}
              onChange={handleChange}
              placeholder="2000"
              min="0"
            />
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
            />
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
            />
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
            />
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

