/*
 * SolarTeklif PWA service worker.
 * Amaç: kurulabilirlik (installability) + statik varlıkların hızlı yüklenmesi.
 * GÜVENLİK: Kimlik doğrulamalı / sunucuda üretilen HTML sayfaları ASLA
 * cache'lenmez (başka kullanıcıya yanlış sayfa gitmesin). Sadece /_next/static
 * ve public statik dosyaları cache-first sunulur.
 */
const CACHE = "solarteklif-static-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

function isStatic(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    /\.(?:png|jpg|jpeg|svg|webp|ico|woff2?|ttf|json)$/.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Sadece statik varlıklar: cache-first, arda güncelle.
  if (isStatic(url)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(req);
        const network = fetch(req)
          .then((res) => {
            if (res && res.status === 200) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })(),
    );
  }
  // Diğer istekler (HTML, API): dokunma — doğrudan ağdan.
});
