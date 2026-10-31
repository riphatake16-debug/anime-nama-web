import {createServer} from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../dist');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8'};
const server=createServer(async(req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(!pathname.startsWith('/anime-nama-web/')){res.writeHead(404);res.end();return}
  const rel=decodeURIComponent(pathname.slice('/anime-nama-web/'.length))||'index.html';
  const target=path.resolve(root,rel);
  if(!target.startsWith(root+path.sep)){res.writeHead(403);res.end();return}
  try{
    const data=await fs.readFile(target);
    res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream'});
    res.end(data);
  }catch{res.writeHead(404);res.end()}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
let browser;
try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,
    hasTouch:true,acceptDownloads:true,locale:'fa-IR'});
  await context.route('**/*',route=>{
    if(new URL(route.request().url()).hostname==='127.0.0.1')return route.continue();
    return route.abort('blockedbyclient');
  });
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/anime-nama-web/#home');
  await page.locator('.anime-card').first().waitFor({timeout:12000});
  assert.ok(await page.getByText('برنامه امروز').count());
  assert.equal(await page.locator('.an-featured').count(),0);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  assert.ok(overflow<=12,'mobile horizontal overflow: '+overflow);
  console.log('PASS: preview home renders public snapshot without external API calls');
  const night=await page.evaluate(()=>({
    theme:document.documentElement.dataset.anTheme,
    panel:getComputedStyle(document.querySelector('.welcome')).backgroundColor,
    text:getComputedStyle(document.querySelector('.welcome h1')).color,
    motion:getComputedStyle(document.querySelector('.welcome')).animationName
  }));
  assert.equal(night.theme,'night');
  assert.match(night.panel,/rgb\\(11, 27, 50\\)/,'night welcome background is inconsistent');
  assert.match(night.text,/rgb\\(242, 248, 255\\)/,'night text contrast regressed');
  assert.match(night.motion,/anSourceRise/);
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await page.evaluate(()=>
    getComputedStyle(document.querySelector('.welcome')).animationName),'none');
  await page.emulateMedia({reducedMotion:'no-preference'});
  console.log('PASS: new React night surfaces, readable text, animated entry and reduced-motion');
  await page.locator('.anime-card .save').first().click();
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('animenama:collection:v1')||'{}'));
  const id=Object.keys(stored)[0];
  assert.ok(id);
  await page.locator('.mobile-nav button').filter({hasText:'فهرست من'}).click();
  await page.locator('.library-item').first().waitFor();
  await page.reload();
  await page.locator('.library-item').first().waitFor();
  const newStore=await page.evaluate(()=>JSON.parse(localStorage.getItem('animenama:collection:v1')||'{}'));
  assert.ok(newStore[id],'legacy list key did not persist');
  console.log('PASS: saved watchlist survives reload');
  const [download]=await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button',{name:'دریافت پشتیبان'}).click()
  ]);
  const exported=JSON.parse(await fs.readFile(await download.path(),'utf8'));
  assert.equal(exported.version,1);
  assert.ok(exported.collection[id]);
  console.log('PASS: compatible v1 backup export');
  await page.locator('.mobile-nav button').filter({hasText:'تقویم'}).click();
  await page.locator('.day-tabs button').first().waitFor();
  await page.locator('.schedule-item').first().waitFor();
  await page.getByRole('button',{name:'تغییر تم'}).click();
  assert.equal(await page.evaluate(()=>document.documentElement.dataset.anTheme),'day');
  console.log('PASS: calendar and theme');
  await page.locator('.extras summary').click();
  await page.locator('.extras button').filter({hasText:'تنظیمات'}).click();
  await page.getByText('حساب و همگام‌سازی').waitFor();
  await page.getByText('اعلان‌های اختیاری').waitFor();
  await page.getByRole('button',{name:'اتصال به حساب انیمه‌نما'}).waitFor();
  assert.equal(await page.locator('iframe[src*="cinema"]').count(),0);
  console.log('PASS: account, notification and privacy settings rendered without contacting account backend');
  await page.locator('.extras summary').click();
  await page.locator('.extras button').filter({hasText:'فصل‌های بعدی'}).click();
  await page.getByText('فصل‌های بعدی انیمه‌های من').waitFor();
  console.log('PASS: personal sequels screen');
  await page.locator('.extras summary').click();
  await page.locator('.extras button').filter({hasText:'اخبار'}).click();
  await page.getByText('اخبار و اطلاعیه‌ها').waitFor();
  console.log('PASS: verified news UI renders even when remote backend is blocked');
  await page.locator('.mobile-nav button').filter({hasText:'خانه'}).click();
  await page.locator('.anime-card').first().waitFor();
  await page.evaluate(async()=>{await navigator.serviceWorker.ready});
  await page.reload();
  const controlling=await page.evaluate(()=>Boolean(navigator.serviceWorker.controller));
  assert.ok(controlling,'React preview PWA worker did not take control');
  await context.setOffline(true);
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('.anime-card').first().waitFor({timeout:12000});
  await context.setOffline(false);
  console.log('PASS: independent React PWA reload survives offline');
  await page.setViewportSize({width:1280,height:800});
  await page.locator('.desktop-nav button').filter({hasText:'آرشیو'}).click();
  await page.locator('.search-label input').waitFor();
  await page.screenshot({path:path.join(root,'react-source-desktop.png')});
  assert.deepEqual(errors,[],'uncaught React errors');
  console.log('PASS: desktop page, zero uncaught browser exceptions');
  await context.close();
}finally{
  if(browser)await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
