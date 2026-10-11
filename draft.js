// Crowns — Magic draft on the wheel.
// One classic-script IIFE (same contract as app.js). Scryfall supplies the card
// pool; packs follow each set's real booster structure; seven bots draft beside
// you and pass left-right-left. The pack in your hands rides the same wheel
// geometry + momentum physics as app.js, so it feels like the main carousel.
// All dynamic text via textContent; images restricted to Scryfall hosts.

(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  // same motion contract as app.js: full motion unless ?motion=reduced
  const REDUCED = new URLSearchParams(location.search).get('motion') === 'reduced';
  document.documentElement.classList.add(REDUCED ? 'motion-reduced' : 'motion-full');
  const GSAP = !REDUCED && window.gsap ? window.gsap : null;

  // --- Draftable sets ----------------------------------------------------------
  // era 'play'  = Play Booster, 14 cards (Murders at Karlov Manor, Feb 2024, onward)
  // era 'draft' = Draft Booster, 15 cards (everything before)
  const SETS = [
    { code: 'msh', name: 'Marvel Super Heroes', year: 2026, era: 'play' },
    { code: 'sos', name: 'Secrets of Strixhaven', year: 2026, era: 'play' },
    { code: 'tmt', name: 'Teenage Mutant Ninja Turtles', year: 2026, era: 'play' },
    { code: 'ecl', name: 'Lorwyn Eclipsed', year: 2026, era: 'play' },
    { code: 'tla', name: 'Avatar: The Last Airbender', year: 2025, era: 'play' },
    { code: 'spm', name: "Marvel's Spider-Man", year: 2025, era: 'play' },
    { code: 'eoe', name: 'Edge of Eternities', year: 2025, era: 'play' },
    { code: 'fin', name: 'Final Fantasy', year: 2025, era: 'play' },
    { code: 'tdm', name: 'Tarkir: Dragonstorm', year: 2025, era: 'play' },
    { code: 'dft', name: 'Aetherdrift', year: 2025, era: 'play' },
    { code: 'fdn', name: 'Foundations', year: 2024, era: 'play' },
    { code: 'dsk', name: 'Duskmourn: House of Horror', year: 2024, era: 'play' },
    { code: 'blb', name: 'Bloomburrow', year: 2024, era: 'play' },
    { code: 'mh3', name: 'Modern Horizons 3', year: 2024, era: 'play' },
    { code: 'otj', name: 'Outlaws of Thunder Junction', year: 2024, era: 'play' },
    { code: 'mkm', name: 'Murders at Karlov Manor', year: 2024, era: 'play' },
    { code: 'lci', name: 'The Lost Caverns of Ixalan', year: 2023, era: 'draft' },
    { code: 'woe', name: 'Wilds of Eldraine', year: 2023, era: 'draft' },
    { code: 'ltr', name: 'The Lord of the Rings', year: 2023, era: 'draft' },
    { code: 'mom', name: 'March of the Machine', year: 2023, era: 'draft' },
    { code: 'stx', name: 'Strixhaven: School of Mages', year: 2021, era: 'draft' },
  ];
  const setByCode = (code) => SETS.find((s) => s.code === code) || null;

  const SEATS = 8;
  const ROUNDS = 3;
  const COLORS = ['W', 'U', 'B', 'R', 'G'];
  const COLOR_NAME = { W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green' };
  const COLOR_HEX = { W: '#F2E6C2', U: '#4BA3E3', B: '#A48FC0', R: '#E8573A', G: '#46B26A', M: '#D9A93A', C: '#9A98A8' };
  const BASIC_OF = { W: 'Plains', U: 'Island', B: 'Swamp', R: 'Mountain', G: 'Forest' };
  const RARITY_RANK = { mythic: 0, rare: 1, uncommon: 2, common: 3 };
  const RARITY_HEX = { mythic: '#F2702E', rare: '#E3B341', uncommon: '#B9C6D6', common: '#8C86A1' };

  // --- Storage (every access guarded: private windows / blocked storage) -----
  const STORE = 'crowns-draft-v1';
  const POOL_PREFIX = 'crowns-draft-pool-v1-';
  const store = {
    get(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch { /* storage blocked */ } },
    keys() { try { return Object.keys(localStorage); } catch { return []; } },
  };

  const IMG_HOSTS = ['https://cards.scryfall.io/', 'https://svgs.scryfall.io/'];
  const safeImg = (u) => (typeof u === 'string' && IMG_HOSTS.some((h) => u.startsWith(h))) ? u : '';
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  // stable 0..1 hash: bots "disagree" about cards without storing per-bot tables
  function hash01(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return ((h >>> 0) % 100000) / 100000;
  }
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  // --- Scryfall -----------------------------------------------------------------
  async function search(q, unique) {
    let url = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(q)}&unique=${unique || 'cards'}&order=set`;
    const out = [];
    for (let p = 0; url && p < 12; p++) {
      const r = await fetch(url, { headers: { Accept: 'application/json' } });
      if (r.status === 404) break; // Scryfall's "no cards matched"
      if (!r.ok) throw new Error(`Scryfall answered ${r.status}`);
      const j = await r.json();
      out.push(...(j.data || []));
      url = j.has_more ? j.next_page : null;
      if (url) await sleep(110); // Scryfall asks for ~10 req/s max
    }
    return out;
  }

  const RAR = { common: 'common', uncommon: 'uncommon', rare: 'rare', mythic: 'mythic', special: 'rare', bonus: 'mythic' };
  // Arena/Moxfield import by FRONT face name for these layouts
  const FRONT_NAME = new Set(['transform', 'modal_dfc', 'adventure', 'flip', 'meld', 'prepare', 'reversible_card']);
  function compact(c) {
    const faces = c.card_faces || [];
    const f0 = faces[0] || {}, f1 = faces[1] || null;
    const iu = c.image_uris || f0.image_uris || {};
    const back = !c.image_uris && f1 && f1.image_uris ? (f1.image_uris.large || f1.image_uris.normal) : null;
    const cols = c.colors || [...new Set(faces.flatMap((f) => f.colors || []))];
    return {
      sid: c.id,
      name: c.name,
      xname: FRONT_NAME.has(c.layout) && f0.name ? f0.name : c.name,
      set: c.set, cn: c.collector_number,
      rarity: RAR[c.rarity] || 'common',
      cmc: c.cmc || 0,
      mana: c.mana_cost ? c.mana_cost : (f0.mana_cost || ''),
      colors: COLORS.filter((x) => cols.includes(x)),
      type: c.type_line || f0.type_line || '',
      text: c.oracle_text != null ? c.oracle_text : faces.map((f) => f.oracle_text || '').join('\n—\n'),
      pow: c.power ?? f0.power ?? null,
      tou: c.toughness ?? f0.toughness ?? null,
      kw: c.keywords || [],
      img: safeImg(iu.large || iu.normal),
      thumb: safeImg(iu.normal || iu.small),
      back: safeImg(back),
      prod: c.produced_mana || [],
    };
  }

  async function loadSetPool(set) {
    const key = POOL_PREFIX + set.code;
    const hit = store.get(key);
    if (hit && hit.v === 1 && Date.now() - hit.at < 7 * 864e5 && hit.cards?.length > 60 && hit.basics?.length) return hit;
    loading(`Fetching ${set.name} from Scryfall…`);
    // booster-eligible cards, one print per name; brand-new sets aren't flagged
    // yet, so fall back to the set's paper cards
    let raw = await search(`e:${set.code} is:booster -t:basic game:paper`);
    if (raw.length < 120) { await sleep(110); raw = await search(`e:${set.code} -t:basic game:paper`); }
    await sleep(110);
    let basics = await search(`e:${set.code} t:basic game:paper`, 'prints');
    if (!basics.length) { await sleep(110); basics = await search('e:fdn t:basic game:paper', 'prints'); }
    const cards = raw.map(compact).filter((c) => c.img);
    if (cards.length < 60) throw new Error(`Scryfall only has ${cards.length} cards for ${set.name} so far`);
    const byName = {};
    for (const b of basics.map(compact)) if (b.img && Object.values(BASIC_OF).includes(b.name) && !byName[b.name]) byName[b.name] = b;
    const pool = { v: 1, at: Date.now(), cards, basics: Object.values(byName) };
    // keep only this set's pool cached (each is ~200 KB)
    store.keys().filter((k) => k.startsWith(POOL_PREFIX) && k !== key).forEach((k) => store.del(k));
    store.set(key, pool);
    return pool;
  }

  // --- Card helpers -------------------------------------------------------------
  const frontType = (c) => (c.type || '').split(' // ')[0];
  const isLand = (c) => /\bLand\b/.test(frontType(c));
  const isBasic = (c) => /\bBasic\b/.test(frontType(c));
  const isCreature = (c) => /\bCreature\b/.test(frontType(c));
  const colorKey = (c) => (c.colors.length > 1 ? 'M' : c.colors[0] || 'C');
  const cardHex = (c) => COLOR_HEX[colorKey(c)];
  const cmcBucket = (c) => (isLand(c) ? 6 : clamp(Math.floor(c.cmc), 1, 6) - 1);
  const BUCKETS = ['≤1', '2', '3', '4', '5', '6+', 'Lands'];
  function pips(mana) {
    const out = { W: 0, U: 0, B: 0, R: 0, G: 0 };
    for (const m of (mana || '').matchAll(/\{([^}]+)\}/g)) {
      const cs = COLORS.filter((x) => m[1].includes(x));
      cs.forEach((x) => { out[x] += 1 / cs.length; });
    }
    return out;
  }

  // Heuristic pick value (no public win-rate feed is reachable, so bots judge
  // cards the way a solid drafter skims them: rarity, removal, card advantage,
  // evasion, and a fair body for the mana).
  const scoreMemo = new Map();
  function baseScore(c) {
    if (scoreMemo.has(c.sid)) return scoreMemo.get(c.sid);
    let s;
    if (isBasic(c)) s = -10;
    else {
      const t = (c.text || '').toLowerCase();
      s = { mythic: 3.25, rare: 3.05, uncommon: 2.55, common: 2.2 }[c.rarity] || 2.2;
      if (isLand(c)) s -= 0.7;
      if (/\b(destroy|exile) target (creature|nonland permanent|permanent|artifact or creature|creature or planeswalker|creature or vehicle|attacking or blocking creature|creature an opponent controls|nonland permanent an opponent controls)/.test(t)) s += 1.1;
      else if (/\bdestroy (all|each) (other )?creatures?\b/.test(t)) s += 0.8;
      else {
        const dmg = t.match(/deals? (\d+|x) damage to (any target|target creature|target creature or planeswalker|target attacking or blocking creature|each creature|each opponent and each creature)/);
        if (dmg) s += dmg[1] === 'x' ? 0.8 : 0.45 + Math.min(+dmg[1], 5) * 0.1;
        else if (/(fights|deals damage equal to its power to) (target|up to one target|another target) creature/.test(t)) s += 0.6;
        else if (/target creature( an opponent controls)? gets -\d+\/-\d+/.test(t)) s += 0.7;
        else if (/enchanted creature can't (attack|block)|(enchanted|target) creature can't attack or block/.test(t)) s += 0.55;
        else if (/return target (creature|nonland permanent) to its owner's hand/.test(t)) s += 0.2;
      }
      if (/draw (two|three|four) cards/.test(t)) s += 0.35;
      else if (/draw a card/.test(t)) s += 0.15;
      if (/counter target spell/.test(t)) s += 0.1;
      if (isCreature(c)) {
        const kws = c.kw.map((k) => k.toLowerCase());
        if (kws.includes('flying')) s += 0.25;
        s += Math.min(0.25, kws.filter((k) => ['lifelink', 'deathtouch', 'first strike', 'double strike', 'trample', 'vigilance', 'menace', 'ward', 'haste', 'reach'].includes(k)).length * 0.08);
        const p = parseFloat(c.pow), q = parseFloat(c.tou);
        if (Number.isFinite(p) && Number.isFinite(q)) s += clamp(((p + q) / (2 * Math.max(1, c.cmc)) - 1) * 0.5, -0.35, 0.35);
        if (!t.trim()) s -= 0.15; // vanilla
      }
      if (c.cmc >= 7) s -= 0.45; else if (c.cmc === 6) s -= 0.15;
      if (c.colors.length > 1) s += 0.1;
    }
    scoreMemo.set(c.sid, s);
    return s;
  }

  // --- Packs --------------------------------------------------------------------
  function buildSheets(pool, era) {
    const sh = { common: [], uncommon: [], rare: [], mythic: [], land: [] };
    for (const c of pool.cards) {
      if (c.rarity === 'common' && isLand(c) && era === 'play') sh.land.push(c); // common duals ride the land slot
      else sh[c.rarity].push(c);
    }
    if (!sh.rare.length) sh.rare = sh.mythic.length ? sh.mythic : sh.uncommon;
    if (!sh.uncommon.length) sh.uncommon = sh.common;
    return sh;
  }
  function roll(table) {
    let r = Math.random();
    for (const [k, p] of table) { if ((r -= p) <= 0) return k; }
    return table[0][0];
  }
  function makePack(sh, basics, era) {
    const used = new Set();
    const out = [];
    const take = (rar, n, foil) => {
      const src = sh[rar] && sh[rar].length ? sh[rar] : sh.common;
      for (let k = 0; k < n; k++) {
        let c, guard = 0;
        do { c = src[Math.floor(Math.random() * src.length)]; } while (used.has(c.sid) && ++guard < 40);
        used.add(c.sid);
        out.push(Object.assign({}, c, { foil: !!foil }));
      }
    };
    const basic = () => {
      const b = basics[Math.floor(Math.random() * basics.length)];
      if (b) out.push(Object.assign({}, b, { foil: false }));
    };
    const rareSlot = () => (sh.mythic.length && Math.random() < (era === 'play' ? 1 / 7 : 1 / 8) ? 'mythic' : 'rare');
    if (era === 'play') {
      take('common', 7); take('uncommon', 3); take(rareSlot(), 1);
      take(roll([['common', 0.42], ['uncommon', 0.42], ['rare', 0.135], ['mythic', 0.025]]), 1);   // wildcard
      take(roll([['common', 0.66], ['uncommon', 0.25], ['rare', 0.075], ['mythic', 0.015]]), 1, true); // traditional foil
      if (sh.land.length && Math.random() < 0.5) take('land', 1); else basic();
    } else {
      const foil = Math.random() < 1 / 3; // a foil of any rarity replaces a common
      take('common', foil ? 9 : 10); take('uncommon', 3); take(rareSlot(), 1);
      if (foil) take(roll([['common', 0.66], ['uncommon', 0.25], ['rare', 0.075], ['mythic', 0.015]]), 1, true);
      basic();
    }
    return out;
  }
  // display order on the wheel: rares first, then colour, then curve; land slot last
  function sortPack(pack) {
    const rank = (c) => (isBasic(c) ? 9 : isLand(c) && c.rarity === 'common' ? 8 : RARITY_RANK[c.rarity] * 2 - (c.foil ? 1 : 0));
    const ck = (c) => 'WUBRGMC'.indexOf(colorKey(c));
    return pack.slice().sort((a, b) => rank(a) - rank(b) || ck(a) - ck(b) || a.cmc - b.cmc || a.name.localeCompare(b.name));
  }

  // --- Draft state --------------------------------------------------------------
  let state = null;
  function save() { if (state) store.set(STORE, state); }
  function validState(s) {
    return s && s.v === 1 && setByCode(s.code) && Array.isArray(s.holding) && s.holding.length === SEATS && Array.isArray(s.pool);
  }

  function newDraft(set, pool) {
    let uid = 0;
    const tag = (pack) => pack.map((c) => Object.assign(c, { uid: 'u' + (uid++).toString(36) }));
    const sh = buildSheets(pool, set.era);
    const rounds = [];
    for (let r = 0; r < ROUNDS; r++) rounds.push(Array.from({ length: SEATS }, () => tag(makePack(sh, pool.basics, set.era))));
    state = {
      v: 1, code: set.code, setName: set.name, era: set.era,
      size: rounds[0][0].length,
      round: 0, pick: 0,
      holding: rounds[0], future: rounds.slice(1),
      bots: Array.from({ length: SEATS }, () => ({ pool: [], w: { W: 0, U: 0, B: 0, R: 0, G: 0 } })),
      pool: [], log: [], seen: {}, signals: { W: 0, U: 0, B: 0, R: 0, G: 0 },
      basics: pool.basics, done: false, deck: null, started: Date.now(),
    };
    save();
  }

  const passDir = (round) => (round === 1 ? -1 : 1); // left, right, left
  const overallPick = () => state.round * state.size + state.pick + 1;

  function botScore(bot, c, n, seat) {
    let s = baseScore(c) + (hash01(c.uid + ':' + seat) - 0.5) * 0.6;
    if (c.colors.length) {
      const commit = clamp((n - 4) / 14, 0, 1); // speculate early, settle into a lane
      const top = COLORS.slice().sort((a, b) => bot.w[b] - bot.w[a]).slice(0, 2);
      const inTop = c.colors.filter((x) => top.includes(x)).length;
      if (inTop === c.colors.length) s += 0.9 * commit;
      else if (inTop) s += (0.2 - 0.5 * (c.colors.length - inTop)) * commit;
      else s -= 1.5 * commit;
    }
    return s;
  }
  function botPick(seat) {
    const bot = state.bots[seat], pack = state.holding[seat];
    if (!pack.length) return;
    const n = overallPick();
    let best = 0, bestScore = -Infinity;
    pack.forEach((c, i) => { const sc = botScore(bot, c, n, seat); if (sc > bestScore) { bestScore = sc; best = i; } });
    const [c] = pack.splice(best, 1);
    bot.pool.push(c);
    const w = Math.max(0, baseScore(c) - 1.5);
    c.colors.forEach((x) => { bot.w[x] += w / c.colors.length; });
  }

  // you just received a pack: count the strong cards still in it, by colour
  function readSignals() {
    if (state.pick < 1 || state.pick > 7) return;
    for (const c of state.holding[0]) {
      if (baseScore(c) < 2.7 || !c.colors.length) continue;
      c.colors.forEach((x) => { state.signals[x] += 1 / c.colors.length; });
    }
  }

  // one full table step: you take, the bots take, every pack moves one seat
  function commitPick(uid) {
    const pack = state.holding[0];
    const i = pack.findIndex((c) => c.uid === uid);
    if (i < 0) return null;
    const [card] = pack.splice(i, 1);
    state.pool.push(card);
    state.log.push({ r: state.round, p: state.pick, name: card.name, uid: card.uid, rarity: card.rarity });
    for (let s = 1; s < SEATS; s++) botPick(s);
    const dir = passDir(state.round);
    const next = new Array(SEATS);
    for (let s = 0; s < SEATS; s++) next[(s + dir + SEATS) % SEATS] = state.holding[s];
    state.holding = next;
    state.pick++;
    if (!state.holding[0].length) {
      state.round++;
      if (state.round >= ROUNDS) { state.done = true; autoBuild(); }
      else { state.holding = state.future.shift(); state.pick = 0; }
    } else readSignals();
    save();
    return card;
  }

  // --- Auto-build: best two colours, 23 spells, 17 lands -----------------------
  function autoBuild() {
    const spells = state.pool.filter((c) => !isLand(c));
    let pair = ['W', 'U'], bestVal = -1;
    for (let a = 0; a < 5; a++) for (let b = a + 1; b < 5; b++) {
      const p = [COLORS[a], COLORS[b]];
      const ranked = spells.filter((c) => c.colors.length && c.colors.every((x) => p.includes(x)))
        .map((c) => baseScore(c)).sort((x, y) => y - x).slice(0, 23);
      const val = ranked.reduce((n, v) => n + Math.max(0, v - 1.2), 0);
      if (val > bestVal) { bestVal = val; pair = p; }
    }
    const fits = (c) => c.colors.every((x) => pair.includes(x));
    const val = (c) => baseScore(c) - (c.cmc >= 6 ? 0.3 : 0) - (c.colors.length ? 0 : 0.15);
    const ranked = spells.filter(fits).sort((x, y) => val(y) - val(x));
    const main = ranked.slice(0, 23);
    if (main.length < 23) { // thin pool: lean on the best off-colour cards rather than run short
      const rest = spells.filter((c) => !main.includes(c)).sort((x, y) => val(y) - val(x));
      main.push(...rest.slice(0, 23 - main.length));
    }
    const duals = state.pool.filter((c) => isLand(c) && !isBasic(c) && c.prod.filter((x) => pair.includes(x)).length >= 2).slice(0, 3);
    main.push(...duals);
    state.deck = { main: main.map((c) => c.uid), lands: landSplit(main, 17 - duals.length) };
  }
  function landSplit(main, total) {
    const sum = { W: 0, U: 0, B: 0, R: 0, G: 0 };
    main.filter((c) => !isLand(c)).forEach((c) => { const p = pips(c.mana); COLORS.forEach((x) => { sum[x] += p[x]; }); });
    const all = COLORS.reduce((n, x) => n + sum[x], 0);
    const lands = { W: 0, U: 0, B: 0, R: 0, G: 0 };
    if (!all || total <= 0) return lands;
    const raw = COLORS.map((x) => [x, (sum[x] / all) * total]);
    raw.forEach(([x, v]) => { lands[x] = Math.floor(v); });
    let left = total - COLORS.reduce((n, x) => n + lands[x], 0);
    raw.sort((a, b) => (b[1] % 1) - (a[1] % 1)).forEach(([x]) => { if (left > 0 && sum[x] > 0) { lands[x]++; left--; } });
    return lands;
  }

  // --- Views ----------------------------------------------------------------------
  const views = { start: $('viewStart'), loading: $('viewLoading'), draft: $('viewDraft'), build: $('viewBuild') };
  let activeView = 'start';
  function show(name) {
    activeView = name;
    Object.entries(views).forEach(([k, v]) => { v.hidden = k !== name; });
    document.body.className = 'dr-' + ({ start: 'start', loading: 'start', draft: 'drafting', build: 'building' })[name];
    $('drStatus').hidden = !(name === 'draft' || name === 'build');
    $('drNew').hidden = !(name === 'draft' || name === 'build');
    if (name !== 'draft') hidePeek();
  }
  function loading(msg) { $('drLoadingTxt').textContent = msg; show('loading'); }

  let toastT = 0;
  function toast(msg) {
    const t = $('drToast');
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove('on'), 2600);
  }

  // mana cost → Scryfall symbol images ({W/U} → WU.svg, {2/W} → 2W.svg)
  function manaNodes(mana, size) {
    const frag = document.createDocumentFragment();
    for (const m of (mana || '').matchAll(/\{([^}]+)\}/g)) {
      if (m[1] === '//') continue;
      const img = new Image();
      img.className = 'ms';
      img.alt = `{${m[1]}}`;
      img.src = safeImg(`https://svgs.scryfall.io/card-symbols/${encodeURIComponent(m[1].replace(/\//g, ''))}.svg`);
      if (size) { img.width = size; img.height = size; }
      frag.appendChild(img);
    }
    return frag;
  }
  const symbol = (x, size) => manaNodes(`{${x}}`, size);

  // --- Start screen ------------------------------------------------------------------
  function buildStart(preselect) {
    const list = $('drSets');
    list.replaceChildren();
    SETS.forEach((s, i) => {
      const li = el('li');
      const b = el('button', 'dr-set');
      b.type = 'button';
      b.style.setProperty('--i', i);
      if (s.code === preselect) b.classList.add('pre');
      const ic = new Image();
      ic.className = 'dr-set-ic';
      ic.alt = '';
      ic.src = safeImg(`https://svgs.scryfall.io/sets/${s.code}.svg`);
      ic.onerror = () => { ic.style.visibility = 'hidden'; };
      const txt = el('span', 'dr-set-txt');
      txt.append(el('span', 'dr-set-name', s.name), el('span', 'dr-set-meta', `${s.code.toUpperCase()} · ${s.year} · ${s.era === 'play' ? 'Play Booster · 14' : 'Draft Booster · 15'}`));
      b.append(ic, txt, el('span', 'dr-set-go', 'Draft'));
      b.addEventListener('click', () => startDraft(s));
      li.appendChild(b);
      list.appendChild(li);
    });
    const saved = validState(state) ? state : null;
    $('drResume').hidden = !saved;
    if (saved) {
      $('drResumeBtn').textContent = saved.done ? 'Back to your deck' : 'Resume draft';
      $('drResumeTxt').textContent = saved.done
        ? `${saved.setName} · ${saved.pool.length} cards drafted`
        : `${saved.setName} · pack ${saved.round + 1}, pick ${saved.pick + 1}`;
    }
  }
  $('drResumeBtn').addEventListener('click', () => (state.done ? enterBuild() : enterDraft()));
  $('drNew').addEventListener('click', () => { buildStart(state && state.code); show('start'); window.scrollTo(0, 0); });

  async function startDraft(set) {
    if (validState(state) && state.pool.length
      && !confirm(`Start a new ${set.name} draft? Your ${state.setName} ${state.done ? 'deck' : 'draft in progress'} will be replaced.`)) return;
    try {
      loading(`Opening ${set.name}…`);
      const pool = await loadSetPool(set);
      loading('Seating eight drafters…');
      newDraft(set, pool);
      enterDraft();
    } catch (err) {
      buildStart(set.code);
      show('start');
      toast(`Couldn't load ${set.name}: ${err.message || err}`);
    }
  }

  // --- Header status ---------------------------------------------------------------
  function buildRing() {
    const ring = $('drRing');
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 48 48');
    for (let s = 0; s < SEATS; s++) {
      const a = Math.PI / 2 + (s / SEATS) * Math.PI * 2; // you sit at the bottom
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', (24 + Math.cos(a) * 17).toFixed(2));
      c.setAttribute('cy', (24 + Math.sin(a) * 17).toFixed(2));
      c.setAttribute('r', s === 0 ? 4.2 : 2.6);
      c.setAttribute('class', s === 0 ? 'you' : 'bot');
      svg.appendChild(c);
    }
    const arrow = document.createElementNS(NS, 'path');
    arrow.setAttribute('d', 'M16.5 21a8 8 0 0 1 15 0M31.5 21l-.4-4.2M31.5 21l-4 -1.4');
    arrow.setAttribute('class', 'arrow');
    svg.appendChild(arrow);
    ring.replaceChildren(svg);
  }
  function updateStatus() {
    const set = setByCode(state.code);
    $('drSetName').textContent = set.name;
    const icon = $('drSetIcon');
    icon.src = safeImg(`https://svgs.scryfall.io/sets/${set.code}.svg`);
    if (state.done) {
      $('drPick').textContent = `${state.pool.length} picks · deck building`;
      $('drRing').classList.remove('left', 'right');
      return;
    }
    const dir = passDir(state.round);
    $('drPick').textContent = `Pack ${state.round + 1} · Pick ${state.pick + 1} / ${state.size} · passing ${dir > 0 ? 'left' : 'right'}`;
    $('drRing').classList.toggle('left', dir > 0);
    $('drRing').classList.toggle('right', dir < 0);
  }

  // --- The wheel (geometry + physics ported from app.js) -------------------------
  const wheel = $('wheel'), track = $('track');
  const FRICTION = 0.92, WHEEL_GAIN = 0.0015, SNAP_VELOCITY = 0.012, SNAP_K = 0.14, MAX_VEL = 0.6;
  const CARD_H = (window.LAYOUT && window.LAYOUT.WHEEL_CARD_HEIGHT_FACTOR) || 0.6;
  let pack = [], els = [], N = 0;
  let position = 0, velocity = 0, target = 0, mode = 'idle', current = -1;
  let cardW = 200, spacing = 200;
  let busy = false;
  const introOff = { v: 0 };

  function measure() {
    cardW = wheel.clientHeight * CARD_H * (734 / 1024);
    spacing = cardW;
  }
  function render(force) {
    for (let i = 0; i < N; i++) {
      const d = i - position + introOff.v * 6;
      const ad = Math.abs(d);
      const pocket = Math.exp(-(d * d) / 1.1);
      const scale = 0.98 + 0.56 * Math.exp(-(d * d) / 1.0);
      const bright = 0.66 + 0.34 * pocket;
      const arcY = (1 - pocket) * spacing * 0.012;
      const zRec = -Math.pow(1 - pocket, 1.6) * 240;
      const yaw = clamp(-d * 38, -42, 42) * (1 - pocket * 0.55);
      const xu = d * 0.40 + Math.sign(d) * Math.min(ad, 1) * 0.62;
      const e = els[i];
      e.style.visibility = 'visible';
      e.style.transform =
        `translate3d(${(xu * spacing - cardW / 2).toFixed(2)}px, -50%, 0)` +
        ` translateY(${arcY.toFixed(2)}px) translateZ(${zRec.toFixed(1)}px)` +
        ` rotateY(${yaw.toFixed(2)}deg) scale(${scale.toFixed(4)})`;
      e.style.setProperty('--dim', (1 - bright).toFixed(3));
      e.style.zIndex = String(100 - Math.round(ad * 10));
    }
    if (!N || busy) return; // mid-pass: the leftovers slide out without touching the caption
    const idx = clamp(Math.round(position), 0, N - 1);
    if (idx !== current || force) setCurrent(idx);
  }
  function clampPos() {
    if (position < 0) { position = 0; velocity = 0; }
    if (position > N - 1) { position = Math.max(0, N - 1); velocity = 0; }
  }
  function tick() {
    if (activeView === 'draft') {
      if (mode === 'gliding' || mode === 'wheeling') {
        position += velocity;
        velocity *= FRICTION;
        clampPos();
        if (Math.abs(velocity) < SNAP_VELOCITY) { mode = 'snapping'; target = clamp(Math.round(position), 0, N - 1); }
        render();
      } else if (mode === 'snapping' || mode === 'jumping') {
        const k = mode === 'jumping' ? SNAP_K * 1.3 : SNAP_K;
        position += (target - position) * k;
        if (Math.abs(target - position) < 0.0008) { position = target; mode = 'idle'; }
        render();
      }
    }
    requestAnimationFrame(tick);
  }
  function goTo(idx, instant) {
    if (!N) return;
    target = clamp(idx, 0, N - 1);
    velocity = 0;
    if (REDUCED || instant || document.hidden) { position = target; mode = 'idle'; render(true); }
    else mode = 'jumping';
  }

  const isWheeled = (c) => state.pick >= SEATS && !!state.seen[c.uid];
  function makeCardEl(c, i) {
    const e = el('div', 'dr-card' + (c.foil ? ' foil' : ''));
    e.dataset.i = i;
    e.setAttribute('aria-hidden', 'true');
    const img = new Image();
    img.alt = c.name;
    img.draggable = false;
    img.decoding = 'async';
    img.onerror = () => e.classList.add('noimg');
    img.src = c.img;
    e.append(img, el('span', 'dr-ph', c.name));
    if (c.foil) e.appendChild(el('span', 'dr-foil-sheen'));
    if (isWheeled(c)) e.appendChild(el('span', 'dr-badge', 'Wheeled'));
    const take = el('span', 'dr-take', 'Take');
    e.appendChild(take);
    return e;
  }
  function mountPack(dirIn) {
    pack = sortPack(state.holding[0]);
    els = pack.map(makeCardEl);
    N = pack.length;
    track.replaceChildren(...els);
    position = target = 0; velocity = 0; mode = 'idle'; current = -1;
    measure();
    if (GSAP && dirIn && !document.hidden) {
      introOff.v = dirIn;
      track.style.opacity = '0';
      GSAP.to(track, { opacity: 1, duration: 0.35, ease: 'power1.out' });
      GSAP.to(introOff, { v: 0, duration: 0.85, ease: 'expo.out', onUpdate: () => render(), onComplete: () => render(true) });
    } else {
      introOff.v = 0;
      track.style.opacity = '1';
    }
    render(true);
    pack.forEach((c) => { state.seen[c.uid] = 1; });
    save();
    updateStatus();
    const wheeled = pack.filter(isWheeled).length;
    if (state.pick === SEATS && wheeled) toast(`Your first pack is back: ${wheeled} card${wheeled > 1 ? 's' : ''} wheeled`);
  }

  // --- Caption -------------------------------------------------------------------------
  const capName = $('capName'), capRarity = $('capRarity'), capMana = $('capMana'), capType = $('capType'), capPT = $('capPT');
  function setCurrent(idx) {
    if (current >= 0 && els[current]) {
      els[current].classList.remove('center');
      els[current].setAttribute('aria-hidden', 'true');
      els[current].removeAttribute('role');
      els[current].removeAttribute('aria-label');
      els[current].tabIndex = -1;
    }
    current = idx;
    const c = pack[idx];
    const e = els[idx];
    e.classList.add('center');
    e.removeAttribute('aria-hidden');
    e.setAttribute('role', 'button');
    e.setAttribute('aria-label', `${c.name}, ${c.rarity}. Press Enter to take it.`);
    e.tabIndex = 0;
    const hex = cardHex(c);
    e.style.setProperty('--focus-glow', hex);
    $('drGlow').style.setProperty('--glow', hex);
    capName.textContent = c.name;
    capRarity.textContent = c.rarity;
    capRarity.style.color = RARITY_HEX[c.rarity];
    capMana.replaceChildren(manaNodes(c.mana));
    capType.textContent = c.type;
    capPT.textContent = c.pow != null && c.tou != null ? `${c.pow}/${c.tou}` : '';
    $('capFoil').hidden = !c.foil;
    $('capWheel').hidden = !isWheeled(c);
  }

  // --- Taking a card ---------------------------------------------------------------------
  function take(idx) {
    if (busy || !pack[idx] || state.done) return;
    busy = true;
    const c = pack[idx];
    const srcEl = els[idx];
    const from = srcEl.querySelector('img').getBoundingClientRect();
    const dir = passDir(state.round);
    commitPick(c.uid);
    renderPool(c.uid);
    flyToPool(c, from, srcEl);
    srcEl.style.visibility = 'hidden';
    els.splice(idx, 1); // the wheel's leftovers slide out toward the next seat
    pack.splice(idx, 1);
    N = pack.length;
    const after = () => {
      busy = false;
      if (state.done) { setTimeout(enterBuild, REDUCED ? 0 : 420); return; }
      mountPack(state.pick === 0 ? 1 : dir); // a fresh pack drops in from the right
    };
    if (GSAP && N && !document.hidden) {
      GSAP.to(introOff, { v: -dir, duration: 0.3, ease: 'power2.in', onUpdate: () => render() });
      GSAP.to(track, { opacity: 0, duration: 0.3, ease: 'power2.in', onComplete: after });
    } else after();
  }

  function flyToPool(c, from, srcEl) {
    const mini = document.querySelector(`.dr-mini[data-uid="${c.uid}"]`);
    const tray = $('drTray');
    const to = mini && tray.classList.contains('open') ? mini.getBoundingClientRect() : $('drTrayToggle').getBoundingClientRect();
    if (REDUCED || !from.width || document.hidden || !to.width) { if (mini) mini.classList.remove('incoming'); return; }
    const ghost = new Image();
    ghost.src = srcEl.querySelector('img').src;
    ghost.className = 'dr-ghost';
    Object.assign(ghost.style, { left: from.left + 'px', top: from.top + 'px', width: from.width + 'px', height: from.height + 'px' });
    document.body.appendChild(ghost);
    const sx = to.width / from.width;
    const dx = to.left - from.left, dy = to.top - from.top;
    const anim = ghost.animate([
      { transform: 'translate(0,0) scale(1)', opacity: 1 },
      { transform: `translate(${dx * 0.35}px, ${dy * 0.2 - 40}px) scale(${(1 + sx) / 2})`, opacity: 1, offset: 0.4 },
      { transform: `translate(${dx}px, ${dy}px) scale(${sx})`, opacity: mini ? 1 : 0.2 },
    ], { duration: 620, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'forwards' });
    anim.onfinish = () => {
      ghost.remove();
      if (mini) { mini.classList.remove('incoming'); mini.classList.add('landed'); }
    };
  }

  // --- Pool tray ---------------------------------------------------------------------------
  const sortInColumn = (a, b) => 'WUBRGMC'.indexOf(colorKey(a)) - 'WUBRGMC'.indexOf(colorKey(b)) || a.cmc - b.cmc || a.name.localeCompare(b.name);
  function renderPool(incomingUid) {
    const box = $('drPool');
    const cols = BUCKETS.map(() => []);
    state.pool.forEach((c) => cols[cmcBucket(c)].push(c));
    box.replaceChildren(...cols.map((list, b) => {
      const col = el('div', 'dr-col');
      const head = el('div', 'dr-col-h');
      head.append(el('span', null, BUCKETS[b]), el('b', null, String(list.length)));
      col.appendChild(head);
      const stack = el('div', 'dr-stack');
      list.sort(sortInColumn).forEach((c) => stack.appendChild(miniEl(c, c.uid === incomingUid)));
      col.appendChild(stack);
      return col;
    }));
    $('drPoolCount').textContent = String(state.pool.length);
    // colour summary
    const counts = { W: 0, U: 0, B: 0, R: 0, G: 0 };
    state.pool.forEach((c) => c.colors.forEach((x) => { counts[x]++; }));
    const cbox = $('drColors');
    cbox.replaceChildren(...COLORS.filter((x) => counts[x]).map((x) => {
      const s = el('span', 'dr-cc');
      s.title = `${counts[x]} ${COLOR_NAME[x].toLowerCase()} card${counts[x] > 1 ? 's' : ''}`;
      s.append(symbol(x, 15), el('b', null, String(counts[x])));
      return s;
    }));
    // signals
    const sig = $('drSignals');
    const max = Math.max(1, ...COLORS.map((x) => state.signals[x]));
    const label = el('span', 'dr-sig-l', 'Open');
    sig.replaceChildren(label, ...COLORS.map((x) => {
      const bar = el('span', 'dr-sig');
      bar.style.setProperty('--h', (state.signals[x] / max).toFixed(3));
      bar.style.setProperty('--c', COLOR_HEX[x]);
      bar.title = `${COLOR_NAME[x]}: ${state.signals[x].toFixed(1)} strong cards seen after pick 1`;
      return bar;
    }));
  }
  function miniEl(c, incoming) {
    const m = el('div', 'dr-mini' + (incoming ? ' incoming' : '') + (c.foil ? ' foil' : ''));
    m.dataset.uid = c.uid;
    m.tabIndex = 0;
    m.setAttribute('role', 'img');
    m.setAttribute('aria-label', c.name);
    const img = new Image();
    img.alt = '';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.draggable = false;
    img.src = c.thumb || c.img;
    m.appendChild(img);
    m.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'touch') peek(c, e.currentTarget); });
    m.addEventListener('pointerleave', hidePeek);
    m.addEventListener('focus', (e) => peek(c, e.currentTarget));
    m.addEventListener('blur', hidePeek);
    return m;
  }
  const peekEl = $('drPeek');
  function peek(c, anchor) {
    const r = anchor.getBoundingClientRect();
    const w = Math.min(280, innerWidth * 0.6), h = w * 1024 / 734;
    let x = r.right + 14;
    if (x + w > innerWidth - 12) x = r.left - w - 14;
    const y = clamp(r.top + r.height / 2 - h / 2, 12, innerHeight - h - 12);
    peekEl.querySelector('img').src = c.img;
    peekEl.style.transform = `translate(${Math.max(12, x)}px, ${y}px)`;
    peekEl.style.width = w + 'px';
    peekEl.classList.add('on');
  }
  function hidePeek() { peekEl.classList.remove('on'); }

  $('drTrayToggle').addEventListener('click', () => {
    const tray = $('drTray');
    const open = !tray.classList.contains('open');
    tray.classList.toggle('open', open);
    $('drTrayToggle').setAttribute('aria-expanded', String(open));
    store.set('crowns-draft-tray', open ? 1 : 0);
    requestAnimationFrame(() => { measure(); render(true); });
  });

  // --- Zoom ------------------------------------------------------------------------------------
  const zoom = $('zoom');
  function openZoom(idx) {
    const c = pack[idx];
    if (!c || zoom.open) return;
    $('dzImg').src = c.img;
    $('dzImg').alt = c.name;
    const back = $('dzBack');
    back.hidden = !c.back;
    if (c.back) back.src = c.back;
    $('dzRarity').textContent = `${c.rarity}${c.foil ? ' · foil' : ''}${isWheeled(c) ? ' · wheeled' : ''}`;
    $('dzRarity').style.color = RARITY_HEX[c.rarity];
    $('dzName').textContent = c.name;
    $('dzMana').replaceChildren(manaNodes(c.mana, 16));
    $('dzType').textContent = c.type + (c.pow != null && c.tou != null ? ` · ${c.pow}/${c.tou}` : '');
    const text = $('dzText');
    text.replaceChildren(...(c.text || '').split('\n').filter(Boolean).map((line) => el('p', line === '—' ? 'dz-sep' : null, line)));
    $('dzTake').hidden = state.done;
    zoom.showModal();
  }
  $('dzClose').addEventListener('click', () => zoom.close());
  $('dzTake').addEventListener('click', () => { zoom.close(); take(current); });
  zoom.addEventListener('click', (e) => { if (e.target === zoom) zoom.close(); });

  // --- Input -----------------------------------------------------------------------------------
  wheel.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (zoom.open || !N) return;
    let d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (e.deltaMode === 1) d *= 16; else if (e.deltaMode === 2) d *= 100;
    if (REDUCED) { goTo(current + Math.sign(d), true); return; }
    velocity = clamp(velocity + d * WHEEL_GAIN, -MAX_VEL, MAX_VEL);
    mode = 'wheeling';
  }, { passive: false });

  let lastX = 0, lastT = 0, dragVel = 0, dragMoved = 0;
  wheel.addEventListener('pointerdown', (e) => {
    if (zoom.open || !N || e.button > 0) return;
    try { wheel.setPointerCapture(e.pointerId); } catch { /* inactive pointer */ }
    wheel.classList.add('dragging');
    mode = 'dragging';
    velocity = 0; dragMoved = 0; dragVel = 0;
    lastX = e.clientX; lastT = performance.now();
  });
  wheel.addEventListener('pointermove', (e) => {
    if (mode !== 'dragging') return;
    const dx = e.clientX - lastX;
    const now = performance.now();
    dragMoved += Math.abs(dx);
    position -= dx / spacing;
    clampPos();
    dragVel = 0.7 * dragVel + 0.3 * (-(dx / spacing) * (1000 / 60) / Math.max(1, now - lastT));
    lastX = e.clientX; lastT = now;
    render();
  });
  function endDrag(e) {
    if (mode !== 'dragging') return;
    wheel.classList.remove('dragging');
    if (dragMoved < 10) {
      // pointer capture retargets to the wheel: hit-test the real point
      const hit = document.elementFromPoint(e.clientX, e.clientY);
      const cardEl = hit && hit.closest ? hit.closest('.dr-card') : null;
      mode = 'idle';
      if (cardEl) {
        const slot = els.indexOf(cardEl);
        if (slot === current && hit.closest('.dr-take')) take(slot);
        else if (slot === current) openZoom(slot);
        else if (slot >= 0) goTo(slot);
      } else { mode = 'snapping'; target = clamp(Math.round(position), 0, N - 1); }
    } else if (REDUCED) goTo(Math.round(position), true);
    else { velocity = clamp(dragVel, -MAX_VEL, MAX_VEL); mode = 'gliding'; }
  }
  wheel.addEventListener('pointerup', endDrag);
  wheel.addEventListener('pointercancel', endDrag);

  addEventListener('keydown', (e) => {
    if (activeView !== 'draft' || zoom.open || busy) return;
    const t = e.target;
    const onControl = t instanceof Element && t.closest('button, a, input, select, textarea, summary') && !t.classList.contains('dr-card');
    switch (e.key) {
      case 'ArrowRight': e.preventDefault(); goTo(current + 1); break;
      case 'ArrowLeft': e.preventDefault(); goTo(current - 1); break;
      case 'Home': e.preventDefault(); goTo(0); break;
      case 'End': e.preventDefault(); goTo(N - 1); break;
      case 'Enter': if (onControl) break; e.preventDefault(); take(current); break;
      case ' ': case 'z': case 'Z': case 'i': case 'I': if (onControl) break; e.preventDefault(); openZoom(current); break;
      default: break;
    }
  });
  addEventListener('resize', () => { if (activeView === 'draft') { measure(); render(true); } hidePeek(); });

  // --- Enter views -----------------------------------------------------------------------------
  function enterDraft() {
    show('draft');
    const trayOpen = store.get('crowns-draft-tray');
    const tray = $('drTray');
    tray.classList.toggle('open', trayOpen !== 0);
    $('drTrayToggle').setAttribute('aria-expanded', String(trayOpen !== 0));
    buildRing();
    renderPool();
    requestAnimationFrame(() => mountPack(1));
  }

  // --- Deck builder --------------------------------------------------------------------------------
  const byUid = () => new Map(state.pool.map((c) => [c.uid, c]));
  function enterBuild() {
    if (!state.deck) autoBuild();
    show('build');
    buildRing();
    updateStatus();
    renderBuild();
    window.scrollTo(0, 0);
  }
  function deckLists() {
    const map = byUid();
    const inMain = new Set(state.deck.main);
    return {
      main: state.deck.main.map((u) => map.get(u)).filter(Boolean),
      side: state.pool.filter((c) => !inMain.has(c.uid)),
    };
  }
  function renderCols(box, list, side) {
    const cols = BUCKETS.map(() => []);
    list.forEach((c) => cols[cmcBucket(c)].push(c));
    box.replaceChildren(...cols.map((l, b) => {
      const col = el('div', 'db-col');
      col.appendChild(el('div', 'db-col-h', `${BUCKETS[b]} · ${l.length}`));
      l.sort(sortInColumn).forEach((c) => {
        const btn = el('button', 'db-card' + (c.foil ? ' foil' : ''));
        btn.type = 'button';
        btn.setAttribute('aria-label', `${c.name} — ${side ? 'add to deck' : 'move to sideboard'}`);
        const img = new Image();
        img.alt = '';
        img.loading = 'lazy';
        img.decoding = 'async';
        img.src = c.thumb || c.img;
        btn.appendChild(img);
        btn.addEventListener('click', () => {
          hidePeek();
          if (side) state.deck.main.push(c.uid);
          else state.deck.main = state.deck.main.filter((u) => u !== c.uid);
          save();
          renderBuild();
        });
        btn.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'touch') peek(c, e.currentTarget); });
        btn.addEventListener('pointerleave', hidePeek);
        btn.addEventListener('focus', (e) => peek(c, e.currentTarget));
        btn.addEventListener('blur', hidePeek);
        col.appendChild(btn);
      });
      if (!l.length) col.classList.add('empty');
      return col;
    }));
  }
  function renderBuild() {
    const { main, side } = deckLists();
    const basics = COLORS.reduce((n, x) => n + (state.deck.lands[x] || 0), 0);
    const spells = main.filter((c) => !isLand(c));
    const total = main.length + basics;
    const landsTotal = basics + main.filter(isLand).length;
    $('buildKicker').textContent = `${state.setName} · draft complete`;
    $('dbMainCount').textContent = `${main.length + basics}`;
    $('dbSideCount').textContent = `${side.length}`;
    renderCols($('dbMain'), main, false);
    renderCols($('dbSide'), side, true);

    // stats strip: count, curve, creatures, colours
    const stats = $('dbStats');
    const count = el('div', 'db-stat db-count' + (total === 40 ? ' ok' : total < 40 ? ' low' : ''));
    count.append(el('b', null, String(total)), el('span', null, total === 40 ? 'cards · ready' : `cards · ${total < 40 ? 40 - total + ' short of' : total - 40 + ' over'} 40`));
    const curve = el('div', 'db-stat db-curve');
    const cc = [0, 0, 0, 0, 0, 0];
    spells.forEach((c) => { cc[clamp(Math.floor(c.cmc), 1, 6) - 1]++; });
    const cmax = Math.max(1, ...cc);
    const bars = el('div', 'db-bars');
    cc.forEach((n, i) => {
      const b = el('span', 'db-bar');
      b.style.setProperty('--h', (n / cmax).toFixed(3));
      b.title = `${n} card${n === 1 ? '' : 's'} at ${BUCKETS[i]} mana`;
      b.append(el('i', null, String(n)), el('em', null, BUCKETS[i]));
      bars.appendChild(b);
    });
    curve.append(bars, el('span', null, 'mana curve'));
    const creatures = spells.filter(isCreature).length;
    const avg = spells.length ? spells.reduce((n, c) => n + c.cmc, 0) / spells.length : 0;
    const mix = el('div', 'db-stat');
    mix.append(el('b', null, `${creatures}`), el('span', null, `creatures · ${spells.length - creatures} other spells · ${landsTotal} lands · avg ${avg.toFixed(2)} mana`));
    stats.replaceChildren(count, curve, mix);

    // basic land steppers
    const lands = $('dbLands');
    lands.replaceChildren(el('span', 'db-lands-l', 'Basic lands'), ...COLORS.map((x) => {
      const w = el('div', 'db-land');
      w.style.setProperty('--c', COLOR_HEX[x]);
      const minus = el('button', 'db-step', '−');
      minus.type = 'button';
      minus.setAttribute('aria-label', `Remove a ${BASIC_OF[x]}`);
      const plus = el('button', 'db-step', '+');
      plus.type = 'button';
      plus.setAttribute('aria-label', `Add a ${BASIC_OF[x]}`);
      const n = el('b', null, String(state.deck.lands[x] || 0));
      minus.addEventListener('click', () => { state.deck.lands[x] = Math.max(0, (state.deck.lands[x] || 0) - 1); save(); renderBuild(); });
      plus.addEventListener('click', () => { state.deck.lands[x] = (state.deck.lands[x] || 0) + 1; save(); renderBuild(); });
      w.append(symbol(x, 18), el('span', 'db-land-n', BASIC_OF[x]), minus, n, plus);
      return w;
    }));

    // pick log + table recap
    const picks = $('dbPicks');
    picks.replaceChildren(...state.log.map((l) => {
      const li = el('li');
      li.append(el('span', 'db-pk', `P${l.r + 1}p${l.p + 1}`), el('span', 'db-pn', l.name));
      li.lastChild.style.color = RARITY_HEX[l.rarity] === RARITY_HEX.common ? '' : RARITY_HEX[l.rarity];
      return li;
    }));
    const table = $('dbTable');
    table.replaceChildren(el('h3', null, 'Who drafted what'), ...state.bots.map((b, s) => {
      const row = el('div', 'db-seat');
      if (s === 0) {
        const mine = { W: 0, U: 0, B: 0, R: 0, G: 0 };
        state.pool.forEach((c) => c.colors.forEach((x) => { mine[x] += Math.max(0, baseScore(c) - 1.5) / c.colors.length; }));
        b = { w: mine };
      }
      const top = COLORS.filter((x) => b.w[x] > 0).sort((a, z) => b.w[z] - b.w[a]).slice(0, 2);
      row.append(el('span', 'db-seat-n', s === 0 ? 'You' : `Seat ${s + 1}`));
      const pp = el('span', 'db-seat-c');
      top.forEach((x) => pp.appendChild(symbol(x, 16)));
      row.appendChild(pp);
      if (s === 1 || s === SEATS - 1) row.appendChild(el('span', 'db-seat-note', s === 1 ? 'passed to you in pack 2' : 'passed to you in packs 1 & 3'));
      return row;
    }));
  }
  $('dbAuto').addEventListener('click', () => { autoBuild(); save(); renderBuild(); toast('Rebuilt around your two deepest colours'); });

  function deckText() {
    const { main, side } = deckLists();
    const lines = (list) => {
      const m = new Map();
      list.forEach((c) => { const k = c.sid; const v = m.get(k) || { c, n: 0 }; v.n++; m.set(k, v); });
      return [...m.values()].map(({ c, n }) => `${n} ${c.xname} (${c.set.toUpperCase()}) ${c.cn}`);
    };
    const out = ['Deck', ...lines(main)];
    COLORS.forEach((x) => {
      const n = state.deck.lands[x] || 0;
      const b = (state.basics || []).find((c) => c.name === BASIC_OF[x]);
      if (n) out.push(b ? `${n} ${b.name} (${b.set.toUpperCase()}) ${b.cn}` : `${n} ${BASIC_OF[x]}`);
    });
    if (side.length) out.push('', 'Sideboard', ...lines(side));
    return out.join('\n');
  }
  $('dbCopy').addEventListener('click', async () => {
    const txt = deckText();
    const ta = $('dbExport');
    try {
      await navigator.clipboard.writeText(txt);
      toast('Deck list copied. Paste it into Arena via Import, or into Moxfield');
      ta.hidden = true;
    } catch {
      ta.value = txt; // clipboard blocked (file:// or permissions): show it to copy by hand
      ta.hidden = false;
      ta.focus();
      ta.select();
      toast('Select the list below and copy it');
    }
  });

  // --- Boot ---------------------------------------------------------------------------------------
  state = store.get(STORE);
  if (!validState(state)) state = null;
  const want = new URLSearchParams(location.search).get('set');
  const wantSet = want ? setByCode(want.toLowerCase()) : null;
  measure();
  requestAnimationFrame(tick);
  if (state && !state.done && (!wantSet || wantSet.code === state.code)) enterDraft();
  else if (wantSet && !(state && state.pool.length)) { buildStart(wantSet.code); startDraft(wantSet); }
  else { buildStart(wantSet ? wantSet.code : state && state.code); show('start'); }
})();
