
'use client'

import { useEffect, useState, useRef } from 'react'
import Image from 'next/image'
import { AuthGuard } from '@/components/AuthGuard'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { uploadAPI, usersAPI, UserProfile } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import {
  User,
  Loader2,
  Camera,
  Save,
  ChevronDown,
  Ruler,
  Calendar,
  Activity,
  Mail,
} from 'lucide-react'
import { toast } from 'react-toastify'

function SelectField({
  label,
  value,
  onChange,
  children,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground/80">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full appearance-none rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-ring pr-8 h-9"
        >
          {children}
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      </div>
    </div>
  )
}

function SectionHeader({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2 pt-2">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
    </div>
  )
}

export default function AccountPage() {
  const { user, refreshUser } = useAuthStore()

  const [fullName, setFullName]           = useState('')
  const [height, setHeight]               = useState<number | ''>('')
  const [birthDate, setBirthDate]         = useState('')
  const [gender, setGender]               = useState('')
  const [activityLevel, setActivityLevel] = useState('')
  const [fitnessGoal, setFitnessGoal]     = useState('')
  const [experienceLevel, setExperienceLevel] = useState('')
  const [isLoading, setIsLoading]         = useState(false)
  const [isUploading, setIsUploading]     = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (user?.profile) {
      setFullName(user.profile.full_name || '')
      setHeight(user.profile.height || '')
      setBirthDate(user.profile.birth_date || '')
      setGender(user.profile.gender || '')
      setActivityLevel(user.profile.activity_level || '')
      setFitnessGoal(user.profile.fitness_goal || '')
      setExperienceLevel(user.profile.experience_level || '')
    }
  }, [user])

  const handleSaveProfile = async () => {
    setIsLoading(true)
    try {
      const updateData: Partial<UserProfile> = { full_name: fullName }
      if (height !== '') updateData.height = typeof height === 'number' ? height : parseFloat(height as string)
      if (birthDate)       updateData.birth_date      = birthDate
      if (gender)          updateData.gender           = gender as UserProfile['gender']
      if (activityLevel)   updateData.activity_level  = activityLevel as UserProfile['activity_level']
      if (fitnessGoal)     updateData.fitness_goal     = fitnessGoal as UserProfile['fitness_goal']
      if (experienceLevel) updateData.experience_level = experienceLevel as UserProfile['experience_level']

      await usersAPI.updateProfile(updateData)
      await refreshUser()
      toast.success('Профиль успешно обновлён')
    } catch {
      toast.error('Ошибка при сохранении профиля')
    }
    setIsLoading(false)
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsUploading(true)
    try {
      const uploadRes = await uploadAPI.uploadFile(file, 'avatars')
      await usersAPI.updateProfile({ avatar_url: uploadRes.data.url })
      await refreshUser()
      toast.success('Аватар успешно обновлён')
    } catch {
      toast.error('Ошибка при загрузке аватара')
    }
    setIsUploading(false)
  }

  const initials = user?.profile?.full_name
    ? user.profile.full_name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? '?'

  return (
    <AuthGuard>
      <div className="min-h-screen">
        <main className="container mx-auto px-4 py-4 sm:py-8 max-w-2xl">

          <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <User className="h-7 w-7 text-primary" />
              Профиль
            </h1>
            <Button onClick={handleSaveProfile} disabled={isLoading || isUploading} size="sm">
              {isLoading
                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                : <Save className="mr-2 h-4 w-4" />
              }
              Сохранить
            </Button>
          </div>

          <div className="rounded-2xl border border-white/8 bg-card/60 p-6 mb-4 flex items-center gap-5">
            <div
              className="relative h-20 w-20 rounded-full overflow-hidden cursor-pointer group shrink-0"
              onClick={() => fileInputRef.current?.click()}
            >
              {user?.profile?.avatar_url ? (
                <Image
                  src={user.profile.avatar_url}
                  alt="Avatar"
                  width={80}
                  height={80}
                  className="h-full w-full object-cover"
                  unoptimized
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center bg-primary/20 text-primary text-2xl font-bold">
                  {initials}
                </div>
              )}
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                <Camera className="h-6 w-6 text-white" />
              </div>
              {isUploading && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-full">
                  <Loader2 className="h-6 w-6 text-white animate-spin" />
                </div>
              )}
            </div>

            <div className="min-w-0">
              <p className="font-semibold text-base truncate">{user?.profile?.full_name || 'Без имени'}</p>
              <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="mt-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
              >
                Изменить фото
              </button>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              accept="image/*"
            />
          </div>

          <div className="rounded-2xl border border-white/8 bg-card/60 p-6 space-y-5">

            <SectionHeader icon={User} label="Личные данные" />
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground/80">Полное имя</label>
              <Input
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Иван Иванов"
                className="rounded-xl"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground/80 flex items-center gap-1.5">
                  <Ruler className="h-3.5 w-3.5 text-muted-foreground" />Рост (см)
                </label>
                <Input
                  type="number"
                  value={height}
                  onChange={e => setHeight(e.target.value === '' ? '' : parseFloat(e.target.value) || '')}
                  placeholder="175"
                  min="50" max="250" step="0.1"
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground/80 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />Дата рождения
                </label>
                <Input
                  type="date"
                  value={birthDate}
                  onChange={e => setBirthDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="rounded-xl"
                />
              </div>
            </div>

            <SelectField label="Пол" value={gender} onChange={setGender}>
              <option value="">Не указан</option>
              <option value="male">Мужской</option>
              <option value="female">Женский</option>
              <option value="other">Другой</option>
            </SelectField>

            <SectionHeader icon={Activity} label="Активность и цели" />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SelectField label="Уровень активности" value={activityLevel} onChange={setActivityLevel}>
                <option value="">Не указан</option>
                <option value="sedentary">Сидячий образ жизни</option>
                <option value="lightly_active">Лёгкая (1–2 раза/нед)</option>
                <option value="moderately_active">Умеренная (3–5 раз/нед)</option>
                <option value="very_active">Высокая (6–7 раз/нед)</option>
                <option value="extremely_active">Очень высокая (2 раза/день)</option>
              </SelectField>

              <SelectField label="Цель тренировок" value={fitnessGoal} onChange={setFitnessGoal}>
                <option value="">Не указана</option>
                <option value="lose_fat">Похудение / сжигание жира</option>
                <option value="gain_muscle">Набор мышечной массы</option>
                <option value="recomposition">Рекомпозиция тела</option>
                <option value="maintain">Поддержание формы</option>
              </SelectField>
            </div>

            <SelectField label="Уровень подготовки" value={experienceLevel} onChange={setExperienceLevel}>
              <option value="">Не указан</option>
              <option value="beginner">Новичок (менее 1 года)</option>
              <option value="intermediate">Средний (1–3 года)</option>
              <option value="advanced">Продвинутый (3+ лет)</option>
            </SelectField>

            <div className="pt-1 border-t border-white/8 space-y-1.5">
              <label className="text-sm font-medium text-foreground/80 flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />Email
              </label>
              <Input
                value={user?.email || ''}
                disabled
                className="rounded-xl bg-white/4 text-muted-foreground cursor-not-allowed"
              />
              <p className="text-xs text-muted-foreground">Email нельзя изменить</p>
            </div>

          </div>

        </main>
      </div>
    </AuthGuard>
  )
}
