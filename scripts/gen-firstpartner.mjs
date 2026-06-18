// First Partner Pack — the oversized starter promo cards. NOT on TCGdex, so this
// builds the set straight from TCGCSV (TCGplayer images + market prices). The 24
// single-Pokémon products are the jumbo promo cards; the "Pack"/"Set"/"Binder"
// products are sealed and excluded. Writes data/cards-fpp.js. Node >= 18, no deps.
// Usage: node gen-firstpartner.mjs

import { writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GROUP = 2776; // TCGCSV Pokémon group "First Partner Pack"
const ID = 'fpp', NAME = 'First Partner Pack';
// starter dex order so the wheel reads Kanto -> Galar instead of by price
const ORDER = ['Bulbasaur','Charmander','Squirtle','Chikorita','Cyndaquil','Totodile','Treecko','Torchic','Mudkip','Turtwig','Chimchar','Piplup','Snivy','Tepig','Oshawott','Chespin','Fennekin','Froakie','Rowlet','Litten','Popplio','Grookey','Scorbunny','Sobble'];

async function getJson(url) {
  const r = await fetch(url, { headers: { 'user-agent': 'phantasmal-showcase/1.0' } });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  return r.json();
}

async function main() {
  const [prod, price] = await Promise.all([
    getJson(`https://tcgcsv.com/tcgplayer/3/${GROUP}/products`),
    getJson(`https://tcgcsv.com/tcgplayer/3/${GROUP}/prices`),
  ]);
  const mkt = {};
  for (const r of price.results || []) { const mp = r.marketPrice; if (typeof mp === 'number') mkt[r.productId] = Math.max(mkt[r.productId] || 0, mp); }

  // keep only the single-Pokémon jumbo cards (drop sealed packs/sets/binders/code cards)
  const isCard = (n) => n && !/\b(pack|packs|set|binder|code|collection|box)\b/i.test(n);
  const cards = (prod.results || [])
    .filter((p) => isCard(p.name))
    .map((p) => {
      const name = (p.name || '').trim();
      const order = ORDER.indexOf(name);
      return {
        productId: p.productId, name,
        num: order < 0 ? 900 + p.productId % 100 : order + 1,
        price: mkt[p.productId] ?? null,
      };
    })
    .sort((a, b) => a.num - b.num)
    .map((c, i) => ({
      id: `fpp-${c.productId}`, localId: String(i + 1).padStart(3, '0'), num: i + 1,
      name: c.name, rarity: 'Promo', category: 'Pokemon', types: [],
      image: `https://tcgplayer-cdn.tcgplayer.com/product/${c.productId}_in_1000x1000.jpg`, fullImg: true,
      priceUsd: c.price, priceVariant: c.price != null ? 'market' : null, variants: {}, cardmarket: null,
      imageOk: true, illustrator: '',
      meta: [['Set', 'First Partner Pack'], ['Type', 'Jumbo Promo'], ['Year', '2021']],
      flavor: 'Oversized first-partner promo card.',
    }));
  if (!cards.length) throw new Error('no First Partner cards found');

  const payload = {
    set: { id: ID, name: NAME, total: cards.length, official: cards.length, logo: '', external: false },
    snapshotAt: new Date().toISOString(), source: 'TCGplayer (via TCGCSV)', cards,
  };
  mkdirSync(join(ROOT, 'data'), { recursive: true });
  const out = join(ROOT, 'data', `cards-${ID}.js`), tmp = out + '.tmp';
  writeFileSync(tmp, `window.CARD_SETS = window.CARD_SETS || {};\nwindow.CARD_SETS[${JSON.stringify(ID)}] = ${JSON.stringify(payload)};\n`);
  for (let i = 0; ; i++) { try { renameSync(tmp, out); break; } catch (e) { if (i >= 5) throw e; await new Promise(r => setTimeout(r, 300 * (i + 1))); } }
  const priced = cards.filter((c) => c.priceUsd != null).length;
  console.log(`wrote data/cards-${ID}.js — ${cards.length} First Partner cards (${priced} priced)`);
}
main().catch((e) => { console.error('FIRST PARTNER GEN FAILED:', e.message || e); process.exit(1); });
