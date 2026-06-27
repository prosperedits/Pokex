// Build the GLOBAL card index for ALL FOUR universes from tcgcsv.com (free TCGplayer
// catalog mirror): real market prices + TCGplayer images for every printing.
// Writes one file per game, each APPENDING to window.CARD_INDEX so loading them all
// gives one merged search index:
//   data/card-index.js       (Pokémon)   window.CARD_INDEX = (..||[]).concat([...])
//   data/card-index-mtg.js    (Magic)
//   data/card-index-lor.js    (Lorcana)
//   data/card-index-op.js     (One Piece)
// Card shape: { i:productId, n, s:groupId, sn:setName, num, rar, img, p:priceUSD, g:game }
// tcgcsv blocks blank User-Agents — send a descriptive one. Node >= 18, no deps.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const UA = { 'User-Agent': 'CrownsTCG/1.0 (personal card tracker; contact fataher1997@gmail.com)' };
const DATA = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const CONC = 6;
const GAMES = [
  { cat: 3, g: 'pokemon', file: 'card-index.js' },
  { cat: 1, g: 'magic', file: 'card-index-mtg.js' },
  { cat: 71, g: 'lorcana', file: 'card-index-lor.js' },
  { cat: 68, g: 'onepiece', file: 'card-index-op.js' },
];
const SEALED = /booster box|booster bundle|elite trainer|trainer box|\bcase\b|collection box|collector|\btin\b|blister|premium|build ?& ?battle|stadium|sleeved|display|\bdeck\b|gift set|\bbundle\b|code card|\bbooster\b|\bpack\b|^lot |bulk|fat pack|bundle gift|commander|secret lair|starter|two-?player|gift box|booster draft/i;

const j = async (u) => { for (let t = 0; t < 4; t++) { try { const r = await fetch(u, { headers: UA }); if (r.ok) return await r.json(); } catch {} await new Promise((s) => setTimeout(s, 400 * (t + 1))); } return null; };
const arr = (x) => (x && x.results) || x || [];
const ext = (p, key) => { const e = (p.extendedData || []).find((d) => d.name === key); return e ? e.value : ''; };

async function buildGame(G) {
  const base = `https://tcgcsv.com/tcgplayer/${G.cat}`;
  const groups = arr(await j(`${base}/groups`));
  if (!groups.length) { console.error(`${G.g}: no groups`); return; }
  console.log(`${G.g}: ${groups.length} groups`);
  const idx = []; let done = 0;
  const queue = [...groups];
  async function worker() {
    while (queue.length) {
      const grp = queue.pop();
      const [prods, prices] = await Promise.all([j(`${base}/${grp.groupId}/products`), j(`${base}/${grp.groupId}/prices`)]);
      done++;
      const pmap = {};
      for (const pr of arr(prices)) { if (pr.marketPrice && (!pmap[pr.productId] || pr.marketPrice > pmap[pr.productId])) pmap[pr.productId] = pr.marketPrice; }
      for (const p of arr(prods)) {
        const rar = ext(p, 'Rarity'), num = ext(p, 'Number');
        if (!p.imageUrl) continue;
        if (!rar && !num) continue;
        if (rar === 'Code Card' || (SEALED.test(p.name) && !num)) continue;
        idx.push({ i: String(p.productId), n: p.cleanName || p.name, s: String(grp.groupId), sn: grp.name, num: num || '', rar: rar || '', img: p.imageUrl, p: pmap[p.productId] ?? null, g: G.g });
      }
      if (done % 30 === 0 || done === groups.length) console.log(`  ${G.g} ${done}/${groups.length} · ${idx.length} cards`);
    }
  }
  await Promise.all(Array.from({ length: CONC }, worker));
  idx.sort((a, b) => a.n.localeCompare(b.n) || a.sn.localeCompare(b.sn));
  writeFileSync(join(DATA, G.file), 'window.CARD_INDEX = (window.CARD_INDEX || []).concat(' + JSON.stringify(idx) + ');\n');
  const priced = idx.filter((c) => c.p != null).length;
  console.log(`${G.g} DONE — ${idx.length} cards · ${priced} priced → ${G.file}`);
  return idx.length;
}

let total = 0;
for (const G of GAMES) total += (await buildGame(G)) || 0;
console.log(`\nALL DONE — ${total} cards across all four universes.`);
