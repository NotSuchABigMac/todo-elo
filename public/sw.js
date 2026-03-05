const CACHE_NAME = 'todo-elo-v1';
const ASSETS = [
  '/todo-elo/',
  '/todo-elo/index.html',
  '/todo-elo/manifest.webmanifest',
  '/todo-elo/icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});