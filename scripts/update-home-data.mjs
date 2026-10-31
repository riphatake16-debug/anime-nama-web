#!/usr/bin/env node
// Refresh a public, same-origin homepage snapshot for GitHub Pages.
// Never touches user data, credentials or personally identifying information.
import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const target = path.join(root, 'data', 'home.json');
const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
const sources = [
  ['Tenrai', 'https://api.tenrai.org/v1/'],
  ['Jikan', 'https://api.jikan.moe/v4/']
];
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let previous = {};
try { previous = JSON.parse(await fs.readFile(target, 'utf8')); } catch {}
const validItems = value => Array.isArray(value) && value.every(
  x => x && Number.isSafeInteger(x.mal_id) && x.mal_id > 0 && typeof x.title === 'string'
);
async function request(endpoint, query) {
  const params = new URLSearchParams({...query, sfw:'true'});
  for (const [name,base] of sources) {
    try {
      const response = await fetch(base + endpoint + '?' + params, {
        headers: {Accept:'application/json'},
        signal: AbortSignal.timeout(9000)
      });
      if (!response.ok) throw new Error('HTTP '+response.status);
      const json = await response.json();
      if (!validItems(json.data) || json.data.length === 0) throw new Error('Empty/invalid JSON');
      return {data:json.data,source:name};
    } catch (error) {
      console.warn(name,endpoint,query.filter??'',String(error.message || error));
      await pause(400);
    }
  }
  return null;
}
const latest = await request('anime', {status:'airing',order_by:'members',sort:'desc',page:'1',limit:'12'});
const airing = latest?.data ?? (validItems(previous.airing) ? previous.airing : []);
const schedules = {};
const counts = {airing: airing.length, days:0};
for (const day of days) {
  await pause(350);
  const result = await request('schedules',{filter:day,page:'1',limit:'25'});
  const fallback = previous.schedules?.[day];
  const data = result?.data ?? (validItems(fallback) ? fallback : []);
  schedules[day] = data;
  if(data.length) counts.days++;
}
if (!airing.length && !counts.days) throw new Error('No valid snapshot data; not overwriting homepage');
const output = {
  version: 1,
  generatedAt:new Date().toISOString(),
  source:latest?.source ?? previous.source ?? 'previous snapshot',
  airing,schedules
};
await fs.mkdir(path.dirname(target),{recursive:true});
await fs.writeFile(target,JSON.stringify(output));
console.log('Saved',target,counts);
