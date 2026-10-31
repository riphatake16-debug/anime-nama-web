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
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/anime-nama-web/#home',{waitUntil:'domcontentloaded'});
 await page.locator('.home-dashboard').waitFor({timeout:15000});
 await page.locator('.home-anime-grid .home-anime-tile').first().waitFor({timeout:16000});
 await page.locator('.home-today-list .home-today-item').first().waitFor({timeout:16000});
 assert.equal(await page.locator('.an-featured').count(),0,'removed blue hero reappeared');
 console.log('PASS: live homepage uses same-origin snapshot, tiles + schedule visible');
 const night=await page.evaluate(()=>{
   const rgb=selector=>getComputedStyle(document.querySelector(selector)).backgroundColor
     .match(/\d+(?:\.\d+)?/g).slice(0,3).map(Number);
   return {
     theme:document.documentElement.dataset.anTheme,
     card:rgb('.home-today-item'),
     nav:rgb('.simple-mobile-nav'),
     sectionAnimation:getComputedStyle(document.querySelector('.home-page-title')).animationName,
     loadedPolish:[...document.styleSheets].some(sheet=>sheet.href?.includes('polish-v21.css'))
   };
 });
 assert.equal(night.theme,'night','night theme must be default for new sessions');
 assert.ok(night.loadedPolish,'v21 theme polish not loaded');
 assert.ok(night.card.every(n=>n<75),'night cards have a light background: '+night.card);
 assert.ok(night.nav.every(n=>n<75),'night mobile nav inconsistent: '+night.nav);
 assert.match(night.sectionAnimation,/an21-rise/,'section entrance animation not enabled');
 await page.emulateMedia({reducedMotion:'reduce'});
 const disabledMotion=await page.evaluate(()=>
   getComputedStyle(document.querySelector('.home-page-title')).animationName);
 assert.equal(disabledMotion,'none','reduced-motion preference must disable animations');
 await page.emulateMedia({reducedMotion:'no-preference'});
 console.log('PASS: dark cards/nav are consistent and reduced-motion turns animations off');
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
