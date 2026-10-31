import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyCloudResponse,combineCloudData,ACCOUNT_ORIGIN} from '../src/lib/cloud.js';
import {continuationReport,sequelEntries,safeLink,personalContinuations,
  formatAirDate,statusLabel,fromReportItem} from '../src/lib/continuations.js';
import {savedAnimeIds,base64Key,deviceToken,pushSupported} from '../src/lib/push.js';

const anime={mal_id:21,title:'One Piece'};
const record=(id,stamp='2026-01-01T00:00:00.000Z')=>({
 anime:{mal_id:id,title:'Anime '+id},status:'watching',progress:3,
 favorite:false,updatedAt:stamp
});
test('cloud sync verifies snapshots and retains newer local changes',()=>{
 assert.equal(ACCOUNT_ORIGIN,'https://anime-nama-watch.riphatake2020.chatgpt.site');
 assert.throws(()=>verifyCloudResponse({snapshot:{collection:[{evil:1}],deleted:{}}}));
 assert.throws(()=>verifyCloudResponse({snapshot:{collection:{21:{anime}},deleted:{}}}));
 const local={collection:{21:record(21,'2026-05-01T00:00:00.000Z')},deleted:{}};
 const server={snapshot:{collection:{21:record(21,'2026-04-01T00:00:00.000Z'),
   22:record(22)},deleted:{}}};
 const merged=combineCloudData(local,server);
 assert.equal(merged.collection[21].updatedAt,'2026-05-01T00:00:00.000Z');
 assert.ok(merged.collection[22]);
});
test('Sequel chain bounded with cycle detection and partial failure flag',async()=>{
 const inputs={
  1:{mal_id:1,title:'First',relations:[{relation:'Sequel',
    entry:[{mal_id:2,type:'anime',name:'Second'}]}]},
  2:{mal_id:2,title:'Second',status:'Currently Airing',relations:[{relation:'Sequel',
    entry:[{mal_id:1,type:'anime'},{mal_id:3,type:'anime',name:'Third'}]}]},
  3:{mal_id:3,title:'Third',status:'Not yet aired'}
 };
 const count=[];
 const fetchDetail=async id=>{count.push(id);return inputs[id]};
 const result=await continuationReport(1,{fetchDetail,refresh:true});
 assert.deepEqual(count,[1,2,3]);
 assert.equal(result.complete,true);
 assert.deepEqual(result.sequels.map(x=>x.id),[2,3]);
 assert.equal(result.sequels[1].status,'Not yet aired');
 assert.ok(fromReportItem(result.sequels[0]).mal_id===2);
 const partial=await continuationReport(1,{refresh:true,fetchDetail:async id=>{
   if(id===3)throw Error('HTTP429');return inputs[id];
 }});
 assert.equal(partial.complete,false);
 assert.equal(partial.unresolved[0].id,3);
 assert.equal(statusLabel(partial.sequels[0].status),'در حال پخش');
 assert.ok(formatAirDate('2026-12-01T00:00:00Z'));
});
test('sequel relations never include non-anime or unconfirmed entries',()=>{
 assert.deepEqual(sequelEntries({
 relations:[{relation:'Prequel',entry:[{mal_id:1,type:'anime'}]},
 {relation:'Sequel',entry:[{mal_id:2,type:'manga'}, {mal_id:3,type:'anime'}]}]
 }).map(x=>x.mal_id),[3]);
 assert.equal(safeLink('javascript:alert(1)'),null);
 assert.equal(safeLink('/relative/url'),null);
 assert.equal(safeLink('https://myanimelist.net/anime/21'),'https://myanimelist.net/anime/21');
});
test('push matching uses existing token key and favorite-aware finite list',()=>{
 const entries={
  21:{...record(21),favorite:true},
  22:{...record(22),favorite:false}
 };
 assert.deepEqual(savedAnimeIds(entries),[21,22]);
 const storage={
  state:new Map(),
  getItem(k){return this.state.get(k)||null},
  setItem(k,v){this.state.set(k,v)}
 };
 const token=deviceToken(storage,{getRandomValues:arr=>arr.fill(42)});
 assert.equal(token.length,64);
 assert.equal(deviceToken(storage,{getRandomValues(){throw Error('should not regen')}}),token);
 assert.equal(pushSupported({Notification:undefined,navigator:{}}),false);
 assert.deepEqual([...base64Key('AQID')],[1,2,3]);
});
