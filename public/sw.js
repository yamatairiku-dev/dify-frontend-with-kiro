/**
 * Service Worker for Dify Workflow Frontend
 * Provides offline caching and performance optimization
 */

const CACHE_NAME = 'dify-workflow-v1';
const STATIC_CACHE = 'dify-static-v1';
const DYNAMIC_CACHE = 'dify-dynamic-v1';

// Files to cache immediately
const STATIC_FILES = [
  '/',
  '/index.html',
  '/vite.svg',
  '/health.json',
];

// API endpoints to cache
const API_CACHE_PATTERNS = [
  /\/api\/workflows/,
  /\/api\/user/,
];

// Files that should never be cached
const NO_CACHE_PATTERNS = [
  /\/callback\//,
  /\/api\/auth\//,
  /\/api\/oauth\//,
];

/**
 * Install event - cache static files
 */
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('Service Worker: Caching static files');
        return cache.addAll(STATIC_FILES);
      })
      .then(() => {
        console.log('Service Worker: Installation complete');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Service Worker: Installation failed', error);
      })
  );
});

/**
 * Activate event - clean up old caches
 */
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
              console.log('Service Worker: Deleting old cache', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker: Activation complete');
        return self.clients.claim();
      })
  );
});

/**
 * Fetch event - handle requests with caching strategy
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip requests that should never be cached
  if (NO_CACHE_PATTERNS.some(pattern => pattern.test(url.pathname))) {
    return;
  }
  
  // Handle different types of requests
  if (url.origin === location.origin) {
    // Same-origin requests
    event.respondWith(handleSameOriginRequest(request));
  } else {
    // Cross-origin requests (APIs, CDNs, etc.)
    event.respondWith(handleCrossOriginRequest(request));
  }
});

/**
 * Handle same-origin requests with cache-first strategy for static files
 */
async function handleSameOriginRequest(request) {
  const url = new URL(request.url);
  
  // Static files - cache first
  if (isStaticFile(url.pathname)) {
    return handleStaticFile(request);
  }
  
  // API requests - network first with cache fallback
  if (url.pathname.startsWith('/api/')) {
    return handleApiRequest(request);
  }
  
  // SPA routes - serve index.html from cache
  return handleSpaRoute(request);
}

/**
 * Handle cross-origin requests
 */
async function handleCrossOriginRequest(request) {
  try {
    const response = await fetch(request);
    
    // Cache successful responses
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    // Try to serve from cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    throw error;
  }
}

/**
 * Handle static files with cache-first strategy
 */
async function handleStaticFile(request) {
  try {
    // Try cache first
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Fetch from network and cache
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    console.error('Service Worker: Failed to fetch static file', error);
    throw error;
  }
}

/**
 * Handle API requests with network-first strategy
 */
async function handleApiRequest(request) {
  const url = new URL(request.url);
  
  // Check if this API should be cached
  const shouldCache = API_CACHE_PATTERNS.some(pattern => pattern.test(url.pathname));
  
  try {
    // Always try network first for APIs
    const response = await fetch(request);
    
    // Cache successful responses if allowed
    if (response.ok && shouldCache) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    // Fallback to cache for cacheable APIs
    if (shouldCache) {
      const cachedResponse = await caches.match(request);
      if (cachedResponse) {
        console.log('Service Worker: Serving API from cache (offline)', request.url);
        return cachedResponse;
      }
    }
    
    throw error;
  }
}

/**
 * Handle SPA routes by serving index.html
 */
async function handleSpaRoute(request) {
  try {
    // Try to fetch the actual route
    const response = await fetch(request);
    if (response.ok) {
      return response;
    }
  } catch (error) {
    // Network error, continue to fallback
  }
  
  // Fallback to index.html for SPA routing
  const indexResponse = await caches.match('/index.html');
  if (indexResponse) {
    return indexResponse;
  }
  
  // Last resort - fetch index.html from network
  return fetch('/index.html');
}

/**
 * Check if a path is for a static file
 */
function isStaticFile(pathname) {
  const staticExtensions = ['.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.eot'];
  return staticExtensions.some(ext => pathname.endsWith(ext)) || pathname === '/vite.svg';
}

/**
 * Handle background sync for offline actions
 */
self.addEventListener('sync', (event) => {
  console.log('Service Worker: Background sync', event.tag);
  
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

/**
 * Perform background sync operations
 */
async function doBackgroundSync() {
  try {
    // Implement background sync logic here
    // For example: sync offline actions, update cache, etc.
    console.log('Service Worker: Background sync completed');
  } catch (error) {
    console.error('Service Worker: Background sync failed', error);
  }
}

/**
 * Handle push notifications (if needed)
 */
self.addEventListener('push', (event) => {
  console.log('Service Worker: Push received', event);
  
  const options = {
    body: event.data ? event.data.text() : 'New notification',
    icon: '/vite.svg',
    badge: '/vite.svg',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'Open App',
        icon: '/vite.svg'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/vite.svg'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('Dify Workflow', options)
  );
});

/**
 * Handle notification clicks
 */
self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: Notification clicked', event);
  
  event.notification.close();
  
  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

/**
 * Handle messages from the main thread
 */
self.addEventListener('message', (event) => {
  console.log('Service Worker: Message received', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_URLS') {
    event.waitUntil(
      caches.open(DYNAMIC_CACHE)
        .then(cache => cache.addAll(event.data.urls))
    );
  }
});

console.log('Service Worker: Script loaded');