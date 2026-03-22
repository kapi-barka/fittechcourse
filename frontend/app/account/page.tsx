/**
 * Страница профиля пользователя
 */
'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { AuthGuard } from '@/components/AuthGuard'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { uploadAPI, usersAPI, UserProfile } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { User, Loader2, Camera, Save, ChevronDown } from 'lucide-react'
import { toast } from 'react-toastify'

export default function AccountPage() {
    const router = useRouter()
    const { user, refreshUser } = useAuthStore()

    const [fullName, setFullName] = useState('')
    const [height, setHeight] = useState<number | ''>('')
    const [birthDate, setBirthDate] = useState('')
    const [gender, setGender] = useState<string>('')
    const [activityLevel, setActivityLevel] = useState<string>('')
    const [fitnessGoal, setFitnessGoal] = useState<string>('')
    const [experienceLevel, setExperienceLevel] = useState<string>('')
    const [isLoading, setIsLoading] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
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
            if (height !== '' && height !== undefined) {
                updateData.height = typeof height === 'number' ? height : parseFloat(height as string)
            }
            if (birthDate) updateData.birth_date = birthDate
            if (gender) updateData.gender = gender as UserProfile['gender']
            if (activityLevel) updateData.activity_level = activityLevel as UserProfile['activity_level']
            if (fitnessGoal) updateData.fitness_goal = fitnessGoal as UserProfile['fitness_goal']
            if (experienceLevel) updateData.experience_level = experienceLevel as UserProfile['experience_level']
            
            await usersAPI.updateProfile(updateData)
            await refreshUser() // Обновляем данные пользователя в сторе
            router.refresh()
            toast.success('Профиль успешно обновлен')
        } catch (error) {
            console.error('Error updating profile:', error)
            toast.error('Ошибка при сохранении профиля')
        }
        setIsLoading(false)
    }

    const handleAvatarClick = () => {
        fileInputRef.current?.click()
    }

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setIsUploading(true)
        try {
            // 1. Загружаем файл
            const uploadRes = await uploadAPI.uploadFile(file, 'avatars')

            // 2. Обновляем профиль
            await usersAPI.updateProfile({ avatar_url: uploadRes.data.url })

            // 3. Обновляем состояние
            await refreshUser()
            toast.success('Аватар успешно обновлен')
        } catch (error) {
            console.error('Error uploading avatar:', error)
            toast.error('Ошибка при загрузке аватара')
        }
        setIsUploading(false)
    }

    return (
        <AuthGuard>
            <div className="min-h-screen">
                <main className="container mx-auto px-4 py-4 sm:py-8 max-w-2xl">
                    <Card>
                        <CardHeader>
                            <CardTitle>Личные данные</CardTitle>
                            <CardDescription>
                                Измените свое имя, фотографию профиля, рост и дату рождения
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Аватар */}
                            <div className="flex flex-col items-center justify-center space-y-4">
                                <div
                                    className="relative h-32 w-32 rounded-full overflow-hidden bg-secondary cursor-pointer group hover:opacity-90 transition-opacity"
                                    onClick={handleAvatarClick}
                                >
                                    {user?.profile?.avatar_url ? (
                                        <Image
                                            src={user.profile.avatar_url}
                                            alt="Avatar"
                                            width={128}
                                            height={128}
                                            className="h-full w-full object-cover"
                                            unoptimized
                                        />
                                    ) : (
                                        <div className="h-full w-full flex items-center justify-center bg-muted text-muted-foreground">
                                            <User className="h-12 w-12" />
                                        </div>
                                    )}

                                    {/* Overlay on hover */}
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Camera className="h-8 w-8 text-white" />
                                    </div>

                                    {/* Loading spinner */}
                                    {isUploading && (
                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                            <Loader2 className="h-8 w-8 text-white animate-spin" />
                                        </div>
                                    )}
                                </div>

                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    className="hidden"
                                    accept="image/*"
                                />

                                <Button variant="ghost" size="sm" onClick={handleAvatarClick} disabled={isUploading}>
                                    Изменить фото
                                </Button>
                            </div>

                            {/* Поля формы */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                    Полное имя
                                </label>
                                <Input
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    placeholder="Введите ваше имя"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                        Рост (см)
                                    </label>
                                    <Input
                                        type="number"
                                        value={height}
                                        onChange={(e) => setHeight(e.target.value === '' ? '' : parseFloat(e.target.value) || '')}
                                        placeholder="175"
                                        min="50"
                                        max="250"
                                        step="0.1"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                        Дата рождения
                                    </label>
                                    <Input
                                        type="date"
                                        value={birthDate}
                                        onChange={(e) => setBirthDate(e.target.value)}
                                        max={new Date().toISOString().split('T')[0]}
                                    />
                                </div>
                            </div>

                            {/* Пол + Активность */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium leading-none">Пол</label>
                                    <div className="relative">
                                        <select
                                            value={gender}
                                            onChange={e => setGender(e.target.value)}
                                            className="w-full appearance-none rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-ring pr-8"
                                        >
                                            <option value="">Не указан</option>
                                            <option value="male">Мужской</option>
                                            <option value="female">Женский</option>
                                            <option value="other">Другой</option>
                                        </select>
                                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium leading-none">Уровень активности</label>
                                    <div className="relative">
                                        <select
                                            value={activityLevel}
                                            onChange={e => setActivityLevel(e.target.value)}
                                            className="w-full appearance-none rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-ring pr-8"
                                        >
                                            <option value="">Не указан</option>
                                            <option value="sedentary">Сидячий образ жизни</option>
                                            <option value="lightly_active">Лёгкая активность (1–2 раза/нед)</option>
                                            <option value="moderately_active">Умеренная (3–5 раз/нед)</option>
                                            <option value="very_active">Высокая (6–7 раз/нед)</option>
                                            <option value="extremely_active">Очень высокая (2 раза в день)</option>
                                        </select>
                                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                                    </div>
                                </div>
                            </div>

                            {/* Цель + Опыт */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium leading-none">Цель тренировок</label>
                                    <div className="relative">
                                        <select
                                            value={fitnessGoal}
                                            onChange={e => setFitnessGoal(e.target.value)}
                                            className="w-full appearance-none rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-ring pr-8"
                                        >
                                            <option value="">Не указана</option>
                                            <option value="lose_fat">Похудение / сжигание жира</option>
                                            <option value="gain_muscle">Набор мышечной массы</option>
                                            <option value="recomposition">Рекомпозиция тела</option>
                                            <option value="maintain">Поддержание формы</option>
                                        </select>
                                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium leading-none">Уровень подготовки</label>
                                    <div className="relative">
                                        <select
                                            value={experienceLevel}
                                            onChange={e => setExperienceLevel(e.target.value)}
                                            className="w-full appearance-none rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-ring pr-8"
                                        >
                                            <option value="">Не указан</option>
                                            <option value="beginner">Новичок (менее 1 года)</option>
                                            <option value="intermediate">Средний (1–3 года)</option>
                                            <option value="advanced">Продвинутый (3+ лет)</option>
                                        </select>
                                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                    Email
                                </label>
                                <Input
                                    value={user?.email || ''}
                                    disabled
                                    className="bg-muted text-muted-foreground"
                                />
                                <p className="text-xs text-muted-foreground">Email нельзя изменить</p>
                            </div>
                        </CardContent>
                        <CardFooter className="flex justify-end">
                            <Button onClick={handleSaveProfile} disabled={isLoading || isUploading}>
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {!isLoading && <Save className="mr-2 h-4 w-4" />}
                                Сохранить изменения
                            </Button>
                        </CardFooter>
                    </Card>
                </main>
            </div>
        </AuthGuard>
    )
}
