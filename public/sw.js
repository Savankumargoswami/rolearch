// Rolearch service worker: an offline page when there's no connection, and job-alert notifications (db/052).
// It never caches signed-in pages, so nothing personal is stored in the browser's cache.
const CACHE = "rolearch-offline-v1";
const OFFLINE = "/offline.html";
const ICON = "/pwa-192x192.png";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll([new Request(OFFLINE, { cache: "reload" }), ICON])));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Pages load from the network as usual; only when that fails is the offline page (and its icon) shown.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.mode === "navigate") event.respondWith(fetch(req).catch(() => caches.match(OFFLINE)));
  else if (req.method === "GET" && new URL(req.url).pathname === ICON) event.respondWith(fetch(req).catch(() => caches.match(ICON)));
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {}
  event.waitUntil(
    self.registration.showNotification(data.title || "Rolearch", {
      body: data.body || "",
      icon: "/pwa-192x192.png",
      badge: "/pwa-192x192.png",
      tag: data.tag || "job-alert",
      data: { url: data.url || "/jobs" },
    }),
  );
});

// Opens the alert's search (only ever a page on this site), reusing a Rolearch tab if one is open.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/jobs", self.location.origin);
  if (url.origin !== self.location.origin) return;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (new URL(c.url).origin === url.origin && "navigate" in c) return c.navigate(url.href).then((w) => (w || c).focus());
      }
      return self.clients.openWindow(url.href);
    }),
  );
});
