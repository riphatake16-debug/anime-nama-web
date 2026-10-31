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
```

- Development preview: http://127.0.0.1:5173/anime-nama-web/
- Build preview is created in `source/dist/` and **does not overwrite** the live GitHub Pages root.
- `vite.config.js` serves `../data/home.json` in development and copies the latest snapshot into preview builds; no fabricated metadata.
- Rebuilt modules: `src/lib/api.js`, `src/lib/library.js`, `src/components.jsx`, `src/App.jsx`, `src/styles.css`.
- The personal-list storage keys are unchanged (`animenama:collection:v1`, `animenama:deleted:v1`); malformed existing data blocks writes, backups use version 1 and import merges rather than replacing. Cross-tab optimistic updates are protected.
- React code is entirely independent from minified production bundles. New functionality can now be developed as readable source.

## Migration status — do not deploy this preview to production yet

Implemented as source: home and today, schedule, paged archive/search, upcoming, poster fallback, details, local watchlist, progress, safe backup import/export, theme and responsive navigation.

**Not yet parity-tested / not yet rebuilt:** existing account popup and cloud sync, official news/update feed, continuation recommendations, optional notifications, the full set of current search filters and production styles, multi-page calendar semantics, service-worker push behavior, and exhaustive cross-browser functional tests. The current production bundle remains the source of truth for those features.

This workspace is a **migration foundation, not a lossless reconstruction of the original React source**. The original files were not recoverable from the minified build. Migration to production must happen only after these features are ported, parity tests pass and rollback is prepared.

Do not remove `assets/`, `sw.js`, `posters/`, `data/home.json` or existing localStorage values when working on the new source. Do not ship under the active GitHub Pages root until a separate reviewed deployment PR.
