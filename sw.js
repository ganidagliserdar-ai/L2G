// Service Worker für das Status-Fenster — ermöglicht echten Offline-Betrieb (PWA).
// Bei Änderungen an index.html/manifest/Icons bitte CACHE_VERSION erhöhen,
// sonst liefern Nutzer:innen weiterhin die alte, gecachte Version aus.

const CACHE_VERSION = 'status-fenster-v75';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png',
  './apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => {
        // Bewusst NICHT cache.addAll(): dort lässt eine einzige fehlende Datei die
        // komplette Installation stillschweigend scheitern. Einzeln cachen, damit
        // die App auch dann funktionsfähig bleibt, wenn ein Asset fehlt.
        return Promise.all(APP_SHELL.map((url) =>
          cache.add(url).catch((err) => {
            console.warn('[SW] Asset konnte nicht gecacht werden:', url, err);
          })
        ));
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if(req.method !== 'GET') return;

  const url = new URL(req.url);
  const isSameOrigin = url.origin === self.location.origin;

  if(isSameOrigin){
    // App-Shell: Cache-first, damit die App auch ohne Netz sofort startet.
    event.respondWith(
      caches.match(req).then((cached) => {
        if(cached) return cached;
        return fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
          return res;
        }).catch(() => caches.match('./index.html'));
      })
    );
  } else {
    // Externe Ressourcen (z.B. Google Fonts): Stale-while-revalidate.
    // Erst aus dem Cache liefern (falls vorhanden), im Hintergrund aktualisieren.
    // Schlägt beides fehl, läuft die App trotzdem weiter — die CSS-Schriftarten
    // haben einen lokalen Fallback-Font-Stack.
    event.respondWith(
      caches.match(req).then((cached) => {
        const networkFetch = fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
          return res;
        }).catch(() => cached);
        return cached || networkFetch;
      })
    );
  }
});
