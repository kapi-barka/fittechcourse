/**
 * Главная страница - редирект на dashboard
 */
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import { Loader2 } from 'lucide-react'

export default function HomePage() {
  const router = useRouter()
  const { isAuthenticated, isLoading, fetchUser } = useAuthStore()
  
  // Загружаем пользователя только один раз при монтировании
  useEffect(() => {
    fetchUser()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  
  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        router.push('/dashboard')
      } else {
        router.push('/login')
      }
    }
  }, [isAuthenticated, isLoading, router])
  
  return (
    <div className="flex h-screen items-center justify-center">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
    </div>
  )
}

