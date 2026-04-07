const CACHE_VERSION = 'v1-gemtenders';
const CACHE_NAME = `${CACHE_VERSION}-cache`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const API_CACHE = `${CACHE_VERSION}-api`;

// Assets to cache on install (critical resources)
const INSTALL_CACHE_URLS = [
  '/',
  '/offline.html',
];

// API endpoints to NOT cache
const API_ENDPOINTS = [
  '/api/',
  '/auth/',
];

// Static asset patterns to cache
const STATIC_ASSETS = /\.(js|css|woff|woff2|ttf|eot|svg|png|jpg|jpeg|gif|webp|ico)$/;

/**
 * Install event - cache critical assets
 */
self.addEventListener('install', (event) => {
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      
      return cache.addAll(INSTALL_CACHE_URLS).catch((err) => {
        console.warn('[ServiceWorker] Some assets failed to cache during install:', err);
      });
    }).then(() => {
      
      return self.skipWaiting();
    })
  );
});

/**
 * Activate event - clean up old caches
 */
self.addEventListener('activate', (event) => {
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE && cacheName !== API_CACHE) {
            
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      
      return self.clients.claim();
    })
  );
});

/**
 * Fetch event - network-first strategy with fallback to cache
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests
  if (url.origin !== self.location.origin) {
    return;
  }

  // Skip WebSocket and non-GET requests
  if (!request.url.startsWith('http') || request.method !== 'GET') {
    return;
  }

  // Check if it's an API endpoint
  const isApiRequest = API_ENDPOINTS.some((endpoint) => url.pathname.startsWith(endpoint));

  if (isApiRequest) {
    // API requests: network-first with cache fallback
    event.respondWith(networkFirstApi(request));
  } else if (STATIC_ASSETS.test(url.pathname)) {
    // Static assets: cache-first with network fallback
    event.respondWith(cacheFirst(request));
  } else {
    // HTML pages: network-first with cache fallback
    event.respondWith(networkFirst(request));
  }
});

/**
 * Network-first strategy for API calls and pages
 * Try network first, fallback to cache, then a fallback response
 */
async function networkFirst(request) {
  const cacheName = request.destination === 'document' ? CACHE_NAME : RUNTIME_CACHE;
  
  try {
    const response = await fetch(request);
    
    // Cache successful responses
    if (response && response.status === 200) {
      const responseToCache = response.clone();
      caches.open(cacheName).then((cache) => {
        cache.put(request, responseToCache);
      });
    }
    
    return response;
  } catch (error) {
    
    
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Return offline page for document requests
    if (request.destination === 'document') {
      const cached = await caches.match('/offline.html');
      if (cached) return cached;
    }

    // Fallback responses
    if (request.destination === 'image') {
      return new Response(
        '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="#f0f0f0" width="100" height="100"/><text x="50" y="50" text-anchor="middle" dy=".3em" fill="#999" font-size="12">Image unavailable</text></svg>',
        { headers: { 'Content-Type': 'image/svg+xml' } }
      );
    }

    return new Response('Offline - Content not available', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: new Headers({ 'Content-Type': 'text/plain' }),
    });
  }
}

/**
 * Network-first strategy specifically for API calls
 * Try network first, fallback to cache, then error response
 */
async function networkFirstApi(request) {
  try {
    const response = await fetch(request);
    
    // Cache successful responses
    if (response && response.status === 200) {
      const responseToCache = response.clone();
      caches.open(API_CACHE).then((cache) => {
        cache.put(request, responseToCache);
      });
    }
    
    return response;
  } catch (error) {
    
    
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    return new Response(JSON.stringify({ error: 'Network request failed', offline: true }), {
      status: 503,
      statusText: 'Service Unavailable',
      headers: new Headers({ 'Content-Type': 'application/json' }),
    });
  }
}

/**
 * Cache-first strategy for static assets
 * Return from cache, update in background
 */
async function cacheFirst(request) {
  const cacheName = RUNTIME_CACHE;
  
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      // Update cache in background (stale-while-revalidate)
      fetch(request).then((response) => {
        if (response && response.status === 200) {
          const responseToCache = response.clone();
          caches.open(cacheName).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
      }).catch((error) => {
        
      });
      
      return cachedResponse;
    }

    // Not in cache, fetch from network
    const response = await fetch(request);
    if (response && response.status === 200) {
      const responseToCache = response.clone();
      caches.open(cacheName).then((cache) => {
        cache.put(request, responseToCache);
      });
    }
    return response;
  } catch (error) {
    
    
    // Try cache as fallback
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    throw error;
  }
}

/**
 * Handle messages from clients
 */
self.addEventListener('message', (event) => {
  
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
