const CACHE_NAME = 'correo-service-v3'; // Incrementamos versión para forzar actualización
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './central.html',
  './manifest.json',
  './manifest-central.json',
  './assets/logo.svg',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600&display=swap'
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Precaching app shell & external CDN assets...');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate Event (Cleanup old caches)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Clearing old cache...', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // ESTRATEGIA NETWORK-FIRST para archivos locales (Desarrollo y Actualizaciones Fluidas)
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          // Si la respuesta es exitosa y es GET, actualizamos caché en segundo plano
          if (event.request.method === 'GET' && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Si falla la red (offline), servimos desde la caché local
          return caches.match(event.request);
        })
    );
  } else {
    // ESTRATEGIA CACHE-FIRST para CDNs de mapas, estilos y tipografías externas
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        
        return fetch(event.request).then((networkResponse) => {
          if (
            event.request.method === 'GET' && 
            (url.hostname.includes('unpkg.com') || 
             url.hostname.includes('basemaps.cartocdn.com') || 
             url.hostname.includes('fonts.gstatic.com') || 
             url.hostname.includes('fonts.googleapis.com'))
          ) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        }).catch(() => {
          // Fail gracefully
        });
      })
    );
  }
});
