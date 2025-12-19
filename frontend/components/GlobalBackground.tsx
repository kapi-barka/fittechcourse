'use client'

import { usePathname } from 'next/navigation'
import { BackgroundSlider } from '@/components/ui/BackgroundSlider'

export function GlobalBackground() {
  const pathname = usePathname()
  
  // Не показываем глобальный фон на страницах входа и регистрации (у них свой фон)
  if (pathname === '/login' || pathname === '/register') {
    return null
  }

  const backgroundImages = [
    '/dashboard-bg.jpg',
    '/dashboard-bg-2.jpg'
  ]

  return (
    <div className="fixed inset-0 z-0 pointer-events-none">
        <BackgroundSlider images={backgroundImages} duration={10000} transitionDuration={2000} />
        {/* Более темный оверлей для темной темы */}
        <div className="absolute inset-0 bg-black/70 z-10" />
    </div>
  )
}

