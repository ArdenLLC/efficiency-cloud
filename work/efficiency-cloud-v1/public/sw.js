const CACHE = 'efficiency-cloud-v3.6.1-static';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon.svg', './app.js', './style.css'];
const STATIC_PATHS = new Set(CORE.map(path => new URL(path, self.location.href).pathname));

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Never cache authenticated/API requests, query-string URLs, or arbitrary same-origin content.
  if (request.headers.has('Authorization') || url.search || !STATIC_PATHS.has(url.pathname)) return;

  event.respondWith(
    fetch(request).then(response => {
      if (response.ok && response.type === 'basic') {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(request, copy));
      }
      return response;
    }).catch(() => caches.match(request).then(cached => cached || (request.mode === 'navigate' ? caches.match('./index.html') : undefined)))
  );
});
