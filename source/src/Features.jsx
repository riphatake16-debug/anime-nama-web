import React,{useEffect,useState} from 'react';
import {fetchAnimeNews,fetchOfficialUpdates,personalContinuations,statusLabel,
  fromReportItem,formatAirDate,safeLink} from './lib/continuations.js';
import {savedAnimeIds,pushSupported,enablePush,disablePush,testPush,refreshPushList,
  getPushSubscription} from './lib/push.js';

export function AccountControls({cloud,library}){
  return <section className="feature-panel">
    <h2>حساب و همگام‌سازی</h2>
    <p>همگام‌سازی کاملاً اختیاری است. فهرست شخصی در مرورگر می‌ماند و با خروج حذف نمی‌شود.</p>
    <p className="state-line">وضعیت: {cloud.state==='connected'?'متصل':
      cloud.state==='syncing'?'در حال همگام‌سازی':cloud.state==='connecting'?'در حال ورود':
      cloud.state==='error'?'خطا':'مهمان'} {cloud.name&&' · '+cloud.name}</p>
    {cloud.error&&<p role="alert" className="warning">{cloud.error}</p>}
    <div className="feature-actions">
      {cloud.state==='connected'||cloud.state==='syncing'
        ? <>
          <button disabled={!library||cloud.state==='syncing'} className="secondary"
            onClick={cloud.synchronize}>همگام‌سازی دوباره</button>
          <button className="secondary" onClick={cloud.disconnect}>قطع اتصال</button>
        </>
        : <button className="primary" disabled={!library} onClick={cloud.connect}>
          اتصال به حساب انیمه‌نما
        </button>}
    </div>
    {cloud.lastSync&&<small>آخرین همگام‌سازی: {new Intl.DateTimeFormat('fa-IR',{
      timeZone:'Asia/Tehran',dateStyle:'short',timeStyle:'short'
    }).format(new Date(cloud.lastSync))}</small>}
    {!library&&<p role="alert">فهرست محلی نامعتبر است؛ برای محافظت از آن همگام‌سازی متوقف شده.</p>}
  </section>;
}
export function NewsPanel({animeId=null}){
  const [items,setItems]=useState(null),[busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [date,setDate]=useState('');
  async function load(){
    setBusy(true);setError('');
    try{
      const data=animeId?await fetchAnimeNews(animeId):await fetchOfficialUpdates();
      setItems(animeId?data:data.updates);
      setDate(animeId?'':data.checkedAt||'');
      if(!animeId&&data.failed)setError('بررسی منبع خبر با تأخیر انجام شده؛ تاریخ را بررسی کن.');
    }catch(e){setError(e.message||'دریافت خبر ممکن نشد.')}
    finally{setBusy(false)}
  }
  useEffect(()=>{
    if(animeId===null)void load();
    else {setItems(null);setError('')}
    // Explicit button used for per-anime news to reduce third-party requests.
  },[animeId]);
  return <section className="feature-panel">
    <div className="heading">
      <div><h2>{animeId?'اخبار مرتبط':'اخبار و اطلاعیه‌ها'}</h2>
        <p>{animeId?'خبرهای ثبت‌شده در MyAnimeList؛ منبع اصلی هر خبر را بررسی کن.':
          'اطلاعیه‌های منبع‌دار؛ تاریخ انتشار ممکن است تغییر کند.'}</p></div>
      <button className="secondary" onClick={()=>void load()} disabled={busy}>
        {busy?'در حال دریافت…':items?'تازه‌سازی':'دریافت خبرها'}
      </button>
    </div>
    {error&&<p role="status" className="warning">{error}</p>}
    {date&&<p className="hint">آخرین بررسی منبع: {date}</p>}
    {items?.length===0&&<p className="empty">در پاسخ منبع، خبری ثبت نشده است؛ این به معنی لغو فصل جدید نیست.</p>}
    {items?.length>0&&<div className="news-list">{items.map((news,i)=>{
      const url=safeLink(news.url);
      return url&&<article key={news.id||url+i}>
        <h3>{news.title}</h3>
        {news.body&&<p>{news.body}</p>}
        <div className="news-meta">
          <a href={url} target="_blank" rel="noopener noreferrer">
            {news.source||'مشاهده منبع'}
          </a>
          {news.publishedAt&&<small>{formatAirDate(news.publishedAt)}</small>}
          {news.date&&<small>{formatAirDate(news.date)}</small>}
        </div>
      </article>;
    })}</div>}
  </section>;
}
export function ContinuationPanel({library,onOpen,onGuide}){
  const [reports,setReports]=useState([]),[busy,setBusy]=useState(false);
  const [limit,setLimit]=useState(6),[error,setError]=useState('');
  const entries=Object.keys(library?.collection||{});
  async function run(){
    if(!entries.length)return;
    setBusy(true);setError('');
    try{
      const list=await personalContinuations(library.collection,{limit});
      setReports(list);
      if(list.some(x=>!x.complete))setError('بعضی زنجیره‌ها کامل بررسی نشدند؛ نتیجه قطعی نیست.');
    }catch(e){setError(e.message||'بررسی ادامه‌ها انجام نشد.')}
    finally{setBusy(false)}
  }
  return <main className="content">
    <div className="heading"><div><h2>فصل‌های بعدی انیمه‌های من</h2>
      <p>بررسی زنجیرهٔ Sequel در MyAnimeList؛ اعلام رسمی نیست.</p></div>
      <button className="secondary" disabled={busy||!entries.length} onClick={()=>void run()}>
        {busy?'در حال بررسی…':'بررسی دوباره'}
      </button></div>
    {!entries.length&&<p className="empty">برای بررسی ادامه فصل‌ها، اول انیمه‌ای به فهرستت اضافه کن.</p>}
    {error&&<p role="status" className="warning">{error}</p>}
    {!busy&&!reports.length&&Boolean(entries.length)&&<p className="empty">برای دریافت فصل‌های مرتبط، «بررسی دوباره» را بزن.</p>}
    <div className="continuation-list">
      {reports.flatMap(rep=>(rep.sequels||[]).filter(season=>season.status!=='Finished Airing')
        .map(season=><article className="continuation-item" key={rep.anime.id+'-'+season.id}>
          <span className="relation-label">ادامهٔ {rep.anime.name||rep.anime.id}</span>
          <h3 dir="auto">{season.name}</h3>
          <p>{statusLabel(season.status)} · {formatAirDate(season.dateRaw)}</p>
          <div className="feature-actions"><button className="secondary"
            onClick={()=>onOpen(fromReportItem(season))}>جزئیات انیمه</button>
            {season.url&&<a href={season.url} rel="noopener noreferrer"
              target="_blank">منبع MyAnimeList</a>}
          </div>
        </article>))}
    </div>
    {!busy&&reports.length>0&&reports.every(rep=>!rep.sequels?.some(s=>s.status!=='Finished Airing'))&&
      <p className="empty">ادامهٔ در حال پخش یا آینده در بخش بررسی‌شده پیدا نشد؛ به معنی لغو نیست.</p>}
    {entries.length>limit&&<button className="secondary" onClick={()=>setLimit(x=>x+6)}>
      بررسی تعداد بیشتر (تا {limit+6} عنوان)
    </button>}
    <div className="feature-panel">
      <p>این صفحه فصل‌های ثبت‌شده در آرشیو را نمایش می‌دهد. نبودن نتیجه به معنی پایان یا لغو قطعی نیست.</p>
      <button className="secondary" onClick={onGuide}>جست‌وجوی انیمه‌ها در آرشیو</button>
    </div>
  </main>;
}
export function PushControls({library}){
  const [state,setState]=useState('off'),[message,setMessage]=useState('');
  const count=savedAnimeIds(library?.collection).length;
  useEffect(()=>{
    if(!pushSupported()){setState('unsupported');return}
    let alive=true;
    getPushSubscription().then(sub=>{
      if(alive)setState(sub&&Notification.permission==='granted'?'on':'off');
    }).catch(()=>{if(alive)setState('off')});
    return()=>{alive=false};
  },[]);
  useEffect(()=>{
    if(state!=='on')return;
    const handle=setTimeout(()=>{
      void refreshPushList(library?.collection).catch(()=>
        setMessage('همگام‌سازی فهرست اعلان‌ها انجام نشد؛ دوباره تلاش کن.'));
    },1700);
    return()=>clearTimeout(handle);
  },[library,state]);
  async function act(operation){
    setState('busy');setMessage('');
    try{
      if(operation==='enable'){
        await enablePush(library?.collection);setState('on');
        setMessage('اعلان این دستگاه روشن شد.');
      }else if(operation==='disable'){
        await disablePush(library?.collection);setState('off');
        setMessage('اعلان این دستگاه خاموش شد.');
      }else{
        await testPush(library?.collection);setState('on');
        setMessage('درخواست اعلان آزمایشی ارسال شد.');
      }
    }catch(e){
      setState(operation==='disable'?'on':'off');
      setMessage(e.message||'عملیات اعلان انجام نشد.');
    }
  }
  return <section className="feature-panel">
    <h2>اعلان‌های اختیاری</h2>
    <p>برای حداکثر {count.toLocaleString('fa-IR')} انیمه ذخیره‌شده در این دستگاه. برای فعال‌سازی به پشتیبانی مرورگر و سرویس اعلان نیاز است.</p>
    {message&&<p role="status" className="warning">{message}</p>}
    <div className="feature-actions">
      {state==='on'?<>
        <button className="secondary" onClick={()=>void act('disable')}>خاموش کردن</button>
        <button className="secondary" onClick={()=>void act('test')}>اعلان آزمایشی</button>
      </>:<button className="primary" disabled={state==='busy'||state==='unsupported'}
        onClick={()=>void act('enable')}>روشن کردن اعلان</button>}
    </div>
    {state==='unsupported'&&<small>مرورگر یا محیط آزمایشی از اعلان Push پشتیبانی نمی‌کند.</small>}
  </section>;
}
export function SettingsPanel({theme,onSetTheme,library,cloud}){
  const [reduce,setReduce]=useState(()=>{
    try{const setting=localStorage.getItem('animenama:motion');
      if(setting==='reduced')return true;
      if(setting==='full')return false;
    }catch{}
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  });
  function changeMotion(){
    const next=!reduce;setReduce(next);
    try{localStorage.setItem('animenama:motion',next?'reduced':'full')}catch{}
    document.documentElement.dataset.motion=next?'reduced':'full';
  }
  return <main className="content">
    <h1>تنظیمات</h1>
    <section className="feature-panel">
      <h2>نمایش</h2>
      <div className="feature-actions">
        <button className="secondary" onClick={()=>onSetTheme(theme==='night'?'day':'night')}>
          {theme==='night'?'تغییر به حالت روشن':'تغییر به حالت تیره'}
        </button>
        <button className="secondary" onClick={changeMotion}>
          {reduce?'فعال‌کردن حرکت‌ها':'کاهش حرکت‌های نمایشی'}
        </button>
      </div>
    </section>
    <AccountControls cloud={cloud} library={library}/>
    <PushControls library={library}/>
    <section className="feature-panel">
      <h2>حریم خصوصی و داده‌ها</h2>
      <p>اطلاعات فهرست در مرورگر ذخیره می‌شود و در صورت انتخاب شما با حساب انیمه‌نما همگام می‌شود.
        اطلاعات فهرست را برای حل مشکل مرورگر پاک نکن؛ ابتدا از «فهرست من» پشتیبان بگیر.</p>
    </section>
  </main>;
}
