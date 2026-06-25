// Cache cleanup service worker for the standard IFM worksheet release.
// The app is now a self-contained static HTML page; fetches fall through to network.
self.addEventListener('install', (event) => {
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', () => {
  // No respondWith: use the browser's normal network request path.
});
