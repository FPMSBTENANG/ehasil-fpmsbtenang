/**
 * ============================================================================
 * SW.JS — SERVICE WORKER e-HASIL FPMSB TENANG
 * ============================================================================
 * Menguruskan caching untuk PWA — membolehkan app berfungsi offline
 * dan memuatkan lebih pantas selepas kunjungan pertama.
 *
 * PENTING: Tukar CACHE_VERSION setiap kali ada update pada mana-mana
 *          fail dalam ASSETS. Ini memaksa semua pengguna mendapat
 *          versi terkini semasa mereka buka app.
 * ============================================================================
 */

const CACHE_VERSION = "ehasil-v3";

const ASSETS = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/config.js",
  "./js/app.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];


// ============================================================================
// INSTALL — Cache semua asset semasa SW dipasang
// ============================================================================
self.addEventListener("install", (event) => {
  // skipWaiting: paksa SW baru ambil alih segera tanpa tunggu tab ditutup
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(ASSETS))
      .then(() => console.log(`[SW] Cache "${CACHE_VERSION}" berjaya dibina.`))
      .catch(err => console.error("[SW] Cache install gagal:", err))
  );
});


// ============================================================================
// ACTIVATE — Padam cache lama
// ============================================================================
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE_VERSION)
          .map(key => {
            console.log(`[SW] Padam cache lama: ${key}`);
            return caches.delete(key);
          })
      ))
      .then(() => self.clients.claim()) // Ambil alih semua tab segera
  );
});


// ============================================================================
// FETCH — Strategi: Network First, fallback ke Cache
// ============================================================================
self.addEventListener("fetch", (event) => {
  // Skip request yang bukan GET (contoh: POST ke API)
  if (event.request.method !== "GET") return;

  // Skip request ke GAS API — jangan cache API calls
  if (event.request.url.includes("script.google.com")) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Simpan salinan terkini ke cache jika request berjaya
        if (response && response.status === 200) {
          const cloned = response.clone();
          caches.open(CACHE_VERSION)
            .then(cache => cache.put(event.request, cloned));
        }
        return response;
      })
      .catch(() => {
        // Tiada sambungan — guna cache
        return caches.match(event.request)
          .then(cached => {
            if (cached) return cached;
            // Fallback terakhir: papar index.html
            return caches.match("./index.html");
          });
      })
  );
});
