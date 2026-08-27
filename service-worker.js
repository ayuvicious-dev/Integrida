// Integrida Service Worker
// Caching dasar untuk shell aplikasi agar dapat dibuka ulang saat offline
// (data laporan keuangan tetap membutuhkan koneksi ke Firebase).

// v2: seluruh CSS & JS aplikasi sudah digabung ke dalam index.html,
// jadi app shell yang perlu di-cache jauh lebih sederhana.
// v3: pembaruan index.html.
// v4: strategi diubah menjadi network-first khusus untuk halaman HTML
//     (navigasi), supaya pembaruan index.html langsung terlihat tanpa
//     perlu menaikkan versi CACHE_NAME setiap kali. Aset statis lain
//     (manifest, ikon) tetap cache-first agar tetap cepat & bisa offline.
const CACHE_NAME = 'integrida-cache-v4';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Jangan cache request ke Firebase / API eksternal - selalu ambil dari jaringan
  if (req.url.includes('googleapis') || req.url.includes('firestore') || req.url.includes('firebase')) {
    return;
  }

  // NETWORK-FIRST untuk navigasi (index.html / rute SPA).
  // Ini memastikan pengguna selalu melihat versi terbaru aplikasi selama
  // online, dan hanya jatuh ke cache lama saat benar-benar offline.
  const isNavigation = req.mode === 'navigate' ||
    (req.method === 'GET' && req.headers.get('accept') && req.headers.get('accept').includes('text/html'));

  if (isNavigation) {
    event.respondWith(
      fetch(req)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return response;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  // CACHE-FIRST untuk aset statis lain (manifest, ikon, dsb.)
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((response) => {
        if (response && response.status === 200 && req.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return response;
      }).catch(() => cached);
    })
  );
});
