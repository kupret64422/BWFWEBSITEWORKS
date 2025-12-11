const CACHE_NAME = 'firebase-pwa-tester-cache-v1';
// List of files to cache upon installation
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  // You would also include your icon files here, e.g., '/icons/icon-192x192.png'
  'https://cdn.tailwindcss.com'
];

// Install Event: Cache all necessary assets
self.addEventListener('install', event => {
  console.log('[Service Worker] Install');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .catch(err => {
        console.error('[Service Worker] Caching failed:', err);
      })
  );
});

// Activate Event: Clean up old caches
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activate');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Fetch Event: Serve from cache first, then fall back to network
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }

        // IMPORTANT: For Firebase/Google APIs, we generally want to go straight to the network.
        // The Service Worker should not aggressively cache Firestore data requests.
        if (event.request.url.includes('googleapis.com') || event.request.url.includes('firestore.googleapis.com')) {
          return fetch(event.request);
        }

        // Otherwise, fetch from the network
        return fetch(event.request).then(
          networkResponse => {
            // Check if we received a valid response
            if(!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse;
            }

            // OPTIONAL: Clone the response. A response is a stream, so it can only be consumed once.
            // We consume the clone to put it into the cache, and return the original.
            const responseToCache = networkResponse.clone();
            
            // Do not cache data uploaded to Storage, only static assets and getDownloadURL links
            if (networkResponse.url.includes('/o/cat_photos')) {
                return networkResponse;
            }

            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return networkResponse;
          }
        );
      })
  );
});
