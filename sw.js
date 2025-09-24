// Basic service worker for Madeena Masjid Duvall
const CACHE_NAME = 'mmduvall-v8';
const ASSETS = [
  '/',
  '/index.html',
  '/admin-schedule.html',
  '/css/bootstrap.min.css',
  '/css/style.css',
  '/js/main.js',
  '/js/config.js',
  '/js/events.js',
  '/js/events-teaser.js',
  '/js/prayer-times.js',
  '/js/schedule.js',
  '/js/schedule-admin.js',
  '/events.json',
  '/prayer-times.json',
  '/site-config.json',
  '/lib/animate/animate.min.css',
  '/lib/owlcarousel/assets/owl.carousel.min.css',
  '/lib/wow/wow.min.js',
  '/lib/easing/easing.min.js',
  '/lib/waypoints/waypoints.min.js',
  '/lib/owlcarousel/owl.carousel.min.js',
  '/logo.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  // Network-first for HTML
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request).then(resp => {
        const copy = resp.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        return resp;
      }).catch(() => caches.match(request).then(c => c || caches.match('/index.html')))
    );
    return;
  }

  // Network-first for JS and CSS to pick up changes quickly
  if (request.destination === 'script' || request.url.endsWith('.js') || request.destination === 'style' || request.url.endsWith('.css')) {
    event.respondWith(
      fetch(request).then(resp => {
        const copy = resp.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        return resp;
      }).catch(() => caches.match(request))
    );
    return;
  }

  // Network-first for JSON config/data files
  if (request.destination === '' && request.url.endsWith('.json')) {
    event.respondWith(
      fetch(request).then(resp => {
        const copy = resp.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        return resp;
      }).catch(() => caches.match(request))
    );
    return;
  }

  // Cache-first for assets
  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request).then(resp => {
      const copy = resp.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
      return resp;
    }))
  );
});
