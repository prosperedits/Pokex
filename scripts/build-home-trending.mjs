// build-home-trending.mjs — generate data/home-trending.js for the HOMEPAGE from
// the real bundled set data, so the Spotlight / Card-of-the-Month / ticker feature
// genuinely trending cards that change with every data refresh (P: "those cards
// are gonna constantly change — all this stuff needs to be automatically done").
//
// Trend formula mirrors app.js monthTrendPct(): (cardmarket.avg1 - avg30) / avg30.
// Run: node scripts/build-home-trending.mjs   (also invoked by refresh-data.mjs)
'use strict';

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dotggFeed, dotggHistory, mtgjsonPrices, indexNow, indexBaseline, tcgcsvDay, BASELINE, daysBefore } from './trend-sources.mjs';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DATA = join(ROOT, 'data');

// load every bundled window.CARD_SETS file into a stub window
const window = { CARD_SETS: {} };
for (const f of readdirSync(DATA)) {
  if (!/^cards-.*\.js$/.test(f)) continue;
  try {
    new Function('window', readFileSync(join(DATA, f), 'utf8'))(window);
  } catch (e) {
    console.error(`skip ${f}: ${e.message}`);
  }
}

const pctOf = (c) => {
  const cm = c.cardmarket;
  if (!cm || typeof cm.avg1 !== 'number' || typeof cm.avg30 !== 'number') return null;
  if (cm.avg30 < 2 || cm.avg1 < 0.5) return null;  // pennies-based ratios are noise, not trends
  const pct = (cm.avg1 - cm.avg30) / cm.avg30 * 100;
  return Math.abs(pct) > 300 ? null : pct;         // implausible spikes = bad data, skip
};

// TCGplayer names carry the printing ("Super Alternate Art", "Showcase Fracture Foil",
// "R RGB") and stray collector numbers; split them so the page shows name + printing
const VAR = /\s+((?:Showcase|Borderless|Extended Art|Super Alternate Art|Alternate Art|Manga|Iconic|Enchanted|Serialized|Full Art|Special Illustration Rare|[RGB] RGB)\b.*)$/i;
const nameOf = (n) => {
  const clean = n.replace(/\s+\d{1,3}(?=\s|$)/g, '').replace(/([a-z])D([A-Z])/g, '$1 D. $2').trim();
  const m = VAR.exec(clean);
  return m ? { name: clean.slice(0, m.index), variant: m[1].replace(/^([RGB]) RGB$/, 'RGB Rare ($1)') } : { name: clean, variant: '' };
};
// the real Cardmarket averages behind a trend (30 days, 7 days, today), for the inspect line
const cmOf = (c) => { const m = c.cardmarket; return m && [m.avg30, m.avg7, m.avg1].every((x) => typeof x === 'number' && x > 0) ? [m.avg30, m.avg7, m.avg1] : undefined; };

const out = [];
for (const [setId, data] of Object.entries(window.CARD_SETS)) {
  const setName = data.set && data.set.name;
  for (const c of data.cards || []) {
    if (c.imageOk === false || !c.image || typeof c.priceUsd !== 'number') continue;
    if (c.priceUsd < 10) continue;                // homepage features chase cards, not bulk
    if (/^(svp|swshp|smp|xyp|bwp|dpp|hgssp|np|basep|fpp)$/.test(setId)) continue;   // promos: thin sales throw spikes (16 of 18 movers were promos)
    const pct = pctOf(c);
    if (pct == null || !isFinite(pct)) continue;
    out.push({
      name: c.name, game: 'pokemon', set: setId, setName,
      num: String(c.localId ?? c.num ?? ''), price: c.priceUsd,
      // fullImg cards (local / TCGplayer art) already carry a complete URL
      pct: +pct.toFixed(1), img: c.fullImg ? c.image : c.image + '/high.png', real: true, cm: cmOf(c),
    });
  }
}

// top movers by rise (the Spotlight reads pct desc), keep the list tight; dedupe
// same-name reprints so the strip doesn't show three of one Pokémon
out.sort((a, b) => b.pct - a.pct);
const seen = new Set();
const top = [];
for (const c of out) {
  const key = c.name.replace(/\s+/g, ' ').toLowerCase();
  if (seen.has(key)) continue;
  seen.add(key);
  top.push(c);
  if (top.length >= 18) break;
}

