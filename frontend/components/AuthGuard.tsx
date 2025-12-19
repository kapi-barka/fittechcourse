'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import { Loader2 } from 'lucide-react'

interface AuthGuardProps {
  children: React.ReactNode
  requireRole?: 'user' | 'admin'
}

export function AuthGuard({ children, requireRole }: AuthGuardProps) {
  const router = useRouter()
  // const pathname = usePathname()
  const { isAuthenticated, isLoading, user, fetchUser } = useAuthStore()
  
  useEffect(() => {
    fetchUser()
  }, [fetchUser])
  
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login')
    }
    
    if (!isLoading && isAuthenticated && requireRole) {
      const roleHierarchy = { guest: 0, user: 1, admin: 2 }
      const userLevel = roleHierarchy[user?.role || 'guest']
      const requiredLevel = roleHierarchy[requireRole]
      
      if (userLevel < requiredLevel) {
        router.push('/dashboard')
      }
    }
  }, [isLoading, isAuthenticated, user, requireRole, router])
  
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }
  
  if (!isAuthenticated) {
    return null
  }
  
  if (requireRole) {
    const roleHierarchy = { guest: 0, user: 1, admin: 2 }
    const userLevel = roleHierarchy[user?.role || 'guest']
    const requiredLevel = roleHierarchy[requireRole]
    
    if (userLevel < requiredLevel) {
      return null
    }
  }
  
  return <>{children}</>
}

export default AuthGuard
