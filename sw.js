// Service Worker — Diario di Sostegno
// Gestisce la cache per il funzionamento offline

const CACHE = 'diario-v1';

// Calcola il percorso base automaticamente (funziona sia in locale che su GitHub Pages)
const BASE = self.location.pathname.replace(/sw\.js$/, '');

const ASSETS = [
  BASE,
  BASE + 'index.html',
  BASE + 'manifest.json',
  BASE + 'css/style.css',
  BASE + 'js/db.js',
  BASE + 'js/pin.js',
  BASE + 'js/app.js',
  BASE + 'js/home.js',
  BASE + 'js/students.js',
  BASE + 'js/notes.js',
  BASE + 'js/timeline.js',
  BASE + 'js/stats.js',
  BASE + 'js/deadlines.js',
  BASE + 'js/settings.js',
  BASE + 'js/synthesis.js',
  BASE + 'icons/icon.svg'
];

// Installazione: metti in cache tutti i file
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Attivazione: elimina le vecchie cache
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch: prima dalla cache, poi dalla rete
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      });
    })
  );
});
