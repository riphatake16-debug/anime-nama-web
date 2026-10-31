/* Standalone React source PWA. It does not reference any legacy minified assets. */
const VERSION='animenama-source-v1';
const SHELL=VERSION+'-shell',IMAGES=VERSION+'-images';
const BASE=new URL('./',self.location.href);
const assetUrl=path=>new URL(path,BASE);
const own=url=>url.origin===BASE.origin&&url.pathname.startsWith(BASE.pathname);
const timeout=ms=>{
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),ms);
  return {controller,cancel:()=>clearTimeout(timer)};
};
async function tryCache(cache,request,response){
  try{await cache.put(request,response.clone())}catch{/* cache quota never breaks online content */}
}
self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(SHELL);
    const response=await fetch(assetUrl('assets-manifest.json'),{cache:'no-store'});
    if(!response.ok)throw Error('App assets list missing');
    const list=await response.json();
    if(!Array.isArray(list)||!list.length||!list.every(x=>
      typeof x==='string'&&/^(\.\/)?(?:assets\/[\w.-]+|data\/home\.json|index\.html|manifest\.webmanifest|favicon\.svg)$/.test(x)))
      throw Error('App assets list invalid');
    // Install is atomic: do not replace the current worker until the complete shell is cached.
    await cache.addAll(['./',...list].map(path=>new Request(assetUrl(path),{cache:'reload'})));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const names=await caches.keys();
    await Promise.allSettled(names.filter(x=>x.startsWith('animenama-source-')&&!x.startsWith(VERSION))
      .map(x=>caches.delete(x)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(!own(url)||/\/(?:api|account|mcp|signin-with-chatgpt|signout-with-chatgpt|callback)(\/|$)/.test(url.pathname))return;
  const path=url.pathname;
  const isNavigation=request.mode==='navigate';
  const isHomeData=path.endsWith('/data/home.json');
  const isImage=/\.(?:png|jpe?g|webp|svg)$/.test(path);
  const isShell=/\/(?:assets|icons)\//.test(path)||
    /\/(?:manifest\.webmanifest|favicon\.svg|vazirmatn\.woff2)$/.test(path);
  if(!isNavigation&&!isHomeData&&!isImage&&!isShell)return;
  event.respondWith((async()=>{
    const cache=await caches.open(isImage?IMAGES:SHELL);
    const key=isNavigation?assetUrl('./'):request;
    const saved=await cache.match(key);
    if(isShell&&saved)return saved;
    const net=timeout(isNavigation||isHomeData?5500:7500);
    try{
      const fresh=await fetch(request,{signal:net.controller.signal});
      if(fresh.ok){
        await tryCache(cache,key,fresh);
        if(isImage){
          const keys=await cache.keys();
          await Promise.allSettled(keys.slice(0,Math.max(0,keys.length-50))
            .map(x=>cache.delete(x)));
        }
        return fresh;
      }
      return saved||fresh;
    }catch(error){
      if(saved)return saved;
      if(isNavigation)return new Response('برای بار اول با اینترنت وارد انیمه‌نما شو.',{
        headers:{'Content-Type':'text/plain;charset=utf-8'}
      });
      if(isHomeData)return new Response('{"version":1,"airing":[],"schedules":{}}',{
        headers:{'Content-Type':'application/json;charset=utf-8'}
      });
      throw error;
    }finally{net.cancel()}
  })());
});
self.addEventListener('push',event=>{
  event.waitUntil((async()=>{
    let data={};
    try{data=event.data?.json()||{}}catch{}
    let target=assetUrl('./#home').href;
    try{const parsed=new URL(data.url);if(own(parsed))target=parsed.href}catch{}
    await self.registration.showNotification(
      typeof data.title==='string'?data.title.slice(0,150):'انیمه‌نما',{
        body:typeof data.body==='string'?data.body.slice(0,300):'خبر تازه‌ای از انیمه‌ها رسیده است.',
        icon:assetUrl('icons/icon-192.png').href,
        badge:assetUrl('icons/icon-192.png').href,
        tag:typeof data.tag==='string'?data.tag:'animenama',
        data:{url:target}
      }
    );
  })());
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil((async()=>{
    const target=event.notification.data?.url||assetUrl('./#home').href;
    const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for(const client of clients){
      if(client.url.startsWith(BASE.href)){
        await client.navigate(target);return client.focus();
      }
    }
    return self.clients.openWindow(target);
  })());
});
