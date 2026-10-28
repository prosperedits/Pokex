// trend-sources.mjs — dated TCGplayer market prices for the homepage's This week /
// This month / This year spotlights (used by build-home-trending.mjs). Every number
// here is a price some source recorded on a named day; nothing is estimated.
//
// Why these sources: TCGCSV's daily price archive (tcgcsv.com/archive/tcgplayer/
// prices-YYYY-MM-DD.ppmd.7z) answers 403 "temporarily removed due to rising server
// costs" since Oct 2026, so the history comes from:
//   - dotGG card feeds (api.dotgg.gg/cgfw/getcards, documented at dotgg.gg/api):
//     today's TCGplayer market price per printing and its change against 7 days
//     ago (delta7dPrice), for Pokémon, Lorcana and One Piece. Their Magic feed has
//     no 7-day change, so Magic comes from MTGJSON.
//   - dotGG per-card daily history (/cgfw/getcardprices, documented, max 1 request a
//     second): the 30-day comparison for Lorcana and One Piece candidates, and the
//     "is it actively traded" check for every finalist. Its Pokémon history mostly
//     starts on 8 Oct 2026 (checked 28 Oct), too short for a 30-day comparison.
//   - MTGJSON AllPrices (mtgjson.com/api/v5/AllPrices.json.gz): TCGplayer retail price
//     per Magic printing per day for the last 90 days (week and month for Magic).
//   - The TCGCSV card index committed to this repo on 26 Jun 2026 (git 0b691e5): the
//     oldest TCGplayer snapshot we hold for all four games, the base of "This year".
//     Checked 28 Oct against dotGG's daily history: of 54 series that moved in late
//     June, 37 equal the snapshot on 26 Jun, and every series that equals it on any day
//     does on 26 Jun. (dotGG stamps its reading ~00:15 UTC and TCGCSV builds ~20:00
//     UTC, so this is the 25 or 26 Jun TCGCSV build; 26 Jun is also the commit day.)
// Everything downloaded is cached in price-history/sources/ (gitignored), one file per
// source per day, so the many refresh steps that run this build re-download nothing.
'use strict';

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createGunzip } from 'node:zlib';
import { Readable } from 'node:stream';
import { createInterface } from 'node:readline';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DATA = join(ROOT, 'data');
const CACHE = join(ROOT, 'price-history', 'sources');
mkdirSync(CACHE, { recursive: true });
const UA = { 'User-Agent': 'CrownsTCG/1.0 (personal card tracker)' };
const TODAY = new Date().toISOString().slice(0, 10);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const DAY = 864e5;
export const ymd = (t) => new Date(t).toISOString().slice(0, 10);
export const daysBefore = (date, n) => ymd(Date.parse(date + 'T00:00:00Z') - n * DAY);

const readJSON = (f) => JSON.parse(readFileSync(f, 'utf8'));
// keep only the newest few cache files of one kind (a daily cache would otherwise grow forever)
const prune = (prefix, keep = 3) => {
  const files = readdirSync(CACHE).filter((f) => f.startsWith(prefix)).sort();
  for (const f of files.slice(0, Math.max(0, files.length - keep))) { try { unlinkSync(join(CACHE, f)); } catch { /* in use */ } }
};
async function cachedDaily(prefix, build) {
  const file = join(CACHE, `${prefix}-${TODAY}.json`);
  if (existsSync(file)) return readJSON(file);
  const v = await build();
  writeFileSync(file, JSON.stringify(v));
  prune(prefix + '-');
  return v;
}

