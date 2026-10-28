// build-fpic.mjs — regenerate the First Partner Illustration Collection sets
// (MEP Black Star Promos 037-063) as data/cards-fpic1.js, cards-fpic2.js and
// cards-fpic3.js, in the same shape the hand-built Series 1/2 files used.
//
//   Series 1  fpic1  MEP 037-045  Kanto / Sinnoh / Alola
//   Series 2  fpic2  MEP 046-054  Johto / Unova / Galar
//   Series 3  fpic3  MEP 055-063  Hoenn / Kalos / Paldea   (released Aug 2026)
//
// Art: local hi-res scans from scripts/fetch-fpic-art.py (assets/fpicN/, 736x1024);
//      if a local file is missing the TCGplayer product image is used instead.
// Price: TCGplayer market via TCGCSV group 24451 ("ME: Mega Evolution Promo"),
//      matched by number; staff/prerelease/exclusive variants are ignored.
// Extra: illustrator, types and Cardmarket EUR trend from TCGdex set "mep"
//      (TCGdex has the MEP card data but no images for these numbers).
// Run: node scripts/build-fpic.mjs        (Node >= 18, no deps)
'use strict';
import { existsSync, writeFileSync, renameSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GROUP = 24451;
const UA = { headers: { 'User-Agent': 'CrownsTCG/1.0 (personal card tracker)' } };
const SERIES = [
  { id: 'fpic1', n: 1, lo: 37, ext: 'png', v: 3, regions: ['Kanto', 'Sinnoh', 'Alola'] },
  { id: 'fpic2', n: 2, lo: 46, ext: 'webp', v: 3, regions: ['Johto', 'Unova', 'Galar'] },
  { id: 'fpic3', n: 3, lo: 55, ext: 'webp', v: 1, regions: ['Hoenn', 'Kalos', 'Paldea'] },
];
const VARIANT = /staff|cosmos|exclusive|prerelease|pok[eé]mon center/i;

async function getJson(url, tries = 4) {
  for (let t = 1; ; t++) {
    try { const r = await fetch(url, UA); if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`); return await r.json(); }
    catch (e) { if (t >= tries) throw e; await new Promise((s) => setTimeout(s, 500 * t)); }
  }
}
const ext = (p, k) => (p.extendedData || []).find((e) => e.name === k)?.value ?? null;

const [prod, price] = await Promise.all([
  getJson(`https://tcgcsv.com/tcgplayer/3/${GROUP}/products`),
  getJson(`https://tcgcsv.com/tcgplayer/3/${GROUP}/prices`),
]);
const mkt = {};
for (const r of price.results || []) {
  const v = r.marketPrice ?? r.midPrice;
  if (typeof v === 'number') mkt[r.productId] = Math.max(mkt[r.productId] || 0, v);
}
const byNum = {};   // 37 -> { productId, name }
for (const p of prod.results || []) {
  const n = parseInt(ext(p, 'Number'), 10);
  if (!(n >= 37 && n <= 63) || VARIANT.test(p.name)) continue;
  if (!byNum[n]) byNum[n] = { productId: p.productId, name: p.name.replace(/\s+-\s+.*$/, '').trim() };
}

// TCGdex mep detail (best-effort: missing data just leaves the fields empty)
const dex = {};
await Promise.all(Array.from({ length: 27 }, async (_, i) => {
  const n = 37 + i;
  try { dex[n] = await getJson(`https://api.tcgdex.net/v2/en/cards/mep-${String(n).padStart(3, '0')}`, 2); } catch {}
}));
const cmOf = (cm) => (cm ? {
  trend: cm.trend ?? null, low: cm.low ?? null, avg1: cm.avg1 ?? null, avg7: cm.avg7 ?? null, avg30: cm.avg30 ?? null,
  holo: (cm['avg30-holo'] != null || cm['avg7-holo'] != null) ? {
    trend: cm['trend-holo'] ?? null, avg1: cm['avg1-holo'] ?? null, avg7: cm['avg7-holo'] ?? null, avg30: cm['avg30-holo'] ?? null,
  } : null,
} : null);

for (const S of SERIES) {
  const name = `First Partner Illustration · Series ${S.n}`;
  const cards = [];
  let localArt = 0;
  for (let i = 0; i < 9; i++) {
    const n = S.lo + i, mep = String(n).padStart(3, '0');
    const t = byNum[n], d = dex[n] || {};
    const cardName = d.name || t?.name;
    if (!cardName) continue;
    const rel = `assets/${S.id}/mep-${n}.${S.ext}`;
    const local = existsSync(join(ROOT, rel));
    if (local) localArt++;
    const image = local ? `${rel}?v=${S.v}` : (t ? `https://tcgplayer-cdn.tcgplayer.com/product/${t.productId}_in_1000x1000.jpg` : null);
    if (!image) continue;
    const p = t ? mkt[t.productId] : null;
    cards.push({
      id: `${S.id}-${n}`, localId: String(i + 1).padStart(3, '0'), num: i + 1, name: cardName,
      rarity: 'Promo', category: 'Pokemon', types: d.types || [], image, fullImg: true,
      priceUsd: typeof p === 'number' ? +p.toFixed(2) : null, priceVariant: 'market', variants: {},
      cardmarket: cmOf(d.pricing?.cardmarket), imageOk: true, illustrator: d.illustrator || '',
      meta: [['Set', name], ['Region', S.regions[Math.floor(i / 3)]], ['Promo', `MEP ${mep}`]],
      flavor: 'First-partner illustration promo.',
    });
  }
  if (cards.length < 9) { console.error(`${S.id}: only ${cards.length}/9 cards found — file left untouched`); process.exitCode = 1; continue; }
  const payload = {
    set: { id: S.id, name, total: cards.length, official: cards.length, logo: '', external: false },
    snapshotAt: new Date().toISOString(),
    source: 'First Partner Illustration Collection 2026 (art: Limitless · price: TCGplayer)',
    cards,
  };
  const out = join(ROOT, 'data', `cards-${S.id}.js`), tmp = out + '.tmp';
  writeFileSync(tmp,
    `// First Partner Illustration Collection — Series ${S.n} (2026, 30th anniversary).\n`
    + `// MEP Black Star Promos ${String(S.lo).padStart(3, '0')}-${String(S.lo + 8).padStart(3, '0')}: ${S.regions.join(' / ')} starters.\n`
    + `// GENERATED by scripts/build-fpic.mjs. Art: assets/${S.id}/ (736x1024 Limitless scans,\n`
    + `// scripts/fetch-fpic-art.py). Price: TCGplayer via TCGCSV group ${GROUP}, matched by number.\n`
    + `// Illustrator / types / Cardmarket trend: TCGdex set "mep". Each regional trio is a panoramic scene.\n`
    + `window.CARD_SETS = window.CARD_SETS || {};\n`
    + `window.CARD_SETS[${JSON.stringify(S.id)}] = ${JSON.stringify(payload)};\n`);
  for (let k = 0; ; k++) { try { renameSync(tmp, out); break; } catch (e) { if (k >= 5) throw e; await new Promise((s) => setTimeout(s, 300 * (k + 1))); } }
  console.log(`wrote data/cards-${S.id}.js — ${cards.length} cards, ${cards.filter((c) => c.priceUsd != null).length} priced, ${localArt} local art`);
}
