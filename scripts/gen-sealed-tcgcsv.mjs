// Regenerate data/sealed.js from TCGCSV — a FREE, keyless mirror of TCGplayer
// data that (crucially) includes SEALED products with market prices for every
// game. Run: `node scripts/gen-sealed-tcgcsv.mjs`. No API key, no account.
//
// Strategy: for each set the app knows, resolve its TCGCSV "group", pull that
// group's products + prices, keep the non-card (sealed) ones, classify them
// into a clean product type, and attach the live market price + a TCGplayer
// product photo. Prints a match report so wrong/missing maps are obvious.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', 'data', 'sealed.js');
const TODAY = new Date().toISOString().slice(0, 10);
const CATEGORY = { pokemon: 3, magic: 1, lorcana: 71, onepiece: 68 };
const IMG = (id) => `https://tcgplayer-cdn.tcgplayer.com/product/${id}_in_1000x1000.jpg`;

// The sets the app ships, in app order. `abbr` (when present) is the cleanest
// join key (Lorcana set #, One Piece OPxx code); otherwise we match by name.
const APP_SETS = [
  // —— Pokémon (match by name; TCGCSV prefixes like "ME04: " are fine) ——
  { id: 'sv01', game: 'pokemon', name: 'Scarlet & Violet', abbr: 'SVI' },
  { id: 'sv02', game: 'pokemon', name: 'Paldea Evolved' },
  { id: 'sv03', game: 'pokemon', name: 'Obsidian Flames' },
  { id: 'sv03.5', game: 'pokemon', name: '151', abbr: 'MEW' },
  { id: 'sv04', game: 'pokemon', name: 'Paradox Rift' },
  { id: 'sv04.5', game: 'pokemon', name: 'Paldean Fates' },
  { id: 'sv05', game: 'pokemon', name: 'Temporal Forces' },
  { id: 'sv06', game: 'pokemon', name: 'Twilight Masquerade' },
  { id: 'sv06.5', game: 'pokemon', name: 'Shrouded Fable' },
  { id: 'sv07', game: 'pokemon', name: 'Stellar Crown' },
  { id: 'sv08', game: 'pokemon', name: 'Surging Sparks' },
  { id: 'sv08.5', game: 'pokemon', name: 'Prismatic Evolutions' },
  { id: 'sv09', game: 'pokemon', name: 'Journey Together' },
  { id: 'sv10', game: 'pokemon', name: 'Destined Rivals' },
  { id: 'sv10.5b', game: 'pokemon', name: 'Black Bolt' },
  { id: 'sv10.5w', game: 'pokemon', name: 'White Flare' },
  { id: 'me01', game: 'pokemon', name: 'Mega Evolution' },
  { id: 'me02', game: 'pokemon', name: 'Phantasmal Flames' },
  { id: 'me02.5', game: 'pokemon', name: 'Ascended Heroes' },
  { id: 'me03', game: 'pokemon', name: 'Perfect Order' },
  { id: 'me04', game: 'pokemon', name: 'Chaos Rising' },
  // —— Magic (exact name avoids the Commander/Art/Promo sibling groups) ——
  { id: 'mtg-tdm', game: 'magic', name: 'Tarkir: Dragonstorm' },
  { id: 'mtg-fin', game: 'magic', name: 'Final Fantasy' },
  { id: 'mtg-eoe', game: 'magic', name: 'Edge of Eternities' },
  { id: 'mtg-tla', game: 'magic', name: 'Avatar: The Last Airbender' },
  { id: 'mtg-spm', game: 'magic', name: "Marvel's Spider-Man" },
  { id: 'mtg-dsk', game: 'magic', name: 'Duskmourn: House of Horror' },
  { id: 'mtg-blb', game: 'magic', name: 'Bloomburrow' },
  { id: 'mtg-mh3', game: 'magic', name: 'Modern Horizons 3' },
  { id: 'mtg-otj', game: 'magic', name: 'Outlaws of Thunder Junction' },
  { id: 'mtg-mkm', game: 'magic', name: 'Murders at Karlov Manor' },
  // —— Lorcana (match by set number = abbreviation) ——
  { id: 'lor-12', game: 'lorcana', name: 'Wilds Unknown', abbr: '12' },
  { id: 'lor-11', game: 'lorcana', name: 'Winterspell', abbr: '11' },
  { id: 'lor-10', game: 'lorcana', name: 'Whispers in the Well', abbr: '10' },
  { id: 'lor-9', game: 'lorcana', name: 'Fabled', abbr: '9' },
  { id: 'lor-8', game: 'lorcana', name: 'Reign of Jafar', abbr: '8' },
  { id: 'lor-7', game: 'lorcana', name: "Archazia's Island", abbr: '7' },
  { id: 'lor-6', game: 'lorcana', name: 'Azurite Sea', abbr: '6' },
  { id: 'lor-5', game: 'lorcana', name: 'Shimmering Skies', abbr: '5' },
  { id: 'lor-4', game: 'lorcana', name: "Ursula's Return", abbr: '4' },
  { id: 'lor-3', game: 'lorcana', name: 'Into the Inklands', abbr: '3' },
  { id: 'lor-2', game: 'lorcana', name: 'Rise of the Floodborn', abbr: '2' },
  { id: 'lor-1', game: 'lorcana', name: 'The First Chapter', abbr: '1' },
  // —— One Piece (match by OPxx code = abbreviation prefix) ——
  { id: 'op-OP16', game: 'onepiece', name: 'The Time of Battle', abbr: 'OP16' },
  { id: 'op-OP15', game: 'onepiece', name: "Adventure on Kami's Island", abbr: 'OP15' },
  { id: 'op-OP14', game: 'onepiece', name: "The Azure Sea's Seven", abbr: 'OP14' },
  { id: 'op-OP13', game: 'onepiece', name: 'Carrying On His Will', abbr: 'OP13' },
  { id: 'op-OP12', game: 'onepiece', name: 'Legacy of the Master', abbr: 'OP12' },
  { id: 'op-OP11', game: 'onepiece', name: 'A Fist of Divine Speed', abbr: 'OP11' },
  { id: 'op-OP10', game: 'onepiece', name: 'Royal Blood', abbr: 'OP10' },
  { id: 'op-OP09', game: 'onepiece', name: 'Emperors in the New World', abbr: 'OP09' },
  { id: 'op-OP08', game: 'onepiece', name: 'Two Legends', abbr: 'OP08' },
  { id: 'op-OP07', game: 'onepiece', name: '500 Years in the Future', abbr: 'OP07' },
  { id: 'op-OP06', game: 'onepiece', name: 'Wings of the Captain', abbr: 'OP06' },
  { id: 'op-OP05', game: 'onepiece', name: 'Awakening of the New Era', abbr: 'OP05' },
  { id: 'op-OP01', game: 'onepiece', name: 'Romance Dawn', abbr: 'OP01' },
];

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const getJSON = async (url) => {
  const r = await fetch(url, { headers: { 'user-agent': 'pokex-sealed/1.0' } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
};

// Classify a sealed product into a clean {label, detail, prio}. Higher prio
// sorts first (the booster box leads, single packs trail).
function classify(name) {
  const n = name.toLowerCase();
  const has = (...k) => k.every((x) => n.includes(x));
  if (n.includes('case')) return null;                       // wholesale, skip
  if (has('elite trainer') && (n.includes('pokemon center') || n.includes('pokémon center')))
    return { label: 'Pokémon Center ETB', detail: 'exclusive · 11 packs', prio: 7 };
  if (has('elite trainer')) return { label: 'Elite Trainer Box', detail: '9 packs + accessories', prio: 6 };
  if (n.includes('collector booster box')) return { label: 'Collector Booster Box', detail: 'sealed display', prio: 9 };
  if (n.includes('play booster box')) return { label: 'Play Booster Box', detail: 'sealed display', prio: 9 };
  if (n.includes('set booster box')) return { label: 'Set Booster Box', detail: 'sealed display', prio: 8 };
  if (n.includes('draft booster box')) return { label: 'Draft Booster Box', detail: 'sealed display', prio: 8 };
  if (has('booster box') || n.includes('booster display')) return { label: 'Booster Box', detail: '36 packs', prio: 10 };
  if (n.includes("illumineer's trove") || n.includes('illumineers trove')) return { label: "Illumineer's Trove", detail: 'box + 8 packs', prio: 7 };
  if (has('booster bundle')) return { label: 'Booster Bundle', detail: '6 packs', prio: 5 };
  if (n.includes('build') && n.includes('battle') && n.includes('stadium')) return { label: 'Build & Battle Stadium', detail: '8 packs + 2 decks', prio: 4 };
  if (n.includes('build') && n.includes('battle')) return { label: 'Build & Battle Box', detail: '4 packs + 40-card deck', prio: 4 };
  if (n.includes('bundle') && !n.includes('art')) return { label: 'Bundle', detail: '9 packs + extras', prio: 5 };
  if (n.includes('starter deck')) return { label: 'Starter Deck', detail: 'ready-to-play deck', prio: 3 };
  if (n.includes('gift set')) return { label: 'Gift Set', detail: 'collector gift set', prio: 3 };
  if (n.includes('booster pack')) return { label: 'Booster Pack', detail: 'single pack', prio: 2 };
  return null;
}

function bestPrice(rows) {
  // prefer the "Normal" subtype; market price, then mid, then low
  const pick = rows.find((r) => r.subTypeName === 'Normal') || rows[0];
  if (!pick) return null;
  const v = pick.marketPrice ?? pick.midPrice ?? pick.lowPrice;
  return typeof v === 'number' ? v : null;
}

async function run() {
  const groupsByCat = {};
  for (const [game, cat] of Object.entries(CATEGORY)) {
    groupsByCat[game] = (await getJSON(`https://tcgcsv.com/tcgplayer/${cat}/groups`)).results || [];
  }

  function resolveGroup(set) {
    const groups = groupsByCat[set.game];
    if (set.abbr) {
      const a = norm(set.abbr);
      const byAbbr = groups.find((g) => norm(g.abbreviation) === a)
        || groups.find((g) => norm(g.abbreviation).split(' ')[0] === a); // "OP15 EB04" -> OP15
      if (byAbbr) return byAbbr;
    }
    const target = norm(set.name);
    const exact = groups.find((g) => norm(g.name) === target);
    if (exact) return exact;
    // contains, but never a Commander/Art/Promo/Event sibling; prefer shortest name
    const bad = /commander|art series|promo|playtest|event cards|championship|anniversary/i;
    const cands = groups.filter((g) => norm(g.name).includes(target) && !bad.test(g.name));
    cands.sort((a, b) => a.name.length - b.name.length);
    return cands[0] || null;
  }

  const out = {};
  const report = [];
  for (const set of APP_SETS) {
    const group = resolveGroup(set);
    if (!group) { report.push(`  ✗ ${set.id.padEnd(9)} ${set.game.padEnd(8)} "${set.name}" — NO GROUP`); continue; }
    let products, prices;
    try {
      const base = `https://tcgcsv.com/tcgplayer/${CATEGORY[set.game]}/${group.groupId}`;
      [products, prices] = await Promise.all([getJSON(`${base}/products`), getJSON(`${base}/prices`)]);
    } catch (e) { report.push(`  ✗ ${set.id.padEnd(9)} fetch failed: ${e.message}`); continue; }
    const priceByPid = {};
    for (const p of prices.results || []) (priceByPid[p.productId] ||= []).push(p);

    const isCard = (p) => {
      const ed = Object.fromEntries((p.extendedData || []).map((e) => [e.name, e.value]));
      return 'Number' in ed || 'Rarity' in ed;
    };
    const seen = new Set();
    const items = [];
    for (const p of products.results || []) {
      if (isCard(p)) continue;
      const cls = classify(p.name);
      if (!cls || seen.has(cls.label)) continue;
      const price = bestPrice(priceByPid[p.productId] || []);
      if (price == null) continue;             // no price = don't show "tracking soon" forever
      seen.add(cls.label);
      items.push({ name: cls.label, detail: cls.detail, img: IMG(p.productId),
        marketUsd: Math.round(price * 100) / 100, source: 'TCGplayer', checked: TODAY, prio: cls.prio });
    }
    items.sort((a, b) => b.prio - a.prio || b.marketUsd - a.marketUsd);
    const top = items.slice(0, 8).map(({ prio, ...rest }) => rest);
    if (top.length) {
      out[set.id] = top;
      report.push(`  ✓ ${set.id.padEnd(9)} → [${group.groupId}] ${group.name.padEnd(34)} ${top.length} sealed  (eg ${top[0].name} $${top[0].marketUsd})`);
    } else {
      report.push(`  · ${set.id.padEnd(9)} → [${group.groupId}] ${group.name} — 0 priced sealed`);
    }
  }

  const banner = `// Sealed-product prices — GENERATED by scripts/gen-sealed-tcgcsv.mjs\n`
    + `// Source: TCGCSV (free TCGplayer mirror). Market price + product photo per\n`
    + `// item. Re-run any time to refresh. Last generated: ${TODAY}.\n`;
  writeFileSync(OUT, `${banner}window.SEALED_PRODUCTS = ${JSON.stringify(out, null, 2)};\n`);
  console.log(report.join('\n'));
  console.log(`\nWrote ${Object.keys(out).length}/${APP_SETS.length} sets → ${OUT}`);
}
run().catch((e) => { console.error(e); process.exit(1); });
