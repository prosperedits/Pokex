// refresh-onepiece.mjs — regenerate data/onepiece.js (window.OP_CARDS), the bundled
// One Piece card list + USD prices the app loads on demand (fetchOnePieceSet in
// app.js). Source: dotgg's free, keyless card feed (the same data the app's card
// images come from). dotgg blocks browser CORS, which is why this is bundled.
//
// Keeps the original bundle's shape: one object per printing with only these
// keys (null fields omitted), ASCII-escaped JSON, every dotgg row kept (the June
// bundle also carried dotgg's 'jpe'/'jp' printings, so they stay for parity):
//   id, set, name, rarity, Color, price, foilPrice, cardType, Cost, Power, Counter, Effect
// Run: node scripts/refresh-onepiece.mjs     (Node >= 18, no deps; file kept on failure)
'use strict';
import { writeFileSync, renameSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'onepiece.js');
const URL = 'https://api.dotgg.gg/cgfw/getcards?game=onepiece&mode=indexed';
const KEYS = ['id', 'set', 'name', 'rarity', 'Color', 'price', 'foilPrice', 'cardType', 'Cost', 'Power', 'Counter', 'Effect'];

const r = await fetch(URL, { headers: { 'User-Agent': 'CrownsTCG/1.0 (personal card tracker)' } });
if (!r.ok) throw new Error(`dotgg HTTP ${r.status}`);
const { names, data } = await r.json();
if (!Array.isArray(names) || !Array.isArray(data)) throw new Error('unexpected dotgg payload');
const col = Object.fromEntries(names.map((n, i) => [n, i]));
for (const k of KEYS) if (!(k in col)) throw new Error(`dotgg payload missing column ${k}`);

const cards = [];
for (const row of data) {
  const c = {};
  for (const k of KEYS) { const v = row[col[k]]; if (v != null && v !== '') c[k] = String(v); }
  if (c.id && c.set && c.name) cards.push(c);
}
if (cards.length < 4000) throw new Error(`only ${cards.length} cards — refusing to overwrite`);

// escape everything outside printable ASCII (space..tilde) as a JSON unicode escape
const BACKSLASH = String.fromCharCode(92);
const json = JSON.stringify(cards).replace(/[^ -~]/g, (ch) => BACKSLASH + 'u' + ch.charCodeAt(0).toString(16).padStart(4, '0'));
writeFileSync(OUT + '.tmp', `window.OP_CARDS=${json};`);
renameSync(OUT + '.tmp', OUT);
const sets = new Set(cards.map((c) => c.set));
console.log(`wrote data/onepiece.js — ${cards.length} cards across ${sets.size} set codes, ${cards.filter((c) => +c.price > 0 || +c.foilPrice > 0).length} priced`);
