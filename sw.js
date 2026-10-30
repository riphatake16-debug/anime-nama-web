/* AnimeNama: public app shell only. Private API/account data is never cached. */
const VERSION='animenama-v6';
const CACHE=VERSION+'-shell';
const IMAGE_CACHE=VERSION+'-images';
const BASE=new URL('./',self.location.href);
self.addEventListener('install',event=>{event.waitUntil((async()=>{const cache=await caches.open(CACHE);const files=['./','./vazirmatn.woff2','./icons/icon-192.png','./icons/icon-512.png'];try{const manifest=await fetch(new URL('precache.json',BASE),{cache:'no-store'});if(manifest.ok){const paths=await manifest.json();files.push(...paths.filter(x=>typeof x==='string'&&/^\.\/assets\//.test(x)));}}catch{}await Promise.allSettled(files.map(path=>cache.add(new URL(path,BASE))));await self.skipWaiting();})());});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(key=>key.startsWith('animenama-')&&!key.startsWith(VERSION)).map(key=>caches.delete(key)));await self.clients.claim();})());});
self.addEventListener('fetch',event=>{
 const req=event.request;const url=new URL(req.url);
 if(req.method!=='GET'||url.origin!==BASE.origin||!url.pathname.startsWith(BASE.pathname)||/\/(api|account|mcp|signin-with-chatgpt|signout-with-chatgpt|callback)(\/|$)/.test(url.pathname))return;
 if(req.mode==='navigate'){
  // Only the public root app can be used as an offline navigation fallback.
  if(url.pathname!==BASE.pathname&&url.pathname!==BASE.pathname+'index.html')return;
  event.respondWith((async()=>{const cache=await caches.open(CACHE);try{const r=await fetch(req);if(r.ok)await cache.put(new URL('./',BASE),r.clone());return r;}catch{return await cache.match(new URL('./',BASE))||new Response('برای اولین بار با اتصال اینترنت وارد انیمه‌نما شو.',{headers:{'Content-Type':'text/plain;charset=utf-8'}});}})());return;
 }
 if(!/\/(assets|icons)\//.test(url.pathname)&&!/^.*\/(vazirmatn\.woff2|hero\.jpg|favicon\.svg)$/.test(url.pathname))return;
 event.respondWith((async()=>{const cache=await caches.open(url.pathname.endsWith('.jpg')?IMAGE_CACHE:CACHE);const old=await cache.match(req);if(old)return old;const r=await fetch(req);if(r.ok){await cache.put(req,r.clone());const keys=await cache.keys();if(keys.length>50)await cache.delete(keys[0]);}return r;})());
});
self.addEventListener('push',event=>{event.waitUntil((async()=>{let data={};try{data=event.data.json();}catch{}const title=typeof data.title==='string'?data.title.slice(0,150):'انیمه‌نما';let target=new URL('./#dashboard',BASE).href;try{const u=new URL(data.url);if(u.origin===BASE.origin&&u.pathname.startsWith(BASE.pathname))target=u.href;}catch{}await self.registration.showNotification(title,{body:typeof data.body==='string'?data.body.slice(0,300):'داستانت خبر تازه‌ای دارد.',icon:new URL('icons/icon-192.png',BASE).href,badge:new URL('icons/icon-192.png',BASE).href,tag:typeof data.tag==='string'?data.tag:'animenama',data:{url:target}});})());});
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil((async()=>{const target=event.notification.data?.url||new URL('./#dashboard',BASE).href;const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});for(const client of clients){if(client.url.startsWith(BASE.href)){await client.navigate(target);return client.focus();}}return self.clients.openWindow(target);})());});
