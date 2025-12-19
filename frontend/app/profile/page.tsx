'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AuthGuard } from '@/components/AuthGuard'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuthStore } from '@/store/authStore'
import { usersAPI, UserProfile } from '@/lib/api'
import { Loader2, User as UserIcon, Target } from 'lucide-react'
import { toast } from 'react-toastify'

export default function ProfilePage() {
  const router = useRouter()
  const { user, fetchUser } = useAuthStore()
  // const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [formData, setFormData] = useState<Partial<UserProfile>>({
    full_name: '',
    height: undefined,
    target_weight: undefined,
    target_calories: undefined,
  })

  useEffect(() => {
    if (user?.profile) {
      setFormData({
        full_name: user.profile.full_name || '',
        height: user.profile.height,
        target_weight: user.profile.target_weight,
        target_calories: user.profile.target_calories,
      })
    }
  }, [user])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target
    let parsedValue: string | number | undefined = value

    if (type === 'number') {
      parsedValue = value === '' ? undefined : parseFloat(value)
    }

    setFormData((prev) => ({
      ...prev,
      [name]: parsedValue,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setIsSaving(true)

    try {
      await usersAPI.updateProfile(formData)
      await fetchUser() // Refresh user data in store
      toast.success('Профиль успешно обновлен!')
      setSuccess('')
      setError('')
    } catch (err) {
      console.error('Error updating profile:', err)
      const errorMsg = 'Не удалось обновить профиль. Попробуйте позже.'
      setError(errorMsg)
      toast.error(errorMsg)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">

        <main className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto">
            <h1 className="text-3xl font-bold mb-8 text-gray-900 dark:text-gray-100 flex items-center gap-3">
              <UserIcon className="h-8 w-8" />
              Мой Профиль
            </h1>

            <form onSubmit={handleSubmit}>
              <Card className="mb-8">
                <CardHeader>
                  <CardTitle>Личные данные</CardTitle>
                  <CardDescription>
                    Информация о вас для расчета показателей
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Input
                    label="Полное имя"
                    name="full_name"
                    value={formData.full_name}
                    onChange={handleChange}
                    placeholder="Иван Иванов"
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      label="Рост (см)"
                      name="height"
                      type="number"
                      value={formData.height || ''}
                      onChange={handleChange}
                      placeholder="175"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="mb-8">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Мои Цели
                  </CardTitle>
                  <CardDescription>
                    Установите цели, к которым вы стремитесь
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      label="Целевой вес (кг)"
                      name="target_weight"
                      type="number"
                      step="0.1"
                      value={formData.target_weight || ''}
                      onChange={handleChange}
                      placeholder="70.5"
                    />
                    <Input
                      label="Цель по калориям (ккал/день)"
                      name="target_calories"
                      type="number"
                      value={formData.target_calories || ''}
                      onChange={handleChange}
                      placeholder="2000"
                    />
                  </div>
                </CardContent>
              </Card>

              {error && (
                <div className="p-4 mb-4 text-sm text-red-800 rounded-lg bg-red-50 dark:bg-gray-800 dark:text-red-400" role="alert">
                  {error}
                </div>
              )}

              {success && (
                <div className="p-4 mb-4 text-sm text-green-800 rounded-lg bg-green-50 dark:bg-gray-800 dark:text-green-400" role="alert">
                  {success}
                </div>
              )}

              <div className="flex justify-end gap-4">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => router.back()}
                >
                  Отмена
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Сохранить изменения
                </Button>
              </div>
            </form>
          </div>
        </main>
      </div>
    </AuthGuard>
  )
}

