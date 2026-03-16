/**
 * Страница входа в систему
 */
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Mail, Lock } from 'lucide-react'
import { toast } from 'react-toastify'
import { GoogleLogin } from '@react-oauth/google'

export default function LoginPage() {
  const router = useRouter()
  const { login, googleLogin } = useAuthStore()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      await login(email, password)
      toast.success('Добро пожаловать!')
      router.replace('/dashboard')
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      const errorMsg = error.response?.data?.detail || 'Ошибка входа. Проверьте email и пароль.'
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
            <div className="relative h-16 w-16 overflow-hidden rounded-2xl shadow-lg">
              <Image
                src="/logo.png"
                alt="Logo"
                width={64}
                height={64}
                className="h-full w-full object-cover"
                unoptimized
              />
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
              Вход
            </CardTitle>
            <CardDescription className="text-center font-medium">
              Введите свои учетные данные
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
                    placeholder="Пароль"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
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
                Войти
              </Button>
            </form>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-muted" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">или</span>
              </div>
            </div>

            <div className="flex justify-center">
              <GoogleLogin
                onSuccess={async (response) => {
                  if (!response.credential) return
                  try {
                    await googleLogin(response.credential)
                    toast.success('Добро пожаловать!')
                    router.replace('/dashboard')
                  } catch {
                    toast.error('Ошибка входа через Google')
                  }
                }}
                onError={() => toast.error('Ошибка входа через Google')}
                shape="rectangular"
                size="large"
                width="100%"
              />
            </div>

            <div className="mt-6 text-center text-sm">
              <span className="text-muted-foreground">Нет аккаунта? </span>
              <Link href="/register" className="text-primary font-medium hover:underline">
                Зарегистрироваться
              </Link>
            </div>
          </CardContent>
        </Card>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          © 2025 FitTech. Все права защищены.
        </p>
      </div>
    </div>
  )
}