// --- Spotlight: the top trending cards across all four games, three windows (Faisal,
// 27 Oct: "Spotlight should be showing the top trending cards", then three tabs: This
// week / This month / This year). Each list is `spotlight` (week), `spotlightMonth`,
// `spotlightYear`: the move in `week` / `month` / `year`, the prices `was` -> `price`
// and the dates `from` -> `to`, `days` between them, and the `source` (sources and
// their limits: scripts/trend-sources.mjs):
//   week  = today vs 7 days ago. Pokémon, Lorcana, One Piece: dotGG's 7-day change;
//           Magic: MTGJSON's daily TCGplayer price.
//   month = today vs 30 days ago. Magic: MTGJSON. Lorcana, One Piece: dotGG's daily
//           history, fetched for a candidate pool (the biggest risers since the June
//           snapshot plus this week's risers), since it comes one card at a time.
//           Pokémon: the same, but dotGG's Pokémon history mostly starts 8 Oct 2026,
//           so a shorter span (14+ days) is used when needed, marked `basis` ('20d').
//   year  = no source reaches back a year, so this is the longest real span we hold:
//           today's TCGCSV index vs the TCGCSV index committed on 26 Jun 2026 (123
//           days on 27 Oct); each card carries the real dates and the day count.
// Filters: singles only (the TCGCSV index drops sealed product), no promo / jumbo /
// oversized / pre-release / event sets, a price floor per game, a minimum dollar move
// so penny cards can't top the list, a price on both dates, no jump over +300%, and an
// actively traded card (see LIQUID).
const HEADERS = { 'user-agent': 'Crowns home-trending build', accept: 'application/json' };   // Scryfall asks for both
const getJSON = async (url) => { const r = await fetch(url, { headers: HEADERS }); if (!r.ok) throw new Error(`${r.status} ${url}`); return r.json(); };
// Scryfall printing words for the homepage's "Printing" line
const mtgPrinting = (c) => [
  (c.promo_types || []).includes('serialized') && 'Serialized', c.border_color === 'borderless' && 'Borderless',
  (c.frame_effects || []).includes('showcase') && 'Showcase', (c.frame_effects || []).includes('extendedart') && 'Extended Art',
].filter(Boolean).join(' ');
const GAMES = ['pokemon', 'magic', 'lorcana', 'onepiece'];
const FLOOR = { pokemon: 10, onepiece: 10, magic: 15, lorcana: 15 };
const MIN_MOVE = 3;
const YEAR_FLOOR = 40, YEAR_MIN_MOVE = 15;   // the long window needs real gainers, not reprint noise
const MAX_PCT = 300;   // a bigger jump is a glitch (a mislisted sale, a remapped listing), not a trend
// TCGplayer's market price only moves when copies sell, so a card whose price changed on
// fewer than 8 of the last 30 days is too thin to call a trend (one sale sets its price)
const LIQUID = 8;
const NOT_SINGLE = /promo|jumbo|oversize|pre-?release|release event|staff|judge|championship|league|playtest|art series|\btokens?\b|world champ|deck exclusives|trick or treat|mcdonald/i;
const PROMO_RARITY = /^(promo|p|code card)$/i;
const DOTGG_SET = { pokemon: /./, lorcana: /^0\d\d$/, onepiece: /^(OP|EB|ST|PRB)\d+$/ };   // dotGG set ids for the main sets (Lorcana P1, C1, D23…, One Piece P, DON… are promos)
const pctOfMove = (from, to) => +((to - from) / from * 100).toFixed(1);
const span = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
const qualifies = (game, was, now, floor = FLOOR[game], move = MIN_MOVE) =>
  was >= floor / 2 && now >= floor && now - was >= move && pctOfMove(was, now) <= MAX_PCT;
// a dated series [[YYYY-MM-DD, price], ...], oldest first: the price on or before a day (within 3 days)
const at = (s, day) => { const lo = daysBefore(day, 3); for (let i = s.length - 1; i >= 0; i--) if (s[i][0] <= day) return s[i][0] >= lo ? s[i] : null; return null; };
const activity = (s) => {   // days among the last 30 on which the price changed
  const lo = daysBefore(s[s.length - 1][0], 30), w = s.filter(([d]) => d > lo);
  let n = 0; for (let i = 1; i < w.length; i++) if (w[i][1] !== w[i - 1][1]) n++;
  return n;
};
// of a card's history keys (Normal / Holofoil / Foil / ColdFoil), the one whose latest price is this printing's
const seriesOf = (h, price, tol = 0.011) => Object.values(h || {}).filter((s) => s.length && Math.abs(s[s.length - 1][1] - price) <= tol * price + 0.01)
  .sort((a, b) => Math.abs(a[a.length - 1][1] - price) - Math.abs(b[b.length - 1][1] - price))[0] || null;

