import {getAnimeDetail,browseAnime,titleOf,posterOf} from './api.js';
import {ACCOUNT_ORIGIN} from './cloud.js';

const DAY=6*3600*1000;
export const safeLink=input=>{
  try{const url=new URL(input);return url.protocol==='https:'?url.href:null}
  catch{return null}
};
const memory=new Map();
export function sequelEntries(anime){
  return (anime?.relations||[]).filter(x=>x.relation?.toLowerCase()==='sequel')
    .flatMap(x=>x.entry||[]).filter(x=>x.type?.toLowerCase()==='anime'&&Number.isSafeInteger(x.mal_id)&&x.mal_id>0);
}
function item(anime,depth){
  return {id:anime.mal_id,name:titleOf(anime),originalName:anime.title,
    image:posterOf(anime),status:anime.status||'',depth,
    url:'https://myanimelist.net/anime/'+anime.mal_id,
    dateRaw:anime.aired?.from||null,episodes:anime.episodes||null};
}
export async function continuationReport(id,{fetchDetail=getAnimeDetail,max=7,refresh=false}={}){
  const malId=Number(id);
  if(!Number.isSafeInteger(malId)||malId<1)throw Error('شناسه نامعتبر است.');
  const cached=memory.get(malId);
  if(!refresh&&cached&&Date.now()-cached.at<DAY)return cached.value;
  let root=await fetchDetail(malId);
  const visited=new Set([malId]),unresolved=[],sequels=[],queue=sequelEntries(root).map(x=>({...x,depth:1}));
  while(queue.length&&sequels.length+unresolved.length<max){
    const current=queue.shift();
    if(visited.has(current.mal_id))continue;
    visited.add(current.mal_id);
    try{
      const next=await fetchDetail(current.mal_id);
      sequels.push(item(next,current.depth));
      for(const child of sequelEntries(next))
        if(!visited.has(child.mal_id))queue.push({...child,depth:current.depth+1});
    }catch{
      unresolved.push({id:current.mal_id,name:current.name,
        url:'https://myanimelist.net/anime/'+current.mal_id});
    }
  }
  for(const q of queue)
    if(!visited.has(q.mal_id)&&!unresolved.some(x=>x.id===q.mal_id))
      unresolved.push({id:q.mal_id,name:q.name,url:'https://myanimelist.net/anime/'+q.mal_id});
  const result={anime:item(root,0),sequels,unresolved,complete:unresolved.length===0,
    checkedAt:new Date().toISOString()};
  memory.set(malId,{value:result,at:Date.now()});
  return result;
}
export async function personalContinuations(collection,{limit=6,fetchDetail=getAnimeDetail}={}){
  const ids=Object.values(collection||{})
    .sort((a,b)=>(a.status==='completed'?0:a.status==='watching'?1:2)
      -(b.status==='completed'?0:b.status==='watching'?1:2))
    .slice(0,limit).map(entry=>entry.anime.mal_id);
  const reports=[];
  for(const id of ids) {
    try{reports.push(await continuationReport(id,{fetchDetail}))}
    catch(reportsError){reports.push({anime:{id},sequels:[],unresolved:[{id}],
      complete:false,error:reportsError.message})}
  }
  return reports;
}
export async function fetchAnimeNews(id){
  const malId=Number(id);
  if(!Number.isSafeInteger(malId)||malId<1)throw Error('شناسه انیمه معتبر نیست.');
  const url='https://api.jikan.moe/v4/anime/'+malId+'/news?page=1';
  const r=await fetch(url,{signal:AbortSignal.timeout(8000)});
  if(!r.ok)throw Error('منبع اخبار در دسترس نیست.');
  const data=(await r.json()).data;
  if(!Array.isArray(data))throw Error('پاسخ اخبار معتبر نیست.');
  return data.filter(x=>safeLink(x.url)&&typeof x.title==='string')
    .slice(0,6).map(x=>({
      id:x.mal_id,title:x.title,url:safeLink(x.url),date:x.date,
      author:x.author_username||null,
      source:'MyAnimeList news'
    }));
}
export async function fetchOfficialUpdates(){
  const r=await fetch(ACCOUNT_ORIGIN+'/api/updates',{signal:AbortSignal.timeout(9000)});
  if(!r.ok)throw Error('دریافت اطلاعیه‌های رسمی ممکن نشد.');
  const payload=await r.json();
  if(!Array.isArray(payload.data))throw Error('پاسخ اطلاعیه معتبر نیست.');
  return {
    updates:payload.data.filter(x=>safeLink(x.url)&&typeof x.title==='string')
      .map(x=>({...x,url:safeLink(x.url)})),
    checkedAt:payload.lastCheck?.checkedAt||null,failed:Boolean(payload.lastCheck?.failed)
  };
}
export function statusLabel(status){
  return status==='Not yet aired'?'هنوز پخش نشده':status==='Currently Airing'?'در حال پخش':
    status==='Finished Airing'?'پخش تمام شده':'وضعیت نامشخص';
}
export function fromReportItem(item){
  return {mal_id:item.id,title:item.originalName||item.name,title_english:item.name,
    images:{jpg:{large_image_url:item.image}},status:item.status,episodes:item.episodes,url:item.url};
}
export function formatAirDate(raw){
  if(!raw||!Number.isFinite(Date.parse(raw)))return 'تاریخ نامشخص';
  return new Intl.DateTimeFormat('fa-IR',{timeZone:'Asia/Tehran',dateStyle:'medium'})
    .format(new Date(raw));
}
