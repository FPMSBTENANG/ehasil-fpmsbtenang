// TUKAR NOMBOR NI SETIAP KALI ADA UPDATE BESAR DI HTML
const CACHE_NAME = 'fpmsb-v1'; // <--- Tukar jadi v3, v4 bila ada update lagi

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png', // Pastikan fail ni wujud
  './icons/icon-512.png'  // Pastikan fail ni wujud
];

// Install Event
self.addEventListener('install', (e) => {
  self.skipWaiting(); // PAKSA UPDATE SEGERA
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

// Activate Event (Buang Cache Lama)
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('Deleting old cache:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Fetch Event
self.addEventListener('fetch', (e) => {
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
























