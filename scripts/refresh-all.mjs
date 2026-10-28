// refresh-all.mjs — run the whole bundled-data refresh in one go, so it can be
// scheduled (e.g. a daily Windows scheduled task). Every step is an existing
// script run in its own process; a failing step is logged and the rest still run
// (each script keeps its previous output file when it fails).
// Writes a summary to data/refresh-all-report.json. Exit code 1 if any step failed.
//
// Run: node scripts/refresh-all.mjs            (daily refresh, ~5-8 min)
//      node scripts/refresh-all.mjs --with-ja  (also rebuild data/ja-map.js, slow)
'use strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const S = (f) => join(ROOT, 'scripts', f);

// TCGdex sets refreshed by refresh-data.mjs: [id, exact TCGdex name]
const TCGDEX_SETS = [
  ['sv01', 'Scarlet & Violet'], ['sv02', 'Paldea Evolved'], ['sv03', 'Obsidian Flames'], ['sv03.5', '151'],
  ['sv04', 'Paradox Rift'], ['sv04.5', 'Paldean Fates'], ['sv05', 'Temporal Forces'], ['sv06', 'Twilight Masquerade'],
  ['sv06.5', 'Shrouded Fable'], ['sv07', 'Stellar Crown'], ['sv08', 'Surging Sparks'], ['sv08.5', 'Prismatic Evolutions'],
  ['sv09', 'Journey Together'], ['sv10', 'Destined Rivals'], ['sv10.5b', 'Black Bolt'], ['sv10.5w', 'White Flare'],
  ['me01', 'Mega Evolution'], ['me02', 'Phantasmal Flames'], ['me02.5', 'Ascended Heroes'], ['me03', 'Perfect Order'],
  ['me04', 'Chaos Rising'], ['me05', 'Pitch Black'],
  ['basep', 'Wizards Black Star Promos'], ['dpp', 'DP Black Star Promos'], ['np', 'Nintendo Black Star Promos'],
];
// promo sets with imageless stubs, via the tolerant gen-promos.mjs: [id, name, TCGCSV group]
const PROMO_SETS = [
  ['svp', 'SVP Black Star Promos', '22872'], ['swshp', 'SWSH Black Star Promos', '2545'],
  ['smp', 'SM Black Star Promos', '1861'], ['xyp', 'XY Black Star Promos', '1451'],
  ['bwp', 'BW Black Star Promos', '1407'], ['hgssp', 'HGSS Black Star Promos', '1453'],
];

const steps = [
  ['card index (all four games, TCGCSV)', [S('build-index.mjs')]],
  ...TCGDEX_SETS.map(([id, name]) => [`set ${id}`, [S('refresh-data.mjs'), id, name]]),
  ...PROMO_SETS.map(([id, name, g]) => [`promos ${id}`, [S('gen-promos.mjs'), id, name, g]]),
  ['First Partner Pack (fpp)', [S('gen-firstpartner.mjs')]],
  ['30th Celebration', [S('fetch-30th.mjs')]],
  ['30th Classic Collection', [S('fetch-30th-classic.mjs')]],
  ['First Partner Illustration fpic1-3', [S('build-fpic.mjs')]],
  ['One Piece bundle (dotgg)', [S('refresh-onepiece.mjs')]],
  ['Magic serialized prices', [S('gen-magic-serial-prices.mjs')]],
  ['sealed prices', [S('gen-sealed-tcgcsv.mjs')]],
  ...(process.argv.includes('--with-ja') ? [['EN-JA printing map', [S('build-ja-map.mjs')]]] : []),
  ['daily price snapshot + trends', [S('snapshot-prices.mjs')]],
  ['homepage trending', [S('build-home-trending.mjs')]],
  ['feed status (Live data page)', [S('build-feed-status.mjs')]],
];

const report = { startedAt: new Date().toISOString(), steps: [] };
for (const [label, args] of steps) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', timeout: 20 * 60e3 });
  const ok = r.status === 0;
  const tail = `${r.stdout || ''}${r.stderr || ''}`.trim().split('\n').slice(-2).join(' | ').slice(0, 300);
  report.steps.push({ step: label, ok, secs: Math.round((Date.now() - t0) / 1000), tail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label} (${Math.round((Date.now() - t0) / 1000)}s) ${ok ? '' : tail}`);
}
report.finishedAt = new Date().toISOString();
report.failed = report.steps.filter((s) => !s.ok).map((s) => s.step);
writeFileSync(join(ROOT, 'data', 'refresh-all-report.json'), JSON.stringify(report, null, 2));
console.log(`\n${steps.length - report.failed.length}/${steps.length} steps ok${report.failed.length ? ' · failed: ' + report.failed.join(', ') : ''}`);
process.exit(report.failed.length ? 1 : 0);
