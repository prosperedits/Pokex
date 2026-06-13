// POKEX set snapshot — fetches one TCGdex set into data/cards-<id>.js as a
// window.CARD_SETS entry. Node >= 18 (built-in fetch). No dependencies.
// Usage: node refresh-data.mjs [setId] [expected set name]
//        node refresh-data.mjs                      -> me02 Phantasmal Flames
//        node refresh-data.mjs me02.5 "Ascended Heroes"
// Fail-safe: on any abort, the existing data file is left untouched, exit 1.

import { writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://api.tcgdex.net/v2/en';
const SET_ID = process.argv[2] || 'me02';
const SET_NAME = process.argv[3] || (SET_ID === 'me02' ? 'Phantasmal Flames' : null);
const CONCURRENCY = 10;
const RETRIES = 3;

const report = {
  startedAt: new Date().toISOString(),
  fetched: 0, failed: 0,
  tcgplayerPriced: 0, cardmarketOnly: 0, unpriced: 0,
  imageVerified: 0, imageUnavailable: 0,
  schemaErrors: [],
};

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

// HEAD probe; CDNs sometimes reject HEAD (405/403) — fall back to a ranged GET.
async function probeImage(url) {
  try {
    let res = await fetch(url, { method: 'HEAD' });
    if (res.status === 405 || res.status === 403) {
      res = await fetch(url, { headers: { range: 'bytes=0-0' } });
    }
    return res.ok || res.status === 206;
  } catch {
    return false;
  }
}

async function pool(items, worker) {
  const results = new Array(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, run));
  return results;
}

// --- Adapter: raw TCGdex card -> app schema ---------------------------------
// Canonical price = TCGplayer USD marketPrice of: normal -> holofoil -> reverse-holofoil.
// Cards without TCGplayer data are unpriced for tiering; Cardmarket trend (EUR) shown separately.
const VARIANT_ORDER = ['normal', 'holofoil', 'reverse-holofoil'];

function adapt(raw) {
  if (!raw.id || !raw.localId || !raw.name || !raw.image) {
    throw new Error(`missing required field on ${raw.id || 'unknown card'}`);
  }
  const tp = raw.pricing?.tcgplayer ?? null;
  const cm = raw.pricing?.cardmarket ?? null;

  let priceUsd = null, priceVariant = null;
  for (const v of VARIANT_ORDER) {
    const mp = tp?.[v]?.marketPrice;
    if (typeof mp === 'number') { priceUsd = mp; priceVariant = v; break; }
  }

  const variants = {};
  for (const v of VARIANT_ORDER) {
    const p = tp?.[v];
    if (p && typeof p === 'object') {
      variants[v] = { low: p.lowPrice ?? null, mid: p.midPrice ?? null, market: p.marketPrice ?? null };
    }
  }

  return {
    id: raw.id,
    localId: raw.localId,
    num: parseInt(raw.localId, 10),
    name: raw.name,
    rarity: raw.rarity ?? null,
    category: raw.category ?? null,
    illustrator: raw.illustrator ?? null,
    types: raw.types ?? [],
    image: raw.image,
    priceUsd,
    priceVariant,
    variants,
    cardmarket: cm ? {
      trend: cm.trend ?? null, low: cm.low ?? null,
      avg1: cm.avg1 ?? null, avg7: cm.avg7 ?? null, avg30: cm.avg30 ?? null,
      holo: (cm['avg30-holo'] != null || cm['avg7-holo'] != null) ? {
        trend: cm['trend-holo'] ?? null,
        avg1: cm['avg1-holo'] ?? null, avg7: cm['avg7-holo'] ?? null, avg30: cm['avg30-holo'] ?? null,
      } : null,
    } : null,
    tcgplayerUpdated: tp?.updated ?? null,
  };
}

// --- Fixtures: frozen raw samples asserted on every run (schema-drift alarm) --
const FIXTURES = [
  {
    raw: {
      id: 'fx-1', localId: '009', name: 'Fixture Charmander', image: 'https://assets.tcgdex.net/x',
      rarity: 'Common', category: 'Pokemon',
      pricing: {
        tcgplayer: { unit: 'USD', updated: 't', normal: { lowPrice: 0.01, midPrice: 0.15, marketPrice: 0.1 }, 'reverse-holofoil': { marketPrice: 0.24 } },
        cardmarket: { unit: 'EUR', trend: 0.03, low: 0.02, avg1: 0.02, avg7: 0.02, avg30: 0.02, 'avg30-holo': 0.07, 'avg7-holo': 0.07, 'avg1-holo': 0.08, 'trend-holo': 0.07 },
      },
    },
    expect: { priceUsd: 0.1, priceVariant: 'normal', cmTrend: 0.03 },
  },
  {
    raw: {
      id: 'fx-2', localId: '130', name: 'Fixture Mega', image: 'https://assets.tcgdex.net/y',
      rarity: 'Mega Hyper Rare', category: 'Pokemon',
      pricing: { tcgplayer: { unit: 'USD', updated: 't', holofoil: { lowPrice: 321.49, midPrice: 420, marketPrice: 365.43 } } },
    },
    expect: { priceUsd: 365.43, priceVariant: 'holofoil', cmTrend: undefined },
  },
  {
    raw: { id: 'fx-3', localId: '050', name: 'Fixture Unpriced', image: 'https://assets.tcgdex.net/z', pricing: { cardmarket: { trend: 1.5 } } },
    expect: { priceUsd: null, priceVariant: null, cmTrend: 1.5 },
  },
];

