// Crowns service worker — minimal: makes the app installable (PWA) without caching app
// code, so there's no stale-asset risk during active development. Static media (images,
// fonts, glb) are cache-first for snappier repeat loads; everything else is network.
const CACHE = 'crowns-media-v1';
const MEDIA = /\.(png|jpe?g|webp|svg|woff2?|glb|wav)$/i;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(
  caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
));
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin || !MEDIA.test(url.pathname)) return; // network for app code + cross-origin
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
      return res;
    }).catch(() => hit))
  );
});