const { rows: idxRows, built: idxBuilt } = indexNow();
const idxById = new Map(idxRows.map((r) => [r.i, r]));
const single = (r) => r && !NOT_SINGLE.test(r.sn || '') && !PROMO_RARITY.test(r.rar || '');
const numOf = (s) => String(s || '').split('/')[0].trim();
// TCGplayer prefixes set names with the era ("SV: ", "SWSH07: ", "SM - ", "XY - "); TCGdex doesn't
const norm = (s) => String(s || '').toLowerCase().replace(/^[^:]*:\s*/, '').replace(/^(sm|xy|bw|dp|hgss|swsh|sv|me)[0-9.]*\s+-\s+/, '').replace(/[^a-z0-9]/g, '');
const firstWord = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').split(' ')[0];

// dotGG rows for Pokémon, Lorcana, One Piece, joined to the TCGCSV index by product id
const feeds = {};
for (const g of ['pokemon', 'lorcana', 'onepiece']) {
  try { feeds[g] = await dotggFeed(g); } catch (e) { console.error(`dotgg ${g}: ${e.message}`); feeds[g] = []; }
}
const dotggDay = feeds.pokemon.reduce((d, r) => (r.date && r.date > d ? r.date : d), '') || new Date().toISOString().slice(0, 10);
const idxOf = (row) => {   // One Piece rows can list several product ids (reprints): take the one priced like this row
  const cands = row.tids.map((t) => idxById.get(t)).filter(Boolean);
  const want = Math.max(row.price, row.foil);
  return cands.sort((a, b) => Math.abs((a.p || 0) - want) - Math.abs((b.p || 0) - want))[0] || null;
};
const dotggByTid = {};
for (const g of Object.keys(feeds)) for (const row of feeds[g]) for (const t of row.tids) (dotggByTid[t] = dotggByTid[t] || []).push({ g, row });
const dotggRowFor = (tid, price) => ((dotggByTid[tid] || []).sort((a, b) => Math.abs(Math.max(a.row.price, a.row.foil) - price) - Math.abs(Math.max(b.row.price, b.row.foil) - price))[0] || null);
// the printings each window compares. Pokémon: the main printing only, because dotGG's
// Pokémon foil column (reverse holos) jumps when TCGplayer remaps vintage listings
const printings = (g, row) => [['normal', row.price, row.d7], ...(g === 'pokemon' ? [] : [['foil', row.foil, row.d7f]])];

