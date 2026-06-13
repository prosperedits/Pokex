// fetch-sealed.mjs — probe Pokémon's official CDN for transparent sealed-product
// renders for EVERY set, download hits to assets/sealed/, and regenerate
// data/sealed.js. Prices: only entries in VERIFIED_PRICES carry numbers — every
// other product ships marketUsd:null ("tracking soon"). Never invents prices.
// Run: node scripts/fetch-sealed.mjs
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'assets', 'sealed');
const CDN = 'https://d1i787aglh9bmb.cloudfront.net/assets/img';

const SETS = [
  'me01', 'me02', 'me02.5', 'me03', 'me04',
  'sv01', 'sv02', 'sv03', 'sv03.5', 'sv04', 'sv04.5', 'sv05', 'sv06', 'sv06.5',
  'sv07', 'sv08', 'sv08.5', 'sv09', 'sv10', 'sv10.5b', 'sv10.5w',
];

// CDN id candidates for dotted/lettered TCGdex ids (probed in order).
// Observed forms: sv08, sv8dot5 (path) + sv8pt5 (file), me02.
function cdnIds(id) {
  const out = [id];
  if (id.includes('.5')) {
    const base = id.replace('.5', '');           // sv08
    const slim = base.replace(/0(\d)$/, '$1');   // sv8
    out.push(base + 'pt5', slim + 'pt5', base + 'dot5', slim + 'dot5', id.replace('.', ''), base + '_5');
  }
  if (/[bw]$/.test(id)) out.push(id.slice(0, -1), id.replace('.5', 'pt5'), id.replace('.5', 'dot5'));
  return [...new Set(out)];
}

const PRODUCTS = [
  { key: 'display', name: 'Booster Box', detail: '36 packs', files: (c, C) => [`${c}-booster-display-en.png`, `${c}-3d-booster-display.png`, `${C}_Display_EN.png`, `${C}_Booster_Display_EN.png`] },
  { key: 'pc-etb', name: 'Pokémon Center ETB', detail: 'exclusive · 11 packs', files: (c, C) => [`${c}-pc-etb-en.png`, `${c}-etb-pc-en.png`, `${C}_PC_ETB_EN.png`] },
  { key: 'etb', name: 'Elite Trainer Box', detail: '9 packs + accessories', files: (c, C) => [`${c}-etb-en.png`, `${c}-3d-etb-en.png`, `${C}_ETB_EN.png`] },
  { key: 'bundle', name: 'Booster Bundle', detail: '6 packs', files: (c, C) => [`${c}-booster-bundle-en.png`, `${c}-3d-booster-bundle-outer-sleeve.png`, `${c}-3d-booster-bundle.png`, `${C}_Booster_Bundle_EN.png`] },
  { key: 'bnb', name: 'Build & Battle Box', detail: '4 packs + 40-card deck', files: (c, C) => [`${c}-build-and-battle-en.png`, `${c}-build-battle-en.png`, `${c}-3d-build-and-battle-outer-sleeve.png`, `${C}_BnB_EN.png`] },
];

// exact URLs harvested from expansion pages whose filenames defy the patterns
const SPECIAL_URLS = {
  'sv01': {
    etb: 'sv-expansions/sv01/collections/en-us/sv01-3d-etb-koraidon.png',
    'pc-etb': 'sv-expansions/sv01/collections/en-us/sv01-3d-pc-etb-koraidon.png',
    display: 'sv-expansions/sv01/collections/en-us/sv01-3d-booster-display.png',
    bundle: 'sv-expansions/sv01/collections/en-us/sv01-3d-booster-bundle-outer-sleeve.png',
    bnb: 'sv-expansions/sv01/collections/en-us/sv01-3d-build-and-battle-outer-sleeve.png',
  },
  'sv05': {
    etb: 'sv-expansions/sv05/collections/en-us/P9504_SV05_3D_ETB_Iron_Leaves_Right_EN.png',
    'pc-etb': 'sv-expansions/sv05/collections/en-us/P9504_SV05_3D_PCenter_ETB_Walking_Wake_Right_EN.png',
    display: 'sv-expansions/sv05/collections/en-us/P9504_SV05_3D_Booster_Display_36ct_Right_EN.png',
    bundle: 'sv-expansions/sv05/collections/en-us/P9504_SV05_3D_Booster_Bundle_Right_INT_EN.png',
    bnb: 'sv-expansions/sv05/collections/en-us/P9504_SV05_3D_Build_and_Battle_Box_Right_EN.png',
  },
  'sv08.5': {
    etb: 'sv-expansions/sv8dot5/collections/en-us/sv8pt5-etb-en.png',
    'pc-etb': 'sv-expansions/sv8dot5/collections/en-us/sv8pt5-etb-pc-en.png',
    bundle: 'sv-expansions/sv8dot5/collections/en-us/sv8pt5-booster-bundle-en.png',
  },
  'me02.5': {
    etb: 'me-expansions/me2dot5/collections/en-us/me2pt5-etb-en.png',
    'pc-etb': 'me-expansions/me2dot5/collections/en-us/me2pt5-pc-etb-en.png',
  },
  'sv04': {
    etb: 'sv-expansions/sv04/collections/en-us/P8981_SV04_3D_ETB_Iron_Valiant_Left_EN.png',
    'pc-etb': 'sv-expansions/sv04/collections/en-us/P8981_SV04_3D_PC_ETB_Iron_Valiant_Left_EN.png',
    display: 'sv-expansions/sv04/collections/en-us/P8981_SV04_3D_Booster_Display_36ct_Left_EN.png',
    bundle: 'sv-expansions/sv04/collections/en-us/P8981_SV04_3D_Booster_Bundle_Outer_Sleeve_EN.png',
    bnb: 'sv-expansions/sv04/collections/en-us/P8981_SV04_3D_Build_and_Battle_Outer_Sleeve_EN.png',
  },
  'sv04.5': {
    etb: 'sv-expansions/sv4dot5/collections/en-us/p9537-sv04pt5-3d-etb-outersleeve-en.png',
    'pc-etb': 'sv-expansions/sv4dot5/collections/en-us/p9537-sv04pt5-pc-3d-etb-outersleeve-en.png',
    bundle: 'sv-expansions/sv4dot5/collections/en-us/p9537-sv04pt5-booster-bundle-en.png',
  },
  'sv06': {
    etb: 'sv-expansions/sv06/collections/en-us/p9505-sv06-3d-etb-outersleeve-right-en.png',
    'pc-etb': 'sv-expansions/sv06/collections/en-us/p9505-sv06-3d-pc-etb-outersleeve-right-en.png',
    display: 'sv-expansions/sv06/collections/en-us/p9505-sv06-3d-booster-display-36ct-right-en.png',
    bundle: 'sv-expansions/sv06/collections/en-us/p9505-sv06-3d-booster-bundle-right-en.png',
    bnb: 'sv-expansions/sv06/collections/en-us/p9505-sv06-3d-build-and-battle-box-right-en.png',
  },
  'sv06.5': {
    etb: 'sv-expansions/sv6dot5/collections/en-us/P9506_SV06pt5_3D_ETB_OuterSleeve_Right_EN.png',
    'pc-etb': 'sv-expansions/sv6dot5/collections/en-us/P9506_SV06pt5_3D_PC_ETB_OuterSleeve_Right_EN.png',
    bundle: 'sv-expansions/sv6dot5/collections/en-us/P9506_SV06pt5_3D_Booster_Bundle_Right_INTL_EN.png',
  },
};

