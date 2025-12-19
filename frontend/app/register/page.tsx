/**
 * Страница регистрации
 */
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Dumbbell, Mail, Lock, User } from 'lucide-react'
import { toast } from 'react-toastify'

export default function RegisterPage() {
  const router = useRouter()
  const { register } = useAuthStore()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Пароли не совпадают')
      return
    }

    if (password.length < 6) {
      setError('Пароль должен содержать минимум 6 символов')
      return
    }

    setIsLoading(true)

    try {
      await register(email, password, fullName)
      toast.success('Регистрация успешна! Добро пожаловать!')
      router.push('/dashboard')
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      const errorMsg = error.response?.data?.detail || 'Ошибка регистрации. Возможно, email уже используется.'
      setError(errorMsg)
      toast.error(errorMsg)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 bg-cover bg-center bg-no-repeat relative"
      style={{ backgroundImage: "url('/login-bg.jpg')" }}
    >
      {/* Overlay for better readability */}
      <div className="absolute inset-0 bg-black/50 z-0" />

      <div className="w-full max-w-md z-10 relative">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center space-x-2">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary shadow-lg">
              <Dumbbell className="h-10 w-10 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold text-primary">
                FitTech
              </h1>
            </div>
          </div>
        </div>

        <Card className="border-0 shadow-2xl">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-extrabold text-center">
              Регистрация
            </CardTitle>
            <CardDescription className="text-center font-medium">
              Создайте аккаунт для начала тренировок
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
                  <p className="text-sm text-destructive text-center">{error}</p>
                </div>
              )}

              <div className="space-y-2">
                <div className="relative">
                  <User className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Полное имя"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                  <Input
                    type="password"
                    placeholder="Пароль (минимум 6 символов)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                  <Input
                    type="password"
                    placeholder="Подтвердите пароль"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    className="pl-10"
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                isLoading={isLoading}
              >
                Создать аккаунт
              </Button>
            </form>

            <div className="mt-6 text-center text-sm">
              <span className="text-muted-foreground">Уже есть аккаунт? </span>
              <Link href="/login" className="text-primary font-medium hover:underline">
                Войти
              </Link>
            </div>
          </CardContent>
        </Card>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          © 2025 FitTech. Все права защищены.
        </p>
      </div>
    </div >
  )
}
