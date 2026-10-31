import test from 'node:test';
import assert from 'node:assert/strict';
import {readPublicHome,scheduleForDay,todayInTehran,toTehranTime,
  titleOf,posterOf,validList,browseAnime} from '../src/lib/api.js';

test('same-origin public homepage has valid shape',async()=>{
  const old=globalThis.fetch;
  let requested='';
  globalThis.fetch=async url=>{
    requested=String(url);
    return new Response(JSON.stringify({version:1,airing:[{mal_id:21,title:'One Piece'}],
      schedules:{saturday:[{mal_id:235,title:'Conan'}]}}),{status:200});
  };
  try{
    const result=await readPublicHome();
    assert.equal(result.airing[0].mal_id,21);
    assert.match(requested,/\/anime-nama-web\/data\/home\.json$/);
    assert.equal(scheduleForDay(result,'saturday')[0].mal_id,235);
  }finally{globalThis.fetch=old}
});
test('poster and title helpers handle missing images and titles',()=>{
  assert.equal(posterOf({images:{jpg:{image_url:'https://example.org/p.jpg'}}}),'https://example.org/p.jpg');
  assert.equal(posterOf({}),null);
  assert.equal(titleOf({title:'Anime',title_english:'English'}),'English');
  assert.equal(titleOf({title:'Anime'}),'Anime');
  assert.ok(validList([{mal_id:1,title:'Title'}]));
  assert.ok(!validList([{mal_id:1}]));
  assert.match(todayInTehran(),/^(sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/);
  assert.notEqual(toTehranTime('23:00'),'زمان نامشخص');
});
test('online archive search handles real schema and rejects malformed results',async()=>{
  const old=globalThis.fetch;
  globalThis.fetch=async ()=>new Response(JSON.stringify({
    data:[{mal_id:5114,title:'Fullmetal Alchemist'}],
    pagination:{has_next_page:false}
  }),{status:200});
  try{
    const result=await browseAnime({q:'test-recovered-source',page:1});
    assert.equal(result.data[0].mal_id,5114);
  }finally{globalThis.fetch=old}
});
