import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=read('index.html');
const precache=JSON.parse(read('precache.json'));
const sw=read('sw.js');
const manifest=JSON.parse(read('manifest.webmanifest'));
const snapshot=JSON.parse(read('data/home.json'));
const js=read('assets/index-optimized-v19.js');
const days=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];

test('release shell points to existing files and has one current JS bundle',()=>{
 const linked=[...html.matchAll(/(?:src|href)="(\/anime-nama-web\/(?:assets|enhancements)\/[^"]+)"/g)].map(x=>x[1].replace('/anime-nama-web/',''));
 const bundles=linked.filter(x=>x.endsWith('.js')&&x.includes('index-'));
 assert.deepEqual(bundles,['assets/index-optimized-v19.js']);
 for(const p of linked){
   assert.ok(fs.existsSync(path.join(root,p)),'missing '+p);
   assert.ok(precache.includes('./'+p),'not precached: '+p);
 }
 assert.ok(!html.includes('streaming-v16.js'),'removed blue hero must stay removed');
 assert.ok(!html.includes('streaming-v16.css'));
 assert.ok(!sw.includes("'./assets/index-optimized-v15.js'"),'SW fallback must not point to an older bundle');
 assert.ok(sw.includes("'./assets/index-optimized-v19.js'"));
 assert.ok(sw.includes("'./data/home.json'"),'offline homepage snapshot should be precached');
});

test('public snapshot is complete, coherent and bounded',()=>{
 assert.equal(snapshot.version,1);
 const generated=Date.parse(snapshot.generatedAt);
 assert.ok(Number.isFinite(generated));
 assert.ok(Date.now()-generated<14*86400_000,'public data older than 14 days');
 assert.ok(Array.isArray(snapshot.airing)&&snapshot.airing.length>0);
 assert.deepEqual(Object.keys(snapshot.schedules).sort(),[...days].sort());
 const valid=list=>list.every(x=>Number.isSafeInteger(x.mal_id)&&x.mal_id>0&&typeof x.title==='string'&&x.title.length>0);
 assert.ok(valid(snapshot.airing));
 for(const day of days){
   assert.ok(Array.isArray(snapshot.schedules[day]),'missing '+day);
   assert.ok(valid(snapshot.schedules[day]),'invalid '+day);
 }
 assert.ok(days.filter(x=>snapshot.schedules[x].length>0).length>=5,'too many missing schedule days');
 assert.ok(Buffer.byteLength(JSON.stringify(snapshot))<800_000,'public payload too large');
});

test('personal data remains local/private and is not included in precache',()=>{
 assert.equal(manifest.scope,'/anime-nama-web/');
 assert.equal(manifest.start_url,'/anime-nama-web/#home');
 assert.match(sw,/api\|account\|mcp\|signin-with-chatgpt/);
 assert.ok(!precache.some(x=>/api|account|library|credentials/i.test(x)));
 assert.ok(js.includes('animenama:collection:v1'),'personal list persistence key missing');
 assert.ok(js.includes('animenama:deleted:v1'),'deletion tombstones missing');
 assert.ok(js.includes('animenama-backup-'),'backup export support missing');
});

test('public snapshot service worker is network-first with offline cache',async()=>{
 const listeners=new Map();
 const stored=new Map();
 const cache={
  async put(req,res){stored.set(req.url||String(req),res.clone())},
  async match(req){const value=stored.get(req.url||String(req));return value?.clone()||undefined},
  async keys(){return [...stored.keys()].map(x=>new Request(x))},
  async delete(req){return stored.delete(req.url||String(req))}
 };
 let online=true,requests=0;
 const fetchMock=async request=>{
   requests++;
   if(!online)throw Error('offline');
   return new Response(JSON.stringify({version:1,airing:[{mal_id:1,title:'Test'}],schedules:{}}),{
    headers:{'Content-Type':'application/json'}
   });
 };
 const scope={
  self:{
    location:{href:'https://example.com/anime-nama-web/sw.js'},
    addEventListener:(name,fn)=>listeners.set(name,fn)
  },
  URL,Request,Response,AbortSignal,fetch:fetchMock,
  caches:{open:async()=>cache,keys:async()=>[]},
  Promise,console
 };
 vm.runInNewContext(sw,scope,{filename:'sw.js'});
 const handler=listeners.get('fetch');
 async function run(url){
   let promise;
   handler({request:new Request(url),respondWith:x=>{promise=x}});
   return promise ? await promise : null;
 }
 const route='https://example.com/anime-nama-web/data/home.json';
 const first=await run(route);
 assert.ok(first);
 assert.equal((await first.json()).airing[0].title,'Test');
 online=false;
 const second=await run(route);
 assert.ok(second);
 assert.equal((await second.json()).airing[0].title,'Test');
 assert.equal(requests,2);
 assert.equal(await run('https://example.com/anime-nama-web/api/library'),null);
 assert.equal(await run('https://other.example/data/home.json'),null);
});

test('theme-only PWA upgrade retains bundled poster cache',async()=>{
 const handlers=new Map();
 const deleted=[];
 const cacheNames=['animenama-v23-posters','animenama-v23-shell',
   'animenama-v22-posters','animenama-v24-shell','animenama-v25-shell'];
 const scope={
  self:{
   location:{href:'https://example.com/anime-nama-web/sw.js'},
   addEventListener:(name,fn)=>handlers.set(name,fn),
   clients:{claim:async()=>{}}
  },
  URL,Request,Response,AbortSignal,
  caches:{
   keys:async()=>cacheNames,
   delete:async name=>{deleted.push(name);return true}
  },
  Promise,console
 };
 vm.runInNewContext(sw,scope,{filename:'sw.js'});
 let run;
 handlers.get('activate')({waitUntil:promise=>{run=promise}});
 await run;
 assert.ok(deleted.includes('animenama-v23-shell'));
 assert.ok(deleted.includes('animenama-v22-posters'));
 assert.ok(!deleted.includes('animenama-v23-posters'),
   'Keep already downloaded poster bundles between theme/UI upgrades');
 assert.ok(deleted.includes('animenama-v24-shell'));
 assert.ok(!deleted.includes('animenama-v25-shell'));
});
