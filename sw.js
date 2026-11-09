// Offline support for the installed app.
// The page itself is fetched from the network first so updates show up on the next open;
// the cached copy is used only when offline. Libraries and fonts never change, so they
// come from the cache first.
const VERSION = 'v57';
const CACHE = '2k17-stats-' + VERSION;
const APP_SHELL = [
  './',
  './index.html',
  './css/app.css',
  './js/data.js', './js/helpers.js', './js/nav-players.js', './js/teams.js', './js/league.js',
  './js/player.js', './js/engine.js', './js/settings.js', './js/main.js',
  './manifest.webmanifest?v=2',
  './icons/icon-192.png?v=2',
  './icons/icon-512.png?v=2',
  './icons/apple-touch-icon.png?v=2',
  './icons/icon-maskable-192.png?v=2',
  './icons/icon-maskable-512.png?v=2',
];
// Fetched on a best-effort basis: if the CDN is unreachable during install, the worker still
// installs and picks the library up the next time the page loads it
const OPTIONAL = ['https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'];
const STATIC_HOSTS = ['cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => Promise.all([
    cache.addAll(APP_SHELL),
    ...OPTIONAL.map(url => cache.add(url).catch(() => {})),
  ])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('2k17-stats-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (STATIC_HOSTS.includes(url.hostname)) {
    event.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(cache => cache.put(req, copy));
      return res;
    })));
    return;
  }

  if (url.origin === location.origin) {
    // no-cache: always ask the server whether a file changed, so a release shows on the next
    // open instead of after the browser's 10-minute cache runs out
    const fresh = req.mode === 'navigate' ? fetch(req.url, { cache: 'no-cache' }) : fetch(req, { cache: 'no-cache' });
    event.respondWith(fresh.then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(cache => cache.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then(hit => hit || caches.match('./index.html'))));
  }
});