// verified market prices (source + check date REQUIRED) — extend as sourced
const VERIFIED_PRICES = {
  'me02:display': { marketUsd: 389.75, source: 'TCGplayer', checked: '2026-06-11', note: 'doubled on the Mega Charizard X SIR chase' },
  'me02:pc-etb': { marketUsd: 226.78, source: 'TCGplayer', checked: '2026-06-11' },
  'me02:etb': { marketUsd: 120.10, source: 'PokeInsight', checked: '2026-04-20' },
  'sv08.5:etb': { marketUsd: 167.00, source: 'PriceCharting', checked: '2026-04' },
  'sv08:display': { marketUsd: 235.00, source: 'TCGplayer avg', checked: '2026-06' },
};

async function probe(url) {
  try {
    let r = await fetch(url, { method: 'HEAD' });
    if (r.status === 405 || r.status === 403) r = await fetch(url, { headers: { range: 'bytes=0-0' } });
    return r.ok || r.status === 206;
  } catch { return false; }
}

async function download(url, file) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  writeFileSync(file, Buffer.from(await r.arrayBuffer()));
}

mkdirSync(OUT_DIR, { recursive: true });
const manifest = {};
let found = 0, missed = 0;

for (const id of SETS) {
  const era = id.startsWith('me') ? 'me-expansions' : 'sv-expansions';
  const entries = [];
  for (const prod of PRODUCTS) {
    let hit = null;
    const special = SPECIAL_URLS[id]?.[prod.key];
    if (special && await probe(`${CDN}/${special}`)) {
      hit = { url: `${CDN}/${special}`, f: special.split('/').pop() };
    }
    if (!hit) outer: for (const cid of cdnIds(id)) {
      for (const f of prod.files(cid.toLowerCase(), cid.toUpperCase())) {
        const url = `${CDN}/${era}/${cid}/collections/en-us/${f}`;
        if (await probe(url)) { hit = { url, f }; break outer; }
      }
    }
    if (!hit) { missed++; continue; }
    const local = `${id.replace(/\./g, '_')}-${prod.key}.png`;
    const dest = join(OUT_DIR, local);
    if (!existsSync(dest)) await download(hit.url, dest);
    found++;
    const v = VERIFIED_PRICES[`${id}:${prod.key}`] || {};
    entries.push({
      name: prod.name, detail: prod.detail,
      img: `assets/sealed/${local}`,
      marketUsd: v.marketUsd ?? null, source: v.source ?? null, checked: v.checked ?? null,
      ...(v.note ? { note: v.note } : {}),
    });
    console.log(`${id} ${prod.key} <- ${hit.f}`);
  }
  if (entries.length) manifest[id] = entries;
  else console.log(`${id}: NO RENDERS FOUND`);
}

const header = `// Sealed-product price tracker data — GENERATED by scripts/fetch-sealed.mjs.
// Images: official transparent renders (Pokémon CDN) in assets/sealed/.
// VERIFIED PRICES ONLY (source + check date); null = listed, "tracking soon".
// To price a product: add it to VERIFIED_PRICES in the script and re-run.
`;
writeFileSync(join(ROOT, 'data', 'sealed.js'),
  header + 'window.SEALED_PRODUCTS = ' + JSON.stringify(manifest, null, 2) + ';\n');
console.log(`\nDONE: ${found} products across ${Object.keys(manifest).length} sets (${missed} probes missed). Wrote data/sealed.js`);
