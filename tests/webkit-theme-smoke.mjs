import {webkit} from 'playwright';
import {createServer} from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
 '.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8',
 '.svg':'image/svg+xml','.webmanifest':'application/manifest+json',
 '.woff2':'font/woff2','.png':'image/png','.jpg':'image/jpeg'};
const server=createServer(async(req,res)=>{
 try{
  const u=new URL(req.url,'http://127.0.0.1');
  if(!u.pathname.startsWith('/anime-nama-web/'))throw Error('outside app');
  const relative=decodeURIComponent(u.pathname.slice('/anime-nama-web/'.length))||'index.html';
  const full=path.resolve(root,relative);
  if(!full.startsWith(root+path.sep))throw Error('unsafe path');
  const bytes=await fs.readFile(full);
  res.writeHead(200,{'Content-Type':types[path.extname(full)]||'application/octet-stream',
   'Cache-Control':'no-store'});
  res.end(bytes);
 }catch{res.writeHead(404);res.end('Not found')}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
 browser=await webkit.launch({headless:true});
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,
  hasTouch:true,locale:'fa-IR'});
 await context.route('**/*',route=>{
  if(new URL(route.request().url()).hostname==='127.0.0.1')return route.continue();
  return route.abort('blockedbyclient');
 });
 const page=await context.newPage();
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const url='http://127.0.0.1:'+server.address().port+'/anime-nama-web/#home';
 await page.goto(url,{waitUntil:'domcontentloaded'});
 await page.locator('.home-anime-grid .home-anime-tile').first().waitFor({timeout:16000});
 await page.locator('.home-today-item').first().waitFor({timeout:16000});
 const initial=await page.evaluate(()=>{
  const item=document.querySelector('.home-today-item');
  const nav=document.querySelector('.simple-mobile-nav');
  return{
   theme:document.documentElement.dataset.anTheme,
   card:getComputedStyle(item).backgroundColor,
   nav:getComputedStyle(nav).backgroundColor,
   overflow:document.documentElement.scrollWidth-window.innerWidth
  }
 });
 assert.equal(initial.theme,'night');
 assert.match(initial.card,/rgb\(|rgba\(/);
 assert.ok(initial.overflow<=12,'WebKit mobile overflow: '+initial.overflow);
 console.log('PASS: WebKit mobile renders the night theme without horizontal overflow');
 await page.locator('#an-theme-button').click();
 assert.equal(await page.evaluate(()=>document.documentElement.dataset.anTheme),'day');
 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('.home-anime-grid .home-anime-tile').first().waitFor({timeout:16000});
 assert.equal(await page.evaluate(()=>document.documentElement.dataset.anTheme),'day');
 assert.equal(await page.locator('meta[name="theme-color"]').getAttribute('content'),'#f7e5f1');
 console.log('PASS: WebKit retains day preference and correct browser theme-color');
 await page.locator('#an-theme-button').click();
 await page.emulateMedia({reducedMotion:'reduce'});
 assert.equal(await page.evaluate(()=>
   getComputedStyle(document.querySelector('.home-page-title')).animationName),'none');
 await page.locator('.simple-mobile-nav button').filter({hasText:'تقویم'}).click();
 await page.locator('.calendar-days button').first().waitFor({timeout:10000});
 console.log('PASS: WebKit calendar navigation and reduced-motion');
 // This isolated test intentionally blocks external update APIs and omitted poster bundles.
 // WebKit reports those expected network failures as pageerror; do not conceal other errors.
 const unexpected=errors.filter(message=>!(
   message.includes('due to access control checks.')&&
   (message.includes('/posters/bundle-')||message.includes('/api/updates'))
 ));
 assert.deepEqual(unexpected,[],'Unexpected WebKit runtime exceptions');
 await context.close();
}finally{
 if(browser)await browser.close();
 await new Promise(resolve=>server.close(resolve));
}
