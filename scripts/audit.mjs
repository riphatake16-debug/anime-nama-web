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
const jsFile = 'assets/index-optimized-v19.js';
const js = read(jsFile);
const extJs = read('enhancements/light-v21.js');
const mirrorCss = 'enhancements/dark-mirror-v22.css';
const extraCss = 'enhancements/light-v14.css';
const originalCss = 'assets/index-DH4P2sUh.css';

for (const p of [jsFile, originalCss, extraCss, 'enhancements/light-v14.js',
  'enhancements/light-v21.js', mirrorCss,
  'vazirmatn.woff2','favicon.svg','posters/index.json','data/home.json']) {
  assert(exists(p), 'Missing required file: ' + p);
}
for (const p of [jsFile, originalCss, extraCss, 'enhancements/light-v21.js', mirrorCss]) {
  assert(html.includes('/anime-nama-web/' + p), 'HTML does not reference ' + p);
  assert(precache.includes('./' + p), 'PWA precache does not reference ' + p);
}
for (const p of precache) {
  assert(typeof p === 'string' && p.startsWith('./') && exists(p.slice(2)),
    'Missing or unsafe precache path: ' + p);
}
assert(manifest.start_url.startsWith('/anime-nama-web/'), 'Manifest start URL changed');
assert(manifest.scope === '/anime-nama-web/', 'Manifest scope changed');
assert(serviceWorker.includes('animenama-v22'), 'Service Worker version mismatch');
assert(serviceWorker.includes('MAX_POSTER_BUNDLES = 9'), 'Poster cache bound missing');
assert(serviceWorker.includes("'./assets/index-optimized-v19.js'") &&
  !serviceWorker.includes("'./assets/index-optimized-v15.js'") &&
  serviceWorker.includes("'./data/home.json'"),
  'Offline fallback shell is stale or missing public snapshot');
assert(exists('tests/release-check.test.mjs') && exists('tests/browser-smoke.mjs') &&
  exists('.github/workflows/browser-qa.yml'), 'Release QA coverage missing');
assert(serviceWorker.includes('api|account|mcp|signin-with-chatgpt'), 'Private route exclusion missing');
assert(js.includes('anPosterCallbacks=new Map') && js.includes('if(!v)return;let t=!0'),
  'React poster component must defer poster requests until near viewport');
assert(js.includes('loading:\`lazy\`'), 'Native poster lazy-loading missing');
assert(js.includes('let h=(0,C.useMemo)(()=>[...r,...a?[a]:[]],[a,r]);') &&
  js.includes('let g=l<h.length?h[l]:s?d[l-h.length]:void 0'),
  'Remote poster URLs must render before optional local bundles');
assert(!extJs.includes('MutationObserver(() => {') || extJs.includes('observer.disconnect()'),
  'Enhancement observer must disconnect after mounting');
assert(size('enhancements/light-v21.js') + size(extraCss) < 15000,
  'Enhancement payload regression: exceeds 15 KB of raw source');
for (const p of [jsFile,'enhancements/light-v21.js','sw.js']) {
  try { new vm.Script(read(p), {filename:p}); }
  catch (err) { errors.push('JavaScript parse error in ' + p + ': ' + err.message); }
}
assert(js.includes('anPublicHomeRoute(e,t,n)') &&
  js.includes('data/home.json') &&
  js.includes('location.hostname.endsWith(`'+'.github.io'+'`)'),
  'Homepage must load same-origin snapshot and bypass missing GitHub Pages API proxy');
const publicHome = JSON.parse(read('data/home.json'));
assert(publicHome.version === 1 && Array.isArray(publicHome.airing) &&
  publicHome.schedules && typeof publicHome.schedules === 'object',
  'Public homepage snapshot schema invalid');
assert(exists('scripts/update-home-data.mjs') && exists('.github/workflows/refresh-home.yml'),
  'Scheduled public homepage refresh missing');
assert(read('enhancements/light-v21.js').includes('.simple-mobile-nav button') &&
  read('enhancements/light-v21.js').includes('shouldReduceMotion()'),
  'Mobile search or stored reduced-motion behavior regressed');
assert(exists(mirrorCss),'Theme mirror stylesheet missing');
assert(html.includes('/anime-nama-web/'+mirrorCss) &&
  precache.includes('./'+mirrorCss) &&
  serviceWorker.includes("'./enhancements/dark-mirror-v22.css'"),
  'Mirror stylesheet must work online and offline');
assert(!html.includes('streaming-v18.css') &&
  !html.includes('polish-v21.css') &&
  !precache.includes('./enhancements/streaming-v18.css') &&
  !precache.includes('./enhancements/polish-v21.css') &&
  !html.includes('streaming-v16.js'), 'Separate blue night layout was not fully removed');
assert(read(mirrorCss).includes('prefers-reduced-motion') &&
  read(mirrorCss).includes('data-motion="reduced"') &&
  read(mirrorCss).includes('.continuation-teaser') &&
  !read(mirrorCss).includes('.an-featured'),
  'Accessible animations or dark continuation panel missing');
assert(size(mirrorCss) < 16000,'Theme mirror exceeds 16KB raw');
assert(html.includes('localStorage.getItem("animenama:visual-theme:v1")==="day"?"day":"night"'),
  'New visitors should see dark mode by default, preserving chosen light mode');
const index = JSON.parse(read('posters/index.json'));
const bundles = new Set(Object.values(index));
assert(bundles.size > 0, 'Poster index empty');
for (const number of bundles) assert(exists('posters/bundle-' + number + '.json'),
  'Poster bundle missing: ' + number);
const shellBytes = size(jsFile)+size(originalCss)+size(extraCss)+size('enhancements/light-v21.js')+size(mirrorCss);
console.log(JSON.stringify({
  status: errors.length ? 'FAIL' : 'PASS',
  shellBytesRaw: shellBytes,
  extraJsCssBytesRaw: size('enhancements/light-v21.js') + size(extraCss) + size(mirrorCss),
  posterEntries: Object.keys(index).length,
  posterBundles: bundles.size,
  checks: 'file references, JS syntax, poster lazy-loading, caching safety, payload budgets',
  errors
}, null, 2));
if (errors.length) process.exitCode = 1;
