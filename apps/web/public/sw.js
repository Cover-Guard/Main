/**
 * CoverGuard Service Worker
 * Required for Google Play Store TWA distribution.
 * Provides offline fallback, caching for static assets, and
 * network-first strategy for API calls.
 */
const CACHE_NAME = 'coverguard-v1'
const OFFLINE_URL = '/offline.html'

// Static assets to pre-cache on install.
// Uses individual cache.add() calls so a missing icon doesn't block
// the entire service worker from activating (icons are generated separately).
const PRECACHE_ASSETS = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
]

// Install: pre-cache essential assets individually so one failure doesn't block activation
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(
        PRECACHE_ASSETS.map(url => cache.add(url).catch(() => {}))
      )
    })
  )
  self.skipWaiting()
})

// Activate: clean up old caches and take control of open tabs
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.allSettled(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      )
    }).then(() => self.clients.claim())
  )
})

// Fetch: network-first with offline fallback
self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests
  if (request.method !== 'GET') return

  // Skip chrome-extension and other non-http(s) schemes
  if (!url.protocol.startsWith('http')) return

  // ── Skip third-party Google Maps / GIS resources ──────────────────
  // Let these go straight to the network without SW interception.
  // This prevents CSP violations (the SW fetch context inherits the
  // page's connect-src policy and cursor/image resources can conflict).
  if (
    url.hostname.endsWith('.googleapis.com') ||
    url.hostname.endsWith('.gstatic.com') ||
    url.hostname.endsWith('.google.com') ||
    url.hostname.endsWith('.googleusercontent.com') ||
    url.hostname.endsWith('.arcgis.com') ||
    url.hostname.endsWith('.fema.gov') ||
    url.hostname.endsWith('.usda.gov') ||
    url.hostname.endsWith('.usgs.gov') ||
    url.hostname.endsWith('.noaa.gov')
  ) return

  // API calls: network only (no caching)
  if (url.pathname.startsWith('/api/')) return

  // Supabase auth calls: network only
  if (url.hostname.endsWith('.supabase.co')) return

  // Navigation requests: network-first with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => {
        return caches.match(OFFLINE_URL).then(cached => {
          return cached ?? new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } })
        })
      })
    )
    return
  }

  // Static assets: stale-while-revalidate
  event.respondWith(
    caches.match(request).then(cachedResponse => {
      const fetchPromise = fetch(request).then(networkResponse => {
        // Cache successful responses
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone()
          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, responseClone).catch(() => {})
          }).catch(() => {})
        }
        return networkResponse
      }).catch(() => {
        // Network failed — return cached version or offline fallback
        if (cachedResponse) {
          return cachedResponse
        }
        return caches.match(OFFLINE_URL).then(offline => {
          return offline ?? new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } })
        })
      })
      // Return cached version immediately if available, otherwise wait for network
      return cachedResponse || fetchPromise
    })
  )
})

// Handle push notifications (for quote request updates)
self.addEventListener('push', event => {
  if (!event.data) return
  let data = {}
  try {
    data = event.data.json()
  } catch {
    // Invalid JSON payload — skip notification
    return
  }
  const options = {
    body: data.body || 'You have a new update from CoverGuard.',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: data.tag || 'coverguard-notification',
    data: { url: data.url || '/' },
  }
  event.waitUntil(
    self.registration.showNotification('CoverGuard', options).catch(() => {})
  )
})

// Handle notification clicks — open the relevant page
self.addEventListener('notificationclick', event => {
  event.notification.close()
  const targetUrl = event.notification.data?.url || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      // Focus existing tab if open
      for (const client of clients) {
        if (client.url.includes(targetUrl)) {
          return client.focus()
        }
      }
      // Otherwise open a new tab
      return self.clients.openWindow(targetUrl)
    })
  )
})
