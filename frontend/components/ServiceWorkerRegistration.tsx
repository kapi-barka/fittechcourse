'use client'

import { useEffect } from 'react'

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return
    }

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

      if ('caches' in window) {
        caches.keys().then((cacheNames) => {
          cacheNames.forEach((cacheName) => {
            caches.delete(cacheName)
          })
        })
      }
      return
    }

    if (process.env.NODE_ENV === 'production') {

      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log(
            '[Service Worker] Registered successfully:',
            registration.scope
          )

          setInterval(() => {
            registration.update()
          }, 60000)

          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (
                  newWorker.state === 'installed' &&
                  navigator.serviceWorker.controller
                ) {

                  console.log('[Service Worker] New version available')

                }
              })
            }
          })
        })
        .catch((error) => {
          console.error('[Service Worker] Registration failed:', error)
        })

      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('[Service Worker] Controller changed, reloading page')
        window.location.reload()
      })
    }
  }, [])

  return null
}
