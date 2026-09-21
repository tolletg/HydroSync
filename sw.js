// Cache des fichiers de l'application : une fois la page ouverte une premiere
// fois avec du reseau, elle se lance ensuite sans connexion.
const CACHE = "ouysse-tournee-v7";   // a incrementer a chaque mise a jour des fichiers
const FICHIERS = ["./", "./index.html", "./app.js", "./manifest.webmanifest", "./icone.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FICHIERS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((cles) => Promise.all(cles.filter((c) => c !== CACHE).map((c) => caches.delete(c))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;          // les envois ne passent pas par le cache
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
});
