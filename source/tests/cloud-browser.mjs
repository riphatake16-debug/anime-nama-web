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
  const u=new URL(req.url,'http://localhost');
  if(!u.pathname.startsWith('/anime-nama-web/')){res.writeHead(404);res.end();return}
  const rel=decodeURIComponent(u.pathname.slice('/anime-nama-web/'.length))||'index.html';
  const file=path.resolve(root,rel);
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return}
  try{
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});
    res.end(await fs.readFile(file));
  }catch{res.writeHead(404);res.end()}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const origin='http://127.0.0.1:'+server.address().port;
const account='https://anime-nama-watch.riphatake2020.chatgpt.site';
const anime=(id,title)=>({mal_id:id,title});
const record=(id,title,updatedAt)=>({
 anime:anime(id,title),status:'watching',progress:2,favorite:false,updatedAt
});
const serverSnapshot={collection:{
  '100':record(100,'Remote show','2026-01-01T00:00:00.000Z')
 },deleted:{}};
let posted=null,readCalls=0;
let browser;
try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true});
  await context.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.hostname==='127.0.0.1')return route.continue();
    if(url.origin!==account)return route.abort('blockedbyclient');
    const allow={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Credentials':'true',
      'Access-Control-Allow-Methods':'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers':'content-type','Content-Type':'application/json'};
    if(url.pathname==='/account')return route.fulfill({
      contentType:'text/html',
      body:'<script>setTimeout(()=>window.opener.postMessage({type:"ANIMENAMA_ACCOUNT_READY",name:"Test user"},"*"),30)</script>'
    });
    if(route.request().method()==='OPTIONS')
      return route.fulfill({status:204,headers:allow,body:''});
    if(url.pathname==='/api/library'){
      if(route.request().method()==='GET'){
        readCalls++;
        return route.fulfill({status:200,headers:allow,
          body:JSON.stringify({user:{name:'Test user'},snapshot:serverSnapshot})});
      }
      posted=route.request().postDataJSON();
      return route.fulfill({status:200,headers:allow,
        body:JSON.stringify({snapshot:posted,user:{name:'Test user'}})});
    }
    return route.abort('blockedbyclient');
  });
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/anime-nama-web/#settings');
  await page.getByText('حساب و همگام‌سازی').waitFor();
  await page.evaluate(()=>{
    localStorage.setItem('animenama:collection:v1',JSON.stringify({
      21:{anime:{mal_id:21,title:'Local show'},status:'watching',
        progress:4,favorite:true,updatedAt:'2026-10-31T00:00:00.000Z'}
    }));
  });
  await page.reload();
  await page.getByRole('button',{name:'اتصال به حساب انیمه‌نما'}).click();
  await page.getByText(/وضعیت: متصل/).waitFor({timeout:20000});
  assert.ok(readCalls>0,'remote snapshot was not fetched');
  assert.ok(posted?.collection?.['21'],'local saved item was not sent');
  assert.ok(posted?.collection?.['100'],'remote saved item not merged');
  const merged=await page.evaluate(()=>JSON.parse(localStorage.getItem('animenama:collection:v1')));
  assert.ok(merged['21']&&merged['100'],'cloud sync dropped a local or remote item');
  console.log('PASS: simulated authenticated backend merges local and remote items');
  await page.getByRole('button',{name:'قطع اتصال'}).click();
  assert.equal(await page.evaluate(()=>localStorage.getItem('animenama:cloud-enabled')),null);
  const retained=await page.evaluate(()=>JSON.parse(localStorage.getItem('animenama:collection:v1')));
  assert.ok(retained['21']&&retained['100'],'disconnect erased saved titles');
  assert.deepEqual(errors,[]);
  console.log('PASS: disconnect keeps both local and synced items');
  await context.close();
}finally{
  if(browser)await browser.close();
  await new Promise(done=>server.close(done));
}
