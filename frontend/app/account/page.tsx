/**
 * Страница профиля пользователя
 */
'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { AuthGuard } from '@/components/AuthGuard'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { uploadAPI, usersAPI } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { User, Loader2, Camera, Save } from 'lucide-react'
import { toast } from 'react-toastify'

export default function AccountPage() {
    const router = useRouter()
    const { user, refreshUser } = useAuthStore()

    const [fullName, setFullName] = useState('')
    const [height, setHeight] = useState<number | ''>('')
    const [birthDate, setBirthDate] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (user?.profile) {
            setFullName(user.profile.full_name || '')
            setHeight(user.profile.height || '')
            // Форматируем дату для input type="date" (YYYY-MM-DD)
            if (user.profile.birth_date) {
                setBirthDate(user.profile.birth_date)
            } else {
                setBirthDate('')
            }
        }
    }, [user])

    const handleSaveProfile = async () => {
        setIsLoading(true)
        try {
            const updateData: any = { full_name: fullName }
            
            // Добавляем рост, если указан
            if (height !== '' && height !== undefined) {
                updateData.height = typeof height === 'number' ? height : parseFloat(height as string)
            }
            
            // Добавляем дату рождения, если указана
            if (birthDate) {
                updateData.birth_date = birthDate
            }
            
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
                <main className="container mx-auto px-4 py-8 max-w-2xl">
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
                                        <img
                                            src={user.profile.avatar_url}
                                            alt="Avatar"
                                            className="h-full w-full object-cover"
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
