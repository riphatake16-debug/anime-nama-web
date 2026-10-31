const SOURCES=[
  {name:'Tenrai',base:'https://api.tenrai.org/v1/'},
  {name:'Jikan',base:'https://api.jikan.moe/v4/'}
];
const base=import.meta.env?.BASE_URL||'/anime-nama-web/';
const memory=new Map();
const DAY_NAMES=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
export const days=DAY_NAMES;

export const PERSIAN_ALIASES={
  'ناروتو':'Naruto','وان پیس':'One Piece','وان‌پیس':'One Piece',
  'فریرن':'Frieren','حمله به تایتان':'Shingeki no Kyojin',
  'اتک آن تایتان':'Shingeki no Kyojin','شیطان کش':'Kimetsu no Yaiba',
  'دیمون اسلیر':'Kimetsu no Yaiba','سولو لولینگ':'Solo Leveling',
  'جوجوتسو کایسن':'Jujutsu Kaisen','دندادان':'Dandadan',
  'دفترچه مرگ':'Death Note','بلیچ':'Bleach',
  'وان پانچ من':'One Punch Man','چینساو من':'Chainsaw Man',
  'توکیو غول':'Tokyo Ghoul','دراگون بال':'Dragon Ball'
};
export const normalizeSearch=query=>PERSIAN_ALIASES[query?.trim()]||query;
export const titleOf=anime=>
  anime?.title_english||anime?.title||anime?.title_japanese||'بدون عنوان';
export const posterOf=anime=>
  anime?.images?.webp?.large_image_url||
  anime?.images?.jpg?.large_image_url||
  anime?.images?.webp?.image_url||
  anime?.images?.jpg?.image_url||null;

async function jsonFetch(url,timeout=7000){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeout);
  try{
    const response=await fetch(url,{signal:controller.signal,cache:'no-store'});
    if(!response.ok)throw Error('HTTP '+response.status);
    return await response.json();
  }finally{clearTimeout(timer)}
}

export function isAnime(x){
  return x&&Number.isSafeInteger(x.mal_id)&&x.mal_id>0&&
    typeof x.title==='string';
}
export function validList(list){
  return Array.isArray(list)&&list.every(isAnime);
}
export async function readPublicHome(){
  const url=base+'data/home.json';
  const data=await jsonFetch(url,4500);
  if(data?.version!==1||!validList(data.airing)||!data.schedules||
     typeof data.schedules!=='object'||Array.isArray(data.schedules))
    throw Error('اطلاعات صفحه اصلی معتبر نیست.');
  return data;
}
export async function browseAnime(params={},signal){
  const options={
    page:params.page??1,
    limit:params.limit??18,
    sfw:'true',
    order_by:params.order_by??'members',
    sort:params.sort??'desc'
  };
  for(const key of ['q','status','genres','type','start_date'])
    if(params[key])options[key]=params[key];
  if(options.q)options.q=normalizeSearch(options.q);
  const query=new URLSearchParams(options);
  const key=query.toString();
  if(memory.has(key)&&Date.now()-memory.get(key).at<120000)
    return memory.get(key).body;
  let error;
  for(const source of SOURCES){
    if(signal?.aborted)throw Error('درخواست لغو شد.');
    const controller=new AbortController();
    const onAbort=()=>controller.abort();
    signal?.addEventListener('abort',onAbort,{once:true});
    const timer=setTimeout(()=>controller.abort(),6500);
    try{
      const response=await fetch(source.base+'anime?'+query,{
        signal:controller.signal,headers:{Accept:'application/json'}
      });
      if(!response.ok)throw Error('HTTP '+response.status);
      const body=await response.json();
      if(!validList(body?.data))throw Error('ساختار پاسخ نامعتبر است.');
      memory.set(key,{at:Date.now(),body});
      if(memory.size>30)memory.delete(memory.keys().next().value);
      return body;
    }catch(e){error=e}
    finally{clearTimeout(timer);signal?.removeEventListener('abort',onAbort)}
  }
  throw Error('دریافت آرشیو ممکن نشد. اتصال اینترنت را بررسی کن. '+(error?.message||''));
}
export async function getAnimeDetail(id){
  if(!Number.isSafeInteger(Number(id))||Number(id)<1)throw Error('شناسه انیمه نامعتبر است.');
  let error;
  for(const source of SOURCES){
    try{
      const body=await jsonFetch(source.base+'anime/'+Number(id)+'/full',6500);
      if(isAnime(body?.data))return body.data;
    }catch(e){error=e}
  }
  throw error||Error('جزئیات در دسترس نیست.');
}
export function todayInTehran(){
  const format=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Tehran',weekday:'long'});
  return format.format(new Date()).toLowerCase();
}
export function scheduleForDay(snapshot,day){
  return Array.isArray(snapshot?.schedules?.[day])?snapshot.schedules[day]:[];
}
export function toTehranTime(time){
  if(!/^\d\d:\d\d$/.test(time||''))return 'زمان نامشخص';
  const [h,m]=time.split(':').map(Number);
  if(h>23||m>59)return 'زمان نامشخص';
  const date=new Date(Date.UTC(2026,0,10,h-9,m));
  return new Intl.DateTimeFormat('fa-IR',{timeZone:'Asia/Tehran',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(date);
}

export function tehranSchedule(snapshot,day){
  const index=days.indexOf(day);
  if(index<0)return [];
  // Japan time is 5h30 ahead of Iran. Japanese 00:00-05:29 belongs
  // to the previous Tehran day; the rest stays on the same day.
  const next=days[(index+1)%days.length];
  const minuteOf=anime=>{
    const value=anime?.broadcast?.time;
    if(!/^\d\d:\d\d$/.test(value||''))return null;
    const [h,m]=value.split(':').map(Number);
    return h<24&&m<60?h*60+m:null;
  };
  const same=scheduleForDay(snapshot,day).filter(x=>{
    const minutes=minuteOf(x);
    return minutes===null||minutes>=330;
  });
  const fromNext=scheduleForDay(snapshot,next).filter(x=>{
    const minutes=minuteOf(x);
    return minutes!==null&&minutes<330;
  });
  const combined=[...same,...fromNext];
  const seen=new Set();
  return combined.filter(x=>{
    if(seen.has(x.mal_id))return false;
    seen.add(x.mal_id);return true;
  }).sort((a,b)=>{
    const time=a=>minuteOf(a)===null?9999:(minuteOf(a)+1110)%1440;
    return time(a)-time(b);
  });
}
