import {chromium} from 'playwright';
import {createServer} from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
 '.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8',
 '.webmanifest':'application/manifest+json','.svg':'image/svg+xml',
 '.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://127.0.0.1');
  if(url.pathname==='/anime-nama-web') {
   res.writeHead(308,{Location:'/anime-nama-web/'});res.end();return;
  }
  if(!url.pathname.startsWith('/anime-nama-web/')){
   res.writeHead(404);res.end('Not found');return;
  }
  const rel=decodeURIComponent(url.pathname.slice('/anime-nama-web/'.length))||'index.html';
  const full=path.resolve(root,rel);
  if(!full.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  const data=await fs.readFile(full);
  res.writeHead(200,{'Content-Type':types[path.extname(full)]||'application/octet-stream',
   'Cache-Control':'no-store'});
  res.end(data);
 }catch{res.writeHead(404);res.end('Not found');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const address=server.address();
const origin='http://127.0.0.1:'+address.port;
let browser;
try{
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,
  isMobile:true,hasTouch:true,acceptDownloads:true,locale:'fa-IR'});
 await context.route('**/*',route=>{
  const requestUrl=new URL(route.request().url());
  if(requestUrl.hostname==='127.0.0.1')return route.continue();
  return route.abort('blockedbyclient');
 });
 const page=await context.newPage();
 const errors=[];
 const posterNetwork=[];
 page.on('request',req=>{if(req.url().includes('/posters/'))posterNetwork.push('REQUEST '+req.url())});
 page.on('response',res=>{if(res.url().includes('/posters/'))posterNetwork.push('RESPONSE '+res.status()+' '+res.url())});
 page.on('requestfailed',req=>{if(req.url().includes('/posters/'))posterNetwork.push('FAILED '+req.failure()?.errorText+' '+req.url())});
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/anime-nama-web/#home',{waitUntil:'domcontentloaded'});
 await page.locator('.home-dashboard').waitFor({timeout:15000});
 await page.locator('.home-anime-grid .home-anime-tile').first().waitFor({timeout:16000});
 await page.locator('.home-today-list .home-today-item').first().waitFor({timeout:16000});
 assert.equal(await page.locator('.an-featured').count(),0,'removed blue hero reappeared');
 console.log('PASS: live homepage uses same-origin snapshot, tiles + schedule visible');
 // All external image/CDN requests are blocked in this test. Real saved GitHub
 // poster bundles must load first, as decoded pictures (not just placeholders).
 try{
   await page.waitForFunction(()=>{
     return [...document.querySelectorAll('.home-anime-grid .home-cover img')]
       .some(img=>img.currentSrc.startsWith('data:image/') &&
         img.complete && img.naturalWidth>0);
   },null,{timeout:12000});
 }catch(error){
   const details=await page.evaluate(()=>({
     imageCount:document.querySelectorAll('.home-anime-grid img').length,
     tileCount:document.querySelectorAll('.home-anime-grid .home-anime-tile').length,
     sample:[...document.querySelectorAll('.home-anime-grid .home-anime-tile')].slice(0,3)
       .map(el=>({html:el.outerHTML.slice(0,800),
         y:el.getBoundingClientRect().y,
         image:el.querySelector('img')?.currentSrc.slice(0,140),
         naturalWidth:el.querySelector('img')?.naturalWidth})),
     fallback:[...document.querySelectorAll('.home-cover-fallback')]
       .slice(0,4).map(x=>x.textContent)
   }));
   let decoded;
   try{
     decoded=await page.evaluate(async()=>{
       const index=await (await fetch('/anime-nama-web/posters/index.json')).json();
       const bundle=await (await fetch('/anime-nama-web/posters/bundle-'+index['21']+'.json')).json();
       const src=bundle['21'],image=new Image();image.src=src;
       try{await image.decode();return {srcLength:src?.length,width:image.naturalWidth,height:image.naturalHeight}}
       catch(e){return {srcLength:src?.length,error:String(e),complete:image.complete}}
     });
   }catch(e){decoded={error:String(e)}}
   console.error('POSTER_DIAG',JSON.stringify({details,posterNetwork,decoded,errors}));
   throw error;
 }
 const bundled=await page.evaluate(()=>
   [...document.querySelectorAll('.home-anime-grid .home-cover img')]
     .filter(img=>img.currentSrc.startsWith('data:image/')&&img.naturalWidth>0).length);
 assert.ok(bundled>=1,'No usable locally bundled poster images loaded');
 console.log('PASS: same-site anime poster bundle decodes even with third-party image hosts blocked');
 const night=await page.evaluate(()=>{
   const rgb=selector=>getComputedStyle(document.querySelector(selector)).backgroundColor
     .match(/\d+(?:\.\d+)?/g).slice(0,3).map(Number);
   return {
     theme:document.documentElement.dataset.anTheme,
     card:rgb('.home-today-item'),
     nav:rgb('.simple-mobile-nav'),
     sectionAnimation:getComputedStyle(document.querySelector('.home-page-title')).animationName,
     loadedMirror:[...document.styleSheets].some(sheet=>sheet.href?.includes('dark-mirror-v22.css'))
   };
 });
 assert.equal(night.theme,'night','night theme must be default for new sessions');
 assert.ok(night.loadedMirror,'v22 black mirror stylesheet not loaded');
 assert.ok(night.card.every(n=>n<75),'night cards have a light background: '+night.card);
 assert.ok(night.nav.every(n=>n<75),'night mobile nav inconsistent: '+night.nav);
 assert.match(night.sectionAnimation,/an22-appear/,'section entrance animation not enabled');
 await page.emulateMedia({reducedMotion:'reduce'});
 const disabledMotion=await page.evaluate(()=>
   getComputedStyle(document.querySelector('.home-page-title')).animationName);
 assert.equal(disabledMotion,'none','reduced-motion preference must disable animations');
 await page.emulateMedia({reducedMotion:'no-preference'});
 const colorContract=await page.evaluate(()=>{
   const item=document.querySelector('.home-today-item');
   const computed=getComputedStyle(item);
   return {background:computed.backgroundColor,
     backgroundImage:computed.backgroundImage,
     text:getComputedStyle(document.querySelector('.home-page-title h1')).color,
     accent:getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()
   };
 });
 assert.match(colorContract.background,/rgb\(/);
 assert.equal(colorContract.backgroundImage,'none','Night should use solid black cards');
 assert.equal(colorContract.accent,'#d98bb9','Night accent should stay pink like day, not blue');
 console.log('PASS: dark mirrors the light layout with black surfaces and pink accent');
 console.log('PASS: dark cards/nav are consistent and reduced-motion turns animations off');
 await page.locator('#an-search-button').click();
 await page.locator('.simple-toolbar .search-field input').waitFor({timeout:10000});
 assert.equal(new URL(page.url()).hash,'#explore','mobile header search did not open archive');
 await page.locator('.simple-mobile-nav button').filter({hasText:'خانه'}).click();
 await page.locator('.home-anime-grid .home-anime-tile').first().waitFor({timeout:10000});
 await page.evaluate(()=>localStorage.setItem('animenama:motion','reduced'));
 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('.home-anime-grid .home-anime-tile').first().waitFor({timeout:12000});
 assert.equal(await page.evaluate(()=>document.documentElement.dataset.motion),'reduced',
   'stored reduced motion was ignored on reload');
 const afterStoredMotion=await page.evaluate(()=>
   getComputedStyle(document.querySelector('.home-page-title')).animationName);
 assert.equal(afterStoredMotion,'none','stored reduced motion must turn off entrance animation');
 await page.evaluate(()=>localStorage.setItem('animenama:motion','full'));
 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('.home-anime-grid .home-anime-tile').first().waitFor({timeout:12000});
 console.log('PASS: mobile header search and saved reduced-motion preference');
 await page.locator('.home-anime-tile .home-tile-cover').first().click();
 await page.locator('.simple-detail[open]').waitFor({timeout:10000});
 await page.waitForTimeout(450);
 const modalGeometry=await page.evaluate(()=>{
   const measure=()=>{
     const dialog=document.querySelector('.simple-detail');
     const poster=document.querySelector('.simple-detail .detail-poster');
     const hero=document.querySelector('.simple-detail .detail-hero');
     const teaser=document.querySelector('.simple-detail .continuation-teaser');
     const size=node=>{
       const box=node.getBoundingClientRect();
       return {width:box.width,height:box.height};
     };
     return {dialog:size(dialog),poster:size(poster),hero:size(hero),
       teaserBackground:getComputedStyle(teaser).backgroundColor,
       teaserImage:getComputedStyle(teaser).backgroundImage};
   };
   document.documentElement.dataset.anTheme='night';
   const night=measure();
   document.documentElement.dataset.anTheme='day';
   const day=measure();
   document.documentElement.dataset.anTheme='night';
   return {night,day};
 });
 for(const key of ['dialog','poster','hero'])
   for(const dim of ['width','height'])
     assert.ok(Math.abs(modalGeometry.night[key][dim]-modalGeometry.day[key][dim])<=2,
       'Dark mode must preserve day '+key+' '+dim+': '+JSON.stringify(modalGeometry));
 assert.ok(modalGeometry.night.poster.width<155,
   'Poster is incorrectly enlarged in night mode: '+JSON.stringify(modalGeometry));
 assert.equal(modalGeometry.night.teaserImage,'none',
   'Next broadcast box should be black, not the old light/blue gradient');
 console.log('PASS: detail poster/dialog keep identical day-night dimensions and dark next-broadcast panel');
 await page.locator('.simple-detail .dialog-close').click();
 await page.locator('.simple-detail[open]').waitFor({state:'hidden'});
 const geometry=await page.evaluate(()=>({
  pageWidth:document.documentElement.scrollWidth,
  viewportWidth:window.innerWidth,
  nav:(()=>{const el=document.querySelector('.simple-mobile-nav');const r=el.getBoundingClientRect();return {left:r.left,right:r.right}})()
 }));
 assert.ok(geometry.pageWidth<=geometry.viewportWidth+12,
  'mobile has horizontal overflow: '+JSON.stringify(geometry));
 assert.ok(geometry.nav.left>=-3&&geometry.nav.right<=geometry.viewportWidth+3,
  'bottom navigation escapes mobile viewport');
 console.log('PASS: mobile layout has no viewport overflow');
 await fs.mkdir(path.join(root,'artifacts'),{recursive:true});
 await page.screenshot({path:path.join(root,'artifacts','v1-home-mobile.png'),fullPage:true});



 const save=page.locator('.home-anime-tile .home-tile-meta button').first();
 await save.click();
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('animenama:collection:v1')||'{}'));
 const ids=Object.keys(saved);
 assert.ok(ids.length>=1,'save was not persisted');
 await page.locator('.simple-mobile-nav button').filter({hasText:'فهرست من'}).click();
 await page.locator('.library-grid .library-card').first().waitFor({timeout:10000});
 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('.library-grid .library-card').first().waitFor({timeout:12000});
 const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('animenama:collection:v1')||'{}'));
 assert.ok(after[ids[0]],'saved anime did not survive reload');
 console.log('PASS: saving a title and reloading preserves personal library');

 await page.locator('.list-tools summary').click();
 const [download]=await Promise.all([
  page.waitForEvent('download',{timeout:15000}),
  page.locator('.list-tools button').filter({hasText:'دریافت پشتیبان'}).click()
 ]);
 const backup=JSON.parse(await fs.readFile(await download.path(),'utf8'));
 assert.equal(backup.version,1,'backup export version');
 assert.ok(backup.collection[ids[0]],'export omitted a saved anime');
 console.log('PASS: user backup export contains saved anime');
 // Check import is non-destructive, and malformed backups cannot erase the list.
 const input=page.locator('.list-tools input[type=file]');
 await input.setInputFiles({name:'backup.json',mimeType:'application/json',
  buffer:Buffer.from(JSON.stringify(backup))});
 const restored=await page.evaluate(()=>JSON.parse(localStorage.getItem('animenama:collection:v1')||'{}'));
 assert.ok(restored[ids[0]],'restoring a valid backup removed a title');
 await input.setInputFiles({name:'broken.json',mimeType:'application/json',
  buffer:Buffer.from('{"version":1,"collection":[not valid json')} );
 const afterBad=await page.evaluate(()=>JSON.parse(localStorage.getItem('animenama:collection:v1')||'{}'));
 assert.ok(afterBad[ids[0]],'malformed backup corrupted the original list');
 console.log('PASS: restoring a backup and rejecting malformed files preserve the list');


 const themeButton=page.locator('#an-theme-button');
 await themeButton.click();
 assert.equal(await page.evaluate(()=>document.documentElement.dataset.anTheme),'day');
 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('.library-grid .library-card').first().waitFor({timeout:12000});
 assert.equal(await page.evaluate(()=>document.documentElement.dataset.anTheme),'day');
 console.log('PASS: light/dark preference persists');

 await page.locator('.simple-mobile-nav button').filter({hasText:'خانه'}).click();
 await page.locator('.home-anime-grid .home-anime-tile').first().waitFor({timeout:12000});
 await page.evaluate(async()=>{
  if(!('serviceWorker' in navigator))throw Error('Service Worker unsupported');
  await navigator.serviceWorker.ready;
 });
 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('.home-anime-grid .home-anime-tile').first().waitFor({timeout:12000});
 const controller=await page.evaluate(()=>Boolean(navigator.serviceWorker.controller));
 assert.ok(controller,'SW did not control app after reload');
 await context.setOffline(true);
 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('.home-anime-grid .home-anime-tile').first().waitFor({timeout:12000});
 await context.setOffline(false);
 await page.waitForFunction(()=>
   [...document.querySelectorAll('.home-anime-grid .home-cover img')]
     .some(img=>img.currentSrc.startsWith('data:image/') &&
       img.complete && img.naturalWidth>0),null,{timeout:12000});
 console.log('PASS: bundled posters survive a fully offline page reload');
 console.log('PASS: offline reload still shows the home anime list');
 await page.setViewportSize({width:1280,height:800});
 await page.locator('.desktop-nav button').filter({hasText:'آرشیو'}).click();
 const search=page.locator('.simple-toolbar .search-field input');
 await search.waitFor({timeout:12000});
 await search.fill('Naruto');
 assert.equal(await search.inputValue(),'Naruto');
 assert.equal(new URL(page.url()).hash,'#explore');
 console.log('PASS: desktop archive search and navigation');
 await page.locator('.desktop-nav button').filter({hasText:'تقویم'}).click();
 try {
  await page.locator('.calendar-days button').first().waitFor({timeout:10000});
  await page.locator('.schedule-list .schedule-row').first().waitFor({timeout:16000});
 } catch(error) {
  console.error('Calendar diagnosis', JSON.stringify({
   url:page.url(),
   body:(await page.locator('body').innerText()).slice(0,900),
   errors
  }));
  throw error;
 }
 await page.setViewportSize({width:390,height:844});
 const calendarPalette=await page.evaluate(async()=>{
   const settle=()=>new Promise(resolve=>setTimeout(resolve,320));
   const selectors={
     day:'.calendar-days > button',
     active:'.calendar-days > button.active',
     list:'.schedule-list',
     bookmark:'.schedule-row > .button',
     timezone:'.timezone-pill'
   };
   const snapshot=()=>{
     const result={};
     for(const [name,selector] of Object.entries(selectors)){
       const el=document.querySelector(selector);
       if(!el)throw Error('Calendar UI is missing '+selector);
       const css=getComputedStyle(el),rect=el.getBoundingClientRect();
       result[name]={
         color:css.color,background:css.backgroundColor,
         width:rect.width,height:rect.height
       };
     }
     return result;
   };
   const original=document.documentElement.dataset.anTheme;
   document.documentElement.dataset.anTheme='day';
   await settle(); // Wait for CSS color transitions to complete before sampling.
   const day=snapshot();
   document.documentElement.dataset.anTheme='night';
   await settle();
   const night=snapshot();
   document.documentElement.dataset.anTheme=original;
   return {day,night};
 });
 const rgb=s=>[...(s.match(/\d+(?:\.\d+)?/g)||[])].slice(0,3).map(Number);
 for(const name of ['day','list','bookmark','timezone']){
   const channels=rgb(calendarPalette.night[name].background);
   assert.equal(channels.length,3,'Unknown calendar background '+name);
   assert.ok(channels.every(value=>value<80),
     'Calendar '+name+' remains too light: '+calendarPalette.night[name].background);
 }
 const activeRgb=rgb(calendarPalette.night.active.background);
 assert.ok(activeRgb.every(v=>v<115),'Active calendar day is too bright');
 for(const key of Object.keys(calendarPalette.day)){
   for(const dim of ['width','height']){
     assert.ok(Math.abs(calendarPalette.day[key][dim]-calendarPalette.night[key][dim])<2,
       'Calendar night mode changed '+key+' '+dim);
   }
 }
 console.log('PASS: real mobile calendar weekdays, list, bookmark and timezone are dark, with matching day dimensions');
 await page.setViewportSize({width:1280,height:800});
 const columns=await page.evaluate(()=>({
   documentWidth:document.documentElement.scrollWidth,
   viewportWidth:window.innerWidth
 }));
 assert.ok(columns.documentWidth<=columns.viewportWidth+12,
  'desktop has horizontal overflow: '+JSON.stringify(columns));
 await page.screenshot({path:path.join(root,'artifacts','v1-calendar-desktop.png'),fullPage:true});
 console.log('PASS: desktop calendar and layout');
 // Check bookmarked/direct calendar links independently of in-app navigation.
 const deep=await context.newPage();
 const deepErrors=[];
 deep.on('pageerror',e=>deepErrors.push(e.message));
 await deep.goto(origin+'/anime-nama-web/#calendar',{waitUntil:'domcontentloaded'});
 try {
  await deep.locator('.calendar-days button').first().waitFor({timeout:12000});
 } catch(error) {
  console.error('Direct calendar diagnosis',JSON.stringify({
   url:deep.url(),
   body:(await deep.locator('body').innerText()).slice(0,700),
   errors:deepErrors
  }));
  throw error;
 }
 console.log('PASS: bookmarked calendar URL opens directly');
 await deep.close();
 assert.equal(errors.length,0,'uncaught browser errors: '+errors.join('; ').slice(0,500));
 console.log('PASS: no uncaught JS exceptions');
 await context.close();
}finally{
 if(browser)await browser.close();
 await new Promise(resolve=>server.close(resolve));
}
