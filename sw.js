// Offline support: everything the app needs is cached on first visit, then served from the phone.
// Bump CACHE when you publish changes; the app offers an "Update" button when a new version is found.
const CACHE = 'pipe-v1.0.0';
const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'app.css',
  'app.js', 'config.js', 'help.js',
  'calculator.js', 'units.js', 'format.js', 'pipes.js', 'pipedata.js',
  'barlow-condensed-latin-500-normal.woff2', 'barlow-condensed-latin-600-normal.woff2',
  'barlow-latin-400-normal.woff2', 'barlow-latin-600-normal.woff2',
  'icon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png',
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('pipe-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => {
      if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => req.mode === 'navigate' ? caches.match('index.html') : Response.error()))
  );
});
