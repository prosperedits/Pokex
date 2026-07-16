// fetch-me05-tcgcsv.mjs — build data/cards-me05.js (ME05: Pitch Black) from
// TCGCSV/TCGplayer group 24688. Pitch Black is not on TCGdex yet, so card
// images come from the TCGplayer product CDN (fullImg, like the fpic sets)
// and prices from the group's market prices. Re-run any time to refresh;
// once TCGdex catalogues me05 the set can migrate to refresh-data.mjs.
// Run: node scripts/fetch-me05-tcgcsv.mjs
'use strict';
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const GROUP = 24688;
const UA = { headers: { 'User-Agent': 'Crowns-Card-Tracker/1.0' } };   // tcgcsv usage guidelines

const products = (await (await fetch(`https://tcgcsv.com/tcgplayer/3/${GROUP}/products`, UA)).json()).results;
const prices = (await (await fetch(`https://tcgcsv.com/tcgplayer/3/${GROUP}/prices`, UA)).json()).results;
const priceBy = new Map();
for (const p of prices) {
  const cur = priceBy.get(p.productId);
  // prefer Normal, else first seen (Holofoil etc.)
  if (!cur || p.subTypeName === 'Normal') priceBy.set(p.productId, p);
}

const ext = (p, k) => (p.extendedData || []).find((e) => e.name === k)?.value ?? null;
const singles = products
  .map((p) => {
    const numRaw = ext(p, 'Number');
    if (!numRaw) return null;
    const [numStr, offStr] = String(numRaw).split('/');
    const num = parseInt(numStr, 10);
    if (!num) return null;
    return { p, num, numStr: numStr.padStart(3, '0'), official: parseInt(offStr, 10) || null };
  })
  .filter(Boolean)
  .sort((a, b) => a.num - b.num || a.p.productId - b.p.productId);

// one card per number: the plain printing wins over stamped/variant listings
const byNum = new Map();
for (const s of singles) if (!byNum.has(s.num)) byNum.set(s.num, s);

const official = [...byNum.values()].map((s) => s.official).find(Boolean) || byNum.size;
const cards = [...byNum.values()].map(({ p, num, numStr }) => {
  const pr = priceBy.get(p.productId);
  const usd = pr ? (pr.marketPrice ?? pr.midPrice ?? null) : null;
  const rarity = ext(p, 'Rarity') || '';
  const cardType = ext(p, 'Card Type') || ext(p, 'CardType') || '';
  const category = /trainer|supporter|item|stadium|tool/i.test(cardType) ? 'Trainer'
    : /energy/i.test(cardType) ? 'Energy' : 'Pokemon';
  return {
    id: `me05-${num}`, localId: numStr, num,
    name: p.name.replace(/\s+-\s+\d+.*$/, '').trim(),
    rarity, category, types: [],
    image: `https://tcgplayer-cdn.tcgplayer.com/product/${p.productId}_in_1000x1000.jpg`,
    fullImg: true,
    priceUsd: typeof usd === 'number' ? +usd.toFixed(2) : null,
    priceVariant: 'market', variants: {}, cardmarket: null, imageOk: true,
    illustrator: '', meta: [['Set', 'Pitch Black'], ['Number', `${numStr}/${String(official).padStart(3, '0')}`]],
    flavor: '',
  };
});

const out = `// ME05: Pitch Black — built from TCGCSV group ${GROUP} (TCGplayer preorder/market
// prices; card images from the TCGplayer product CDN — the set is not on TCGdex
// yet). Regenerate: node scripts/fetch-me05-tcgcsv.mjs
window.CARD_SETS = window.CARD_SETS || {};
window.CARD_SETS["me05"] = ${JSON.stringify({
  set: { id: 'me05', name: 'Pitch Black', total: cards.length, official, logo: '', external: false },
  snapshotAt: new Date().toISOString(),
  source: 'TCGplayer via TCGCSV (preorder market prices)',
  cards,
}, null, 0)};
`;
writeFileSync(join(HERE, '..', 'data', 'cards-me05.js'), out);
console.log(`me05 Pitch Black: ${cards.length} cards (official ${official}), ` +
  `${cards.filter((c) => c.priceUsd != null).length} priced`);