// ---- dotGG card feeds: one row per printing, TCGplayer market price + 7-day change ----
const DOTGG_GAME = { pokemon: 'pokemon', lorcana: 'lorcana', onepiece: 'onepiece' };
export async function dotggFeed(game) {
  return cachedDaily(`dotgg-${game}`, async () => {
    const r = await fetch(`https://api.dotgg.gg/cgfw/getcards?game=${DOTGG_GAME[game]}&mode=indexed`, { headers: UA });
    if (!r.ok) throw new Error(`dotgg ${game} ${r.status}`);
    const { names, data } = await r.json();
    const col = Object.fromEntries(names.map((n, i) => [n, i]));
    const f = (row, k) => (col[k] == null ? null : row[col[k]]);
    const num = (v) => { const x = parseFloat(v); return isFinite(x) ? x : 0; };
    const rows = [];
    for (const row of data) {
      if (col.language != null && f(row, 'language') && f(row, 'language') !== 'en') continue;   // One Piece: English printings only
      const price = num(f(row, 'price')), foil = num(f(row, 'foilPrice'));
      if (Math.max(price, foil) < 3) continue;
      rows.push({
        id: String(f(row, 'id')), set: String(f(row, 'setId') ?? f(row, 'set') ?? ''), num: String(f(row, 'number') ?? ''),
        name: String(f(row, 'displayName') || f(row, 'name') || ''), rarity: String(f(row, 'rarity') || ''),
        tids: String(f(row, 'tcg_ids') ?? f(row, 'tcgPlayerId') ?? f(row, 'marketIds') ?? '').split(',').map((s) => s.trim()).filter(Boolean),
        price, foil, d7: num(f(row, 'delta7dPrice')), d7f: num(f(row, 'delta7dPriceFoil')),
        date: f(row, 'price_date') ? ymd(+f(row, 'price_date') * 1000) : null,
      });
    }
    return rows;
  });
}

// ---- dotGG per-card daily history (a year): { Normal|Foil|Holofoil|ColdFoil: [[YYYY-MM-DD, price], ...] } ----
// One request per card, at most one a second (dotGG's rule); a day's results are cached.
const HIST_FILE = join(CACHE, `dotgg-hist-${TODAY}.json`);
let hist = null, lastHit = 0;
export async function dotggHistory(game, id) {
  if (!hist) { hist = existsSync(HIST_FILE) ? readJSON(HIST_FILE) : {}; prune('dotgg-hist-'); }
  const key = `${game}|${id}`;
  if (hist[key]) return hist[key];
  const wait = lastHit + 1100 - Date.now();
  if (wait > 0) await sleep(wait);
  lastHit = Date.now();
  const series = {};
  try {
    const r = await fetch(`https://api.dotgg.gg/cgfw/getcardprices?game=${DOTGG_GAME[game]}&cardid=${encodeURIComponent(id)}&timepattern=y`, { headers: UA });
    if (!r.ok) throw new Error(r.status);
    for (const l of (await r.json()).lines || []) {
      for (const k of ['Normal', 'Foil', 'Holofoil', 'ColdFoil']) { const v = parseFloat(l[k]); if (v > 0) (series[k] = series[k] || []).push([ymd(+l.date * 1000), v]); }
    }
  } catch (e) { console.error(`dotgg history ${key}: ${e.message}`); return series; }   // not cached: a later run retries
  hist[key] = series;
  writeFileSync(HIST_FILE, JSON.stringify(hist));
  return series;
}

