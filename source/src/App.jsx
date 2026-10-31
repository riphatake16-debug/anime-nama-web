import React,{useEffect,useMemo,useRef,useState} from 'react';
import {AnimeGrid,Poster,ScheduleList,DetailDialog} from './components.jsx';
import {browseAnime,days,getAnimeDetail,readPublicHome,scheduleForDay,titleOf,todayInTehran} from './lib/api.js';
import {backupSnapshot,changeEntry,importBackup,readSnapshot,toggleSaved,STATUS} from './lib/library.js';

const routes={home:'خانه',explore:'آرشیو',calendar:'تقویم',library:'فهرست من',upcoming:'انیمه‌های آینده'};
const weekdays={sunday:'یکشنبه',monday:'دوشنبه',tuesday:'سه‌شنبه',wednesday:'چهارشنبه',
  thursday:'پنجشنبه',friday:'جمعه',saturday:'شنبه'};
function currentRoute(){
  const name=location.hash.slice(1);
  return Object.hasOwn(routes,name)?name:'home';
}
function Note({children}){return <p className="note" role="status">{children}</p>}
function Heading({title,subtitle,action}){
  return <div className="heading"><div><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div>{action}</div>;
}
function HomePage({publicData,error,onNavigate,onOpen,onToggle,library}){
  const today=todayInTehran();
  return <main className="content">
    <div className="welcome">
      <h1>خانه</h1>
      <p>جایی برای کشف انیمه‌های در حال پخش و برنامه روزانه</p>
      <button className="secondary" onClick={()=>onNavigate('library')}>فهرست من</button>
    </div>
    <section>
      <Heading title="در حال پخش" subtitle="بر اساس اطلاعات عمومی MyAnimeList"
        action={<button className="text-action" onClick={()=>onNavigate('explore')}>مشاهده آرشیو ←</button>}/>
      {error&&<Note>{error}</Note>}
      {!publicData&&!error&&<Note>در حال دریافت اطلاعات…</Note>}
      <AnimeGrid items={(publicData?.airing||[]).slice(0,12)}
        snapshot={library} onOpen={onOpen} onToggle={onToggle}/>
    </section>
    <section>
      <Heading title="برنامه امروز" subtitle={'به وقت تهران · '+weekdays[today]}
        action={<button className="text-action" onClick={()=>onNavigate('calendar')}>تقویم کامل ←</button>}/>
      {!publicData&&!error&&<Note>در حال دریافت برنامه…</Note>}
      <ScheduleList items={scheduleForDay(publicData,today).slice(0,15)} onOpen={onOpen}/>
    </section>
  </main>;
}
function ExplorePage({upcoming,onOpen,onToggle,library}){
  const [query,setQuery]=useState('');
  const [status,setStatus]=useState(upcoming?'upcoming':'');
  const [type,setType]=useState('');
  const [page,setPage]=useState(1);
  const [result,setResult]=useState([]);
  const [hasNext,setHasNext]=useState(false);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  useEffect(()=>setStatus(upcoming?'upcoming':''),[upcoming]);
  useEffect(()=>{
    const controller=new AbortController();
    const timer=setTimeout(()=>{
      setLoading(true);setError('');
      browseAnime({q:query.trim()||undefined,status:status||undefined,
        type:type||undefined,page,limit:18},controller.signal)
        .then(body=>{
          if(!controller.signal.aborted){
            setResult(body.data);
            setHasNext(Boolean(body.pagination?.has_next_page));
          }
        })
        .catch(e=>{if(!controller.signal.aborted)setError(e.message)})
        .finally(()=>{if(!controller.signal.aborted)setLoading(false)});
    },query.trim()?400:0);
    return()=>{clearTimeout(timer);controller.abort()};
  },[query,status,type,page]);
  return <main className="content">
    <Heading title={upcoming?'انیمه‌های آینده':'آرشیو انیمه‌ها'}
      subtitle="جست‌وجو در اطلاعات آنلاین انیمه‌ها"/>
    <div className="search-toolbar">
      <label className="search-label">جست‌وجوی انیمه
        <input value={query} placeholder="نام فارسی یا انگلیسی را وارد کن"
          onChange={e=>{setQuery(e.target.value);setPage(1)}}/>
      </label>
      <label>وضعیت
        <select value={status} onChange={e=>{setStatus(e.target.value);setPage(1)}}>
          <option value="">همه</option>
          <option value="airing">در حال پخش</option>
          <option value="complete">پایان‌یافته</option>
          <option value="upcoming">آینده</option>
        </select>
      </label>
      <label>نوع
        <select value={type} onChange={e=>{setType(e.target.value);setPage(1)}}>
          <option value="">همه</option><option value="tv">TV</option>
          <option value="movie">فیلم</option><option value="ova">OVA</option>
          <option value="ona">ONA</option>
        </select>
      </label>
    </div>
    {error&&<Note>{error}</Note>}
    {loading&&<Note>در حال بارگذاری آرشیو…</Note>}
    {!loading&&<AnimeGrid items={result} snapshot={library}
      onOpen={onOpen} onToggle={onToggle}/>}
    <div className="pagination">
      <button className="secondary" onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1}>قبلی</button>
      <span>صفحه {page.toLocaleString('fa-IR')}</span>
      <button className="secondary" onClick={()=>setPage(p=>p+1)} disabled={!hasNext||loading}>بعدی</button>
    </div>
  </main>;
}
function CalendarPage({publicData,error,onOpen}){
  const [day,setDay]=useState(todayInTehran);
  return <main className="content">
    <Heading title="تقویم پخش" subtitle="برنامه هفتگی انیمه‌ها — ساعت‌های موجود به وقت تهران تبدیل می‌شوند"/>
    <div className="day-tabs" role="group" aria-label="روزهای هفته">
      {days.map(d=><button key={d} className={d===day?'active':''}
        onClick={()=>setDay(d)}>{weekdays[d]}</button>)}
    </div>
    {!publicData&&<Note>{error||'در حال دریافت برنامه…'}</Note>}
    <ScheduleList items={scheduleForDay(publicData,day)} onOpen={onOpen}/>
    <p className="hint">برنامه بر اساس منبع هفتگی است؛ زمان‌ها ممکن است تغییر کنند و اطلاعات بعضی روزها محدود است.</p>
  </main>;
}
function LibraryPage({library,onOpen,onChange,onRemove,onBackup,onImport}){
  const ref=useRef(null);
  const [filter,setFilter]=useState('all');
  const items=useMemo(()=>Object.values(library?.collection||{})
    .filter(x=>filter==='all'||x.status===filter)
    .sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)),[library,filter]);
  return <main className="content">
    <Heading title="فهرست من" subtitle="پیگیری انیمه‌هایی که ذخیره کرده‌ای"/>
    <div className="library-tools">
      <button className="secondary" onClick={onBackup}>دریافت پشتیبان</button>
      <button className="secondary" onClick={()=>ref.current?.click()}>بازیابی پشتیبان</button>
      <input ref={ref} hidden type="file" accept="application/json,.json" onChange={async e=>{
        const file=e.target.files?.[0];e.target.value='';
        if(file)await onImport(file);
      }}/>
    </div>
    <div className="day-tabs">
      <button className={filter==='all'?'active':''} onClick={()=>setFilter('all')}>همه</button>
      {Object.entries(STATUS).map(([id,label])=><button key={id}
        className={filter===id?'active':''} onClick={()=>setFilter(id)}>{label}</button>)}
    </div>
    {!library&&<Note>فهرست قبلی قابل خواندن نیست؛ برای حفاظت از اطلاعات هیچ چیزی بازنویسی نمی‌شود.</Note>}
    {items.length===0&&<p className="empty">هنوز انیمه‌ای در این بخش وجود ندارد.</p>}
    <div className="library-grid">
      {items.map(item=><article className="library-item" key={item.anime.mal_id}>
        <button type="button" className="library-art" onClick={()=>onOpen(item.anime)}>
          <Poster anime={item.anime} alt={titleOf(item.anime)}/>
        </button>
        <div className="library-info">
          <button className="anime-title" onClick={()=>onOpen(item.anime)} dir="auto">
            {titleOf(item.anime)}
          </button>
          <label>وضعیت تماشا
            <select value={item.status} onChange={e=>onChange(item.anime.mal_id,{status:e.target.value})}>
              {Object.entries(STATUS).map(([id,label])=><option key={id} value={id}>{label}</option>)}
            </select>
          </label>
          <div className="progress-controls">
            <span>قسمت {item.progress.toLocaleString('fa-IR')}</span>
            <button className="secondary" onClick={()=>onChange(item.anime.mal_id,{
              progress:Math.max(0,item.progress-1)
            })} disabled={item.progress===0}>−</button>
            <button className="secondary" onClick={()=>onChange(item.anime.mal_id,{
              progress:Math.min(item.anime.episodes||100000,item.progress+1)
            })}>＋</button>
          </div>
          <button className="text-action" onClick={()=>onRemove(item.anime)}>حذف از فهرست</button>
        </div>
      </article>)}
    </div>
  </main>;
}
export function App(){
  const [page,setPage]=useState(currentRoute);
  const [theme,setTheme]=useState(()=>{
    try{return localStorage.getItem('animenama:visual-theme:v1')==='day'?'day':'night'}
    catch{return 'night'}
  });
  const [publicData,setPublicData]=useState(null);
  const [homeError,setHomeError]=useState('');
  const [library,setLibrary]=useState(()=>{
    try{return readSnapshot(localStorage)}catch{return null}
  });
  const [selected,setSelected]=useState(null);
  const [toast,setToast]=useState('');
  useEffect(()=>{
    const onHash=()=>setPage(currentRoute());
    window.addEventListener('hashchange',onHash);
    return()=>window.removeEventListener('hashchange',onHash);
  },[]);
  useEffect(()=>{
    const sync=()=>{try{setLibrary(readSnapshot(localStorage))}catch{setLibrary(null)}};
    window.addEventListener('storage',sync);
    return()=>window.removeEventListener('storage',sync);
  },[]);
  useEffect(()=>{
    document.documentElement.dataset.anTheme=theme;
    try{localStorage.setItem('animenama:visual-theme:v1',theme)}catch{}
  },[theme]);
  useEffect(()=>{
    let active=true;
    readPublicHome().then(x=>{if(active)setPublicData(x)})
      .catch(e=>{if(active)setHomeError(e.message)});
    return()=>{active=false};
  },[]);
  useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(''),4200);return()=>clearTimeout(t)},[toast]);
  useEffect(()=>{
    if(!selected)return;
    let active=true;
    getAnimeDetail(selected.mal_id).then(x=>{if(active)setSelected(x)}).catch(()=>{});
    return()=>{active=false};
  },[selected?.mal_id]);
  function navigate(target){
    location.hash='#'+target;
    setPage(target);
    window.scrollTo({top:0,behavior:'instant'});
  }
  function onToggle(anime){
    if(!library){setToast('ابتدا مشکل خواندن فهرست را برطرف کن؛ داده قبلی حذف نشده.');return}
    try{setLibrary(toggleSaved(localStorage,anime));setToast('فهرست به‌روز شد.')}
    catch(e){setToast(e.message)}
  }
  function onChange(id,patch){
    if(!library)return;
    try{setLibrary(changeEntry(localStorage,String(id),patch))}
    catch(e){setToast(e.message)}
  }
  function onBackup(){
    try{
      const data=backupSnapshot(localStorage);
      const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
      const anchor=document.createElement('a');
      anchor.href=url;anchor.download='animenama-backup-'+new Date().toISOString().slice(0,10)+'.json';
      document.body.append(anchor);anchor.click();anchor.remove();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch(e){setToast(e.message)}
  }
  async function onImport(file){
    if(file.size>5*1024*1024){setToast('فایل پشتیبان خیلی بزرگ است.');return}
    try{
      const data=JSON.parse(await file.text());
      const next=importBackup(localStorage,data);
      setLibrary(next);setToast('فایل پشتیبان با فهرست فعلی ادغام شد.');
    }catch(e){setToast(e.message||'فایل پشتیبان معتبر نیست.')}
  }
  return <>
    <header className="header">
      <button className="brand" onClick={()=>navigate('home')}>انیمه<span>نما</span></button>
      <nav className="desktop-nav" aria-label="صفحات اصلی">
        {Object.entries(routes).map(([id,label])=><button key={id} onClick={()=>navigate(id)}
          className={page===id?'active':''}>{label}</button>)}
      </nav>
      <button className="theme-toggle" title="تغییر تم" aria-label="تغییر تم"
        onClick={()=>setTheme(x=>x==='night'?'day':'night')}>{theme==='night'?'☾':'☀'}</button>
    </header>
    {page==='home'&&<HomePage publicData={publicData} error={homeError}
      onNavigate={navigate} onOpen={setSelected} onToggle={onToggle} library={library}/>}
    {(page==='explore'||page==='upcoming')&&<ExplorePage upcoming={page==='upcoming'}
      onOpen={setSelected} onToggle={onToggle} library={library}/>}
    {page==='calendar'&&<CalendarPage publicData={publicData} error={homeError} onOpen={setSelected}/>}
    {page==='library'&&<LibraryPage library={library} onOpen={setSelected}
      onChange={onChange} onRemove={onToggle} onBackup={onBackup} onImport={onImport}/>}
    <footer className="footer">انیمه‌نما · اطلاعات عمومی از MyAnimeList · نسخه سورس آزمایشی</footer>
    <nav className="mobile-nav" aria-label="ناوبری موبایل">
      {Object.entries(routes).filter(([id])=>id!=='upcoming').map(([id,label])=>
        <button key={id} onClick={()=>navigate(id)} className={page===id?'active':''}>
          <span aria-hidden="true">{id==='home'?'⌂':id==='explore'?'▦':id==='calendar'?'▤':'☆'}</span>{label}
        </button>)}
    </nav>
    {toast&&<div className="toast" role="status">{toast}</div>}
    <DetailDialog anime={selected} onClose={()=>setSelected(null)} saved={Boolean(
      selected&&library?.collection?.[selected.mal_id])}
      entry={selected&&library?.collection?.[selected.mal_id]}
      onToggle={onToggle} onChange={onChange}/>
  </>;
}
