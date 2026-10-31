# AnimeNama — React source recovery (isolated preview)

This is an **original, readable React/Vite workspace** created **inside anime-nama-web only**. It does not import from, connect to, or alter any other GitHub repository. The public site continues to use the existing root `index.html` and `assets/index-optimized-v19.js`.

## Run

```bash
cd source
npm install
npm test
npm run dev
npm run build
npm run preview
npm run test:browser # requires Chromium installed via npx playwright install chromium
```

- Development preview: http://127.0.0.1:5173/anime-nama-web/
- Build preview is created in `source/dist/` and **does not overwrite** the live GitHub Pages root.
- `vite.config.js` serves `../data/home.json` in development and copies the latest snapshot into preview builds; no fabricated metadata.
- Rebuilt modules: `src/lib/api.js`, `src/lib/library.js`, `src/components.jsx`, `src/App.jsx`, `src/styles.css`.
- The personal-list storage keys are unchanged (`animenama:collection:v1`, `animenama:deleted:v1`); malformed existing data blocks writes, backups use version 1 and import merges rather than replacing. Cross-tab optimistic updates are protected.
- React code is entirely independent from minified production bundles. New functionality can now be developed as readable source.

## Nocturne visual redesign

The current preview shares the Nocturne v25 visual tokens and layout direction via `src/nocturne.css`. This file is loaded after legacy source styles and remains independent from the public production bundle. The preview is not a functional drop-in replacement until real account/push verification and other parity gates pass.

## Migration status — do not deploy this preview to production yet

Implemented as source: home and today, schedule, paged archive/search, upcoming, poster fallback, details, local watchlist, progress, safe backup import/export, theme and responsive navigation.

**Now rebuilt as readable source:** optional account popup and safe snapshot merging (`src/lib/cloud.js`), source-linked news and sequel graph (`src/lib/continuations.js`), opt-in push control (`src/lib/push.js`), settings (`src/Features.jsx`), genre/year filters, Persian title aliases, Tehran-time week rollover and independent installable PWA worker (`public/sw.js`). Build copies the required icon/manifest files and produces a hashed asset list without using the legacy JS bundle. Unit tests and the headless Chromium UI/backup/offline workflow cover these modules. Account protocol tests use a fake backend and fake account only.

**Still required before replacing production:** authorized real-account login/sync on two devices (CORS, cookie/popup bridge, merge conflicts), push subscription and notifications against the actual backend, UI parity review of official announcements and related-season guide, Android/iOS Safari, performance/Lighthouse and accessibility on real devices. The production bundle remains the source of truth for unverified features, and `source/dist/` is only an isolated preview artifact.

This workspace is a **migration foundation, not a lossless reconstruction of the original React source**. The original files were not recoverable from the minified build. Migration to production must happen only after these features are ported, parity tests pass and rollback is prepared.

Do not remove `assets/`, `sw.js`, `posters/`, `data/home.json` or existing localStorage values when working on the new source. Do not ship under the active GitHub Pages root until a separate reviewed deployment PR.
