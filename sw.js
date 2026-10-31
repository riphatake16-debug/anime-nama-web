/* AnimeNama offline shell. Never cache account/private API responses. */
const VERSION = 'animenama-v25';
const SHELL = VERSION + '-shell';
// Poster files are unchanged by theme updates: keep already downloaded bundles between releases.
const POSTERS = 'animenama-v23-posters';
const IMAGES = VERSION + '-images';
const BASE = new URL('./', self.location.href);
const MAX_POSTER_BUNDLES = 18;
const MAX_IMAGES = 50;
const pathOf = path => new URL(path, BASE);
const sameSite = url => url.origin === BASE.origin && url.pathname.startsWith(BASE.pathname);

async function trim(cache, max) {
  const keys = await cache.keys();
  if (keys.length > max) {
    await Promise.allSettled(keys.slice(0, keys.length - max).map(key => cache.delete(key)));
  }
}
async function safePut(cache, request, response) {
  try { await cache.put(request, response.clone()); } catch (_) { /* quota reached: still serve network */ }
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    let paths = [
      './assets/index-optimized-v19.js',
      './assets/index-DH4P2sUh.css',
      './enhancements/light-v21.js',
      './enhancements/nocturne-v25.css',
      './enhancements/light-v14.css'
    ];
    try {
      const response = await fetch(pathOf('precache.json'), {cache: 'no-store'});
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) paths = data.filter(x =>
          typeof x === 'string' && /^\.\/(assets|enhancements|posters)\/[\w.-]+$/.test(x)
        );
      }
    } catch (_) { /* use the built-in required asset list */ }
    // Install should not replace the last working offline version unless the new app shell is complete.
    await cache.addAll(['./', ...paths].map(path => new Request(pathOf(path), { cache: 'reload' })));
    const optional = ['./data/home.json', './vazirmatn.woff2', './icons/icon-192.png', './icons/icon-512.png'];
    await Promise.allSettled(optional.map(path => cache.add(pathOf(path))));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.allSettled(keys.filter(key =>
      key.startsWith('animenama-') && !key.startsWith(VERSION) && key !== POSTERS
    ).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (!sameSite(url) || /\/(api|account|mcp|signin-with-chatgpt|signout-with-chatgpt|callback)(\/|$)/.test(url.pathname)) return;

  if (request.mode === 'navigate') {
    if (url.pathname !== BASE.pathname && url.pathname !== BASE.pathname + 'index.html') return;
    event.respondWith((async () => {
      const cache = await caches.open(SHELL);
      try {
        const response = await fetch(request, {signal: AbortSignal.timeout(6500)});
        if (response.ok) await safePut(cache, pathOf('./'), response);
        return response;
      } catch (_) {
        return await cache.match(pathOf('./')) || new Response(
          'برای اولین بار با اتصال اینترنت وارد انیمه‌نما شو.',
          {headers: {'Content-Type':'text/plain;charset=utf-8'}}
        );
      }
    })());
    return;
  }

  const path = url.pathname;
  // This JSON contains public anime metadata only. Network-first; cache it for flaky connections.
  if (path.endsWith('/data/home.json')) {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL);
      try {
        const fresh = await fetch(request, {signal: AbortSignal.timeout(4000)});
        if (fresh.ok) {
          await safePut(cache, request, fresh);
          return fresh;
        }
      } catch (_) { /* use last successful public snapshot */ }
      return await cache.match(request) || new Response('{"version":1,"airing":[],"schedules":{}}', {
        status: 200, headers: {'Content-Type':'application/json; charset=utf-8'}
      });
    })());
    return;
  }
  const isPoster = /\/posters\/bundle-\d+\.json$/.test(path);
  const isPosterIndex = /\/posters\/index\.json$/.test(path);
  const isImage = /\.(?:jpg|jpeg|png|webp|svg)$/.test(path);
  const isShell = /\/(?:assets|enhancements|icons)\//.test(path) ||
    /\/(?:vazirmatn\.woff2|hero\.jpg|favicon\.svg)$/.test(path);
  if (!isPoster && !isPosterIndex && !isImage && !isShell) return;

  event.respondWith((async () => {
    const name = isPoster ? POSTERS : isImage ? IMAGES : SHELL;
    const cache = await caches.open(name);
    const cached = await cache.match(request);
    if (cached) return cached;
    // Do not let cache-quota failures or cache writes break online image/API-independent loading.
    const response = await fetch(request);
    if (response.ok) {
      await safePut(cache, request, response);
      if (isPoster) await trim(cache, MAX_POSTER_BUNDLES);
      else if (isImage) await trim(cache, MAX_IMAGES);
    }
    return response;
  })());
});

self.addEventListener('push', event => {
  event.waitUntil((async () => {
    let data = {};
    try { data = event.data?.json() || {}; } catch (_) {}
    const title = typeof data.title === 'string' ? data.title.slice(0, 150) : 'انیمه‌نما';
    let target = new URL('./#dashboard', BASE).href;
    try {
      const url = new URL(data.url);
      if (sameSite(url)) target = url.href;
    } catch (_) {}
    await self.registration.showNotification(title, {
      body: typeof data.body === 'string' ? data.body.slice(0, 300) : 'داستانت خبر تازه‌ای دارد.',
      icon: pathOf('icons/icon-192.png').href,
      badge: pathOf('icons/icon-192.png').href,
      tag: typeof data.tag === 'string' ? data.tag : 'animenama',
      data: {url: target}
    });
  })());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const target = event.notification.data?.url || pathOf('./#dashboard').href;
    const windows = await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for (const windowClient of windows) {
      if (windowClient.url.startsWith(BASE.href)) {
        await windowClient.navigate(target);
        return windowClient.focus();
      }
    }
    return self.clients.openWindow(target);
  })());
});
