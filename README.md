# POKEX

Every Pokémon TCG card on one 3D wheel — with a holographic inspect view, a
species "other cards" browser, and a sealed-product price tracker. **Static site,
zero dependencies** (three.js + GSAP are vendored in `vendor/`).

## Run it locally (independent — no AI tools required)

```bash
npm start
```

That boots the bundled static server (`server.mjs`) at **http://localhost:4173/**.
It is plain Node ≥18, has **no dependencies**, and is not bound to any editor,
AI, or MCP session — it keeps running until you close that terminal.

- Different port: `PORT=8080 npm start`
- If you see *"already running"*, the site is already up (the machine's
  background supervisor keeps it alive) — just open http://localhost:4173/.
- No build step. You can also open `index.html` directly, but the server is
  preferred (correct MIME types + range requests for the video backdrops).

## Always-on / public

- **Permanent public URL:** https://p-projects.pages.dev/pokex/ (Cloudflare Pages —
  stays up with this PC off). Redeploy with `..\share\deploy.ps1`.
- **Local always-on:** the workspace `supervisor.mjs` keeps `server.mjs` (port
  4173) running across reboots, independent of any terminal.

## Data

- `npm run refresh-data` — re-pull a set's cards/prices from TCGdex.
- `npm run refresh-sealed` — re-pull sealed-product renders + regenerate `data/sealed.js`.

## Layout

| path | what |
|------|------|
| `index.html` / `app.js` / `style.css` | the wheel + inspect |
| `collection.html` | wishlist / collection page |
| `brand/tokens.css` | design tokens (colors, fonts) |
| `data/cards-*.js` | per-set card data (21 sets) |
| `data/sealed.js` | sealed-product manifest (generated) |
| `assets/` | card-back, grain, sealed renders, fonts, video |
| `vendor/` | three.min.js, gsap.min.js |
| `server.mjs` | the zero-dependency static server |
