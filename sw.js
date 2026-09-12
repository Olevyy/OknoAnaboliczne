// Nowe pliki pobierają się w tle, a zmiany widać przy kolejnym otwarciu aplikacji.
// Podbij wersję, gdy zmieniasz listę plików.
const CACHE = 'okno-v1';
const ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './js/logic.js',
  './js/store.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;

  // stale-while-revalidate: natychmiast z cache, w tle pobierz nowszą wersję
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(event.request, { ignoreSearch: true });
      const network = fetch(event.request)
        .then((res) => {
          if (res.ok) cache.put(event.request, res.clone());
          return res;
        })
        .catch(() => cached);
      if (cached) {
        event.waitUntil(network);
        return cached;
      }
      return network;
    }),
  );
});
