// Compatible with the current deployed AnimeNama localStorage schema.
// Do not clear or migrate user data automatically. Invalid data blocks writes.
export const COLLECTION_KEY='animenama:collection:v1';
export const DELETED_KEY='animenama:deleted:v1';
export const STATUS={planned:'می‌خواهم ببینم',watching:'در حال تماشا',completed:'دیده‌ام',paused:'فعلاً متوقف'};
const plain=x=>x!==null && typeof x==='object' && !Array.isArray(x);
const validDate=x=>typeof x==='string' && Number.isFinite(Date.parse(x));

export function validRecord(id,record){
  return plain(record) && plain(record.anime) &&
    Number.isSafeInteger(record.anime.mal_id) &&
    record.anime.mal_id>0 && record.anime.mal_id<10_000_000 &&
    String(record.anime.mal_id)===id &&
    typeof record.anime.title==='string' && record.anime.title.length<500 &&
    Object.hasOwn(STATUS,record.status) &&
    Number.isSafeInteger(record.progress) && record.progress>=0 && record.progress<=100000 &&
    typeof record.favorite==='boolean' && validDate(record.updatedAt) &&
    JSON.stringify(record).length<=100000;
}
function collectionShape(obj){
  if(!plain(obj)||Object.keys(obj).length>3000)throw Error('فهرست معتبر نیست؛ چیزی بازنویسی نشد.');
  for(const [id,entry] of Object.entries(obj))
    if(!validRecord(id,entry))throw Error('رکورد قدیمی نامعتبر است؛ اطلاعات دست‌نخورده ماند.');
  return obj;
}
function tombstoneShape(obj){
  if(!plain(obj)||Object.keys(obj).length>10000)throw Error('سوابق حذف معتبر نیست.');
  for(const [id,date] of Object.entries(obj))
    if(!/^[1-9]\d{0,7}$/.test(id)||!validDate(date))
      throw Error('سوابق حذف معتبر نیست.');
  return obj;
}
const parse=(storage,key)=> {
  const raw=storage.getItem(key);
  if(raw===null)return {};
  try{return JSON.parse(raw)}catch{throw Error('فایل ذخیره‌شده خوانده نشد؛ هیچ تغییری اعمال نشد.')}
};
export function readSnapshot(storage){
  return {
    collection:collectionShape(parse(storage,COLLECTION_KEY)),
    deleted:tombstoneShape(parse(storage,DELETED_KEY))
  };
}
export function mergeSnapshots(left,right){
  const a={collection:{...left.collection},deleted:{...left.deleted}};
  const b={collection:collectionShape(right.collection),deleted:tombstoneShape(right.deleted??{})};
  for(const [id,entry] of Object.entries(b.collection))
    if(!a.collection[id]||Date.parse(entry.updatedAt)>Date.parse(a.collection[id].updatedAt))
      a.collection[id]=entry;
  for(const [id,date] of Object.entries(b.deleted))
    if(!a.deleted[id]||Date.parse(date)>Date.parse(a.deleted[id]))a.deleted[id]=date;
  for(const [id,date] of Object.entries(a.deleted))
    if(a.collection[id]&&Date.parse(date)>=Date.parse(a.collection[id].updatedAt))
      delete a.collection[id];
  return a;
}
export function writeSnapshot(storage,previous,next){
  // Optimistic lock prevents accidental overwrite of another tab/legacy app.
  const previousCollection=storage.getItem(COLLECTION_KEY);
  const previousDeleted=storage.getItem(DELETED_KEY);
  if(JSON.stringify(readSnapshot(storage))!==JSON.stringify(previous))
    throw Error('فهرست در تب دیگری تغییر کرده؛ دوباره بارگذاری کن.');
  const validated={
    collection:collectionShape(next.collection),
    deleted:tombstoneShape(next.deleted)
  };
  let wrote=false;
  try{
    storage.setItem(COLLECTION_KEY,JSON.stringify(validated.collection));wrote=true;
    storage.setItem(DELETED_KEY,JSON.stringify(validated.deleted));
  }catch(e){
    if(wrote){
      try{
        if(previousCollection===null)storage.removeItem(COLLECTION_KEY);
        else storage.setItem(COLLECTION_KEY,previousCollection);
        if(previousDeleted===null)storage.removeItem(DELETED_KEY);
        else storage.setItem(DELETED_KEY,previousDeleted);
      }catch{/* report and preserve as much as possible */}
    }
    throw Error('ذخیره انجام نشد؛ فهرست قبلی را پاک نکن.');
  }
  return validated;
}
export function toggleSaved(storage,anime){
  if(!Number.isSafeInteger(anime?.mal_id)||anime.mal_id<=0||typeof anime.title!=='string')
    throw Error('اطلاعات انیمه ناقص است.');
  const id=String(anime.mal_id),current=readSnapshot(storage);
  const next={collection:{...current.collection},deleted:{...current.deleted}};
  const stamp=new Date().toISOString();
  if(next.collection[id]){
    delete next.collection[id];
    next.deleted[id]=stamp;
  }else{
    next.collection[id]={anime,status:'planned',progress:0,favorite:false,updatedAt:stamp};
    delete next.deleted[id];
  }
  return writeSnapshot(storage,current,next);
}
export function changeEntry(storage,id,patch){
  const current=readSnapshot(storage);
  if(!current.collection[id])throw Error('این انیمه در فهرست موجود نیست.');
  const previous=current.collection[id];
  const next={
    collection:{...current.collection,[id]:{
      ...previous,
      status:patch.status??previous.status,
      progress:patch.progress??previous.progress,
      favorite:patch.favorite??previous.favorite,
      updatedAt:new Date().toISOString()
    }},
    deleted:{...current.deleted}
  };
  return writeSnapshot(storage,current,next);
}
export function backupSnapshot(storage){
  const snapshot=readSnapshot(storage);
  return {version:1,exportedAt:new Date().toISOString(),collection:snapshot.collection};
}
export function importBackup(storage,data){
  if(!plain(data)||data.version!==1||!plain(data.collection))throw Error('فرمت پشتیبان معتبر نیست.');
  const incoming={collection:collectionShape(data.collection),deleted:{}};
  const current=readSnapshot(storage);
  return writeSnapshot(storage,current,mergeSnapshots(current,incoming));
}