// one candidate per printing: { game, tid, finish, idx, dg (dotGG row), series?, was, now, from, to, src }
const cand = { week: [], month: [], year: [] };
// week, Pokémon / Lorcana / One Piece: dotGG's 7-day change
for (const g of Object.keys(feeds)) {
  for (const row of feeds[g]) {
    if (!DOTGG_SET[g].test(row.set) || /^DON/i.test(row.id)) continue;
    const idx = idxOf(row);
    if (!single(idx)) continue;
    for (const [finish, now, d] of printings(g, row)) {
      if (!(now > 0) || !d) continue;
      const was = +(now - d).toFixed(2);
      if (qualifies(g, was, now)) cand.week.push({ game: g, tid: idx.i, finish, idx, dg: row, was, now, from: daysBefore(dotggDay, 7), to: dotggDay, src: 'dotGG' });
    }
  }
}
// week and month, Magic: MTGJSON's daily series
let mj = {};
try { mj = await mtgjsonPrices(); } catch (e) { console.error(`mtgjson: ${e.message} (Magic sits out the week and month lists)`); }
const mjByTid = {};
for (const [key, s] of Object.entries(mj)) {
  const [tid, finish] = key.split('|');
  (mjByTid[tid] = mjByTid[tid] || []).push(s);
  const idx = idxById.get(tid);
  if (!idx || idx.g !== 'magic' || !single(idx)) continue;
  const to = s[s.length - 1];
  if (activity(s) < LIQUID) continue;   // thin: see LIQUID
  for (const [w, n] of [['week', 7], ['month', 30]]) {
    const past = at(s, daysBefore(to[0], n));
    if (past && qualifies('magic', past[1], to[1])) cand[w].push({ game: 'magic', tid, finish, idx, series: s, was: past[1], now: to[1], from: past[0], to: to[0], src: 'MTGJSON' });
  }
}
// year: the June snapshot vs today, product by product (both are TCGCSV's highest market price across printings)
let base = {};
try { base = indexBaseline(); } catch (e) { console.error(`June snapshot: ${e.message} (no year list)`); }
const idxDay = await tcgcsvDay(idxBuilt);
for (const r of idxRows) {
  const was = base[r.i];
  if (!single(r) || typeof r.p !== 'number' || !qualifies(r.g, was, r.p, YEAR_FLOOR, YEAR_MIN_MOVE)) continue;
  const d = r.g === 'magic' ? null : dotggRowFor(r.i, r.p);   // the same main-set rule as the other lists
  if (r.g !== 'magic' && (!d || d.g !== r.g || !DOTGG_SET[d.g].test(d.row.set) || /^DON/i.test(d.row.id))) continue;
  if (r.g === 'pokemon' && Math.abs(d.row.price - r.p) > 0.011 * r.p + 0.01) continue;   // the product's top price is a reverse holo: see printings()
  let series;
  if (r.g === 'magic') {   // Magic's daily series is local, so thin cards drop out here
    series = (mjByTid[r.i] || []).map((x) => seriesOf({ x }, r.p, 0.05)).find(Boolean);
    if (!series || activity(series) < LIQUID) continue;
  }
  cand.year.push({ game: r.g, tid: r.i, finish: '', idx: r, dg: d && d.row, series, was, now: r.p, from: BASELINE.date, to: idxDay, src: 'TCGCSV' });
}
// month, Pokémon / Lorcana / One Piece: dotGG's daily history, which comes one card a
// second, so only for a pool of likely risers: the biggest climbers since June and this
// week's. dotGG's Pokémon history mostly starts on 8 Oct 2026 (checked 28 Oct), so a
// Pokémon card with no price 30 days back is compared over the longest span it has (at
// least 14 days) and says so in `basis` (e.g. '20d'). Cardmarket's averages were tried as
// that fallback and dropped: a few high sales swing them while TCGplayer sits flat
// (Paldean Tauros, 28 Oct: Cardmarket trend EUR 29.84, TCGplayer flat near $17 for 3 weeks).
const POOL = { pokemon: [40, 40], lorcana: [30, 25], onepiece: [30, 25] };   // [since June, this week]
for (const g of ['pokemon', 'lorcana', 'onepiece']) {
  const longRun = idxRows.filter((r) => r.g === g && single(r) && base[r.i] > 0 && qualifies(g, base[r.i], r.p))
    .map((r) => ({ was: base[r.i], now: r.p, dg: (dotggRowFor(r.i, r.p) || {}).row }))
    .filter((c) => c.dg && DOTGG_SET[g].test(c.dg.set) && !/^DON/i.test(c.dg.id) && (g !== 'pokemon' || Math.abs(c.dg.price - c.now) <= 0.011 * c.now + 0.01))
    .sort((a, b) => b.now / b.was - a.now / a.was).map((c) => c.dg);
  const weekly = cand.week.filter((c) => c.game === g).sort((a, b) => b.now / b.was - a.now / a.was).map((c) => c.dg);
  const pool = [...new Set([...longRun.slice(0, POOL[g][0]), ...weekly.slice(0, POOL[g][1])])];
  for (const row of pool) {
    const idx = idxOf(row);
    if (!single(idx)) continue;
    const h = await dotggHistory(g, row.id);
    for (const [finish, now] of printings(g, row)) {
      const s = now > 0 && seriesOf(h, now);
      if (!s) continue;
      const to = s[s.length - 1];
      let past = at(s, daysBefore(to[0], 30)), basis;
      if (!past && g === 'pokemon') {
        const first = s.find(([d]) => d >= daysBefore(to[0], 30));
        if (first && first[0] <= daysBefore(to[0], 14)) { past = first; basis = `${span(first[0], to[0])}d`; }
      }
      if (past && activity(s) >= LIQUID && qualifies(g, past[1], to[1])) {
        cand.month.push({ game: g, tid: idx.i, finish, idx, dg: row, series: s, was: past[1], now: to[1], from: past[0], to: to[0], src: 'dotGG', ...(basis ? { basis } : {}) });
      }
    }
  }
}
// a finalist must be actively traded (its daily series moved on LIQUID+ of the last 30
// days) and, where that series reaches the window's first day, agree with its price
async function confirm(c) {
  let s = c.series;
  if (!s && c.dg) s = seriesOf(await dotggHistory(c.game, c.dg.id), c.now);
  if (!s && c.game === 'magic') s = (mjByTid[c.tid] || []).map((x) => seriesOf({ x }, c.now, 0.05)).find(Boolean) || null;
  if (!s || !s.length) return null;
  const n = activity(s), start = at(s, c.from);
  if (n < LIQUID || (start && Math.abs(start[1] - c.was) > 0.25 * c.was)) return null;
  return n;
}

