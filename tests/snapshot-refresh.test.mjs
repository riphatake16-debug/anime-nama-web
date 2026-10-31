import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const source=await fs.readFile(path.join(root,'scripts/update-home-data.mjs'),'utf8');
const initial={
 version:1,generatedAt:'2026-10-30T12:00:00.000Z',source:'earlier verified feed',
 airing:[{mal_id:21,title:'Already cached'}],
 schedules:{sunday:[{mal_id:21,title:'Cached Sunday'}]}
};
async function fixture(loader){
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'anime-snapshot-'));
 const script=path.join(dir,'scripts','update-home-data.mjs');
 await fs.mkdir(path.dirname(script),{recursive:true});
 await fs.mkdir(path.join(dir,'data'),{recursive:true});
 // Tests skip intentional API rate limiting, but execute the real production refresh logic.
 const testSource=source.replace('const pause = ms => new Promise(resolve => setTimeout(resolve, ms));','const pause = async () => {};');
 assert.notEqual(testSource,source);
 await fs.writeFile(script,testSource);
 await fs.writeFile(path.join(dir,'data','home.json'),JSON.stringify(initial));
 const mocked=path.join(dir,'mock.mjs');
 await fs.writeFile(mocked,loader);
 return {dir,script,mocked};
}
test('total provider outage never overwrites a valid snapshot or freshness time',async()=>{
 const f=await fixture("globalThis.fetch=async()=>{throw Error('offline')};");
 try{
  const file=path.join(f.dir,'data','home.json');
  const before=await fs.readFile(file,'utf8');
  const result=spawnSync(process.execPath,['--import',f.mocked,f.script],{
   cwd:f.dir,encoding:'utf8',timeout:10000
  });
  assert.equal(result.status,0,result.stderr);
  assert.match(result.stderr,/retaining previously verified snapshot/);
  assert.equal(await fs.readFile(file,'utf8'),before);
 }finally{await fs.rm(f.dir,{recursive:true,force:true})}
});
test('partial successful provider refresh updates fresh data and preserves cached days',async()=>{
 const loader=[
  "globalThis.fetch=async url=>{",
  "if(String(url).includes('/anime?')) return new Response(JSON.stringify({data:[{mal_id:25,title:'Fresh anime'}]}),{status:200});",
  "throw Error('schedule provider offline');",
  "};"
 ].join('\n');
 const f=await fixture(loader);
 try{
  const result=spawnSync(process.execPath,['--import',f.mocked,f.script],{
   cwd:f.dir,encoding:'utf8',timeout:10000
  });
  assert.equal(result.status,0,result.stderr);
  const next=JSON.parse(await fs.readFile(path.join(f.dir,'data','home.json'),'utf8'));
  assert.equal(next.airing[0].title,'Fresh anime');
  assert.equal(next.schedules.sunday[0].title,'Cached Sunday');
  assert.ok(Date.parse(next.generatedAt)>Date.parse(initial.generatedAt));
 }finally{await fs.rm(f.dir,{recursive:true,force:true})}
});
