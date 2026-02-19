self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

// Intentionally passthrough: keep runtime behavior unchanged while enabling PWA installability checks.
self.addEventListener('fetch', () => {
});
