const CACHE_NAME = "oc-profile-app-v41-horizontal-icon";
const APP_SHELL = ["./", "./index.html", "./style.css", "./app-drawer.css", "./app-drawer-enhancements.css", "./app-drawer.js", "./lottery.css", "./lottery.js", "./hogwarts-dorm.css", "./hogwarts-dorm-refine.css", "./hogwarts-dorm.js", "./paro-layouts.css", "./paro-layouts.js", "./character-archive.css", "./character-archive.js", "./scoreboard.css", "./scoreboard.js", "./music.css", "./music-player-refresh.css", "./music.js", "./features.css", "./features-timeline.css", "./timeline-books.css", "./data.js", "./app.js", "./features.js", "./vn-assets.js", "./vn-page.js", "./vn-page.css", "./vn-page-responsive.css", "./vn-layout.js", "./vn-layout.css", "./vn-library.js", "./vn-library.css", "./forum.css", "./forum-chat.css", "./forum-chat-core.js", "./forum-core.js", "./forum-chat.js", "./forum.js", "./cloud-sync-core.js", "./cloud-sync.js", "./cloud-sync.css", "./manifest.webmanifest", "./app-icon-192.png", "./app-icon-512.png"];

APP_SHELL.push('./reader-viewport.js');
APP_SHELL.push('./tierlist.js','./tierlist.css');

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
