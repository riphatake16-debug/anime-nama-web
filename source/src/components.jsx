import React,{useState} from 'react';
import {posterOf,titleOf,toTehranTime} from './lib/api.js';
import {STATUS} from './lib/library.js';

export function Poster({anime,alt='',className=''}) {
  const [failed,setFailed]=useState(false);
  const url=posterOf(anime);
  return <div className={'poster '+className}>
    {url&&!failed
      ? <img src={url} alt={alt||titleOf(anime)} loading="lazy" decoding="async"
          referrerPolicy="no-referrer" onError={()=>setFailed(true)}/>
      : <div className="poster-fallback" aria-label="پوستر موجود نیست">پوستر موجود نیست</div>}
  </div>;
}
export function AnimeCard({anime,saved,onOpen,onToggle}) {
  return <article className="anime-card">
    <button type="button" className="art-action" onClick={()=>onOpen(anime)}
      aria-label={'جزئیات '+titleOf(anime)}>
      <Poster anime={anime}/>
      {anime.score>0&&<span className="score">★ {anime.score}</span>}
    </button>
    <button className="anime-title" type="button" onClick={()=>onOpen(anime)} dir="auto">
      {titleOf(anime)}
    </button>
    <div className="anime-actions">
      <span>{anime.type||anime.status||'انیمه'}</span>
      <button type="button" className={'save '+(saved?'selected':'')}
        onClick={()=>onToggle(anime)} aria-label={saved?'حذف از فهرست':'افزودن به فهرست'}>
        {saved?'✓ ذخیره‌شده':'＋ ذخیره'}
      </button>
    </div>
  </article>;
}
export function AnimeGrid({items,snapshot,onOpen,onToggle}) {
  if(!items?.length)return <p className="empty">در حال حاضر موردی برای نمایش وجود ندارد.</p>;
  return <div className="anime-grid">{items.map(anime=><AnimeCard key={anime.mal_id}
    anime={anime} saved={Boolean(snapshot?.collection?.[anime.mal_id])}
    onOpen={onOpen} onToggle={onToggle}/>)}</div>;
}
export function ScheduleList({items,onOpen}) {
  if(!items?.length)return <p className="empty">برنامه‌ای برای این روز ثبت نشده است.</p>;
  return <div className="schedule-list">
    {items.map(anime=><button className="schedule-item" key={anime.mal_id}
      type="button" onClick={()=>onOpen(anime)}>
      <Poster anime={anime} alt="" className="schedule-poster"/>
      <span className="schedule-name" dir="auto">{titleOf(anime)}</span>
      <span className="schedule-time">{anime.broadcast?.time
        ? toTehranTime(anime.broadcast.time):'نامشخص'}<small>وقت تهران</small></span>
    </button>)}
  </div>;
}
export function DetailDialog({anime,saved,onClose,onToggle,entry,onChange}) {
  if(!anime)return null;
  const episodes=Number.isInteger(anime.episodes)&&anime.episodes>0?anime.episodes:null;
  return <div className="overlay" role="presentation" onMouseDown={e=>{
    if(e.target===e.currentTarget)onClose();
  }}>
    <section className="detail" role="dialog" aria-modal="true"
      aria-label={'جزئیات '+titleOf(anime)}>
      <div className="detail-header">
        <button type="button" className="close" onClick={onClose}>✕ بستن</button>
        <h2 dir="auto">{titleOf(anime)}</h2>
      </div>
      <div className="detail-top">
        <Poster anime={anime} alt={titleOf(anime)} className="detail-poster"/>
        <div className="detail-meta">
          <p>★ {anime.score||'—'} · {anime.type||'نامشخص'} · {anime.status||'—'}</p>
          <p>{episodes?'تعداد قسمت‌ها: '+episodes:'تعداد قسمت‌ها نامشخص'}</p>
          <p>{anime.genres?.map(x=>x.name).filter(Boolean).join('، ')||''}</p>
          <button className="primary" onClick={()=>onToggle(anime)}>
            {saved?'حذف از فهرست من':'افزودن به فهرست من'}
          </button>
          {saved&&entry&&<div className="detail-progress">
            <label>وضعیت تماشا
              <select value={entry.status} onChange={e=>onChange(anime.mal_id,{status:e.target.value})}>
                {Object.entries(STATUS).map(([k,v])=><option value={k} key={k}>{v}</option>)}
              </select>
            </label>
            <label>قسمت دیده‌شده
              <input type="number" min="0" max={episodes||100000} value={entry.progress}
                onChange={e=>{const n=e.target.valueAsNumber;if(Number.isSafeInteger(n)&&n>=0&&n<=100000)
                  onChange(anime.mal_id,{progress:n});}}/>
            </label>
          </div>}
        </div>
      </div>
      <h3>خلاصه داستان</h3>
      <p className="synopsis">{anime.synopsis||'هنوز خلاصه‌ای ثبت نشده است.'}</p>
      {anime.url?.startsWith('https://myanimelist.net/')&&<a href={anime.url}
        target="_blank" rel="noopener noreferrer">اطلاعات بیشتر در MyAnimeList</a>}
    </section>
  </div>;
}