// ---- MTGJSON (Magic): TCGplayer retail price per printing per day, the last 45 days ----
// AllPrices.json is ~1.5 GB once unzipped, so it is streamed: each card's entry is cut
// out at its closing brace and parsed on its own. Result keyed `${tcgplayerProductId}|${finish}`,
// each a [[YYYY-MM-DD, price], ...] series (oldest first), kept when the latest price is >= $5.
function splitEntries(onEntry) {   // the entries of the top-level "data" object, as Buffers
  let depth = 0, inStr = false, esc = false, cap = null, capFrom = -1;
  return (buf) => {
    if (cap) capFrom = 0;
    for (let i = 0; i < buf.length; i++) {
      const b = buf[i];
      if (inStr) { if (esc) esc = false; else if (b === 92) esc = true; else if (b === 34) inStr = false; continue; }
      if (b === 34) { inStr = true; if (depth === 2 && !cap) { cap = []; capFrom = i; } }
      else if (b === 123) depth++;
      else if (b === 125) {
        depth--;
        if (depth === 2 && cap) { cap.push(buf.subarray(capFrom, i + 1)); onEntry(Buffer.concat(cap)); cap = null; capFrom = -1; }
        else if (depth < 2) { cap = null; capFrom = -1; }
      }
    }
    if (cap && capFrom >= 0) cap.push(buf.subarray(capFrom));
  };
}
export async function mtgjsonPrices() {
  const meta = await (await fetch('https://mtgjson.com/api/v5/Meta.json', { headers: UA })).json();
  const date = meta.data && meta.data.date;
  if (!date) throw new Error('mtgjson: no meta date');
  const file = join(CACHE, `mtgjson-series-${date}.json`);
  if (existsSync(file)) return readJSON(file);
  // uuid -> TCGplayer product ids (normal/foil share one product, etched has its own)
  const ids = new Map();
  {
    const r = await fetch('https://mtgjson.com/api/v5/csv/cardIdentifiers.csv.gz', { headers: UA });
    if (!r.ok) throw new Error(`mtgjson identifiers ${r.status}`);
    const rl = createInterface({ input: Readable.fromWeb(r.body).pipe(createGunzip()) });
    let head = null;
    for await (const line of rl) {
      const c = line.split(',');
      if (!head) { head = Object.fromEntries(c.map((n, i) => [n, i])); continue; }
      const t = c[head.tcgplayerProductId], e = c[head.tcgplayerEtchedProductId];
      if (t || e) ids.set(c[head.uuid], [t || '', e || '']);
    }
  }
  const out = {}, from = daysBefore(date, 45);
  const r = await fetch('https://mtgjson.com/api/v5/AllPrices.json.gz', { headers: UA });
  if (!r.ok) throw new Error(`mtgjson prices ${r.status}`);
  const feed = splitEntries((buf) => {
    const obj = JSON.parse('{' + buf.toString('latin1') + '}');
    const [uuid, v] = Object.entries(obj)[0];
    const retail = v && v.paper && v.paper.tcgplayer && v.paper.tcgplayer.retail;
    const tid = ids.get(uuid);
    if (!retail || !tid) return;
    for (const finish of ['normal', 'foil', 'etched']) {
      const s = retail[finish]; if (!s) continue;
      const pid = finish === 'etched' ? tid[1] : tid[0]; if (!pid) continue;
      const series = Object.entries(s).filter(([d, p]) => d > from && d <= date && p > 0).sort((a, b) => (a[0] < b[0] ? -1 : 1));
      if (series.length && series[series.length - 1][1] >= 5) out[`${pid}|${finish}`] = series;
    }
  });
  await new Promise((res, rej) => {
    const z = Readable.fromWeb(r.body).pipe(createGunzip());
    z.on('data', feed); z.on('end', res); z.on('error', rej);
  });
  writeFileSync(file, JSON.stringify(out));
  prune('mtgjson-series-', 2);
  return out;
}

// ---- TCGCSV card index: today's file and the 26 Jun 2026 snapshot from git ----
const INDEX_FILES = ['card-index.js', 'card-index-mtg.js', 'card-index-lor.js', 'card-index-op.js'];
const loadIndex = (read) => { const w = {}; for (const f of INDEX_FILES) new Function('window', read(f))(w); return w.CARD_INDEX || []; };
export function indexNow() {   // [{ i, n, s, sn, num, rar, img, p, g }] + the TCGCSV build day it reflects
  const rows = loadIndex((f) => readFileSync(join(DATA, f), 'utf8'));
  return { rows, built: new Date(Math.min(...INDEX_FILES.map((f) => statSync(join(DATA, f)).mtimeMs))) };
}
export const BASELINE = { commit: '0b691e5', date: '2026-06-26' };
export function indexBaseline() {   // { productId: price } from the committed snapshot
  const file = join(CACHE, `tcgcsv-${BASELINE.date}.json`);
  if (existsSync(file)) return readJSON(file);
  const rows = loadIndex((f) => execFileSync('git', ['show', `${BASELINE.commit}:data/${f}`], { cwd: ROOT, maxBuffer: 256 << 20 }).toString('utf8'));
  const out = {};
  for (const c of rows) if (typeof c.p === 'number') out[c.i] = c.p;
  writeFileSync(file, JSON.stringify(out));
  return out;
}
// the TCGCSV build day the current index reflects: TCGCSV rebuilds once a day (~20:00 UTC)
export async function tcgcsvDay(builtAt) {
  try {
    const t = Date.parse((await (await fetch('https://tcgcsv.com/last-updated.txt', { headers: UA })).text()).trim());
    if (isFinite(t) && builtAt.getTime() >= t) return ymd(t);
  } catch { /* offline: fall back to the file date */ }
  return ymd(builtAt.getTime() - 20 * 3600e3);   // a build before ~20:00 UTC still holds the previous day's prices
}
