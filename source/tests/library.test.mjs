import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readSnapshot,toggleSaved,changeEntry,backupSnapshot,importBackup,
  mergeSnapshots,COLLECTION_KEY,DELETED_KEY
} from '../src/lib/library.js';

function storage(seed={}){
  const data=new Map(Object.entries(seed));
  return {
    getItem:key=>data.has(key)?data.get(key):null,
    setItem:(key,value)=>data.set(key,value),
    removeItem:key=>data.delete(key),
    entries:()=>Object.fromEntries(data)
  };
}
const anime={mal_id:21,title:'One Piece',episodes:1000};
test('legacy list format stays intact while adding and changing progress',()=>{
  const store=storage();
  let snapshot=toggleSaved(store,anime);
  assert.deepEqual(Object.keys(snapshot.collection),['21']);
  assert.equal(snapshot.collection[21].status,'planned');
  assert.equal(snapshot.collection[21].progress,0);
  snapshot=changeEntry(store,'21',{progress:25,status:'watching'});
  assert.equal(snapshot.collection[21].progress,25);
  assert.equal(snapshot.collection[21].status,'watching');
  assert.deepEqual(readSnapshot(store),snapshot);
});
test('removing saved items creates compatible tombstones',()=>{
  const store=storage();
  toggleSaved(store,anime);
  const next=toggleSaved(store,anime);
  assert.equal(next.collection[21],undefined);
  assert.ok(Number.isFinite(Date.parse(next.deleted[21])));
  assert.ok(store.getItem(DELETED_KEY));
});
test('v1 backup exports existing entries and import merges without dropping current list',()=>{
  const store=storage();
  toggleSaved(store,anime);
  const backup=backupSnapshot(store);
  assert.equal(backup.version,1);
  const other=storage();
  toggleSaved(other,{mal_id:5114,title:'Fullmetal Alchemist: Brotherhood'});
  importBackup(other,backup);
  const next=readSnapshot(other);
  assert.equal(next.collection[21].anime.title,'One Piece');
  assert.equal(next.collection[5114].anime.mal_id,5114);
});
test('malformed and stale data cannot be silently overwritten',()=>{
  const broken=storage({[COLLECTION_KEY]:'{invalid json'});
  assert.throws(()=>toggleSaved(broken,anime));
  assert.equal(broken.getItem(COLLECTION_KEY),'{invalid json');
  const store=storage();
  toggleSaved(store,anime);
  assert.throws(()=>importBackup(store,{version:1,collection:[]}));
  assert.ok(readSnapshot(store).collection[21]);
});
test('newer tombstones prevent accidental restore by old backups',()=>{
  const old={collection:{'21':{anime,status:'watching',progress:3,favorite:false,updatedAt:'2025-01-01T00:00:00.000Z'}},deleted:{}};
  const deleted={collection:{},deleted:{'21':'2026-01-01T00:00:00.000Z'}};
  const merged=mergeSnapshots(deleted,old);
  assert.equal(merged.collection[21],undefined);
});