// --- who each finalist is: name, set, number and clean art, per game (TCGdex for
// Pokémon, Scryfall for Magic, Lorcast for Lorcana, dotGG for One Piece; never
// TCGplayer scans, whose new One Piece parallels carry a "SAMPLE" watermark)
const PK_SETS = Object.entries(window.CARD_SETS).map(([id, d]) => ({ id, name: (d.set && d.set.name) || '', d }));
let tcgdexSets = null;
async function resolvePokemon(c) {
  const want = norm(c.idx.sn), n = parseInt(numOf(c.idx.num), 10);
  const same = (name) => firstWord(name) === firstWord(c.dg ? c.dg.name : c.idx.n);
  const local = PK_SETS.find((s) => norm(s.name) === want);
  if (local) {
    const k = (local.d.cards || []).find((x) => !x.sealed && parseInt(x.localId, 10) === n && same(x.name) && x.image && x.imageOk !== false);
    if (k) return { name: String(k.name).split(' — ')[0], set: local.id, setName: local.name, num: String(k.localId), img: k.fullImg ? k.image : k.image + '/high.png' };
  }
  try {
    tcgdexSets = tcgdexSets || await getJSON('https://api.tcgdex.net/v2/en/sets');
    const s = tcgdexSets.find((x) => norm(x.name) === want);
    if (s) {
      const full = await getJSON(`https://api.tcgdex.net/v2/en/sets/${encodeURIComponent(s.id)}`);
      const k = (full.cards || []).find((x) => parseInt(x.localId, 10) === n && same(x.name) && x.image);
      if (k) return { name: k.name, set: s.id, setName: s.name, num: String(k.localId), img: k.image + '/high.png' };
    }
  } catch (e) { console.error(`tcgdex ${c.idx.n}: ${e.message}`); }
  // not on TCGdex under the TCGplayer set name: the Pokémon TCG API's scan of the same
  // card (dotGG ids are that API's ids), checked to exist; the set opens from the index
  if (!c.dg) return null;
  const [set, no] = [c.dg.id.slice(0, c.dg.id.lastIndexOf('-')), c.dg.id.slice(c.dg.id.lastIndexOf('-') + 1)];
  const img = `https://images.pokemontcg.io/${set}/${no}_hires.png`;
  try { if (!(await fetch(img, { method: 'HEAD' })).ok) return null; } catch { return null; }
  return { name: /\?/.test(c.dg.name) ? nameOf(c.idx.n).name : c.dg.name, set: c.idx.s, setName: c.idx.sn, num: numOf(c.idx.num), img };   // dotGG writes symbols like ◇ as "?"
}
async function resolveMagic(c) {
  const sc = await getJSON(`https://api.scryfall.com/cards/tcgplayer/${c.tid}`);
  await new Promise((r) => setTimeout(r, 120));   // Scryfall asks for 50-100 ms between requests
  if (sc.promo || sc.oversized || sc.digital || /^(token|memorabilia|promo|minigame|alchemy)$/.test(sc.set_type)) return null;
  const u = sc.image_uris || (sc.card_faces && sc.card_faces[0] && sc.card_faces[0].image_uris) || {};
  if (!(u.normal || u.large)) return null;
  const variant = [mtgPrinting(sc), c.finish === 'foil' ? 'Foil' : c.finish === 'etched' ? 'Etched Foil' : ''].filter(Boolean).join(' ');
  return { name: sc.name, variant, set: 'mtg-' + sc.set, setName: sc.set_name, num: sc.collector_number, img: u.normal || u.large };
}
async function resolveLorcana(c) {
  const code = String(parseInt(c.dg.set, 10));
  const k = await getJSON(`https://api.lorcast.com/v0/cards/${code}/${encodeURIComponent(c.dg.num)}`);
  const u = (k.image_uris && k.image_uris.digital) || {};
  if (!(u.normal || u.large)) return null;
  const variant = [/^(enchanted|iconic|epic)$/i.test(k.rarity || '') ? k.rarity : '', c.finish === 'foil' ? 'Cold Foil' : ''].filter(Boolean).join(' ');
  return { name: k.version ? `${k.name}, ${k.version}` : k.name, variant, set: 'lor-' + code, setName: (k.set && k.set.name) || c.idx.sn, num: String(k.collector_number), img: u.normal || u.large };
}
function resolveOnePiece(c) {
  // dotGG writes "Rocks.D.Xebec"; the card says "Rocks D. Xebec" (same fix as index.html cardName)
  return { name: c.dg.name.replace(/\.([A-Z])\./g, ' $1. '), variant: /_p\d*$/i.test(c.dg.id) ? 'Parallel' : '', set: 'op-' + c.dg.set, setName: c.idx.sn, num: c.dg.id.split('_')[0],
    img: `https://static.dotgg.gg/onepiece/card/${c.dg.id}.webp` };
}
const RESOLVE = { pokemon: resolvePokemon, magic: resolveMagic, lorcana: resolveLorcana, onepiece: resolveOnePiece };
const resolved = new Map();
async function resolve(c) {
  const key = `${c.game}|${c.tid}|${c.finish}`;
  if (!resolved.has(key)) {
    let v = null;
    try { v = await RESOLVE[c.game](c); } catch (e) { console.error(`resolve ${c.game} ${c.idx.n}: ${e.message}`); }
    resolved.set(key, v);
  }
  return resolved.get(key);
}

