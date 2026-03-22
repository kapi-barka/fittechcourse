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
  LogOut,
  Menu,
  X,
  Shield,
  Calendar,
  Sparkles,
  Bot,
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

  const mainLinks = [
    { href: '/dashboard', label: 'Главная', icon: Home },
    { href: '/schedule', label: 'Тренировка', icon: Calendar },
    { href: '/diary', label: 'Дневник', icon: Utensils },
    { href: '/programs', label: 'Программы', icon: Dumbbell },
    { href: '/recommendations', label: 'Рекомендации', icon: Sparkles },
    { href: '/coach', label: 'Консультант', icon: Bot },
    { href: '/articles', label: 'Статьи', icon: BookOpen },
  ]

  const adminLink = { href: '/admin', label: 'Админ', icon: Shield }

  const allMobileLinks = [
    ...mainLinks,
    ...(user?.role === 'admin' ? [adminLink] : []),
  ]

  // Не показываем Navbar на страницах логина и регистрации
  const isAuthPage = pathname === '/login' || pathname === '/register'
  if (!isAuthenticated || isAuthPage) return null

  const navLinkClass = (active: boolean) => cn(
    'flex items-center gap-1.5 rounded-md px-2 py-2 text-sm font-medium transition-all duration-200',
    'hover:bg-white/10 hover:text-foreground',
    active
      ? 'bg-primary/20 text-primary border border-primary/30'
      : 'text-muted-foreground'
  )

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-white/5 bg-background/90 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70">
      <div className="container mx-auto px-4">
        <div className="flex h-14 items-center justify-between gap-4">

          {/* Logo */}
          <Link href="/dashboard" className="flex shrink-0 items-center gap-2">
            <div className="relative h-8 w-8 overflow-hidden rounded-lg ring-1 ring-white/10">
              <Image
                src="/logo.png"
                alt="Logo"
                width={32}
                height={32}
                className="h-full w-full object-cover"
                unoptimized
              />
            </div>
            <span className="hidden font-extrabold text-base sm:inline-block tracking-tight">
              FitTech
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex md:items-center md:gap-0.5">
            {mainLinks.map((link) => {
              const Icon = link.icon
              const active = pathname === link.href
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  title={link.label}
                  className={navLinkClass(active)}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="hidden lg:inline">{link.label}</span>
                </Link>
              )
            })}

            {/* Admin */}
            {user?.role === 'admin' && (
              <Link
                href="/admin"
                title="Админ"
                className={navLinkClass(pathname === '/admin')}
              >
                <Shield className="h-4 w-4 shrink-0" />
                <span className="hidden lg:inline">Админ</span>
              </Link>
            )}
          </div>

          {/* User Menu */}
          <div className="hidden md:flex md:items-center md:gap-2">
            <Link
              href="/account"
              className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-white/5 transition-colors"
            >
              <div className="hidden lg:block text-right">
                <p className="text-sm font-medium leading-none">{user?.profile?.full_name || user?.email}</p>
                <p className="text-xs text-muted-foreground mt-0.5 capitalize">{user?.role}</p>
              </div>
              {user?.profile?.avatar_url ? (
                <Image
                  src={user.profile.avatar_url}
                  alt="Avatar"
                  width={32}
                  height={32}
                  className="h-8 w-8 rounded-full object-cover ring-1 ring-border"
                  unoptimized
                />
              ) : (
                <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center ring-1 ring-primary/30">
                  <span className="text-xs font-bold text-primary">
                    {(user?.profile?.full_name || user?.email || 'U').charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              title="Выйти"
              className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden rounded-md p-2 text-muted-foreground hover:bg-white/10 hover:text-foreground transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/5 py-3 space-y-0.5">
            {allMobileLinks.map((link) => {
              const Icon = link.icon
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    pathname === link.href
                      ? 'bg-primary/15 text-primary'
                      : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {link.label}
                </Link>
              )
            })}

            <div className="border-t border-white/5 pt-3 mt-2 space-y-0.5">
              <Link
                href="/account"
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                {user?.profile?.avatar_url ? (
                  <Image
                    src={user.profile.avatar_url}
                    alt="Ava"
                    width={28}
                    height={28}
                    className="h-7 w-7 rounded-full object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="h-7 w-7 rounded-full bg-primary/15 flex items-center justify-center ring-1 ring-primary/30">
                    <span className="text-xs font-bold text-primary">
                      {(user?.profile?.full_name || user?.email || 'U').charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div>
                  <p className="font-medium text-sm text-foreground">{user?.profile?.full_name || user?.email}</p>
                  <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
                </div>
              </Link>

              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Выйти
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
