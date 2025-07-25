const CACHE_NAME = 'eventhouse-scanner-v1.0.0';
const urlsToCache = [
  '/mobile/scanner.html',
  '/admin/login.html',
  '/assets/css/bootstrap.min.css',
  '/assets/js/bootstrap.bundle.min.js',
  '/assets/icons/icon-192x192.png',
  '/assets/icons/icon-512x512.png',
  '/manifest.json',
  // External CDN resources
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.0/font/bootstrap-icons.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js',
  'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching files');
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.error('Service Worker: Cache failed', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Fetch event - serve cached content when offline
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip API requests for special handling
  if (event.request.url.includes('/api/')) {
    event.respondWith(handleApiRequest(event.request));
    return;
  }

  // Cache-first strategy for static assets
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        return response || fetch(event.request)
          .then((fetchResponse) => {
            // Check if we received a valid response
            if (!fetchResponse || fetchResponse.status !== 200 || fetchResponse.type !== 'basic') {
              return fetchResponse;
            }

            // Clone the response for caching
            const responseToCache = fetchResponse.clone();

            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return fetchResponse;
          })
          .catch(() => {
            // Return offline fallback for HTML pages
            if (event.request.headers.get('accept').includes('text/html')) {
              return caches.match('/mobile/offline.html') || 
                     new Response('<h1>Offline</h1><p>Koneksi internet diperlukan</p>', {
                       headers: { 'Content-Type': 'text/html' }
                     });
            }
          });
      })
  );
});

// Handle API requests with network-first strategy
async function handleApiRequest(request) {
  try {
    // Try network first
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // Fallback to cache for GET requests
    if (request.method === 'GET') {
      const cachedResponse = await caches.match(request);
      if (cachedResponse) {
        return cachedResponse;
      }
    }
    
    // Return offline response for failed API calls
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Koneksi internet diperlukan untuk operasi ini',
        offline: true
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Background sync for offline check-ins
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-checkin') {
    event.waitUntil(syncOfflineCheckins());
  }
});

// Push notification handler
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'EventHouse by IDCloudHost notification',
    icon: '/assets/icons/icon-192x192.png',
    badge: '/assets/icons/badge-72x72.png',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    }
  };

  event.waitUntil(
    self.registration.showNotification('EventHouse by IDCloudHost', options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients.openWindow('/mobile/scanner.html')
  );
});

// Sync offline check-ins when connection is restored
async function syncOfflineCheckins() {
  try {
    // Get offline check-ins from IndexedDB
    const offlineCheckins = await getOfflineCheckins();
    
    for (const checkin of offlineCheckins) {
      try {
        const response = await fetch('/api/admin/checkin', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${checkin.token}`
          },
          body: JSON.stringify(checkin.data)
        });

        if (response.ok) {
          // Remove from offline storage
          await removeOfflineCheckin(checkin.id);
          console.log('Synced offline check-in:', checkin.id);
        }
      } catch (error) {
        console.error('Failed to sync check-in:', error);
      }
    }
  } catch (error) {
    console.error('Background sync failed:', error);
  }
}

// IndexedDB helpers for offline storage
async function getOfflineCheckins() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('EventHouse by IDCloudHostDB', 1);
    
    request.onerror = () => reject(request.error);
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['checkins'], 'readonly');
      const store = transaction.objectStore('checkins');
      const getRequest = store.getAll();
      
      getRequest.onsuccess = () => resolve(getRequest.result);
      getRequest.onerror = () => reject(getRequest.error);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('checkins')) {
        db.createObjectStore('checkins', { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

async function removeOfflineCheckin(id) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('EventHouse by IDCloudHostDB', 1);
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['checkins'], 'readwrite');
      const store = transaction.objectStore('checkins');
      const deleteRequest = store.delete(id);
      
      deleteRequest.onsuccess = () => resolve();
      deleteRequest.onerror = () => reject(deleteRequest.error);
    };
  });
}

// Skip waiting and take control immediately
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

console.log('Service Worker: Loaded');
