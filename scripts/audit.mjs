#!/usr/bin/env node
// Static deployment checks for the GitHub Pages build; no network or dependencies.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const errors = [];
const exists = p => fs.existsSync(path.join(root, p));
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const size = p => fs.statSync(path.join(root, p)).size;
const assert = (condition, message) => { if (!condition) errors.push(message); };
const html = read('index.html');
const precache = JSON.parse(read('precache.json'));
const manifest = JSON.parse(read('manifest.webmanifest'));
const serviceWorker = read('sw.js');
const jsFile = 'assets/index-optimized-v15.js';
const js = read(jsFile);
const extJs = read('enhancements/light-v16.js');
const midnightJs = read('enhancements/streaming-v16.js');
const midnightCss = 'enhancements/streaming-v16.css';
const extraCss = 'enhancements/light-v14.css';
const originalCss = 'assets/index-DH4P2sUh.css';

for (const p of [jsFile, originalCss, extraCss, 'enhancements/light-v14.js',
  'enhancements/light-v16.js', midnightCss, 'enhancements/streaming-v16.js',
  'vazirmatn.woff2','favicon.svg','posters/index.json']) {
  assert(exists(p), 'Missing required file: ' + p);
}
for (const p of [jsFile, originalCss, extraCss, 'enhancements/light-v16.js', midnightCss, 'enhancements/streaming-v16.js']) {
  assert(html.includes('/anime-nama-web/' + p), 'HTML does not reference ' + p);
  assert(precache.includes('./' + p), 'PWA precache does not reference ' + p);
}
for (const p of precache) {
  assert(typeof p === 'string' && p.startsWith('./') && exists(p.slice(2)),
    'Missing or unsafe precache path: ' + p);
}
assert(manifest.start_url.startsWith('/anime-nama-web/'), 'Manifest start URL changed');
assert(manifest.scope === '/anime-nama-web/', 'Manifest scope changed');
assert(serviceWorker.includes('animenama-v17'), 'Service Worker version mismatch');
assert(serviceWorker.includes('MAX_POSTER_BUNDLES = 9'), 'Poster cache bound missing');
assert(serviceWorker.includes('api|account|mcp|signin-with-chatgpt'), 'Private route exclusion missing');
assert(js.includes('anPosterCallbacks=new Map') && js.includes('if(!v)return;let t=!0'),
  'React poster component must defer poster requests until near viewport');
assert(js.includes('loading:\`lazy\`'), 'Native poster lazy-loading missing');
assert(js.includes('let h=(0,C.useMemo)(()=>[...r,...a?[a]:[]],[a,r]);') &&
  js.includes('let g=l<h.length?h[l]:s?d[l-h.length]:void 0'),
  'Remote poster URLs must render before optional local bundles');
assert(!extJs.includes('MutationObserver(() => {') || extJs.includes('observer.disconnect()'),
  'Enhancement observer must disconnect after mounting');
assert(size('enhancements/light-v16.js') + size(extraCss) < 15000,
  'Enhancement payload regression: exceeds 15 KB of raw source');
for (const p of [jsFile,'enhancements/light-v16.js','enhancements/streaming-v16.js','sw.js']) {
  try { new vm.Script(read(p), {filename:p}); }
  catch (err) { errors.push('JavaScript parse error in ' + p + ': ' + err.message); }
}
assert(read(midnightCss).includes('.an-featured') &&
  read(midnightCss).includes('.simple-mobile-nav') &&
  read(midnightCss).includes('@media(max-width:760px)'),
  'Midnight Cinema responsive design styles missing');
assert(midnightJs.includes('.home-anime-grid .home-anime-tile') &&
  midnightJs.includes('.home-tile-cover') &&
  !midnightJs.includes('localStorage'),
  'Featured section must use existing anime cards without touching user storage');
assert(html.includes('localStorage.getItem("animenama:visual-theme:v1")==="day"?"day":"night"'),
  'New visitors should see dark mode by default, preserving chosen light mode');
assert(size(midnightCss) < 28000, 'Midnight CSS exceeds 28KB raw budget');
assert(size('enhancements/streaming-v16.js') < 6500, 'Midnight JS exceeds 6.5KB raw budget');
const index = JSON.parse(read('posters/index.json'));
const bundles = new Set(Object.values(index));
assert(bundles.size > 0, 'Poster index empty');
for (const number of bundles) assert(exists('posters/bundle-' + number + '.json'),
  'Poster bundle missing: ' + number);
const shellBytes = size(jsFile)+size(originalCss)+size(extraCss)+size('enhancements/light-v16.js')+size(midnightCss)+size('enhancements/streaming-v16.js');
console.log(JSON.stringify({
  status: errors.length ? 'FAIL' : 'PASS',
  shellBytesRaw: shellBytes,
  extraJsCssBytesRaw: size('enhancements/light-v16.js') + size(extraCss) + size(midnightCss) + size('enhancements/streaming-v16.js'),
  posterEntries: Object.keys(index).length,
  posterBundles: bundles.size,
  checks: 'file references, JS syntax, poster lazy-loading, caching safety, payload budgets',
  errors
}, null, 2));
if (errors.length) process.exitCode = 1;
