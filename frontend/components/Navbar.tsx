/**
 * Навигационная панель с адаптивным дизайном
 */
'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import {
  Dumbbell,
  Home,
  BookOpen,
  Utensils,
  Activity,
  LogOut,
  Menu,
  X,
  Shield,
  Calendar
} from 'lucide-react'
import { Button } from './ui/Button'

export const Navbar = () => {
  const pathname = usePathname()
  const router = useRouter()
  const { user, isAuthenticated, logout } = useAuthStore()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  // Навигационные ссылки в зависимости от роли
  const getNavLinks = () => {
    if (!isAuthenticated) return []

    const links = [
      { href: '/dashboard', label: 'Главная', icon: Home },
      { href: '/schedule', label: 'Тренировка', icon: Calendar },
      { href: '/programs', label: 'Программы', icon: Dumbbell },
      { href: '/my-programs', label: 'Мои программы', icon: Activity },
      { href: '/diary', label: 'Дневник', icon: Utensils },
      { href: '/articles', label: 'Статьи', icon: BookOpen },
    ]

    if (user?.role === 'admin') {
      links.push({ href: '/admin', label: 'Админ', icon: Shield })
    }

    return links
  }

  const navLinks = getNavLinks()

  // Не показываем Navbar на страницах логина и регистрации
  const isAuthPage = pathname === '/login' || pathname === '/register'
  
  if (!isAuthenticated || isAuthPage) {
    return null
  }

  return (
    <nav className="sticky top-0 z-50 w-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center space-x-2">
            <div className="relative h-10 w-10 overflow-hidden rounded-lg">
              <Image
                src="/logo.png"
                alt="Logo"
                width={40}
                height={40}
                className="h-full w-full object-cover"
                unoptimized
              />
            </div>
            <span className="hidden font-extrabold text-xl sm:inline-block">
              FitTech
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex md:items-center md:space-x-1">
            {navLinks.map((link) => {
              const Icon = link.icon
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'flex items-center space-x-2 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
                    pathname === link.href && 'bg-accent text-accent-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{link.label}</span>
                </Link>
              )
            })}
          </div>

          {/* User Menu */}
          <div className="hidden md:flex md:items-center md:space-x-4">
            <Link href="/account" className="flex items-center space-x-3 hover:opacity-80 transition-opacity">
              <div className="text-right hidden lg:block">
                <p className="text-sm font-medium">{user?.profile?.full_name || user?.email}</p>
                <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
              </div>
              {user?.profile?.avatar_url ? (
                <Image src={user.profile.avatar_url} alt="Avatar" width={36} height={36} className="h-9 w-9 rounded-full object-cover border border-border" unoptimized />
              ) : (
                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center border border-border">
                  <span className="text-sm font-bold text-primary">
                    {(user?.profile?.full_name || user?.email || 'U').charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </Link>
            <Button variant="ghost" size="icon" onClick={handleLogout} title="Выйти">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t py-4 space-y-2">
            {navLinks.map((link) => {
              const Icon = link.icon
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    'flex items-center space-x-2 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent',
                    pathname === link.href && 'bg-accent'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{link.label}</span>
                </Link>
              )
            })}
            <div className="border-t pt-4 mt-4">
              <Link href="/account" className="block px-3 py-2 hover:bg-accent rounded-md transition-colors" onClick={() => setMobileMenuOpen(false)}>
                <div className="flex items-center space-x-3">
                  {user?.profile?.avatar_url ? (
                    <Image src={user.profile.avatar_url} alt="Ava" width={32} height={32} className="h-8 w-8 rounded-full object-cover" unoptimized />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-xs font-bold text-primary">
                        {(user?.profile?.full_name || user?.email || 'U').charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-sm">{user?.profile?.full_name || user?.email}</p>
                    <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
                  </div>
                </div>
              </Link>
              <button
                onClick={handleLogout}
                className="flex w-full items-center space-x-2 rounded-md px-3 py-2 text-sm font-medium text-destructive hover:bg-accent"
              >
                <LogOut className="h-4 w-4" />
                <span>Выйти</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}

