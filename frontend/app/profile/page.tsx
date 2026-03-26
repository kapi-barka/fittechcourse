'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AuthGuard } from '@/components/AuthGuard'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuthStore } from '@/store/authStore'
import { usersAPI, UserProfile } from '@/lib/api'
import { Loader2, Target, Scale, Flame, Beef, Droplets, Save } from 'lucide-react'
import { toast } from 'react-toastify'

// ── Section header ───────────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
    </div>
  )
}

// ── Hint text ────────────────────────────────────────────────────────────────
function Hint({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground mt-1">{children}</p>
}

export default function ProfilePage() {
  const router = useRouter()
  const { user, fetchUser } = useAuthStore()
  const [isSaving, setIsSaving] = useState(false)

  const [formData, setFormData] = useState<Partial<UserProfile>>({
    full_name: '',
    height: undefined,
    target_weight: undefined,
    target_calories: undefined,
    target_proteins: undefined,
    target_fats: undefined,
    target_carbs: undefined,
  })

  useEffect(() => {
    if (user?.profile) {
      setFormData({
        full_name:        user.profile.full_name        || '',
        height:           user.profile.height,
        target_weight:    user.profile.target_weight,
        target_calories:  user.profile.target_calories,
        target_proteins:  user.profile.target_proteins,
        target_fats:      user.profile.target_fats,
        target_carbs:     user.profile.target_carbs,
      })
    }
  }, [user])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target
    const parsed = type === 'number' ? (value === '' ? undefined : parseFloat(value)) : value
    setFormData(prev => ({ ...prev, [name]: parsed }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (formData.target_weight !== undefined) {
      const w = Number(formData.target_weight)
      if (isNaN(w) || w < 20 || w > 300) {
        toast.error('Целевой вес: от 20 до 300 кг')
        return
      }
    }
    if (formData.target_calories !== undefined) {
      const c = Number(formData.target_calories)
      if (isNaN(c) || c < 800 || c > 8000) {
        toast.error('Калории: от 800 до 8000 ккал/день')
        return
      }
    }

    setIsSaving(true)
    try {
      await usersAPI.updateProfile(formData)
      await fetchUser()
      toast.success('Профиль успешно обновлён!')
    } catch {
      toast.error('Не удалось обновить профиль')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <AuthGuard>
      <div className="min-h-screen">
        <main className="container mx-auto px-4 py-4 sm:py-8 max-w-2xl">

          {/* Header */}
          <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <Target className="h-7 w-7 text-primary" />
              Мои цели
            </h1>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => router.back()}>
                Отмена
              </Button>
              <Button size="sm" onClick={handleSubmit} disabled={isSaving}>
                {isSaving
                  ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  : <Save className="mr-2 h-4 w-4" />
                }
                Сохранить
              </Button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Personal */}
            <div className="rounded-2xl border border-white/8 bg-card/60 p-5 space-y-4">
              <SectionHeader icon={Target} label="Личные данные" />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground/80">Имя</label>
                  <Input
                    name="full_name"
                    value={formData.full_name}
                    onChange={handleChange}
                    placeholder="Иван Иванов"
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground/80">Рост (см)</label>
                  <Input
                    name="height"
                    type="number"
                    value={formData.height || ''}
                    onChange={handleChange}
                    placeholder="175"
                    className="rounded-xl"
                  />
                </div>
              </div>
            </div>

            {/* Weight & calories */}
            <div className="rounded-2xl border border-white/8 bg-card/60 p-5 space-y-4">
              <SectionHeader icon={Scale} label="Вес и калории" />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground/80 flex items-center gap-1.5">
                    <Scale className="h-3.5 w-3.5 text-violet-400" />
                    Целевой вес (кг)
                  </label>
                  <Input
                    name="target_weight"
                    type="number"
                    step="0.1"
                    min="20" max="300"
                    value={formData.target_weight || ''}
                    onChange={handleChange}
                    placeholder="70.5"
                    className="rounded-xl"
                  />
                  <Hint>От 20 до 300 кг</Hint>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground/80 flex items-center gap-1.5">
                    <Flame className="h-3.5 w-3.5 text-orange-400" />
                    Калории (ккал/день)
                  </label>
                  <Input
                    name="target_calories"
                    type="number"
                    min="800" max="8000"
                    value={formData.target_calories || ''}
                    onChange={handleChange}
                    placeholder="2000"
                    className="rounded-xl"
                  />
                  <Hint>От 800 до 8000 ккал/день</Hint>
                </div>
              </div>
            </div>

            {/* Macros */}
            <div className="rounded-2xl border border-white/8 bg-card/60 p-5 space-y-4">
              <SectionHeader icon={Beef} label="Макронутриенты (г/день)" />

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground/80 flex items-center gap-1.5">
                    <Beef className="h-3.5 w-3.5 text-blue-400" />Белки
                  </label>
                  <Input
                    name="target_proteins"
                    type="number"
                    min="0"
                    value={formData.target_proteins || ''}
                    onChange={handleChange}
                    placeholder="150"
                    className="rounded-xl"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground/80 flex items-center gap-1.5">
                    <Droplets className="h-3.5 w-3.5 text-yellow-400" />Жиры
                  </label>
                  <Input
                    name="target_fats"
                    type="number"
                    min="0"
                    value={formData.target_fats || ''}
                    onChange={handleChange}
                    placeholder="65"
                    className="rounded-xl"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground/80 flex items-center gap-1.5">
                    <Flame className="h-3.5 w-3.5 text-emerald-400" />Углеводы
                  </label>
                  <Input
                    name="target_carbs"
                    type="number"
                    min="0"
                    value={formData.target_carbs || ''}
                    onChange={handleChange}
                    placeholder="250"
                    className="rounded-xl"
                  />
                </div>
              </div>
            </div>

          </form>
        </main>
      </div>
    </AuthGuard>
  )
}
