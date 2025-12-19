'use client'

import { useEffect } from 'react'

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return
    }

    // В development режиме удаляем все service workers для чистоты
    if (process.env.NODE_ENV === 'development') {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          registration.unregister().then((success) => {
            if (success) {
              console.log('[Service Worker] Unregistered in dev mode')
            }
          })
        })
      })
      // Очищаем кеш
      if ('caches' in window) {
        caches.keys().then((cacheNames) => {
          cacheNames.forEach((cacheName) => {
            caches.delete(cacheName)
          })
        })
      }
      return
    }

    // Регистрация service worker только в production
    if (process.env.NODE_ENV === 'production') {
      // Регистрация service worker только в production
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log(
            '[Service Worker] Registered successfully:',
            registration.scope
          )

          // Проверка обновлений каждые 60 секунд
          setInterval(() => {
            registration.update()
          }, 60000)

          // Обработка обновления service worker
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (
                  newWorker.state === 'installed' &&
                  navigator.serviceWorker.controller
                ) {
                  // Новый service worker доступен, можно показать уведомление
                  console.log('[Service Worker] New version available')
                  // Можно показать уведомление пользователю о необходимости обновления
                }
              })
            }
          })
        })
        .catch((error) => {
          console.error('[Service Worker] Registration failed:', error)
        })

      // Обработка контроллера service worker
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('[Service Worker] Controller changed, reloading page')
        window.location.reload()
      })
    }
  }, [])

  return null
}