// the five top movers of one window: each game's best first (so all four make the five
// when they qualify), then the best of the rest; no repeated card names, at most two per
// set; the homepage shows the first three, which must not all be one game when another
// game made the list
async function topMovers(list, field, n = 5) {
  const ranked = list.map((c) => ({ c, pct: pctOfMove(c.was, c.now) })).sort((a, b) => b.pct - a.pct);
  const out = [], names = new Set(), perSet = {};
  const tryTake = async ({ c, pct }) => {
    const active = await confirm(c);
    if (active == null) return false;
    const r = await resolve(c);
    if (!r) return false;
    const nameKey = c.game + '|' + r.name.toLowerCase();
    if (names.has(nameKey) || (perSet[r.set] || 0) >= 2) return false;
    names.add(nameKey); perSet[r.set] = (perSet[r.set] || 0) + 1;
    out.push({ name: r.name, variant: r.variant || '', game: c.game, set: r.set, setName: r.setName, num: r.num, price: c.now, img: r.img, real: true,
      [field]: pct, was: c.was, from: c.from, to: c.to, days: span(c.from, c.to), source: c.src, ...(c.basis ? { basis: c.basis } : {}) });
    return true;
  };
  for (const g of GAMES) for (const x of ranked.filter((x) => x.c.game === g).slice(0, 20)) if (await tryTake(x)) break;
  for (const x of ranked.slice(0, 60)) { if (out.length >= n) break; await tryTake(x); }
  out.sort((a, b) => b[field] - a[field]);
  const lead3 = out.slice(0, 3);
  if (out.length > 3 && lead3.every((c) => c.game === lead3[0].game)) {
    const k = out.findIndex((c, i) => i >= 3 && c.game !== lead3[0].game);
    if (k > 0) out.splice(2, 0, ...out.splice(k, 1));
  }
  return out;
}
const spotlight = await topMovers(cand.week, 'week');
const spotlightMonth = await topMovers(cand.month, 'month');
const spotlightYear = await topMovers(cand.year, 'year');

