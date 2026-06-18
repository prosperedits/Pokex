// POKEX promo-set snapshot — like refresh-data.mjs but TOLERANT, for promo sets
// (SVP Black Star Promos, etc.) where some entries are imageless/nameless stubs.
// Those would hard-fail the strict refresh-data.mjs; here we SKIP them and report.
// Writes data/cards-<id>.js as a window.CARD_SETS entry. Node >= 18, no deps.
// Usage: node gen-promos.mjs svp "SVP Black Star Promos"

import { writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://api.tcgdex.net/v2/en';
const SET_ID = process.argv[2];
const SET_NAME = process.argv[3];
const CONCURRENCY = 10;
const RETRIES = 3;
if (!SET_ID || !SET_NAME) { console.error('usage: node gen-promos.mjs <setId> "<name>"'); process.exit(1); }

async function fetchJson(url, attempt = 1) {
  try {
    const res = await fetch(url, { headers: { 'user-agent': 'phantasmal-showcase/1.0' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    if (attempt >= RETRIES) throw err;
    await new Promise(r => setTimeout(r, 500 * 2 ** attempt));
    return fetchJson(url, attempt + 1);
  }
}

async function probeImage(url) {
  try {
    let res = await fetch(url, { method: 'HEAD' });
    if (res.status === 405 || res.status === 403) res = await fetch(url, { headers: { range: 'bytes=0-0' } });
    return res.ok || res.status === 206;
  } catch { return false; }
}

async function pool(items, worker) {
  const results = new Array(items.length);
  let next = 0;
  async function run() { while (next < items.length) { const i = next++; results[i] = await worker(items[i], i); } }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, run));
  return results;
}

// identical price/variant logic to refresh-data.mjs (TCGplayer USD canonical)
const VARIANT_ORDER = ['normal', 'holofoil', 'reverse-holofoil'];
function adapt(raw) {
  const tp = raw.pricing?.tcgplayer ?? null;
  const cm = raw.pricing?.cardmarket ?? null;
  let priceUsd = null, priceVariant = null;
  for (const v of VARIANT_ORDER) { const mp = tp?.[v]?.marketPrice; if (typeof mp === 'number') { priceUsd = mp; priceVariant = v; break; } }
  const variants = {};
  for (const v of VARIANT_ORDER) { const p = tp?.[v]; if (p && typeof p === 'object') variants[v] = { low: p.lowPrice ?? null, mid: p.midPrice ?? null, market: p.marketPrice ?? null }; }
  return {
    id: raw.id, localId: raw.localId, num: parseInt(raw.localId, 10) || 0,
    name: raw.name, rarity: raw.rarity ?? null, category: raw.category ?? null,
    illustrator: raw.illustrator ?? null, types: raw.types ?? [], image: raw.image,
    priceUsd, priceVariant, variants,
    cardmarket: cm ? {
      trend: cm.trend ?? null, low: cm.low ?? null, avg1: cm.avg1 ?? null, avg7: cm.avg7 ?? null, avg30: cm.avg30 ?? null,
      holo: (cm['avg30-holo'] != null || cm['avg7-holo'] != null) ? {
        trend: cm['trend-holo'] ?? null, avg1: cm['avg1-holo'] ?? null, avg7: cm['avg7-holo'] ?? null, avg30: cm['avg30-holo'] ?? null,
      } : null,
    } : null,
    tcgplayerUpdated: tp?.updated ?? null,
  };
}

// TCGdex has no TCGplayer prices for promos, so backfill from TCGCSV (same source
// used for Magic serialized) — matched by card Number. Best-effort: any failure
// just leaves promos unpriced. Returns { "001": 11.44, ... } (max market per number).
async function tcgcsvPricesByNumber(setId) {
  try {
    const groups = await fetchJson('https://tcgcsv.com/tcgplayer/3/groups'); // 3 = Pokémon
    const g = (groups.results || []).find((x) => (x.abbreviation || '').toUpperCase() === setId.toUpperCase());
    if (!g) { console.log(`  (no TCGCSV group for ${setId} — promos stay unpriced)`); return {}; }
    const [prod, price] = await Promise.all([
      fetchJson(`https://tcgcsv.com/tcgplayer/3/${g.groupId}/products`),
      fetchJson(`https://tcgcsv.com/tcgplayer/3/${g.groupId}/prices`),
    ]);
    const numById = {};
    for (const p of prod.results || []) {
      const n = (p.extendedData || []).find((e) => e.name === 'Number');
      if (n && n.value) numById[p.productId] = String(n.value);
    }
    const byNum = {};
    for (const r of price.results || []) {
      const n = numById[r.productId], mp = r.marketPrice;
      if (n && typeof mp === 'number') byNum[n] = Math.max(byNum[n] || 0, mp);
    }
    console.log(`  TCGCSV group ${g.groupId} "${g.name}": ${Object.keys(byNum).length} numbers priced`);
    return byNum;
  } catch (e) { console.log(`  (TCGCSV price backfill failed: ${e.message})`); return {}; }
}

async function main() {
  const set = await fetchJson(`${API}/sets/${SET_ID}`);
  if (set.id !== SET_ID) throw new Error(`set id mismatch: got ${set.id}`);
  const official = set.cardCount?.official ?? set.cards.length;
  console.log(`set ${SET_ID} "${set.name}": ${set.cards.length} stubs (${official} official)`);
  const priceByNum = await tcgcsvPricesByNumber(SET_ID);
  const lookupPrice = (localId) => priceByNum[localId] ?? priceByNum[String(localId).padStart(3, '0')] ?? null;

  let skipped = 0;
  const raw = await pool(set.cards, async (stub) => {
    try {
      const r = await fetchJson(`${API}/cards/${stub.id}`);
      if (!r.id || !r.localId || !r.name || !r.image) { skipped++; return null; } // tolerant: drop incomplete promo stubs
      const card = adapt(r);
      if (card.priceUsd == null) { const p = lookupPrice(card.localId); if (p != null) { card.priceUsd = p; card.priceVariant = 'market'; } }
      card.imageOk = await probeImage(`${card.image}/high.webp`);
      return card;
    } catch { skipped++; return null; }
  });
  const cards = raw.filter(Boolean).sort((a, b) => a.num - b.num);
  if (!cards.length) throw new Error('no usable cards');

  const payload = {
    set: { id: SET_ID, name: SET_NAME, total: cards.length, official, logo: set.logo ?? `https://assets.tcgdex.net/en/sv/${SET_ID}/logo`, external: false },
    snapshotAt: new Date().toISOString(),
    source: 'TCGdex (prices: TCGplayer USD / Cardmarket EUR)',
    cards,
  };
  mkdirSync(join(ROOT, 'data'), { recursive: true });
  const out = join(ROOT, 'data', `cards-${SET_ID}.js`), tmp = out + '.tmp';
  writeFileSync(tmp, `window.CARD_SETS = window.CARD_SETS || {};\nwindow.CARD_SETS[${JSON.stringify(SET_ID)}] = ${JSON.stringify(payload)};\n`);
  for (let i = 0; ; i++) { try { renameSync(tmp, out); break; } catch (err) { if (i >= 5) throw err; await new Promise(r => setTimeout(r, 300 * (i + 1))); } }
  const priced = cards.filter(c => c.priceUsd != null).length;
  console.log(`wrote data/cards-${SET_ID}.js — ${cards.length} cards (${skipped} skipped, ${priced} priced)`);
}

main().catch((e) => { console.error('PROMO GEN FAILED:', e.message || e); process.exit(1); });
