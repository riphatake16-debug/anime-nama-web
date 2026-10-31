import {useCallback,useEffect,useRef,useState} from 'react';
import {mergeSnapshots,readSnapshot,writeSnapshot} from './library.js';

// Exactly the existing AnimeNama backend. Never send account data to GitHub Pages.
export const ACCOUNT_ORIGIN='https://anime-nama-watch.riphatake2020.chatgpt.site';
const ENABLED_KEY='animenama:cloud-enabled';

export function verifyCloudResponse(value){
  if(!value||typeof value!=='object'||!value.snapshot||typeof value.snapshot!=='object')
    throw Error('پاسخ حساب معتبر نیست؛ فهرست محلی دست‌نخورده ماند.');
  const incoming=value.snapshot;
  // Reuse the existing strict local schema validation without writing it to storage.
  return mergeSnapshots({collection:{},deleted:{}},incoming);
}
export function combineCloudData(local,server){
  return mergeSnapshots(local,verifyCloudResponse(server));
}
async function backendRequest(action,snapshot,signal){
  const response=await fetch(ACCOUNT_ORIGIN+'/api/library',{
    method:action==='merge'?'POST':'GET',
    credentials:'include',
    headers:action==='merge'?{'Content-Type':'application/json'}:{Accept:'application/json'},
    body:action==='merge'?JSON.stringify(snapshot):undefined,
    signal
  });
  const value=await response.json();
  if(!response.ok)throw Error(value?.error||'ورود به حساب لازم است.');
  return value;
}
export function useCloudSync({library,onApply}){
  const [state,setState]=useState('guest');
  const [error,setError]=useState('');
  const [name,setName]=useState('');
  const [lastSync,setLastSync]=useState('');
  const popup=useRef(null);
  const usingPopup=useRef(false);
  const active=useRef(false);
  const syncing=useRef(false);
  const connecting=useRef(false);
  const pending=useRef(new Map());
  const revision=useRef(0);
  const libraryRef=useRef(library);
  const onApplyRef=useRef(onApply);
  const syncRef=useRef(null);
  libraryRef.current=library;
  onApplyRef.current=onApply;
  const request=useCallback(async(action,snapshot)=>{
    if(usingPopup.current){
      if(!popup.current||popup.current.closed)throw Error('پنجره حساب بسته شده است.');
      const id=crypto.randomUUID();
      return await new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>{
          pending.current.delete(id);
          reject(Error('پاسخ حساب دریافت نشد؛ دوباره امتحان کن.'));
        },20000);
        pending.current.set(id,{resolve,reject,timer});
        popup.current.postMessage({
          type:'ANIMENAMA_ACCOUNT_REQUEST',id,action,snapshot
        },ACCOUNT_ORIGIN);
      });
    }
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),20000);
    try{return await backendRequest(action,snapshot,controller.signal)}
    finally{clearTimeout(timer)}
  },[]);
  const synchronize=useCallback(async()=>{
    if(!active.current||syncing.current||!libraryRef.current)return;
    syncing.current=true;
    const seq=revision.current;
    setState('syncing');setError('');
    try{
      const current=readSnapshot(localStorage);
      const remote=await request('read');
      const combined=combineCloudData(current,remote);
      const answer=await request('merge',combined);
      if(!active.current||revision.current!==seq)return;
      const latest=readSnapshot(localStorage);
      const merged=mergeSnapshots(mergeSnapshots(combined,verifyCloudResponse(answer)),latest);
      if(!active.current||revision.current!==seq)return;
      const applied=writeSnapshot(localStorage,latest,merged);
      onApplyRef.current(applied);
      if(remote.user?.name)setName(String(remote.user.name).slice(0,100));
      setLastSync(new Date().toISOString());
      setState('connected');
      localStorage.setItem(ENABLED_KEY,'true');
    }catch(e){
      if(revision.current===seq){setState('error');setError(e.message||'همگام‌سازی انجام نشد.')}
    }finally{syncing.current=false}
  },[request]);
  syncRef.current=synchronize;
  useEffect(()=>{
    function handle(event){
      if(event.origin!==ACCOUNT_ORIGIN||event.source!==popup.current||!event.data)return;
      const data=event.data;
      if(data.type==='ANIMENAMA_ACCOUNT_RESULT'){
        const entry=pending.current.get(data.id);
        if(!entry)return;
        clearTimeout(entry.timer);
        pending.current.delete(data.id);
        if(data.error)entry.reject(Error(data.error));
        else entry.resolve(data.body);
      }
      if(data.type==='ANIMENAMA_ACCOUNT_READY'&&!active.current&&!connecting.current){
        connecting.current=true;
        setName(typeof data.name==='string'?data.name.slice(0,100):'دوست انیمه‌نما');
        const finalize=async()=>{
          try{
            usingPopup.current=false;
            await request('read'); // Prefer backend's authenticated session.
            popup.current?.close();
          }catch{
            usingPopup.current=true; // Cross-site cookies blocked: use authenticated popup bridge.
          }
          active.current=true;connecting.current=false;
          syncRef.current?.();
        };
        void finalize();
      }
    }
    window.addEventListener('message',handle);
    return ()=>{
      window.removeEventListener('message',handle);
      for(const item of pending.current.values()){
        clearTimeout(item.timer);
        item.reject(Error('درخواست لغو شد.'));
      }
      pending.current.clear();
    };
  },[request]);
  useEffect(()=>{
    if(localStorage.getItem(ENABLED_KEY)==='true'&&libraryRef.current){
      request('read').then(()=>{
        active.current=true;
        syncRef.current?.();
      }).catch(()=>{/* user may have signed out; never overwrite the local list */});
    }
    const timer=setInterval(()=>{
      if(document.visibilityState==='visible'&&active.current)syncRef.current?.();
    },45000);
    const online=()=>{if(active.current)syncRef.current?.()};
    window.addEventListener('online',online);
    return()=>{clearInterval(timer);window.removeEventListener('online',online)};
  },[request]);
  useEffect(()=>{
    if(!active.current||!library)return;
    const timer=setTimeout(()=>syncRef.current?.(),1400);
    return()=>clearTimeout(timer);
  },[library]);
  useEffect(()=>{
    if(state!=='connecting')return;
    let alive=true;
    const tick=setInterval(()=>{
      if(active.current||connecting.current)return;
      request('read').then(()=>{
        if(!alive)return;
        active.current=true;
        popup.current?.close();
        syncRef.current?.();
      }).catch(()=>{
        if(alive&&popup.current?.closed){
          setState('error');setError('ورود هنوز کامل نشده؛ دوباره اتصال را بزن.');
        }
      });
    },4000);
    const timeout=setTimeout(()=>{
      if(alive&&!active.current){
        setState('error');setError('ورود هنوز کامل نشده؛ می‌توانی دوباره تلاش کنی.');
      }
    },120000);
    return()=>{alive=false;clearInterval(tick);clearTimeout(timeout)};
  },[state,request]);
  function connect(){
    revision.current++;
    setError('');setState('connecting');
    active.current=false;
    usingPopup.current=false;
    popup.current=window.open(ACCOUNT_ORIGIN+'/account','animenama-account','popup,width=540,height=700');
    if(!popup.current){
      setState('error');setError('اجازه بازشدن پنجره ورود را بده و دوباره امتحان کن.');
    }
  }
  function disconnect(){
    revision.current++;
    active.current=false;usingPopup.current=false;
    localStorage.removeItem(ENABLED_KEY);
    if(popup.current&&!popup.current.closed){
      popup.current.postMessage({
        type:'ANIMENAMA_ACCOUNT_REQUEST',id:crypto.randomUUID(),action:'disconnect'
      },ACCOUNT_ORIGIN);
    }
    setState('guest');setName('');setError('');
    // Never clear local library, even if backend logout fails.
  }
  return {state,error,name,lastSync,connect,disconnect,synchronize};
}