// --- The newest set per game, for the strip under the spotlight (Faisal, 27 Oct:
// "show the new Magic set logo, the new One Piece set logo, the new Pokémon set
// logo"). Update the list when a game releases its next set.
// The numbers come from the same sources and rules as the set page (app.js
// fetch*Set + setStats), so the homepage and app.html?set=<id> agree: every
// non-sealed card counts, a card is priced when its price is above 0, and the
// top card is the priciest. Pokémon: the bundled cards file (before the app folds
// in TCGplayer's pattern reprints). Lorcana: Lorcast live. Magic: Scryfall live,
// usd, else usd_foil, else usd_etched, else the bundled TCGplayer backfill. One
// Piece: the bundled dotGG data, price, else foil price, with dotGG art.
const NEWEST = [
  { game: 'pokemon', id: '30th', name: '30th Celebration', sn: 'ME: 30th Celebration' },
  { game: 'magic', id: 'mtg-fra', code: 'fra', name: 'Reality Fracture', sn: 'Reality Fracture' },
  { game: 'onepiece', id: 'op-OP17', code: 'OP17', name: "The World's Strongest Warriors", sn: "The World's Strongest Warriors" },
  { game: 'lorcana', id: 'lor-14', code: '14', name: 'Hyperia City', sn: 'Hyperia City' },
];
const usdPrice = (p) => { const v = p && (p.usd || p.usd_foil || p.usd_etched); return v ? parseFloat(v) : null; };   // app.js usdPrice
const opPrice = (c) => { const reg = parseFloat(c.price), foil = parseFloat(c.foilPrice); return reg > 0 ? reg : (foil > 0 ? foil : null); };   // app.js opPrice
const loadWindow = (file) => { const w = {}; new Function('window', readFileSync(join(DATA, file), 'utf8'))(w); return w; };
// one set's cards as { name, variant, num, price, img }, the way the set page builds them
async function newSetCards(s) {
  if (s.game === 'pokemon') {
    const d = window.CARD_SETS[s.id];
    return ((d && d.cards) || []).filter((c) => !c.sealed).map((c) => ({
      name: String(c.name || '').split(' — ')[0], variant: /rgb/i.test(c.rarity || '') ? `RGB Rare (${c.localId})` : '',
      num: String(c.localId ?? c.num ?? ''), price: c.priceUsd, img: c.imageOk === false || !c.image ? '' : (c.fullImg ? c.image : c.image + '/high.png'),
    }));
  }
  if (s.game === 'magic') {
    const MP = loadWindow('magic-prices.js').MAGIC_PRICES || {};
    const all = [];
    let url = `https://api.scryfall.com/cards/search?q=set%3A${s.code}+game%3Apaper&unique=prints&order=set`;
    for (let p = 0; url && p < 16; p++) {
      if (p) await new Promise((r) => setTimeout(r, 550));   // Scryfall: /cards/search is limited to 2 a second
      const j = await getJSON(url); all.push(...(j.data || [])); url = j.has_more ? j.next_page : null;
    }
    return all.map((c) => ({ c, u: c.image_uris || (c.card_faces && c.card_faces[0] && c.card_faces[0].image_uris) || {} }))
      .filter(({ u }) => u.large || u.normal)
      .map(({ c, u }) => ({ name: c.name, variant: mtgPrinting(c), num: c.collector_number,
        price: usdPrice(c.prices) ?? (MP[c.tcgplayer_id] || null), img: u.normal || u.large }));
  }
  if (s.game === 'lorcana') {
    const j = await getJSON(`https://api.lorcast.com/v0/sets/${s.code}/cards`);
    const arr = Array.isArray(j) ? j : (j.results || j.cards || []);
    return arr.map((c) => ({ c, u: (c.image_uris && c.image_uris.digital) || {} }))
      .filter(({ u }) => u.large || u.normal)
      .map(({ c, u }) => ({ name: c.version ? `${c.name}, ${c.version}` : c.name, variant: /^(enchanted|iconic|epic)$/i.test(c.rarity || '') ? c.rarity : '',
        num: String(c.collector_number), price: usdPrice(c.prices), img: u.normal || u.large }));
  }
  // One Piece: dotGG art, never TCGplayer's "SAMPLE"-watermarked scans
  return (loadWindow('onepiece.js').OP_CARDS || []).filter((c) => c.set === s.code && c.id).map((c) => ({
    name: c.name, variant: /_p\d*$/i.test(c.id) ? 'Parallel' : '', num: c.id.split('_')[0],
    price: opPrice(c), img: `https://static.dotgg.gg/onepiece/card/${c.id}.webp`,
  }));
}
// a live source that's down keeps the set's last built numbers rather than dropping it
let prevNew = [];
try { prevNew = loadWindow('home-trending.js').HOME_TRENDING.newSets || []; } catch { /* first build */ }
const newSets = [];
for (const { code, ...s } of NEWEST) {
  let cards;
  try { cards = await newSetCards({ ...s, code }); } catch (e) {
    const old = prevNew.find((x) => x.id === s.id);
    console.error(`new set ${s.id}: ${e.message}${old ? ' (kept the last build)' : ''}`);
    if (old) newSets.push(old);
    continue;
  }
  const ranked = cards.filter((c) => typeof c.price === 'number' && c.price > 0).sort((a, b) => b.price - a.price);
  // the set's three priciest distinct cards, for the homepage's new-set spotlights
  const tops = []; for (const c of ranked) { if (tops.length === 3) break; if (c.img && !tops.some((t) => t.name === c.name)) tops.push(c); }
  if (cards.length) newSets.push({ ...s, cards: cards.length, top: ranked[0] || null, tops });
}

// --- Chase cards for the hero ring: the priciest cards of each game's recent sets at
// today's prices (replaces the hand-typed June list that used to live in index.html).
// Pokémon from the bundled sets (TCGdex art); the other games from the price index.
const idx = {};
for (const f of readdirSync(DATA)) {
  if (!/^card-index.*\.js$/.test(f)) continue;
  try { new Function('window', readFileSync(join(DATA, f), 'utf8'))(idx); } catch (e) { console.error(`skip ${f}: ${e.message}`); }
}
const rows = Object.values(idx).filter(Array.isArray).flat();
const CHASE_PK = ['30th','me05', 'me04', 'me03', 'me02.5', 'sv10.5w', 'sv10.5b', 'sv08.5'];
const CHASE_IDX = [
  { game: 'magic', sets: [['Reality Fracture', 'mtg-fra'], ['The Hobbit', 'mtg-hob'], ['Marvel Super Heroes', 'mtg-msh'], ['Final Fantasy', 'mtg-fin']], n: 6 },
  { game: 'lorcana', sets: [['Hyperia City', 'lor-14'], ['Attack of the Vine!', 'lor-13'], ['Wilds Unknown', 'lor-12']], n: 5 },
  { game: 'onepiece', sets: [["The World's Strongest Warriors", 'op-OP17']], n: 4 },
];
const chase = [];
const pk = [];
for (const id of CHASE_PK) {
  const d = window.CARD_SETS[id]; if (!d) continue;
  for (const c of d.cards || []) {
    if (c.sealed || c.imageOk === false || !c.image || typeof c.priceUsd !== 'number') continue;
    pk.push({ name: c.name, game: 'pokemon', set: id, setName: d.set && d.set.name, num: String(c.localId ?? c.num ?? ''), price: c.priceUsd,
      img: c.fullImg ? c.image : c.image + '/high.png', real: true, cm: cmOf(c) });
  }
}
pk.sort((a, b) => b.price - a.price);
const seenPk = new Set();
for (const c of pk) { if (seenPk.has(c.name)) continue; seenPk.add(c.name); chase.push(c); if (seenPk.size >= 8) break; }
for (const g of CHASE_IDX) {
  const pool = [];
  for (const [sn, id] of g.sets) for (const c of rows) if (c.sn === sn && typeof c.p === 'number' && c.img) pool.push({ c, id, sn });
  pool.sort((a, b) => b.c.p - a.c.p);
  const seen = new Set();
  for (const { c, id, sn } of pool) {
    const nm = nameOf(c.n);
    if (seen.has(nm.name)) continue; seen.add(nm.name);
    chase.push({ name: nm.name, variant: nm.variant, game: g.game, set: id, setName: sn, num: String(c.num || '').split('/')[0],
      price: c.p, img: c.img.replace('_200w', '_400w'), real: true });
    if (seen.size >= g.n) break;
  }
}

