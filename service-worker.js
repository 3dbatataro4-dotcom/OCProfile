const CACHE_NAME = "oc-profile-app-v21-3-backup-motion-header";
const APP_SHELL = ["./", "./index.html", "./style.css", "./data.js", "./app.js", "./forum.css", "./forum-chat.css", "./forum-chat-core.js", "./forum-chat.js", "./forum-core.js", "./forum.js", "./cloud-sync-core.js", "./cloud-sync.js", "./cloud-sync.css", "./manifest.webmanifest", "./app-icon-192.png", "./app-icon-512.png"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(event.request).then(response => {
    const copy = response.clone();
    caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
    return response;
  }).catch(() => caches.match(event.request, { ignoreSearch:true }).then(hit => hit || (event.request.mode === "navigate" ? caches.match("./index.html") : Response.error()))));
});