function runFixtures() {
  for (const { raw, expect } of FIXTURES) {
    const a = adapt(raw);
    const ok = a.priceUsd === expect.priceUsd && a.priceVariant === expect.priceVariant
      && (a.cardmarket?.trend ?? undefined) === expect.cmTrend;
    if (!ok) throw new Error(`fixture ${raw.id} failed: got ${JSON.stringify({ p: a.priceUsd, v: a.priceVariant, cm: a.cardmarket?.trend })}`);
  }
  console.log(`fixtures: ${FIXTURES.length}/${FIXTURES.length} pass`);
}

// --- Main --------------------------------------------------------------------
async function main() {
  runFixtures();

  if (!SET_NAME) throw new Error('expected set name required for non-default sets: node refresh-data.mjs <id> "<name>"');
  const set = await fetchJson(`${API}/sets/${SET_ID}`);
  if (set.id !== SET_ID || set.name !== SET_NAME) {
    throw new Error(`set mismatch: got ${set.id} "${set.name}"`);
  }
  const total = set.cardCount.total, official = set.cardCount.official;
  if (set.cards.length !== total) {
    throw new Error(`card list ${set.cards.length} != cardCount.total ${total}`);
  }
  console.log(`set ${SET_ID} "${set.name}": ${total} cards (${official} official)`);

  const cards = await pool(set.cards, async (stub) => {
    let raw;
    try {
      raw = await fetchJson(`${API}/cards/${stub.id}`);
      report.fetched++;
    } catch (err) {
      report.failed++;
      throw new Error(`fetch failed for ${stub.id}: ${err.message}`);
    }
    let card;
    try {
      card = adapt(raw);
    } catch (err) {
      report.schemaErrors.push(err.message);
      throw err;
    }
    card.imageOk = await probeImage(`${card.image}/high.webp`);
    card.imageOk ? report.imageVerified++ : report.imageUnavailable++;
    if (card.priceUsd !== null) report.tcgplayerPriced++;
    else if (card.cardmarket?.trend != null) report.cardmarketOnly++;
    else report.unpriced++;
    return card;
  });

  cards.sort((a, b) => a.num - b.num);

  const payload = {
    set: { id: SET_ID, name: SET_NAME, total, official, logo: set.logo ?? `https://assets.tcgdex.net/en/me/${SET_ID}/logo` },
    snapshotAt: new Date().toISOString(),
    source: 'TCGdex (prices: TCGplayer USD / Cardmarket EUR)',
    cards,
  };

  // Atomic write: tmp -> validate -> rename. Existing file untouched on any throw above.
  mkdirSync(join(ROOT, 'data'), { recursive: true });
  const out = join(ROOT, 'data', `cards-${SET_ID}.js`);
  const tmp = out + '.tmp';
  writeFileSync(tmp,
    `window.CARD_SETS = window.CARD_SETS || {};\n` +
    `window.CARD_SETS[${JSON.stringify(SET_ID)}] = ${JSON.stringify(payload)};\n`);
  if (payload.cards.length !== total) throw new Error('post-write count mismatch');
  // Windows can EPERM a rename-over while a server/AV briefly holds the target.
  for (let i = 0; ; i++) {
    try { renameSync(tmp, out); break; }
    catch (err) {
      if (i >= 5) throw err;
      await new Promise(r => setTimeout(r, 300 * (i + 1)));
    }
  }

  report.finishedAt = new Date().toISOString();
  writeFileSync(join(ROOT, 'data', `refresh-report-${SET_ID}.json`), JSON.stringify(report, null, 2));
  console.table ? console.table([report]) : console.log(report);
  console.log(`wrote data/cards-${SET_ID}.js (${cards.length} cards)`);
}

main().catch((err) => {
  report.finishedAt = new Date().toISOString();
  report.fatal = String(err.message || err);
  try {
    mkdirSync(join(ROOT, 'data'), { recursive: true });
    writeFileSync(join(ROOT, 'data', `refresh-report-${SET_ID}.json`), JSON.stringify(report, null, 2));
  } catch { /* report write is best-effort */ }
  console.error(`REFRESH FAILED (existing data file preserved): ${report.fatal}`);
  process.exit(1);
});