// One Piece: TCGplayer's scans of the new parallels carry a "SAMPLE" watermark, so use the
// clean dotGG art the app already shows. A TCGplayer row (e.g. OP17-118 Super Alternate Art)
// maps to the dotGG printing of that number with the highest price, which is the parallel.
try {
  const op = {}; new Function('window', readFileSync(join(DATA, 'onepiece.js'), 'utf8'))(op);
  const price = (c) => { const p = parseFloat(c.price); return p > 0 ? p : parseFloat(c.foilPrice) || 0; };
  const clean = (c) => {
    if (!c || !c.num) return;
    const base = String(c.num).toUpperCase();
    const prints = (op.OP_CARDS || []).filter((x) => x.id === base || x.id.startsWith(base + '_'));
    const best = prints.sort((a, b) => price(b) - price(a))[0];
    if (best) c.img = `https://static.dotgg.gg/onepiece/card/${best.id}.webp`;
  };
  chase.filter((x) => x.game === 'onepiece').forEach(clean);
} catch (e) { console.error('one piece art: ' + e.message); }

// The hero crown sets these cards into its band in WebGL, which needs same-origin images
// (TCGplayer and dotGG send no CORS headers), so keep a local copy of each chase image.
const CHASE_DIR = join(ROOT, 'assets', 'chase');
try {
  const { mkdirSync, writeFileSync: wf } = await import('node:fs');
  mkdirSync(CHASE_DIR, { recursive: true });
  for (let i = 0; i < chase.length; i++) {
    const c = chase[i];
    const ext = /\.png($|\?)/.test(c.img) ? 'png' : /\.webp($|\?)/.test(c.img) ? 'webp' : 'jpg';
    const file = `${String(i).padStart(2, '0')}-${c.set.replace(/[^a-z0-9.-]/gi, '')}-${String(c.num).replace(/[^a-z0-9-]/gi, '')}.${ext}`;
    try {
      const r = await fetch(c.img, { headers: { 'user-agent': 'Mozilla/5.0 Crowns refresh' } });
      if (!r.ok) throw new Error(r.status);
      wf(join(CHASE_DIR, file), Buffer.from(await r.arrayBuffer()));
      c.local = `assets/chase/${file}`;
    } catch (e) { console.error(`chase image ${c.name}: ${e.message}`); }
  }
} catch (e) { console.error('chase images: ' + e.message); }

const payload = { generatedAt: new Date().toISOString(), cards: top, spotlight, spotlightMonth, spotlightYear, newSets, chase };
writeFileSync(join(DATA, 'home-trending.js'),
  `// AUTO-GENERATED by scripts/build-home-trending.mjs — real movers for the homepage (30-day ticker; week, month and long-run spotlights).\n`
  + `window.HOME_TRENDING = ${JSON.stringify(payload)};\n`);
console.log(`wrote data/home-trending.js (${top.length} movers; #1 ${top[0]?.name} ${top[0]?.pct}%)`);
for (const s of newSets) console.log(`new set ${s.id}: ${s.cards} cards, top ${s.top ? `${s.top.name} $${s.top.price.toFixed(2)}` : 'none priced'}`);
for (const [label, list, f] of [['week', spotlight, 'week'], ['month', spotlightMonth, 'month'], ['year', spotlightYear, 'year']]) {
  console.log(`spotlight ${label}:`);
  for (const c of list) console.log(`  ${c.game.padEnd(8)} ${c.name}${c.variant ? ` [${c.variant}]` : ''} (${c.setName} #${c.num}) $${c.was} on ${c.from} -> $${c.price} on ${c.to} = +${c[f]}% (${c.days} days, ${c.source}${c.basis ? ', basis ' + c.basis : ''})`);
}
