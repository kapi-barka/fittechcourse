// Service Worker для FitTech PWA
const CACHE_NAME = 'fittech-v1';
const RUNTIME_CACHE = 'fittech-runtime-v1';

// Ресурсы для кеширования при установке
const STATIC_ASSETS = [
  '/',
  '/dashboard',
  '/login',
  '/register',
  '/manifest.json',
  '/icon.png',
  '/icon-192.png',
  '/icon-512.png',
];

// Стратегия кеширования: Network First, Fallback to Cache
const networkFirstStrategy = async (request) => {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    // Если это навигационный запрос и нет кеша, вернуть главную страницу
    if (request.mode === 'navigate') {
      const cache = await caches.open(CACHE_NAME);
      return cache.match('/') || new Response('Offline', { status: 503 });
    }
    throw error;
  }
};

// Стратегия кеширования: Cache First (для статических ресурсов)
const cacheFirstStrategy = async (request) => {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    return new Response('Resource not available offline', { status: 503 });
  }
};

// Установка Service Worker
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching static assets');
      return cache.addAll(STATIC_ASSETS).catch((error) => {
        console.log('[Service Worker] Failed to cache some assets:', error);
      });
    })
  );
  self.skipWaiting(); // Активировать сразу
});

// Активация Service Worker
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim(); // Взять контроль над всеми клиентами
});

// Перехват запросов
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Пропустить запросы к API (не кешируем)
  // Проверяем как относительные, так и абсолютные URL
  if (url.pathname.startsWith('/api/') || url.href.includes('/api/')) {
    return; // Использовать сеть напрямую, не перехватывать
  }

  // Пропустить запросы к внешним ресурсам (API на другом домене)
  // Если это не наш origin и это не статический ресурс, пропускаем
  if (url.origin !== location.origin) {
    // Пропускаем все внешние запросы (включая API)
    return;
  }

  // Статические ресурсы: изображения, шрифты, CSS, JS
  if (
    request.destination === 'image' ||
    request.destination === 'font' ||
    request.destination === 'style' ||
    request.destination === 'script' ||
    url.pathname.match(/\.(jpg|jpeg|png|gif|svg|woff|woff2|ttf|eot|css|js)$/i)
  ) {
    event.respondWith(cacheFirstStrategy(request));
    return;
  }

  // HTML страницы и навигация: Network First
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  // Остальные запросы: Network First
  event.respondWith(networkFirstStrategy(request));
});

// Обработка сообщений от клиента
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName))
        );
      })
    );
  }
});

