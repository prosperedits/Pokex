// fetch-30th.mjs — build data/cards-30th.js (ME: 30th Celebration, released
// 2026-09-16) as a window.CARD_SETS entry in the same shape as the TCGdex sets.
//
// Why a separate script: TCGdex catalogues the set (id "30th", 158 cards with
// art, rarity, illustrator, types) but carries NO prices for it yet, so
// refresh-data.mjs would write it fully unpriced. Prices come from TCGCSV
// (free TCGplayer mirror) group 24722, matched by card number. TCGplayer also
// lists the three "RGB Rare" Mew cards (R/RGB, G/RGB, B/RGB) that TCGdex does not;
// they are appended with TCGplayer product images (fullImg) so the set is complete.
// Once TCGdex has TCGplayer prices, its own price wins (same order as
// refresh-data.mjs: normal -> holofoil -> reverse-holofoil).
//
// Run: node scripts/fetch-30th.mjs     (Node >= 18, no deps; existing file kept on failure)
'use strict';
import { writeFileSync, renameSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SET_ID = '30th', SET_NAME = '30th Celebration', GROUP = 24722;
const API = 'https://api.tcgdex.net/v2/en';
const UA = { headers: { 'User-Agent': 'CrownsTCG/1.0 (personal card tracker)' } };
const VARIANT_ORDER = ['normal', 'holofoil', 'reverse-holofoil'];

async function getJson(url, tries = 4) {
  for (let t = 1; ; t++) {
    try { const r = await fetch(url, UA); if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`); return await r.json(); }
    catch (e) { if (t >= tries) throw e; await new Promise((s) => setTimeout(s, 500 * t)); }
  }
}
async function probe(url) {
  try { const r = await fetch(url, { method: 'HEAD', ...UA }); return r.ok; } catch { return false; }
}
async function pool(items, n, fn) {
  const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); } }));
  return out;
}
const ext = (p, k) => (p.extendedData || []).find((e) => e.name === k)?.value ?? null;
const r2 = (v) => (typeof v === 'number' ? +v.toFixed(2) : null);

// 1) TCGCSV: number -> { productId, name, rarity, row } (max market across subtypes)
const tcgBase = `https://tcgcsv.com/tcgplayer/3/${GROUP}`;
const [prodRes, priceRes] = await Promise.all([getJson(`${tcgBase}/products`), getJson(`${tcgBase}/prices`)]);
let tcgUpdated = null;
try { tcgUpdated = (await (await fetch('https://tcgcsv.com/last-updated.txt', UA)).text()).trim() || null; } catch {}
const rowsBy = new Map();
for (const r of priceRes.results || []) { if (!rowsBy.has(r.productId)) rowsBy.set(r.productId, []); rowsBy.get(r.productId).push(r); }
const tcg = new Map();   // key: "001".."158" or "R"/"G"/"B"
for (const p of prodRes.results || []) {
  const numRaw = ext(p, 'Number'); if (!numRaw) continue;
  const head = String(numRaw).split('/')[0].trim();
  const key = /^\d+$/.test(head) ? head.padStart(3, '0') : head.toUpperCase();
  const rows = rowsBy.get(p.productId) || [];
  const best = rows.filter((r) => typeof r.marketPrice === 'number').sort((a, b) => b.marketPrice - a.marketPrice)[0]
    || rows.find((r) => typeof r.midPrice === 'number') || null;
  const entry = { productId: p.productId, name: p.name, rarity: ext(p, 'Rarity'), numRaw: String(numRaw), best };
  if (!tcg.has(key) || (best && !tcg.get(key).best)) tcg.set(key, entry);
}
console.log(`TCGCSV group ${GROUP}: ${tcg.size} numbered cards`);

// 2) TCGdex: the card list + per-card detail
const set = await getJson(`${API}/sets/${SET_ID}`);
if (set.id !== SET_ID || set.name !== SET_NAME) throw new Error(`TCGdex set mismatch: ${set.id} "${set.name}"`);
const official = set.cardCount?.official || 128;
const details = await pool(set.cards, 10, (stub) => getJson(`${API}/cards/${stub.id}`));

const tpVariants = (row) => {
  if (!row) return {};
  const k = /reverse/i.test(row.subTypeName) ? 'reverse-holofoil' : /holo/i.test(row.subTypeName) ? 'holofoil' : 'normal';
  return { [k]: { low: r2(row.lowPrice), mid: r2(row.midPrice), market: r2(row.marketPrice) } };
};
const used = new Set();
const cards = await pool(details, 10, async (raw) => {
  const t = tcg.get(String(raw.localId).padStart(3, '0'));
  if (t) used.add(String(raw.localId).padStart(3, '0'));
  const tp = raw.pricing?.tcgplayer ?? null, cm = raw.pricing?.cardmarket ?? null;
  let priceUsd = null, priceVariant = null, variants = {};
  for (const v of VARIANT_ORDER) { const mp = tp?.[v]?.marketPrice; if (typeof mp === 'number') { priceUsd = mp; priceVariant = v; break; } }
  if (priceUsd != null) {
    for (const v of VARIANT_ORDER) { const p = tp?.[v]; if (p && typeof p === 'object') variants[v] = { low: p.lowPrice ?? null, mid: p.midPrice ?? null, market: p.marketPrice ?? null }; }
  } else if (t?.best) {
    variants = tpVariants(t.best);
    priceVariant = Object.keys(variants)[0];
    priceUsd = r2(t.best.marketPrice ?? t.best.midPrice);
  }
  const hasArt = !!raw.image && await probe(`${raw.image}/high.webp`);
  return {
    id: raw.id, localId: raw.localId, num: parseInt(raw.localId, 10),
    name: raw.name, rarity: raw.rarity ?? t?.rarity ?? null, category: raw.category ?? 'Pokemon',
    illustrator: raw.illustrator ?? null, types: raw.types ?? [],
    image: hasArt ? raw.image : (t ? `https://tcgplayer-cdn.tcgplayer.com/product/${t.productId}_in_1000x1000.jpg` : raw.image),
    ...(hasArt ? {} : { fullImg: true }),
    priceUsd, priceVariant, variants,
    cardmarket: cm ? {
      trend: cm.trend ?? null, low: cm.low ?? null, avg1: cm.avg1 ?? null, avg7: cm.avg7 ?? null, avg30: cm.avg30 ?? null,
      holo: (cm['avg30-holo'] != null || cm['avg7-holo'] != null) ? {
        trend: cm['trend-holo'] ?? null, avg1: cm['avg1-holo'] ?? null, avg7: cm['avg7-holo'] ?? null, avg30: cm['avg30-holo'] ?? null,
      } : null,
    } : null,
    tcgplayerUpdated: tp?.updated ?? (t?.best ? tcgUpdated : null),
    imageOk: true,
  };
});
cards.sort((a, b) => a.num - b.num);

// 3) TCGplayer-only cards (the RGB Rare Mews) appended after the numbered run
const rgb = (k) => { const i = ['R', 'G', 'B'].indexOf(k); return i < 0 ? 99 : i; };
const extras = [...tcg.entries()].filter(([k]) => !used.has(k) && !/^\d+$/.test(k))
  .sort(([a], [b]) => rgb(a) - rgb(b) || a.localeCompare(b));
let nextNum = Math.max(...cards.map((c) => c.num)) + 1;
for (const [k, t] of extras) {
  const variants = tpVariants(t.best);
  cards.push({
    id: `${SET_ID}-${k}`, localId: k, num: nextNum++,
    name: t.name.replace(/\s+-\s+.*$/, '').trim(), rarity: t.rarity || null, category: 'Pokemon',
    illustrator: null, types: [],
    image: `https://tcgplayer-cdn.tcgplayer.com/product/${t.productId}_in_1000x1000.jpg`, fullImg: true,
    priceUsd: t.best ? r2(t.best.marketPrice ?? t.best.midPrice) : null,
    priceVariant: t.best ? Object.keys(variants)[0] : null, variants,
    cardmarket: null, tcgplayerUpdated: t.best ? tcgUpdated : null,
    imageOk: true, meta: [['Set', SET_NAME], ['Number', t.numRaw]],
  });
}
const unmatched = [...tcg.keys()].filter((k) => /^\d+$/.test(k) && !used.has(k));
if (unmatched.length) console.log(`  TCGCSV numbers with no TCGdex card (skipped): ${unmatched.join(', ')}`);
if (cards.length < set.cards.length) throw new Error('card count shrank');

const payload = {
  set: { id: SET_ID, name: SET_NAME, total: cards.length, official, logo: set.logo || `https://assets.tcgdex.net/en/me/${SET_ID}/logo` },
  snapshotAt: new Date().toISOString(),
  source: `TCGdex (art) + TCGplayer via TCGCSV group ${GROUP} (USD market prices)`,
  cards,
};
const out = join(ROOT, 'data', `cards-${SET_ID}.js`), tmp = out + '.tmp';
writeFileSync(tmp,
  `// ME: 30th Celebration — GENERATED by scripts/fetch-30th.mjs (TCGdex art/metadata +\n`
  + `// TCGCSV group ${GROUP} prices). Re-run any time to refresh.\n`
  + `window.CARD_SETS = window.CARD_SETS || {};\n`
  + `window.CARD_SETS[${JSON.stringify(SET_ID)}] = ${JSON.stringify(payload)};\n`);
for (let i = 0; ; i++) { try { renameSync(tmp, out); break; } catch (e) { if (i >= 5) throw e; await new Promise((s) => setTimeout(s, 300 * (i + 1))); } }
const priced = cards.filter((c) => c.priceUsd != null).length;
const top = [...cards].filter((c) => c.priceUsd != null).sort((a, b) => b.priceUsd - a.priceUsd).slice(0, 5);
console.log(`wrote data/cards-${SET_ID}.js — ${cards.length} cards (${official} official), ${priced} priced, `
  + `${cards.filter((c) => !c.fullImg).length} with TCGdex art`);
console.log('top 5: ' + top.map((c) => `${c.name} ${c.localId} $${c.priceUsd}`).join(' · '));
