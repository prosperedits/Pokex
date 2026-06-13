# POKEX — project contract (for Claude Code, any device)

A premium Pokémon TCG card showcase: a 3D wheel carousel with an "inspect" detail
view, USD price tracking, and a sealed-product browser. **Vanilla JS, no build step,
no framework.** This file travels with the repo so editing on the Mac works exactly
like editing on the PC.

## Run & preview
- `npm start` → http://localhost:4173 (a tiny static server, `server.mjs`).
- The app is also `file://`-safe — `index.html` opens directly with no server.
- Node ≥18. The only "dependencies" are vendored libs in `vendor/` (three.min.js,
  gsap.min.js), committed on purpose. **Do not add npm/bundler deps.**

## How it's built
- `app.js` is one IIFE (`(() => { 'use strict'; … })()`), loaded as a CLASSIC script
  (not a module). `index.html` loads scripts in order: `layout-constants.js` →
  vendored libs → `data/*.js` (per-set card data) → `data/sealed.js` → `app.js`.
- `layout-constants.js` is the single source of truth for card geometry/motion: it
  sets CSS custom properties on `:root` AND exposes a frozen `window.LAYOUT`. Card
  aspect ratio is 734/1024 (a real 63×88mm TCG card). Change sizing/timing HERE.
- Styling: `brand/tokens.css` (design tokens) + `style.css`. Premium easing is
  `--ease-snap: cubic-bezier(0.16,1,0.3,1)`.
- Card/price data lives in `data/cards-<set>.js` and `data/sealed.js`. Regenerate via
  `scripts/refresh-data.mjs` / `scripts/fetch-sealed.mjs`. The inspect reveal sound is
  synthesized by `scripts/make-whoosh.mjs` → `assets/sfx/whoosh.wav`.

## ⚠️ Cache-busting — do this every time
`index.html` pins `style.css?v=N`, `app.js?v=N`, `layout-constants.js?v=N`. **Whenever
you edit any of those three, bump the `?v=` number** (all together) so browsers and the
CDN pick up the change. Currently at **v39**. (`tokens.css?v=` rarely changes — bump
only if you edit tokens.)

## Motion / accessibility
- Some machines report `prefers-reduced-motion: reduce` by default — the app has a
  reduced-motion path AND a `?motion` URL override. Test both paths after motion work.
- Verify in a REAL focused browser (animations/`<dialog>` events stall in occluded or
  background tabs). Open localhost:4173, inspect a card, watch the title reveal + holo
  background actually run.

## Deploy
- **`main` is production.** Pushing to `main` auto-deploys to Cloudflare Pages
  (`pokex.pages.dev`). Just `git add -A && git commit && git push`.
- Two-device rule: `git pull` before you start, `git push` when you finish.
