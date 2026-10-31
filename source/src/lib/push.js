import {ACCOUNT_ORIGIN} from './cloud.js';

export const PUSH_TOKEN_KEY='animenama:push-token';
export function pushSupported(env=globalThis){
  return Boolean(env.Notification&&env.navigator?.serviceWorker&&env.PushManager);
}
export function savedAnimeIds(collection){
  return Object.values(collection||{})
    .sort((a,b)=>Number(b.favorite)-Number(a.favorite)||b.updatedAt.localeCompare(a.updatedAt))
    .slice(0,100).map(item=>item.anime.mal_id).filter(Number.isSafeInteger);
}
export function base64Key(value){
  if(typeof value!=='string'||!value.trim())throw Error('کلید اعلان معتبر نیست.');
  const normalized=value.replace(/-/g,'+').replace(/_/g,'/');
  return Uint8Array.from(atob(normalized+'='.repeat((4-normalized.length%4)%4)),
    ch=>ch.charCodeAt(0));
}
export function deviceToken(storage,cryptoApi){
  let token=storage.getItem(PUSH_TOKEN_KEY);
  if(token&&/^[0-9a-f]{64}$/.test(token))return token;
  const bytes=cryptoApi.getRandomValues(new Uint8Array(32));
  token=Array.from(bytes,n=>n.toString(16).padStart(2,'0')).join('');
  storage.setItem(PUSH_TOKEN_KEY,token);
  return token;
}
export async function pushBackend(action,subscription,animeIds){
  if(!['subscribe','unsubscribe','test'].includes(action))
    throw Error('عملیات اعلان نامعتبر است.');
  const token=deviceToken(localStorage,crypto);
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),20000);
  try{
    const response=await fetch(ACCOUNT_ORIGIN+'/api/push',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({subscription:subscription.toJSON(),animeIds,token,action}),
      signal:controller.signal
    });
    const data=await response.json();
    if(!response.ok||!data.ok)throw Error(data.error||'سرویس اعلان پاسخ نداد.');
    return data;
  }finally{clearTimeout(timeout)}
}
export async function pushPublicKey(){
  const response=await fetch(ACCOUNT_ORIGIN+'/api/push',{signal:AbortSignal.timeout(10000)});
  const data=await response.json();
  if(!response.ok||typeof data.publicKey!=='string')throw Error('سرویس اعلان آماده نیست.');
  return base64Key(data.publicKey);
}
export async function getPushSubscription(){
  if(!pushSupported())return null;
  const registration=await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL);
  return registration?.pushManager.getSubscription()||null;
}
export async function enablePush(collection){
  if(!pushSupported())throw Error('مرورگر از اعلان پشتیبانی نمی‌کند.');
  if(Notification.permission==='denied')throw Error('اجازه اعلان در تنظیمات مرورگر مسدود است.');
  if(await Notification.requestPermission()!=='granted')throw Error('اجازه اعلان داده نشد.');
  const key=await pushPublicKey();
  // Register current deployment worker only; isolated Vite preview never overwrites the production worker.
  const registration=await navigator.serviceWorker.ready;
  let subscription=await registration.pushManager.getSubscription();
  if(!subscription)subscription=await registration.pushManager.subscribe({
    userVisibleOnly:true,applicationServerKey:key
  });
  await pushBackend('subscribe',subscription,savedAnimeIds(collection));
  return subscription;
}
export async function disablePush(collection){
  const subscription=await getPushSubscription();
  if(!subscription)return;
  await pushBackend('unsubscribe',subscription,savedAnimeIds(collection));
  await subscription.unsubscribe();
}
export async function testPush(collection){
  const sub=await getPushSubscription();
  if(!sub)throw Error('ابتدا اعلان را فعال کن.');
  return pushBackend('test',sub,savedAnimeIds(collection));
}
export async function refreshPushList(collection){
  if(!pushSupported()||Notification.permission!=='granted')return;
  const sub=await getPushSubscription();
  if(sub)await pushBackend('subscribe',sub,savedAnimeIds(collection));
}
