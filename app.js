// Phantasmal Flames — wheel carousel.
// Single position scalar (card units) owned by an explicit interaction state
// machine: idle | wheeling | dragging | gliding | snapping | jumping.
// All dynamic text via textContent; images restricted to assets.tcgdex.net.

(() => {
  'use strict';
  // the brand mark is the way home: bound first, so it works even if a later part
  // of the boot fails (a half-loaded set must never trap the visitor)
  document.querySelector('.lockup')?.addEventListener('click', () => { location.href = 'index.html'; });

  const SETS = window.CARD_SETS;
  // Immutable layout + transition blueprint (loaded before this file). Falls back
  // to literals only if layout-constants.js failed to load, so nothing breaks.
  const L = window.LAYOUT || {
    WHEEL_CARD_HEIGHT_FACTOR: 0.70, OPEN_DURATION: 520, CLOSE_DURATION: 380,
    EASE_PREMIUM: 'cubic-bezier(0.16, 1, 0.3, 1)', BACKDROP_FADE_DURATION: 440,
    STAGGER_BASE_DELAY: 260, STAGGER_STEP: 45, STAGGER_CHILD_DURATION: 360,
    STAGGER_TRANSLATE_Y: 12, CLOSE_INSURANCE_TIMEOUT: 650,
  };
  const HOME_SET = 'me02';
  if (!SETS || !SETS[HOME_SET]?.cards?.length) {
    document.getElementById('capName').textContent = 'No data — run scripts/refresh-data.mjs';
    return;
  }
  // each bundled set's own numbered cards, captured before mergeFullSet folds in
  // TCGplayer's pattern reprints: the set browser + set header count and value these
  const ORIG_CARDS = {};
  for (const id in SETS) ORIG_CARDS[id] = SETS[id].cards;
  // Active-set state — loadSet() swaps all three together
  let DATA = SETS[HOME_SET];
  let CARDS = DATA.cards;
  let N = CARDS.length;
  // MOBILE (PWA) view state — see the MOBILE section just before the boot.
  const MQ_MOBILE = matchMedia('(max-width: 760px)');
  let MOBILE = MQ_MOBILE.matches;
  let mViewport = null, mcar = null, mscrub = null, mProg = false, mProgT = 0, mScrollT = 0;
  // Owner's call (P, 2026-06-10): POKEX defaults to FULL motion — the OS
  // reduced-motion flag is ignored because this machine reports it from a
  // Windows performance tweak, not an accessibility need. ?motion=reduced is
  // the explicit opt-out. The resolved state drives BOTH JS and CSS.
  const REDUCED = new URLSearchParams(location.search).get('motion') === 'reduced';
  document.documentElement.classList.add(REDUCED ? 'motion-reduced' : 'motion-full');

  // --- Price tiers (TCGplayer USD market; thresholds from PLAN/brand) -------
  // price bands (Faisal, 27 Oct): under $1 grey, $1-5 green, $5-15 blue, $15-50
  // violet, $50+ chroma foil. The dial bars, its legend and the focus rim all read
  // from these, so one colour always means one price range.
  const TIERS = [
    { max: 1, var: '--tier-1', label: 'T1', band: 'b0' },
    { max: 5, var: '--tier-2', label: 'T2', band: 'b1' },
    { max: 15, var: '--tier-3', label: 'T3', band: 'b2' },
    { max: 50, var: '--tier-4', label: 'T4', band: 'b3' },
    { max: Infinity, var: '--tier-5', label: 'T5', band: 'b4' },
  ];
  const css = getComputedStyle(document.documentElement);
  const tierColor = (v) => css.getPropertyValue(v).trim();
  function tierOf(card) {
    if (typeof card.priceUsd !== 'number') return { var: '--tier-none', label: null };
    return TIERS.find(t => card.priceUsd < t.max);
  }
  // image hosts we allow: tcgdex (Pokemon), Scryfall cards + set symbols (Magic),
  // Lorcast (Lorcana), dotgg (One Piece), TCGplayer (sealed product photos)
  const IMG_HOSTS = ['https://assets.tcgdex.net/', 'https://cards.scryfall.io/', 'https://svgs.scryfall.io/', 'https://cards.lorcast.io/', 'https://static.dotgg.gg/', 'https://tcgplayer-cdn.tcgplayer.com/'];
  const safeImg = (url) => (typeof url === 'string' && IMG_HOSTS.some((h) => url.startsWith(h))) ? url : '';
  // one chokepoint for every card image: sealed renders carry a local PNG path,
  // external-game cards (Magic/Lorcana) carry a COMPLETE url, and tcgdex cards
  // carry a base url + a /quality.ext ladder (high.png / high.webp / low.webp).
  const cardImg = (card, quality) => {
    if (!card) return '';
    if (card.sealed) return card.image;          // local path, used directly
    if (card.fullImg) return card.image.startsWith('assets/') ? card.image : safeImg(card.image); // bundled-local OR external full url (whitelisted host)
    return safeImg(card.image + '/' + quality);   // tcgdex base + quality
  };
  // Last-ditch art for a card whose primary image is a dead upstream asset. The
  // merge (mergeFullSet) stamps `fallbackImage` on special-pattern reprints
  // (Master Ball / Poké Ball Pattern) — TCGplayer lists the product but never
  // uploaded its scan, so the _Nw.jpg 404s. The pattern card shares the base
  // printing's illustration, so we fall back to that base card's tcgdex art
  // (same collector number) and the card shows correct artwork instead of a gap.
  const cardImgFallback = (card, quality) => {
    if (!card || !card.fallbackImage) return '';
    return safeImg(card.fallbackImage + '/' + quality); // base card is always a tcgdex base url
  };
  // the smallest real scan each source offers (about 20 KB): what a wheel card shows
  // the moment it comes into view, so scrubbing the dial or a long fling never
  // passes blank cards (Faisal, 27 Oct). '' = the source has one size only (dotGG).
  const thumbImg = (card) => {
    if (!card || card.sealed) return '';
    if (!card.fullImg) return card.imageOk === false ? '' : cardImg(card, 'low.webp');
    const u = cardImg(card, 'high.webp');
    if (u.indexOf('cards.scryfall.io/large/') !== -1) return u.replace('/large/', '/small/');
    if (u.indexOf('cards.lorcast.io/') !== -1 && u.indexOf('/large/') !== -1) return u.replace('/large/', '/normal/');
    if (/tcgplayer-cdn\.tcgplayer\.com\/product\/\d+_in_1000x1000\.jpg/.test(u)) return u.replace('_in_1000x1000.jpg', '_200w.jpg');
    return '';
  };
  // tcgdex set logos live at /en/<series>/<id>/logo; the series is the set id's
  // alpha prefix (sv05 -> sv, me03 -> me). Derive it instead of trusting
  // set.logo — sv05 (Temporal Forces) shipped with a wrong /en/me/ path, which
  // 404s and leaves an empty, dark set button. Deriving fixes that whole class.
  // tcgdex carries no set LOGO for a few sets (only a symbol) — supply the
  // wordmark locally so the dropdown + selector never fall back to a glyph.
  const SET_LOGO_OVERRIDE = {
    'me05': 'assets/setlogos/me05.png',        // Pitch Black (not on tcgdex yet; Bulbagarden archive art)
    '30th': 'assets/setlogos/30th.png',         // official 30th Celebration logo (local; tcgdex has png only, no webp)
    '30th-c': 'assets/setlogos/30th.png',
    // newest sets' official logos, dropped into assets/setlogos/ on 27 Oct
    'mtg-fra': 'assets/setlogos/mtg-fra.png', 'mtg-hob': 'assets/setlogos/mtg-hob.png',
    'lor-13': 'assets/setlogos/lor-13.webp', 'lor-14': 'assets/setlogos/lor-14.webp',
    'op-OP16': 'assets/setlogos/op-OP16.png', 'op-OP17': 'assets/setlogos/op-OP17.png',
    sv05: 'assets/setlogos/sv05.png', // Temporal Forces (tcgdex gap)
    // Disney Lorcana set wordmarks — transparent logos from card-binder.com
    'lor-1': 'assets/setlogos/lor-1.webp', 'lor-2': 'assets/setlogos/lor-2.webp',
    'lor-3': 'assets/setlogos/lor-3.webp', 'lor-4': 'assets/setlogos/lor-4.webp',
    'lor-5': 'assets/setlogos/lor-5.webp', 'lor-6': 'assets/setlogos/lor-6.webp',
    'lor-7': 'assets/setlogos/lor-7.webp', 'lor-8': 'assets/setlogos/lor-8.webp',
    'lor-9': 'assets/setlogos/lor-9.webp', 'lor-10': 'assets/setlogos/lor-10.webp',
    'lor-11': 'assets/setlogos/lor-11.webp',
    // user-supplied (drop the file at the path → it lights up automatically):
    'lor-12': 'assets/setlogos/lor-12.webp',   // Wilds Unknown (webp)
    // 'mtg-sos': 'assets/setlogos/mtg-sos.png',  // Secrets of Strixhaven: re-enable once the file exists (it 404ed on every Magic view)
  };
  const setLogoPng = (set) => {
    const id = set && set.id ? String(set.id) : '';
    if (SET_LOGO_OVERRIDE[id]) return SET_LOGO_OVERRIDE[id];
    const m = id.match(/^[a-z]+/);
    return m ? safeImg(`https://assets.tcgdex.net/en/${m[0]}/${id}/logo.png`)
             : safeImg((set && set.logo ? set.logo : '') + '.png');
  };

  // month-over-month price move: how far the current (avg1) sits above the
  // 30-day average. Drives the "TRENDING" stamp (>= +10% in the last month).
  function monthTrendPct(card) {
    const cm = card && card.cardmarket;
    if (!cm || typeof cm.avg1 !== 'number' || typeof cm.avg30 !== 'number' || cm.avg30 <= 0) return null;
    return (cm.avg1 - cm.avg30) / cm.avg30 * 100;
  }
  const TREND_THRESHOLD = 10; // percent
  const isTrending = (card) => { const p = monthTrendPct(card); return p != null && p >= TREND_THRESHOLD; };

  // the inspect backdrop is tinted by the POKEMON's colour (its type), not a
  // generic prismatic wash — a Fire card glows warm, Water blue, Grass green.
  const TYPE_COLORS = {
    Grass: '#5dc264', Fire: '#ff7a3d', Water: '#4aa6ee', Lightning: '#f6cf3b',
    Psychic: '#d164c8', Fighting: '#d2683f', Darkness: '#6b6f86', Metal: '#9fb0c0',
    Dragon: '#d8a93e', Fairy: '#f48cc6', Colorless: '#cdc6ba',
    // Magic colours
    White: '#f0e9c8', Blue: '#3f8fe0', Black: '#5b5f74', Red: '#ff6347', Green: '#4fbf6a', Gold: '#d8a93e',
    // Lorcana inks
    Amber: '#f0a830', Amethyst: '#a766d6', Emerald: '#3fbf7f', Ruby: '#e0556a', Sapphire: '#4f8fe0', Steel: '#9fb0c0',
    // One Piece colours
    Purple: '#a766d6', Yellow: '#f6cf3b',
  };
  function cardTintColor(card) {
    if (card && Array.isArray(card.types) && card.types.length && TYPE_COLORS[card.types[0]]) {
      return TYPE_COLORS[card.types[0]];
    }
    return rarityColor(card && card.rarity); // typeless cards fall back to rarity colour
  }

  // Trending tiers: a flame for UP (3 tiers by how hard it's rising — orange,
  // then purple, then green for the hottest), a snowflake for DOWN. One glyph.
  const FLAME_PATH = 'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z';
  const SNOW_PATH = 'M12 2v20M4 7l16 10M20 7 4 17M12 2.5 9.8 4.4M12 2.5l2.2 1.9M12 21.5l-2.2-1.9M12 21.5l2.2-1.9M4.3 7.2l.2 2.8M4.3 7.2 7 6.7M19.7 16.8l-.2-2.8M19.7 16.8 17 17.3M19.7 7.2l-.2 2.8M19.7 7.2 17 6.7M4.3 16.8l.2-2.8M4.3 16.8 7 17.3';
  function trendTier(pct) {
    if (pct == null) return null;
    if (pct >= 50) return { kind: 'fire', tier: 3, color: '#43e3a3' }; // green — really, really high
    if (pct >= 25) return { kind: 'fire', tier: 2, color: '#b072ff' }; // purple — higher
    if (pct >= TREND_THRESHOLD) return { kind: 'fire', tier: 1, color: '#ff7a3d' }; // orange — trending
    if (pct <= -10) return { kind: 'snow', tier: 0, color: '#6ec6ff' }; // snowflake — cooling off
    return null;
  }
  // an <svg> string for a tier glyph (flame filled, snowflake stroked)
  function trendGlyphSVG(t, px) {
    if (!t) return '';
    return t.kind === 'fire'
      ? `<svg viewBox="0 0 24 24" width="${px}" height="${px}" style="color:${t.color}"><path fill="currentColor" d="${FLAME_PATH}"/></svg>`
      : `<svg viewBox="0 0 24 24" width="${px}" height="${px}" style="color:${t.color}"><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" d="${SNOW_PATH}"/></svg>`;
  }

  // --- Glow swap: new text seeps in through a soft glow (P's pick over the
  // scramble). Text is set synchronously, so a frozen tab never shows garbage.
  function glowSwap(el, text, quiet) {
    if (el.textContent === text) return;
    el.textContent = text;
    if (REDUCED || quiet) return;   // quiet = the wheel is flying past: no per-step blur repaint
    el.animate([
      { opacity: 0.08, filter: 'blur(7px)', textShadow: '0 0 26px currentColor' },
      { opacity: 1, filter: 'blur(0px)', textShadow: '0 0 0 rgba(0,0,0,0)' },
    ], { duration: 340, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
  }

  // --- Currency: everything shown in USD ------------------------------------
  // TCGplayer fields are already USD; Cardmarket is EUR — convert at a fixed,
  // labeled rate so the whole UI reads in one currency (P's request).
  const EUR_USD = 1.10;
  const eurToUsd = (v) => (typeof v === 'number' ? v * EUR_USD : null);

  // --- Rarity → signature color (caption, meta, family strip) ----------------
  const RARITY_VAR = {
    'common': '--text-faint',
    'uncommon': '--text-dim',
    'rare': '--spectral',
    'double rare': '--tier-2',
    'ace spec rare': '--ember-hot',
    'illustration rare': '--ember-glint',
    'ultra rare': '--spectral-bright',
    'special illustration rare': '--ember',
    'hyper rare': '--ember-glint',
    'black white rare': '--text',
    'mega hyper rare': '--tier-5',
  };
  const rarityColor = (r) => tierColor(RARITY_VAR[(r || '').toLowerCase()] || '--text-dim');
  // slug for the per-rarity "flair" classes (rar-enchanted, rar-ultra-rare, …)
  const raritySlug = (r) => (r || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  // Lorcana names arrive as "Character — Title"; present them dash-free as a
  // name + subtitle pair (no hyphens, just spacing). No-op for other games.
  const splitName = (full) => { const i = (full || '').indexOf(' — '); return i < 0 ? { name: full || '', sub: '' } : { name: full.slice(0, i), sub: full.slice(i + 3) }; };

  // --- Species grouping: "other cards of this Pokémon" -----------------------
  // Strip Mega-/possessive-/suffix decoration down to the core species name so
  // every Greninja printing (Greninja, Greninja ex, Mega Greninja ex) collapses.
  function speciesKey(name) {
    let s = (name || '').trim();
    const poss = s.match(/^.+?['’']s\s+(.+)$/); // "Iono's Bellibolt" → "Bellibolt"
    if (poss) s = poss[1];
    s = s.replace(/^Mega\s+/i, '');
    s = s.replace(/\s+(?:ex|gx|v|vmax|vstar|v-?union|lv\.?\s?x)$/i, '');
    s = s.replace(/\s+[XY]$/, ''); // Mega X / Y forms
    return s.trim().toLowerCase();
  }
  let _speciesIndex = null;
  function speciesGroup(name) {
    if (!_speciesIndex) {
      _speciesIndex = new Map();
      for (const [sid, set] of Object.entries(SETS)) {
        for (const c of set.cards) {
          const k = speciesKey(c.name);
          if (!_speciesIndex.has(k)) _speciesIndex.set(k, []);
          _speciesIndex.get(k).push({ setId: sid, card: c });
        }
      }
    }
    return _speciesIndex.get(speciesKey(name)) || [];
  }

  // --- Pull rates, organized by set ------------------------------------------
  // me02 = exact community-measured (PokéBeach/TCGplayer). Sets within an era
  // share a print structure, so the era ladder is applied and labeled "est."
  // Numeric model: perPack = copies of that rarity per pack; packs = packs per
  // hit of ANY card of that rarity. Per-CARD odds divide across the set's pool.
  const PULL_LADDERS = {
    meEra: {
      label: 'Mega Evolution era · community est.',
      rates: {
        'Common': { perPack: 4 }, 'Uncommon': { perPack: 3 }, 'Rare': { perPack: 1 },
        'Double rare': { packs: 5 }, 'Illustration rare': { packs: 9 },
        'Ultra Rare': { packs: 12 }, 'Special illustration rare': { packs: 80 },
        'Mega Hyper Rare': { packs: 1260 },
      },
    },
    svEra: {
      label: 'Scarlet & Violet era · community est.',
      rates: {
        'ACE SPEC Rare': { packs: 5 }, 'Double rare': { packs: 4 },
        'Illustration rare': { packs: 12 }, 'Ultra Rare': { packs: 8 },
        'Special illustration rare': { packs: 40 }, 'Hyper rare': { packs: 51 },
      },
    },
  };
  const SET_ERA = {
    me01: 'meEra', me02: 'meEra', 'me02.5': 'meEra', me03: 'meEra', me04: 'meEra',
    sv01: 'svEra', sv02: 'svEra', sv03: 'svEra', 'sv03.5': 'svEra', sv04: 'svEra',
    'sv04.5': 'svEra', sv05: 'svEra', sv06: 'svEra', 'sv06.5': 'svEra', sv07: 'svEra',
    sv08: 'svEra', 'sv08.5': 'svEra', sv09: 'svEra', sv10: 'svEra', 'sv10.5b': 'svEra', 'sv10.5w': 'svEra',
  };
  const pullLadderFor = (sid) => PULL_LADDERS[SET_ERA[sid]] || null;
  const fmtPacks = (n) => `1 in ${Math.round(n).toLocaleString('en-US')} packs`;
  const rarityRate = (rate) => rate.packs ? fmtPacks(rate.packs) : `~${rate.perPack} / pack`;
  // odds for THIS specific card: the rarity slot's rate split across every
  // card of that rarity in the set (assumes equal weighting within the slot)
  function cardPullRate(card) {
    const ladder = pullLadderFor(DATA.set.id);
    const rate = ladder?.rates[card.rarity];
    if (!rate) return null;
    const pool = CARDS.reduce((n, c) => n + (c.rarity === card.rarity ? 1 : 0), 0) || 1;
    const packsPerCopy = rate.packs ? rate.packs * pool : pool / rate.perPack;
    return { text: fmtPacks(packsPerCopy), pool };
  }

  // --- Physics constants -----------------------------------------------------
  const FRICTION = 0.92;        // per frame at 60fps
  const WHEEL_GAIN = 0.0015;    // px delta -> card units of velocity (~1.8 cards/notch)
  const SNAP_VELOCITY = 0.012;  // below this, gliding hands off to snapping
  const SNAP_K = 0.14;          // spring constant for snap/jump easing
  const MAX_VEL = 0.6;

  // Belt sweep-in: a VISUAL-ONLY offset added to each card's d in render() —
  // GSAP tweens it 1 → 0 on set load so the whole belt sweeps in from the right
  // (same motion language as the homepage wheel). position/setCurrent untouched.
  const introOff = { v: 0 };
  function kickWheelIntro() {
    if (MOBILE || REDUCED || !window.gsap || document.hidden) { introOff.v = 0; return; }
    gsap.killTweensOf(introOff);
    introOff.v = 1;
    gsap.to(introOff, { v: 0, duration: 1.45, ease: 'expo.out', overwrite: true,
      onUpdate: () => render(), onComplete: () => { introOff.v = 0; render(); } });
    // caption + dial ride in behind the belt
    gsap.fromTo('.caption > *', { opacity: 0, y: 16 },
      { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out', stagger: 0.07, delay: 0.22, clearProps: 'opacity,transform' });
    gsap.fromTo('.minimap', { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out', delay: 0.4, clearProps: 'opacity,transform' });
  }

  // --- State -------------------------------------------------------------------
  let mode = 'idle';
  let position = 0;             // float, card units
  let velocity = 0;
  let target = 0;               // snap/jump destination
  let current = -1;             // settled/nearest integer index (drives UI)
  let spacing = 0;              // px between card centers
  let cardW = 0;

  // --- DOM ---------------------------------------------------------------------
  const $ = (id) => document.getElementById(id);
  const wheel = $('wheel'), track = $('track'), rail = $('rail'), ticksBox = $('ticks');
  const railArc = $('railArc'); // arced, segmented, tapered dial (drawn per set)
  let dial = null;              // { R, A, chord, n, _cur, _curEl }
  // The dial (Faisal picked option A, 27 Oct): a slim scrub track. One segment per
  // card from cheapest to priciest, the wheel's own order, in the card's price-band
  // colour; the part past the current card is dimmed; a knob rides the track with
  // the card's place and price over it. The same track drives the phone scrubber.
  const BAND_COL = { b0: '#80838c', b1: '#4fd17a', b2: '#4ea3f0', b3: '#a879f2', nop: '#2a2c32' };
  const CHROMA = 'linear-gradient(90deg, #ff6fae, #ffd24a 30%, #6ff2c6 55%, #6aa8ff 78%, #c58cff)';
  function makeScrub(host) {
    host.insertAdjacentHTML('afterbegin', '<div class="sd"><span class="sd-end lo">Cheapest</span><span class="sd-end hi">Priciest</span>'
      + '<div class="sd-track"><i class="sd-rest"></i></div><i class="sd-knob"></i><span class="sd-read"></span></div>');
    const q = (c) => host.querySelector(c);
    return { sd: q('.sd'), track: q('.sd-track'), rest: q('.sd-rest'), knob: q('.sd-knob'), read: q('.sd-read'), lo: q('.sd-end.lo'), hi: q('.sd-end.hi'), cur: -1 };
  }
  // paint the track from the active set's cards in wheel order: the set is a few long
  // runs of one band (it is in price order), drawn as hard colour stops, with a
  // one-pixel gap between cards wherever a card is at least 3px wide
  function paintScrub(sc) {
    if (!sc || view.length !== N || !N) return;
    const runs = [];
    for (let s = 0; s < N; s++) {
      const c = cardAt(s);
      const b = c && typeof c.priceUsd === 'number' && c.priceUsd > 0 ? tierOf(c).band : 'nop';
      const last = runs[runs.length - 1];
      if (last && last.b === b) last.to = s + 1; else runs.push({ b, from: s, to: s + 1 });
    }
    const pc = (s) => (s / N * 100).toFixed(4) + '%';
    const stops = runs.map((r) => `${r.b === 'b4' ? '#ffd24a' : BAND_COL[r.b]} ${pc(r.from)} ${pc(r.to)}`).join(', ');
    const chroma = runs.filter((r) => r.b === 'b4').map((r) => {
      const w = (r.to - r.from) / N, f = r.from / N;
      return `${CHROMA} ${w >= 1 ? 0 : (f / (1 - w) * 100).toFixed(4)}% 0 / ${(w * 100).toFixed(4)}% 100% no-repeat`;
    });
    sc.track.style.background = [...chroma, `linear-gradient(90deg, ${stops})`].join(', ');
    const pitch = (sc.track.clientWidth || 1) / N;
    const mask = pitch >= 3 ? `repeating-linear-gradient(90deg, #000 0 ${(pitch - 1).toFixed(3)}px, transparent ${(pitch - 1).toFixed(3)}px ${pitch.toFixed(3)}px)` : 'none';
    sc.track.style.webkitMaskImage = sc.track.style.maskImage = mask;
    sc.cur = -1;
  }
  // the knob and the dimmed rest follow the wheel's position every frame it moves
  function scrubTo(sc, pos) {
    if (!sc || !N) return;
    const f = (Math.max(0, Math.min(N - 1, pos)) + 0.5) / N * 100;
    sc.knob.style.left = f.toFixed(3) + '%';
    sc.rest.style.left = f.toFixed(3) + '%';
  }
  // per card: the readout over the knob (kept inside the track) and the end labels
  function scrubCard(sc, idx) {
    if (!sc || idx === sc.cur || idx < 0) return;
    sc.cur = idx;
    const c = cardAt(idx);
    sc.read.textContent = `${idx + 1} of ${N}` + (c && typeof c.priceUsd === 'number' ? ` · ${money(c.priceUsd)}` : '');
    const w = sc.sd.clientWidth, rw = sc.read.offsetWidth, x = Math.max(rw / 2, Math.min(w - rw / 2, (idx + 0.5) / N * w));
    sc.read.style.left = x.toFixed(1) + 'px';
    sc.lo.style.opacity = x - rw / 2 < sc.lo.offsetWidth + 18 ? '0' : '';
    sc.hi.style.opacity = x + rw / 2 > w - sc.hi.offsetWidth - 18 ? '0' : '';
  }
  let scrub = null, mScrub = null;
  function buildDial() {
    if (!scrub) { railArc.replaceChildren(); scrub = makeScrub(railArc); }
    dial = scrub;
    recolorDial();
  }
  // view[] must be valid for the ACTIVE set — applySort re-calls this.
  function recolorDial() {
    for (const sc of [scrub, mScrub]) {
      if (!sc) continue;
      paintScrub(sc);
      scrubTo(sc, current >= 0 ? current : position);
      if (current >= 0) scrubCard(sc, current);
    }
  }
  // Arc-dial geometry. Single source of truth = the --arc-depth/--arc-rot CSS
  // vars on .minimap (the media query shrinks them on small screens); read them
  // once here and on resize so render() can place the dial without per-frame
  // getComputedStyle.
  const minimapEl = document.querySelector('.minimap');
  let ARC_DEPTH = 20, ARC_ROT = 13;
  const syncArc = () => {
    const cs = getComputedStyle(minimapEl);
    ARC_DEPTH = parseFloat(cs.getPropertyValue('--arc-depth')) || ARC_DEPTH;
    ARC_ROT = parseFloat(cs.getPropertyValue('--arc-rot')) || ARC_ROT;
  };
  syncArc();
  const capName = $('capName'), capMeta = $('capMeta'), capPrice = $('capPrice'),
    capRarity = $('capRarity'), capNumber = $('capNumber'), counter = $('counter'), capTrend = $('capTrend');
  let focusedCard = null;   // the card centred in the wheel (for the share button)
  const zoom = $('zoom'), zoomImg = $('zoomImg'), zoomClose = $('zoomClose');
  const tiltZone = $('tiltZone'), tiltCard = $('tiltCard'), shine = $('shine'), cardFaces = $('cardFaces');
  // EN↔JA printing toggle (P): tcgdex hosts ja-locale art on the same path —
  // probe it on demand; a missing ja printing flashes the button and stays EN
  const langBtn = $('langBtn');
  let zoomLangCard = null, zoomJa = false;
  function setLangUI(ja) {
    zoomJa = ja;
    if (!langBtn) return;
    langBtn.setAttribute('aria-pressed', String(ja));
    langBtn.querySelector('.lb').textContent = ja ? 'English' : 'Japanese';
    langBtn.querySelector('.ic').textContent = ja ? 'EN' : '日本語';
    langBtn.querySelector('.ic').lang = ja ? 'en' : 'ja';
    langBtn.setAttribute('aria-label', ja ? 'Show the English printing' : 'Show the Japanese printing');
    langBtn.classList.toggle('active', ja);
  }
  if (langBtn) langBtn.addEventListener('click', () => {
    const card = zoomLangCard; if (!card) return;
    const jaSrc = window.JA_MAP && window.JA_MAP[card.id];
    if (!zoomJa) {
      if (!jaSrc) return;
      const g = ++imgGen;                       // cancel any pending EN sharpeners
      const probe = new Image();
      probe.onload = () => { if (g === imgGen) { swapArt(probe.src); setLangUI(true); } };
      probe.onerror = () => { if (g === imgGen) { langBtn.classList.add('na'); setTimeout(() => langBtn.classList.remove('na'), 900); } };
      probe.src = jaSrc;
    } else {
      ++imgGen;
      swapArt(cardImg(card, 'high.webp')); // EN high is already cached
      setLangUI(false);
    }
  });
  // the printing changes behind a quick quarter turn of the card, so the swap reads
  // even where the two printings share their art and only the text differs
  function swapArt(src) {
    const faces = document.getElementById('cardFaces');
    if (!faces || REDUCED || !faces.animate) { zoomImg.src = src; return; }
    faces.animate([{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(90deg)' }], { duration: 150, easing: 'ease-in' }).onfinish = () => {
      zoomImg.src = src;
      faces.animate([{ transform: 'rotateY(-90deg)' }, { transform: 'rotateY(0deg)' }], { duration: 220, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
    };
  }

  // Sealed products ride the wheel as synthetic cards, appended after the
  // numbered singles (so real-card indices 0..N-1 are untouched). Their image
  // is a local transparent PNG, not a TCGdex scan — flagged with sealed:true.
  function sealedCardsFor(id) {
    const prods = (window.SEALED_PRODUCTS || {})[id] || [];
    return prods.map((p, i) => ({
      id: `${id}-sealed-${i}`,
      sealed: true,
      sealedMeta: p,
      name: p.name,
      localId: 'sealed',
      num: 900 + i,
      rarity: null,
      category: 'Sealed',
      illustrator: null,
      image: p.img,
      priceUsd: typeof p.marketUsd === 'number' ? p.marketUsd : null,
      priceVariant: null,
      variants: {},
      cardmarket: null,
      imageOk: true,
    }));
  }
  const cardListCache = {};
  function setCardList(id) {
    if (!cardListCache[id]) cardListCache[id] = [...SETS[id].cards, ...sealedCardsFor(id)];
    return cardListCache[id];
  }

  // Card + tick DOM is built once per set and cached; loadSet() swaps it in.
  const domCache = {};
  function buildSetDom(id) {
    if (domCache[id]) return domCache[id];
    const data = SETS[id];
    const list = setCardList(id);
    const els = list.map((card, i) => {
      const el = document.createElement('article');
      el.className = 'card';
      el.dataset.i = i;
      el.tabIndex = -1;
      el.setAttribute('aria-hidden', 'true');
      // NOTE: do NOT set `inert` on off-center cards. `inert` removes the element
      // from hit-testing, so elementFromPoint() skips it and the click handler
      // can't resolve which card was clicked — only the centered card stayed
      // clickable. aria-hidden + tabIndex=-1 already keep non-focused cards out
      // of the tab order / AT tree; mouse clicks on them must still work.
      const img = document.createElement('img');
      img.alt = card.sealed ? `${card.name} — sealed product` : `${card.name} — card ${card.localId} of ${data.set.name}`;
      img.draggable = false;
      img.decoding = 'async';           // never block the wheel on image decode
      // no loading="lazy": wantImage() already decides when each card loads, and a
      // lazy img stays under an IntersectionObserver that had to re-map every
      // in-flight card through its 3D transform on every frame of a fling
      const slot = { el, img, loaded: card.sealed ? 'high' : null }; // declared early so the error handler can settle its load state
      const ph = document.createElement('div');
      ph.className = 'ph';
      ph.textContent = card.name;
      if (card.sealed) {
        el.classList.add('sealed');     // floats the transparent render, no card frame
        img.src = card.image;           // local PNG — no webp quality ladder
      } else {
        img.addEventListener('error', () => {
          // primary failed. tcgdex cards step high.webp -> low.webp first; a
          // full-url (index/external) card has no quality ladder, so it skips
          // straight to the fallback. Either way, when the primary art is dead
          // we try the base printing's tcgdex art (stamped by mergeFullSet on
          // Master Ball / Poké Ball Pattern reprints) before the placeholder.
          if (img.dataset.q === 'thumb') {                  // the small scan is missing: show the full one
            img.dataset.q = 'high'; slot.loaded = 'full';
            img.src = cardImg(card, 'high.webp');
          } else if (!card.fullImg && img.dataset.q === 'high') { // tcgdex high failed -> drop to low
            img.dataset.q = 'low';
            img.src = cardImg(card, 'low.webp');
          } else if (card.fallbackImage && img.dataset.q !== 'fallback') { // dead asset -> base printing's art
            img.dataset.q = 'fallback';
            slot.loaded = 'high';        // fallback IS hi-res tcgdex; stop the upgrade ladder
            img.src = cardImgFallback(card, 'high.webp');
          } else {                       // nothing left -> placeholder
            el.classList.add('noimg');
          }
        });
      }
      const tag = document.createElement('span');
      tag.className = 'inspect-tag';
      tag.textContent = 'inspect';
      tag.setAttribute('aria-hidden', 'true'); // the card itself is the button
      // depth dim: its OWN composited layer, so changing its opacity every frame
      // never repaints the card (the old ::after dim re-rastered every visible
      // card + its 50px shadow on every frame of a fling: the main jank source)
      const dim = document.createElement('i');
      dim.className = 'card-dim';
      dim.setAttribute('aria-hidden', 'true');
      const rim = document.createElement('i');   // settled-focus rim (CSS .card.lit)
      rim.className = 'card-rim';
      rim.setAttribute('aria-hidden', 'true');
      el.append(rim, img, ph, tag, dim);
      slot.dim = dim; slot.dimV = -1; slot.z = null;
      return slot;
    });
    const ticks = list.map((card) => {
      const t = document.createElement('i');
      const color = tierColor(tierOf(card).var);
      t.style.background = color;
      t.style.color = color; // for .cur glow via currentColor
      return t;
    });
    domCache[id] = { els, ticks };
    return domCache[id];
  }

  let els = [];
  let tickByCard = [];
  let tickEls = [];

  // Display order: slot -> card index. The wheel, minimap, and counter all
  // speak in slots; CARDS/els/ticks stay card-indexed underneath.
  let view = [];
  let slotOf = [];
  const cardAt = (slot) => CARDS[view[slot]];

  // --- Image loading: distance-based low -> high upgrades ---------------------
  // while the dial is being scrubbed the wheel passes dozens of cards a second:
  // they show their small scans only, and the big ones wait for the release (a
  // queue of 200 KB requests used to starve the small ones and leave blank cards)
  let holdHigh = false;
  function wantImage(i, q) {
    const slot = els[i];
    if (slot.loaded === 'high' || slot.loaded === q) return;
    const card = CARDS[i];
    // full-url cards (index / Magic / Lorcana / One Piece) carry ONE image with no
    // webp quality ladder — cardImg returns the same url for high/low. Point the
    // VISIBLE img straight at it so, if the asset is dead (TCGplayer never uploaded
    // the pattern reprint's scan), the img's own onerror fires and swaps to the
    // base printing's art. A hidden preloader would only ever fire onload, so a
    // dead asset would silently leave the card blank — this is what broke them.
    if (card.fullImg) {
      if (slot.loaded === 'full') return;
      const thumb = thumbImg(card);
      // first sight: the small scan at once (cached by the thumb warm-up below)
      if (thumb && !slot.loaded) { slot.img.dataset.q = 'thumb'; slot.img.src = thumb; slot.loaded = 'low'; }
      if (q !== 'high' && slot.loaded) return;
      if (slot.loaded === 'low') {
        // near the centre: the full scan replaces the small one once it has loaded,
        // so the card is never blank between the two; a dead full scan is handed to
        // the visible img so its error chain (base printing's art, then placeholder) runs
        if (slot.hiPending) return;
        slot.hiPending = true;
        const pre = new Image();
        pre.decoding = 'async';
        pre.onload = pre.onerror = () => { if (slot.best === 'done') return; slot.img.dataset.q = 'high'; slot.img.src = pre.src; slot.loaded = 'full'; };
        pre.src = cardImg(card, 'high.webp');
        return;
      }
      slot.img.dataset.q = 'high';
      slot.img.src = cardImg(card, 'high.webp');
      slot.loaded = 'full';
      return;
    }
    if (q === 'high' && card.imageOk === false) q = 'low';
    // a card that comes into view near the centre (a dial scrub drops the wheel
    // anywhere) shows its small scan at once instead of nothing until high.webp lands
    if (!slot.loaded) { slot.img.dataset.q = 'low'; slot.img.src = cardImg(card, 'low.webp'); slot.loaded = 'low'; }
    if (q === 'high') {
      if (slot.hiPending) return;   // one request per card, not one per frame
      slot.hiPending = true;
      const pre = new Image();
      pre.decoding = 'async';
      pre.onload = () => { if (slot.best === 'done') return; slot.img.dataset.q = 'high'; slot.img.src = pre.src; slot.loaded = 'high'; };
      // tcgdex high.webp missing -> fall back to the base printing's art, else low
      pre.onerror = () => {
        const fb = cardImgFallback(card, 'high.webp');
        if (fb) { slot.img.dataset.q = 'fallback'; slot.img.src = fb; slot.loaded = 'high'; }
      };
      pre.src = cardImg(card, 'high.webp');
    }
  }

  // --- Layout ------------------------------------------------------------------
  const PEAK = L.WHEEL_CARD_PEAK || 1.54;   // card elements are built at the focused size (layout-constants.js)
  let elW = 0;                              // the card element's real width = cardW * PEAK
  function measure() {
    const h = wheel.clientHeight * L.WHEEL_CARD_HEIGHT_FACTOR; // pinned in layout-constants.js
    cardW = h * (734 / 1024);
    elW = cardW * PEAK;
    spacing = cardW; // base unit; the focus-pocket curve shapes actual gaps
  }
  addEventListener('resize', () => { syncArc(); measure(); buildDial(); render(true); });
  // the wheel lays out in the room UNDER the set header (style.css: main's top
  // padding is the header's height), so on a short screen (1440x900, 1366x768)
  // the focused card shrinks instead of riding up under the header's text; the
  // wheel is re-measured whenever that room changes size
  if (window.ResizeObserver) {
    const sh = document.getElementById('setHead');
    if (sh) new ResizeObserver(() => document.body.style.setProperty('--sh-h', sh.offsetHeight + 'px')).observe(sh);
    let lastWheelH = 0;
    new ResizeObserver(() => {
      const h = wheel.clientHeight;
      if (!h || h === lastWheelH) return;
      lastWheelH = h;
      if (wheelReady) { measure(); render(true); }
    }).observe(wheel);
  }

  // --- Render ------------------------------------------------------------------
  const WINDOW = 10; // paint ±10 around position (smaller cards pack more in view)
  let painted = new Set();
  let wheelReady = false;   // false until the first loadSet (the set browser boots without a wheel)
  function render(force) {
    if (!wheelReady || !els.length) return;
    const lo = Math.max(0, Math.floor(position) - WINDOW);
    const hi = Math.min(N - 1, Math.ceil(position) + WINDOW);
    const next = new Set();
    for (let i = lo; i <= hi; i++) next.add(i);
    for (const i of painted) if (!next.has(i)) {
      const el = els[view[i]].el;
      if (el !== zoomReturnEl) el.style.visibility = 'hidden'; // never cull the open inspect's source card
    }
    for (let i = lo; i <= hi; i++) {
      const d = i - position + introOff.v * 6; // sweep-in shift (0 when settled)
      const ad = Math.abs(d);
      // premium curve (aristidebenoist-style): one smooth gaussian "bump" —
      // lift, brightness and tilt all ride the same continuous pocket,
      // so the swipe reads as one fluid wave instead of stepped keyframes
      const pocket = Math.exp(-(d * d) / 1.1); // wide: smooth depth/tilt/light
      // gacha-select geometry (P's reference): the focused card stands flat
      // and dominant; its neighbours stay LARGE (~80% apparent) and bend
      // hard inward around it, stacking tight like a held hand of cards
      // base card is 15% smaller (LAYOUT 0.60) but the focus compensates to the
      // SAME absolute size (0.60*1.54 == 0.70*1.32) — the field shrinks, the
      // champion doesn't, and everything gains dead space (P)
      // the element is built at the PEAK size, so the curve is divided by it:
      // the focused card sits at scale 1 (rastered 1:1, crisp), the rest shrink
      const scale = (0.98 + 0.56 * Math.exp(-(d * d) / 1.0)) / PEAK;
      const bright = 0.66 + 0.34 * pocket;   // clearer side cards (P: more clarity)
      // the frame: side cards keep the centre's eye-line, dive back in Z, and
      // turn toward the focused card — one shared vanishing point (.track)
      const arcY = (1 - pocket) * spacing * 0.012;
      const zRec = -Math.pow(1 - pocket, 1.6) * 240;   // neighbours stay near, the wall dives
      const yaw = Math.max(-42, Math.min(42, -d * 38)) * (1 - pocket * 0.55);
      const slot = els[view[i]], el = slot.el;
      if (!el.isConnected) track.appendChild(el);
      el.style.visibility = 'visible';
      // breathing fan (P: the focus needs AIR): the first neighbour sits a
      // full card out — clear gap around the focused card — then 0.40 slices
      const xu = d * 0.40 + Math.sign(d) * Math.min(ad, 1) * 0.62;
      el.style.transform =
        `translate3d(${(xu * spacing - elW / 2).toFixed(2)}px, -50%, 0)` +
        ` translateY(${arcY.toFixed(2)}px) translateZ(${zRec.toFixed(1)}px)` +
        ` rotateY(${yaw.toFixed(2)}deg) scale(${scale.toFixed(4)})`;
      // dim = opacity of the card's own overlay layer (compositor-only, no repaint);
      // written only when it moves visibly
      const dimV = 1 - bright;
      if (Math.abs(dimV - slot.dimV) > 0.004) { slot.dim.style.opacity = dimV.toFixed(3); slot.dimV = dimV; }
      // stacking: nearer card in front. round(ad) keeps the same order as ad*10
      // but only changes at half-card crossings, so the layer tree is rebuilt a
      // few times per card instead of on every frame
      const z = 100 - Math.round(ad);
      if (slot.z !== z) { el.style.zIndex = String(z); slot.z = z; }
      // hold quality upgrades during fast travel; decode work causes hitching
      wantImage(view[i], (ad < 3.5 && Math.abs(velocity) < 0.18 && !holdHigh) ? 'high' : 'low');
    }
    painted = next;
    scrubTo(scrub, position);   // the knob glides with the wheel

    const idx = Math.max(0, Math.min(N - 1, Math.round(position)));
    if (idx !== current || force) setCurrent(idx);
  }

  // --- Current-card UI (caption, minimap, counter, glow, focus) ---------------
  const priceTween = { v: 0 }; // shared target for the count-up price
  let centerEl = null;   // the element that holds .center now (not derived from `current`,
                         // which callers reset to -1 to force a repaint: that left a stale .center behind)
  function setCurrent(idx) {
    if (current >= 0 && current !== idx && tickEls[current]) tickEls[current].classList.remove('cur');
    const nextEl = els[view[idx]] && els[view[idx]].el;
    if (centerEl && centerEl !== nextEl) {
      const prev = centerEl;
      prev.tabIndex = -1;
      prev.classList.remove('center', 'lit');
      prev.setAttribute('aria-hidden', 'true');
      prev.removeAttribute('role');       // drop the button semantics it got while centered
      prev.removeAttribute('aria-label'); // (it's clickable for the mouse, but hidden from AT again)
    }
    centerEl = nextEl;
    current = idx;
    const card = cardAt(idx);
    const tier = tierOf(card);
    const color = tierColor(tier.var);
    // flying past at speed (fling / fast drag): text swaps without the glow and
    // price count-up, so each card step costs a text write, not a repaint chain
    const fast = ((mode === 'gliding' || mode === 'wheeling') && Math.abs(velocity) > 0.12)
      || (mode === 'dragging' && Math.abs(dragVel) > 0.12);

    tickEls[idx].classList.add('cur');
    rail.setAttribute('aria-valuenow', String(idx + 1));
    const priceText = typeof card.priceUsd === 'number'
      ? `$${card.priceUsd.toFixed(2)}`
      : (card.cardmarket?.trend != null ? `€${card.cardmarket.trend.toFixed(2)} Cardmarket` : 'unpriced');
    rail.setAttribute('aria-valuetext', `card ${idx + 1} of ${N} — ${card.name}, ${priceText}`);

    const cEl = els[view[idx]].el;
    cEl.tabIndex = 0;
    cEl.classList.add('center');
    cEl.style.setProperty('--focus-glow', color);   // the rim wears the tier's light
    cEl.removeAttribute('aria-hidden');
    cEl.setAttribute('role', 'button');
    cEl.setAttribute('aria-label', `Inspect ${card.name}`);

    const cn = splitName(card.name); // dash-free Lorcana names (Character / Title)
    glowSwap(capName, cn.name, fast); // ALL-CAPS via CSS; seeps in between cards
    capRarity.className = 'cap-rarity-top' + (card.sealed ? '' : ' rar-' + raritySlug(card.rarity)); // special rarities get flair
    // rarity rides the TOP line, above the wheel, in its signature color
    if (card.sealed) capRarity.style.color = 'var(--ember-glint)';
    else capRarity.style.color = rarityColor(card.rarity);
    const rarityLine = card.sealed ? 'SEALED PRODUCT' : (card.rarity ? card.rarity.toUpperCase() : ' ');
    capRarity.hidden = !rarityLine.trim();   // no rarity → no empty pill (P: "the empty bar")
    glowSwap(capRarity, rarityLine, fast);
    // the card number now rides the TOP, directly under the rarity (P)
    capNumber.textContent = card.sealed
      ? (card.sealedMeta.detail || 'sealed product')
      : `${card.localId} / ${String(DATA.set.official).padStart(3, '0')}`;
    capMeta.replaceChildren();
    if (cn.sub) capMeta.textContent = cn.sub; // Lorcana subtitle below the name, no dash
    focusedCard = card;
    refreshCapMarks(card);

    // the price — big, money-green, counting to its value (the dopamine hit)
    const capUsd = typeof card.priceUsd === 'number' ? card.priceUsd
      : (card.cardmarket?.trend != null ? eurToUsd(card.cardmarket.trend) : null);
    capPrice.classList.toggle('t5', tier.label === 'T5');
    capPrice.classList.toggle('none', capUsd == null);
    if (capUsd != null) {
      priceTween.target = capUsd;
      if (window.gsap && !REDUCED && !fast) {
        gsap.killTweensOf(priceTween);
        gsap.to(priceTween, {
          v: capUsd, duration: 0.4, ease: 'power3.out',
          onUpdate: () => { capPrice.textContent = money(priceTween.v); },
        });
        // insurance for frozen tickers (occluded tab): snap to the final value
        setTimeout(() => {
          if (priceTween.target === capUsd) { priceTween.v = capUsd; capPrice.textContent = money(capUsd); }
        }, 520);
      } else {
        if (window.gsap) gsap.killTweensOf(priceTween);
        priceTween.v = capUsd;
        capPrice.textContent = money(capUsd);
      }
    } else {
      priceTween.target = null;
      if (window.gsap) gsap.killTweensOf(priceTween);
      priceTween.v = 0;
      capPrice.textContent = '—';
    }

    // trending stamp by the price — flame tiers for up, snowflake for down
    const tPct = card.sealed ? null : monthTrendPct(card);
    const capTier = trendTier(tPct);
    if (capTier) {
      capTrend.innerHTML = `${trendGlyphSVG(capTier, 19)}<span class="cap-trend-pct">${tPct >= 0 ? '+' : ''}${Math.round(tPct)}%</span>`;
      capTrend.style.color = capTier.color;
      capTrend.hidden = false;
    } else {
      capTrend.hidden = true;
    }

    counter.textContent = String(idx + 1).padStart(3, '0');
    const span = document.createElement('span');
    span.textContent = `/${N}`;
    counter.appendChild(span);

    // dial: the readout names this card's place and price over the knob
    scrubCard(scrub, idx);
    if (MOBILE) { scrubTo(mScrub, idx); scrubCard(mScrub, idx); }

    // valuable cards (>= $20) get the hot title treatment
    const hot = typeof card.priceUsd === 'number' && card.priceUsd >= 20;
    capName.classList.toggle('hot', hot);
    if (hot) capName.style.setProperty('--hot-color', color);

    if (mode === 'idle') settle();
  }
  // Work that only makes sense once the wheel has STOPPED on a card (tick() calls
  // this when a glide/snap/jump lands; setCurrent when an instant move lands):
  // the full-screen glow recolour (a 2560px gradient repaint, so never mid-flight),
  // the crisp full-resolution scan for the focused card, and the idle prefetch.
  let settledOn = -1;
  function settle() {
    if (!wheelReady || current < 0 || settledOn === current) return;
    settledOn = current;
    els[view[current]].el.classList.add('lit');   // the rim fades in on the card we stopped on
    sharpenFocused(current);
    if (typeof schedulePrefetch === 'function') schedulePrefetch();
  }
  // the focused card wears the highest-resolution scan its source offers (tcgdex
  // lossless PNG, Scryfall PNG, TCGplayer 1000px) once it has decoded off-thread;
  // the same bytes then open the inspect instantly. Side cards stay on webp.
  const bestImg = (card) => {
    if (!card || card.sealed) return '';
    if (!card.fullImg) return card.imageOk === false ? '' : cardImg(card, 'high.png');
    const u = cardImg(card, 'high.webp');
    if (u.indexOf('tcgplayer-cdn.tcgplayer.com/product/') !== -1) return u.replace(/_\d+w\.jpg$/, '_in_1000x1000.jpg');
    if (u.indexOf('cards.scryfall.io/large/') !== -1) return u.replace('/large/', '/png/').replace(/\.jpg(\?|$)/, '.png$1');
    return '';
  };
  function sharpenFocused(slotIdx) {
    const ci = view[slotIdx], slot = els[ci], card = CARDS[ci];
    if (!slot || slot.best || slot.img.dataset.q === 'fallback') return;
    const url = bestImg(card);
    if (!url) return;
    slot.best = 'pending';
    const pre = new Image();
    pre.decoding = 'async';
    pre.src = url;
    (pre.decode ? pre.decode() : new Promise((ok, no) => { pre.onload = ok; pre.onerror = no; }))
      .then(() => { slot.img.dataset.q = 'best'; slot.img.src = url; slot.loaded = 'high'; slot.best = 'done'; })
      .catch(() => { slot.best = 'failed'; });
  }

  // --- rAF loop -----------------------------------------------------------------
  function clampPos() {
    if (position < 0) { position = 0; velocity = 0; }
    if (position > N - 1) { position = N - 1; velocity = 0; }
  }
  // Background drift runs from rAF (ambientLoop below) — CSS animation timelines
  // are frozen on this machine, but rAF demonstrably runs (the wheel moves).
  const TAU = Math.PI * 2;
  const bgGrain = $('bgGrain'), bgGlass = $('bgGlass'), bgLight = $('bgLight'), zoomBgArt = $('zoomBgArt');

  function driftBg(ms) {
    const t = ms / 1000;
    bgGlass.style.transform =
      `translate3d(${(Math.sin(t * TAU / 28) * 3.2).toFixed(3)}%, ${(Math.cos(t * TAU / 23) * 0.6).toFixed(3)}%, 0)` +
      ` scale(${(1.06 + Math.sin(t * TAU / 37) * 0.05).toFixed(4)})`;
    bgGrain.style.transform =
      `translate3d(${(Math.sin(t * TAU / 50 + 2) * 2).toFixed(3)}%, ${(Math.cos(t * TAU / 41) * 0.5).toFixed(3)}%, 0)`;
    // keylight sways mostly horizontally — no vertical bob that reads as a moving line at the top
    bgLight.style.transform =
      `translate3d(${(Math.sin(t * TAU / 45 + 1) * 4).toFixed(3)}%, ${(Math.cos(t * TAU / 38) * 0.7).toFixed(3)}%, 0)`;
    bgLight.style.opacity = (0.88 + 0.12 * Math.sin(t * TAU / 17)).toFixed(3);
    // inspect backdrop: slow Ken Burns over the blurred card art, every card
    if (zoom.open) {
      zoomBgArt.style.transform =
        `translate3d(${(Math.sin(t * TAU / 26) * 1.8).toFixed(3)}%, ${(Math.cos(t * TAU / 21) * 1.4).toFixed(3)}%, 0)` +
        ` scale(${(1.07 + Math.sin(t * TAU / 33) * 0.06).toFixed(4)})`;
    }
  }

  // The stage keeps breathing while the wheel is still, so the drift, the floor and
  // the inspect holo run in their own loop (HEAD ran them inside tick(), which now
  // sleeps whenever the wheel stops). Off in the set browser and in hidden tabs.
  let driftFrame = 0;
  function ambientLoop(ms) {
    requestAnimationFrame(ambientLoop);
    if (document.hidden) return;
    const home = document.body.classList.contains('home-open');
    // every 2nd frame: the drift is slow, 30fps is invisible, churn halves
    if (!REDUCED && !home && (driftFrame++ & 1)) driftBg(ms);
    if (zoom.open) holoRender(ms); // animated inspect backdrop
    if (topo && !home && document.body.dataset.game === 'pokemon') topo.render(ms); // Pokémon topo drift
    if (zoom.open && document.body.dataset.game === 'pokemon') { if (!zoomTopo) buildZoomTopo(); if (zoomTopo) { zoomTopo.color.set(insColor); zoomTopo.render(ms); } } // Pokémon inspect topo, tinted to the card
    if (floorFX && !zoom.open && !home) floorFX.render(ms); // stage floor under the wheel
  }

  // Physics runs on elapsed TIME, normalised to 60 Hz frames (the units every
  // constant above was tuned in). It used to step once per frame, so on a 279 Hz
  // screen a fling or snap played ~4.6x faster than designed (a 500 ms settle
  // became ~110 ms) and every dropped frame stalled the wheel. Now the glide and
  // the snap take the same time on every screen and a late frame catches up.
  let tickT = 0;
  function tick(ms) {
    const now = ms || performance.now();
    const f = tickT ? Math.min(3, Math.max(0.05, (now - tickT) / (1000 / 60))) : 1;   // elapsed, in 60 Hz frames
    tickT = now;
    if (mode === 'dragging') {
      if (dragDirty) { dragDirty = false; render(); }
    } else if (mode === 'gliding' || mode === 'wheeling') {
      position += velocity * f;
      velocity *= Math.pow(FRICTION, f);
      clampPos();
      if (Math.abs(velocity) < SNAP_VELOCITY) {
        mode = 'snapping';
        target = Math.max(0, Math.min(N - 1, Math.round(position)));
      }
      render();
    } else if (mode === 'snapping' || mode === 'jumping') {
      const k = mode === 'jumping' ? SNAP_K * 1.3 : SNAP_K;
      position += (target - position) * (1 - Math.pow(1 - k, f));
      if (Math.abs(target - position) < 0.0008) { position = target; mode = 'idle'; }
      render();
      if (mode === 'idle') settle();
    }
    requestAnimationFrame(tick);
  }

  function goTo(idx, instant) {
    idx = Math.max(0, Math.min(N - 1, idx));
    // mobile: there is no wheel spring — scroll the snap-carousel to the slot instead
    if (MOBILE && mcar) { mScrollTo(idx, !(instant || document.hidden)); return; }
    target = idx;
    velocity = 0;
    // hidden tabs freeze rAF — the spring would never integrate, so land instantly
    if (REDUCED || instant || document.hidden) { position = target; mode = 'idle'; render(true); }
    else mode = 'jumping';
  }

  // --- Sorting ---------------------------------------------------------------------
  // Ranking only: USD market when present, else Cardmarket trend (EUR ~ ballpark),
  // else -1. Displayed prices stay source-labeled; this never shows as a value.
  const sortValue = (c) => (typeof c.priceUsd === 'number') ? c.priceUsd : (c.cardmarket?.trend ?? -1);
  function applySort(order) {
    const keepCard = current >= 0 ? view[current] : view[0];
    if (order === 'set') {
      view = CARDS.map((_, i) => i);
    } else {
      // value modes share ONE arrangement: cheapest on the left, priciest on
      // the right; the buttons differ only in which end they land you on
      view = CARDS.map((_, i) => i).sort((a, b) => {
        const va = sortValue(CARDS[a]), vb = sortValue(CARDS[b]);
        return va === vb ? a - b : va - vb;
      });
    }
    view.forEach((ci, s) => { slotOf[ci] = s; });
    tickByCard.forEach(t => t.classList.remove('cur'));
    tickEls = view.map(ci => tickByCard[ci]);
    ticksBox.style.setProperty('--n', N);          // arc geometry: total bars
    tickEls.forEach((t, s) => {                     // reorder + seat each bar on the arc
      t.style.setProperty('--s', s);
      ticksBox.appendChild(t);
    });
    els.forEach(e => { e.el.style.visibility = 'hidden'; });
    painted = new Set();
    position = order === 'value-desc' ? N - 1   // $ high -> the expensive end
      : order === 'value-asc' ? 0               // $ low  -> the cheap end
      : slotOf[keepCard];                       // set #  -> stay on this card
    target = position;
    velocity = 0;
    mode = 'idle';
    current = -1;
    render(true);
    if (MOBILE) mobileBuild();   // rebuild the mobile carousel in the new order
  }
  // the wheel is fixed to value order (priciest first); the sort control was removed
  const sortMode = 'value-desc';

  // --- Per-set ambience: the stage relights in the set logo's colors ----------
  // Same layers, same drift — only the light colors change. Multicolored logos
  // contribute up to three hues (keylight / kicker / sweep); fallback = brand.
  const AMB_DEFAULT = ['#7FD4F4', '#F08C1E', '#C44BAD'];
  const hexA = (hex, a) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  };
  function applyAmbience(cols) {
    if (!cols || !cols[0]) return;
    const bs = document.body.style;
    const [a, b, c] = [cols[0], cols[1] ?? cols[0], cols[2] ?? cols[1] ?? cols[0]];
    // feed the per-set signature colour to the themed backdrops:
    // Lorcana bottom glow (--set-glow), One Piece rain tint (--op-rain*), Pokémon topo hue
    bs.setProperty('--set-glow', a);
    bs.setProperty('--op-rain', a);
    bs.setProperty('--op-rain2', c);
    if (topo) topo.color.set(a);
    if (floorFX) { floorFX.color.set(a); if (REDUCED) floorFX.render(0); } // stage floor rides the set colour too
    bgLight.style.background =
      `radial-gradient(100% 88% at 50% -22%, ${hexA(a, 0.5)} 0%, transparent 66%),` +
      ` radial-gradient(78% 100% at 106% 82%, ${hexA(b, 0.4)} 0%, transparent 60%),` +
      ` linear-gradient(118deg, transparent 34%, ${hexA(c, 0.26)} 50%, transparent 66%)`;
    // the glass streaks are baked ice-blue (hue ≈205): rotate toward the primary
    const n = parseInt(cols[0].slice(1), 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, bl = n & 255;
    const mx = Math.max(r, g, bl), mn = Math.min(r, g, bl);
    let h = 205;
    if (mx !== mn) {
      h = mx === r ? (g - bl) / (mx - mn) * 60
        : mx === g ? ((bl - r) / (mx - mn) + 2) * 60
        : ((r - g) / (mx - mn) + 4) * 60;
      if (h < 0) h += 360;
    }
    bgGlass.style.filter = `hue-rotate(${Math.round((h - 205 + 360) % 360)}deg)`;
  }
  function extractLogoColors(url, cb) {
    if (!url) return cb(null);
    // tcgdex logos carry no CORS headers, so a crossOrigin canvas read always
    // throws (every set already falls back to the default ambience) — and the
    // failed crossOrigin request poisons the display <img>'s cache, breaking
    // the logo. Skip extraction for cross-origin URLs; only same-origin images
    // can actually be read into a canvas.
    if (!url.startsWith(location.origin)) return cb(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const cv = document.createElement('canvas');
        cv.width = cv.height = 48;
        const cx = cv.getContext('2d', { willReadFrequently: true });
        cx.drawImage(img, 0, 0, 48, 48);
        const d = cx.getImageData(0, 0, 48, 48).data;
        const N = 12, count = new Array(N).fill(0), sum = Array.from({ length: N }, () => [0, 0, 0]);
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i], g = d[i + 1], b = d[i + 2];
          if (d[i + 3] < 140) continue;
          const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
          if (mx - mn < 42 || mx < 80) continue; // grays can't light a room
          let h = mx === r ? (g - b) / (mx - mn) * 60
            : mx === g ? ((b - r) / (mx - mn) + 2) * 60
            : ((r - g) / (mx - mn) + 4) * 60;
          if (h < 0) h += 360;
          const k = Math.floor(h / (360 / N)) % N;
          count[k]++; sum[k][0] += r; sum[k][1] += g; sum[k][2] += b;
        }
        const tot = count.reduce((s, x) => s + x, 0);
        if (tot < 24) return cb(null); // effectively monochrome logo
        const cols = count.map((x, i) => [x, i]).sort((p, q) => q[0] - p[0])
          .filter(([x]) => x >= tot * 0.14).slice(0, 3)
          .map(([x, i]) => '#' + sum[i].map(s => Math.round(s / x).toString(16).padStart(2, '0')).join(''));
        cb(cols.length ? cols : null);
      } catch { cb(null); } // tainted canvas (no CORS) — keep the brand palette
    };
    img.onerror = () => cb(null);
    img.src = url;
  }
  // the set's signature colour comes from a LOCAL image we can actually read into
  // a canvas: its sealed box render (authentic Pokémon PNG / cut-out webp), else
  // the game logo. Cross-origin card/logo URLs taint the canvas, so they're out.
  function localSetImage(id) {
    // a LOCAL set logo (assets/setlogos/*) is the most genuine signature colour and is
    // same-origin, so the canvas read isn't tainted — prefer it over the box / game logo
    const ov = SET_LOGO_OVERRIDE[id];
    if (ov && ov.startsWith('assets/')) return new URL(ov.split('?')[0], location.href).href;
    const prods = (window.SEALED_PRODUCTS || {})[id] || [];
    const p = prods.find((x) => x.img && x.img.startsWith('assets/'));
    if (p) return new URL(p.img.split('?')[0], location.href).href;
    const meta = gameSetMeta(id);
    if (meta) return new URL(`assets/logos/${meta.game}.png`, location.href).href;
    return null;
  }
  // per-UNIVERSE signature gradient (P: Magic=green, One Piece=red, Lorcana=purple-blue, Pokémon=red+blue).
  // 3 colours feed the 3 ambience layers (keylight / kicker / sweep) → reads as that universe's gradient.
  const UNIVERSE_AMB = {
    pokemon:  ['#e63946', '#3b82f6', '#7a2231'],   // red + blue gradient
    magic:    ['#36b24a', '#8fe39a', '#1e7a30'],   // green → light green
    lorcana:  ['#5b46c8', '#3a52d6', '#2a2a7a'],   // dark purple → blue
    onepiece: ['#ef4b3a', '#ff8467', '#9e1f15'],   // light red → dark red
  };
  // hand-picked backdrop colours for sets the auto-sampler reads wrong (3 colours = the 3 ambience layers)
  const AMBIENCE_OVERRIDE = {
    'mtg-sos': ['#46a049', '#7fcf6a', '#2f7d3a'],   // Secrets of Strixhaven — green, not red
    'mtg-tmt': ['#5cb44a', '#8fd86a', '#357a2e'],   // Teenage Mutant Ninja Turtles — turtle green
    'mtg-ecl': ['#8a5cd8', '#b48cf0', '#5a3a9e'],   // Lorwyn Eclipsed — mystical purple
    'mtg-tla': ['#39b0e0', '#e0892e', '#5fbf6a'],   // Avatar: TLA — water / fire / earth, four-element wash
    // Lorcana — genuine per-set signature colours (P wants the universe strongly colour-coded)
    'lor-12': ['#e0892e', '#86c24a', '#c4631e'],    // Wilds Unknown — orange + wild green
    'lor-11': ['#56a8e6', '#a6d6f4', '#3f7fc8'],    // Winterspell — icy winter blue
    'lor-10': ['#2f9f8a', '#5fc4a6', '#246f6a'],    // Whispers in the Well — deep teal
    'lor-9':  ['#d8a83a', '#ffd472', '#b07f2a'],    // Fabled — storybook gold
    'lor-8':  ['#cc3a3a', '#e0a040', '#9c2a2a'],    // Reign of Jafar — crimson + gold
    'lor-7':  ['#5ab84a', '#9fd86a', '#caa24a'],    // Archazia's Island — jungle green
    'lor-6':  ['#2f7fd0', '#5fb0e8', '#1f5fa0'],    // Azurite Sea — deep azure
    'lor-5':  ['#5ec6e8', '#ffe49a', '#7fb0e0'],    // Shimmering Skies — sky cyan + sun
    'lor-4':  ['#8a5cd8', '#c06fe0', '#c84fa8'],    // Ursula's Return — sea-witch violet
    'lor-3':  ['#39b07a', '#7fd8a0', '#2f8f6a'],    // Into the Inklands — emerald ink
    'lor-2':  ['#3aa9d4', '#6fd0e0', '#2f6fb0'],    // Rise of the Floodborn — water blue
    'lor-1':  ['#6db8d6', '#caa24a', '#7b5fb0'],    // The First Chapter — teal / amber / amethyst
  };
  function setAmbience(id) {
    const uni = document.body.dataset.game;          // per-universe gradient wins (set on body just before this call)
    if (UNIVERSE_AMB[uni]) { applyAmbience(UNIVERSE_AMB[uni]); return; }
    if (AMBIENCE_OVERRIDE[id]) { applyAmbience(AMBIENCE_OVERRIDE[id]); return; }
    const pre = (window.SET_COLORS || {})[id];     // precomputed from the set LOGO
    if (pre && pre.length) { applyAmbience(pre); return; }
    extractLogoColors(localSetImage(id), (cols) => {   // external sets: read the box
      if (!DATA || DATA.set.id !== id) return;     // guard against rapid re-switch
      applyAmbience(cols || AMB_DEFAULT);
    });
  }

  // --- Set switching -----------------------------------------------------------------
  // generate the Lorcana starfield once (each star duplicated +2000px for a seamless scroll)
  let starsBuilt = false;
  function buildStarfield() {
    if (starsBuilt) return; starsBuilt = true;
    const W = 3440; // span ultrawide so the field fills the full viewport, edge to edge
    const mk = (n) => { let s = ''; for (let i = 0; i < n; i++) { const x = Math.floor(Math.random() * W), y = Math.floor(Math.random() * 2000); s += `${x}px ${y}px #fff, ${x}px ${y + 2000}px #fff`; if (i < n - 1) s += ', '; } return s; };
    const a = document.getElementById('stars'), b = document.getElementById('stars2'), c = document.getElementById('stars3');
    if (a) a.style.boxShadow = mk(900);
    if (b) b.style.boxShadow = mk(380);
    if (c) c.style.boxShadow = mk(210);
  }

  // ---- Pokémon carousel topographic background (same shader as the homepage).
  //      Recolored per set by applyAmbience(), which already samples each set's
  //      signature colour (precomputed for Pokémon, read off the box for others).
  //      Built lazily on the first Pokémon set. ----
  let topo = null, zoomTopo = null;
  // Shared topo factory — identical look to the homepage: zoomed-out (p*4.6) crisp white
  // contours on a deep-navy field, no glow, no gold. `big` oversizes the canvas past the
  // viewport for the inspect backdrop (.zoom-bg is inset:-56px). Used for the carousel
  // background (#bgTopo) and the Pokémon card inspect (#zoomTopo).
  function makeTopo(canvas, big) {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
    const scene = new THREE.Scene();
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const uni = { uTime: { value: 0 }, uRes: { value: new THREE.Vector2() }, uColor: { value: new THREE.Color(0.33, 0.55, 1.0) } };
    const mat = new THREE.ShaderMaterial({
      uniforms: uni, transparent: true,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `
        precision highp float; varying vec2 vUv; uniform vec2 uRes; uniform vec3 uColor; uniform float uTime;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453123); }
        float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
          return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x), mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x), f.y); }
        float fbm(vec2 p){ float v=0.0, a=0.55; for(int i=0;i<6;i++){ v+=a*noise(p); p=p*2.03+vec2(11.3,7.7); a*=0.5; } return v; }
        void main(){
          vec2 uv = vUv; vec2 p = uv; p.x *= uRes.x / max(uRes.y, 1.0);
          p = p * 4.6; float n = fbm(p + vec2(uTime * 0.018, uTime * 0.012));    // zoomed out → more of the pattern (matches homepage)
          float f = n * 8.5; float fr = fract(f); float d = min(fr, 1.0 - fr);
          float line = 1.0 - smoothstep(0.0, 0.038, d);                          // crisp, thin lines
          float g = clamp(uv.x * 0.45 + (1.0 - uv.y) * 0.7, 0.0, 1.0);
          vec3 base = mix(uColor * 0.19, uColor * 0.05, g);                       // field tinted to the set/card colour (navy by default)
          vec3 lineWhite = mix(vec3(0.9,0.94,1.0), vec3(0.5,0.58,0.78), g);      // white contours, dims with depth, no glow halo
          float lineStr = line * (0.3 + 0.14 * (1.0 - g));
          vec3 col = mix(base, lineWhite, clamp(lineStr, 0.0, 1.0));
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));
    const W = () => big ? innerWidth + 112 : innerWidth, H = () => big ? innerHeight + 112 : innerHeight;
    const rs = () => { renderer.setSize(W(), H(), false); uni.uRes.value.set(W(), H()); };
    rs(); addEventListener('resize', rs);
    return { render: (t) => { uni.uTime.value = t * 0.001; renderer.render(scene, cam); }, color: uni.uColor.value };
  }
  function buildTopo() {
    if (topo || !window.THREE) return;
    const canvas = document.getElementById('bgTopo'); if (!canvas) return;
    topo = makeTopo(canvas, false);
  }
  function buildZoomTopo() {                       // lazy — first Pokémon inspect
    if (zoomTopo || !window.THREE) return;
    const canvas = document.getElementById('zoomTopo'); if (!canvas) return;
    zoomTopo = makeTopo(canvas, true);
  }

  // --- Stage floor: a Three.js lit pool + receding grid grounding the wheel ---
  // Follows the makeTopo pattern (shader quad, own resize, {render,color} API);
  // tinted per set via applyAmbience; rendered from tick() — never CSS animation
  // (CSS animation timelines are frozen on this machine).
  let floorFX = null;
  const FLOOR_FRAG = `
    precision mediump float;
    uniform float uTime; uniform vec2 uRes; uniform vec3 uColor;
    void main() {
      vec2 uv = gl_FragCoord.xy / uRes;
      float horizon = 0.97;
      float v = clamp((horizon - uv.y) / horizon, 0.0008, 1.0);
      float z = 1.0 / v;                                 // scene depth
      // receding rows drifting toward the viewer + converging columns
      float row = abs(fract(z * 1.7 - uTime * 0.22) - 0.5);
      float col = abs(fract((uv.x - 0.5) * z * 1.15) - 0.5);
      float lines = smoothstep(0.052, 0.0, row) + smoothstep(0.045, 0.0, col) * 0.7;
      float depthFade = smoothstep(7.5, 1.6, z);         // fade toward the horizon
      float frontFade = smoothstep(0.0, 0.34, uv.y);     // and toward the viewer — the front NEVER hard-edges
      float grid = lines * depthFade * frontFade * 0.30;
      // the light pool under the focused card, breathing gently
      vec2 pc = vec2(0.5, 0.58);
      vec2 pd = (uv - pc) * vec2(uRes.x / uRes.y * 0.62, 1.45);
      float pool = exp(-dot(pd, pd) * 3.4) * (0.86 + 0.14 * sin(uTime * 0.8));
      vec3 colr = uColor * (pool * 0.62 + grid * (0.5 + pool * 0.8)) + vec3(1.0) * pool * 0.05;
      float a = clamp(pool * 0.62 + grid, 0.0, 1.0);
      gl_FragColor = vec4(colr, a * 0.85);
    }`;
  function buildFloor() {
    if (floorFX !== null || !window.THREE) return;
    const canvas = $('stageFloor');
    if (!canvas) { floorFX = false; return; }
    try {
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'low-power' });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
      const scene = new THREE.Scene();
      const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      const uni = {
        uTime: { value: 0 },
        uRes: { value: new THREE.Vector2(2, 2) },
        uColor: { value: new THREE.Color('#7FD4F4') },
      };
      const size = () => {
        const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || Math.round(innerHeight * 0.46);
        renderer.setSize(w, h, false);
        const pr = renderer.getPixelRatio();
        uni.uRes.value.set(w * pr, h * pr);
      };
      size();
      scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2),
        new THREE.ShaderMaterial({ fragmentShader: FLOOR_FRAG, uniforms: uni, transparent: true, depthWrite: false })));
      addEventListener('resize', size);
      floorFX = {
        color: uni.uColor.value,
        render: (t) => { uni.uTime.value = REDUCED ? 26.0 : t * 0.001; renderer.render(scene, cam); },
      };
    } catch { floorFX = false; }
  }
  // RULE: the inspect backdrop takes the inspected CARD's own colour (style unchanged).
  // Sample the card art → feed --ins-lit/--ins-deep (the .zoom-uni gradient, all universes).
  const INS_ACCENT = { pokemon: '#3b62b8', magic: '#8a5a2e', lorcana: '#2f6f9e', onepiece: '#9e3a30' };
  let insColor = '#1a2746';
  function tintInspect(card) {
    if (!card) return;
    const bs = document.body.style;
    const apply = (r, g, b) => {
      const cl = (k) => `rgb(${Math.min(255, Math.round(r * k))},${Math.min(255, Math.round(g * k))},${Math.min(255, Math.round(b * k))})`;
      bs.setProperty('--ins-lit', cl(0.34));        // brighter stop of the inspect gradient
      bs.setProperty('--ins-deep', cl(0.075));      // near-black stop, keeps text/card readable
      insColor = `rgb(${r},${g},${b})`;
    };
    // instant = the card's intrinsic colour (Lorcana ink / Magic mana / Pokémon type) — always
    // available, genuinely "the card's colour", and needs no CORS. Art-sampling refines it below.
    const base = (typeof cardTintColor === 'function' && cardTintColor(card)) || INS_ACCENT[document.body.dataset.game] || '#33508c';
    const bn = parseInt(base.slice(1), 16);
    apply((bn >> 16) & 255, (bn >> 8) & 255, bn & 255);
    const url = card.sealed ? card.image : (typeof cardImg === 'function' ? cardImg(card, 'low.webp') : null);
    if (!url) return;
    // only hosts that answer CORS (verified 27 Oct: tcgdex, Scryfall, dotgg; TCGplayer
    // and Lorcast don't) are sampled, and with no-store: the wheel's <img> already
    // cached these bytes WITHOUT the CORS header, and reusing that copy threw a CORS
    // error into the console on every inspect. Everything else keeps the type colour.
    const corsOk = url.startsWith('assets/') || /^https:\/\/(assets\.tcgdex\.net|cards\.scryfall\.io|static\.dotgg\.gg)\//.test(url);
    if (!corsOk) return;
    // CORS blob → ImageBitmap → canvas is untainted, so pixels are readable
    fetch(url, url.startsWith('assets/') ? {} : { mode: 'cors', cache: 'no-store' }).then((res) => res.ok ? res.blob() : Promise.reject()).then(createImageBitmap).then((bm) => {
      const cv = document.createElement('canvas'); cv.width = 18; cv.height = 25;
      const x = cv.getContext('2d'); x.drawImage(bm, 0, 0, 18, 25);
      const d = x.getImageData(0, 0, 18, 25).data;
      let r = 0, g = 0, b = 0, w = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 200) continue;
        const R = d[i], G = d[i + 1], B = d[i + 2], mx = Math.max(R, G, B), mn = Math.min(R, G, B);
        const k = 0.18 + (mx ? (mx - mn) / mx : 0);       // vivid pixels weigh more → the card's true colour
        r += R * k; g += G * k; b += B * k; w += k;
      }
      if (w) apply(Math.round(r / w), Math.round(g / w), Math.round(b / w));
    }).catch(() => {});
  }
  function loadSet(id) {
    // Pokémon bundled sets: fold in the full TCGplayer catalogue (all printings)
    // before anything reads the card list. Idempotent + no-op for unmapped sets.
    if (typeof mergeFullSet === 'function') mergeFullSet(id);
    DATA = SETS[id];
    // body[data-game] keys the per-game inspect accents (INS_ACCENT)
    const universe = id.startsWith('lor-') ? 'lorcana' : id.startsWith('op-') ? 'onepiece' : id.startsWith('mtg-') ? 'magic' : 'pokemon';
    document.body.dataset.game = universe;
    if (universe === 'lorcana') buildStarfield();
    else if (universe === 'pokemon') buildTopo();
    CARDS = setCardList(id); // numbered singles + sealed products
    N = CARDS.length;
    const dom = buildSetDom(id);
    els = dom.els;
    tickByCard = dom.ticks;
    // cards join the DOM as they first enter the painted window (render): inserting
    // all of a 250-card set at once was a 50 ms style pass on every set switch
    track.replaceChildren();
    ticksBox.replaceChildren(...tickByCard);
    rail.setAttribute('aria-valuemax', String(N));
    // search suggestions follow the set
    dl.replaceChildren();
    CARDS.forEach((c) => {
      const o = document.createElement('option');
      o.value = `${c.name.replace(/ — /g, ' ')} · ${c.localId}`; // dash-free Lorcana names
      dl.appendChild(o);
    });
    // footer snapshot label + staleness follow the set
    // (the set's name, count and value live in the set header now: the footer
    // only credits the data source, so nothing is said twice on screen)
    const snapAt = new Date(DATA.snapshotAt);
    $('snapshotLabel').textContent = isNaN(snapAt) ? '' :
      `Market prices updated ${snapAt.getDate()} ${MONTHS[snapAt.getMonth()]} ${snapAt.getFullYear()}, ${snapAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    $('snapshotLabel').title = `Source: ${DATA.source || 'TCGdex'}`;   // the full data credit stays one hover away
    $('staleNotice').hidden = DATA.set.external || Date.now() - Date.parse(DATA.snapshotAt) <= 7 * 864e5;
    // selector reflects the active set — fall back to the set name as text when
    // the logo asset is missing (Temporal Forces, all external-game sets)
    const btnLogo = $('setBtnLogo'), btnName = $('setBtnName');
    btnName.textContent = DATA.set.name;
    btnLogo.alt = DATA.set.name;
    // EVERY universe tries its real set mark up top (local override →
    // tcgdex/Scryfall → sealed box); the game-logo tail is skipped — when no
    // set-specific art exists the name reads better than a generic wordmark
    const hdrCands = (DATA.set.external
      ? setMarkChain(universe, { id, name: DATA.set.name, code: DATA.set.code }).filter((u) => u.indexOf('assets/logos/') === -1)
      : [SET_LOGO_OVERRIDE[id], ...(NO_TCGDEX_LOGO.has(id) ? [] : DATA.set.logo
        ? [safeImg(DATA.set.logo + '.webp'), safeImg(DATA.set.logo + '.png')]   // webp first: a fifth of the png, and the browser tile already cached it
        : [setLogoPng(DATA.set)])].filter(Boolean));
    btnLogo.classList.toggle('on-light', LIGHT_PLATE.has(id));
    if (hdrCands.length) {
      let hi = 0;
      btnLogo.hidden = false; btnName.hidden = true;
      btnLogo.onload = () => { btnLogo.hidden = false; btnName.hidden = true; };
      btnLogo.onerror = () => { if (++hi < hdrCands.length) btnLogo.src = hdrCands[hi]; else { btnLogo.hidden = true; btnName.hidden = false; } };
      btnLogo.src = hdrCands[0];
    } else {
      btnLogo.hidden = true; btnName.hidden = false; btnLogo.removeAttribute('src');
    }
    $('setBtn').setAttribute('aria-label', `${DATA.set.name} — switch set`);
    setMenu.querySelectorAll('.sm-set').forEach((b) => {
      b.classList.toggle('active', b.dataset.set === id);
    });
    pfNext = 0; // restart idle prefetch for this set (re-centres on the new set's cards)
    if (typeof schedulePrefetch === 'function') schedulePrefetch();
    current = -1; settledOn = -1;
    painted = new Set();
    wheelReady = true;
    buildDial();          // redraw the arced dial for this set's card count
    applySort(sortMode); // rebuilds view/ticks order and lands per mode
    recolorDial();       // dial heat-strip colours need the NEW view order
    buildFloor();        // stage floor (all universes) — lazy singleton
    // the ground's light pool takes THIS set's colour (async for sets whose colour
    // is read off their sealed render; guards re-switch)
    setAmbience(id);
    paintSetHead(id);
    try { if (new URLSearchParams(location.search).get('set') !== id) history.replaceState({ set: id }, '', 'app.html?set=' + encodeURIComponent(id)); } catch { /* file:// */ }
    if (gridOn) { gridView._set = null; buildGrid(); }
    kickWheelIntro();    // belt sweeps in from the right + caption/dial entrance
  }

  // --- Set-to-set: the cards a set opens on are decoded BEFORE the swap, so a
  // switch never shows empty card faces (Faisal: the set-to-set "segues" looked
  // buggy). The old wheel stays, dimmed, for the few hundred ms this takes.
  function landingCards(id, mode) {
    if (!SETS[id]) return [];
    try { mergeFullSet(id); } catch { /* bundled list is fine */ }
    const cards = setCardList(id);
    const order = cards.map((_, i) => i).sort((a, b) => { const va = sortValue(cards[a]), vb = sortValue(cards[b]); return va === vb ? a - b : va - vb; });
    let land = order.length - 1;                       // deep links land on the priciest (applySort)
    if (mode === 'first') {                            // the browser + menu land on card #1 (landOnFirstCard)
      let best = -1, bn = Infinity;
      cards.forEach((c, i) => { if (c.sealed) return; const n = typeof c.num === 'number' ? c.num : parseInt(c.localId, 10); if (n < bn) { bn = n; best = i; } });
      if (best >= 0) land = order.indexOf(best);
    }
    const out = [];
    // the whole painted window (±WINDOW), so the landing sweep never shows blank cards at its edges
    for (let k = Math.max(0, land - WINDOW); k <= Math.min(order.length - 1, land + WINDOW); k++) out.push(cards[order[k]]);
    return out;
  }
  function preloadLanding(id, mode, maxMs = 800) {
    const list = landingCards(id, mode);
    if (!list.length) return Promise.resolve();
    document.body.classList.add('switching');
    const jobs = list.map((c) => {
      // the same first image the wheel shows (wantImage): the small scan where the source has one
      const url = c.sealed ? c.image : (thumbImg(c) || cardImg(c, c.fullImg ? 'high.webp' : 'low.webp'));
      if (!url) return Promise.resolve();
      const im = new Image(); im.decoding = 'async'; im.src = url;
      return im.decode ? im.decode().catch(() => {}) : Promise.resolve();
    });
    return Promise.race([Promise.allSettled(jobs), new Promise((r) => setTimeout(r, maxMs))])
      .finally(() => document.body.classList.remove('switching'));
  }

  // --- Set header (Scryfall set page: logo, card count, release, total value;
  // Pokedesk: the set's top card beside its value). Numbers come from setStats(),
  // the same list the set browser tile shows, so the two always agree. ---
  const shName = $('shName'), shMeta = $('shMeta'), shValue = $('shValue'), shPriced = $('shPriced'),
    shTop = $('shTop'), shTopImg = $('shTopImg'), shTopName = $('shTopName'), shTopPrice = $('shTopPrice');
  let shTopId = null;
  function paintSetHead(id, quiet) {
    const game = gameOf(id);
    if (statCache[id] && statCache[id].cached && SETS[id]) { delete statCache[id]; storeStats(id, setStats(id)); }
    $('shBackLbl').textContent = `All ${GAME_SHORT[game]} sets`;
    $('shBack').href = 'app.html?game=' + game;
    shName.textContent = DATA.set.name;
    const st = setStats(id);
    const rel = RELEASED[id] || (DATA.cards.find((c) => c.released) || {}).released || '';
    const bits = [];
    if (st) bits.push(`${st.count.toLocaleString('en-US')} cards`);
    if (rel) bits.push(`Released ${fmtDay(rel)}`);
    shMeta.textContent = bits.join(' · ');
    $('shValueBox').hidden = !st || !st.priced;
    if (st && st.priced) {
      shValue.textContent = money(st.value);
      shPriced.textContent = st.priced < st.count * 0.95 ? `${st.priced} of ${st.count} cards priced` : '';
      shPriced.hidden = !shPriced.textContent;
    }
    const top = st && st.top[0];
    shTop.hidden = !top;
    if (top) {
      shTopId = top.id;
      shTopImg.src = cardThumb(top);
      shTopName.textContent = ' · ' + cardName(top);
      shTopPrice.textContent = money(top.priceUsd);
      shTop.setAttribute('aria-label', `Go to the top card, ${cardName(top)}, ${money(top.priceUsd)}`);
    }
    if (!RELEASED[id] && game !== 'onepiece') loadReleased(game).then(() => { if (DATA && DATA.set.id === id && RELEASED[id]) paintSetHead(id, true); });
    // a new set's numbers settle in with the wheel's sweep (expo-out, staggered)
    if (!quiet && window.gsap && !REDUCED && !document.hidden) {
      gsap.fromTo(['.sh-text', '.sh-stat', '.sh-top', '.sh-views'], { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.5, ease: 'expo.out', stagger: 0.05, delay: 0.12, clearProps: 'opacity,transform' });
    }
  }
  shTop.addEventListener('click', () => {
    const ci = CARDS.findIndex((c) => c.id === shTopId);
    if (ci < 0) return;
    if (gridOn) setView('wheel');
    goTo(slotOf[ci]);
  });
  $('shBack').addEventListener('click', (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
    e.preventDefault();
    const game = gameOf(DATA.set.id);
    try { history.pushState({ game }, '', 'app.html?game=' + game); } catch { /* file:// */ }
    showHome(game);
  });

  // --- Grid view: the whole set at once, in card-number order (Scryfall's
  // browse). Click a card to inspect it; closing returns to the grid. ---
  const gridView = $('gridView'), gridCards = $('gridCards');
  let gridOn = false;
  function setView(v) {
    gridOn = v === 'grid';
    document.body.classList.toggle('grid-on', gridOn);
    $('viewWheel').setAttribute('aria-pressed', String(!gridOn));
    $('viewGrid').setAttribute('aria-pressed', String(gridOn));
    gridView.hidden = !gridOn;
    if (gridOn) {
      buildGrid();
      if (window.gsap && !REDUCED) gsap.fromTo(gridView, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.5, ease: 'expo.out', clearProps: 'opacity,transform' });
    } else render(true);
  }
  function buildGrid() {
    if (gridView._set === DATA.set.id) return;
    gridView._set = DATA.set.id;
    const order = CARDS.map((_, i) => i).sort((a, b) => {
      const A = CARDS[a], B = CARDS[b];
      if (!!A.sealed !== !!B.sealed) return A.sealed ? 1 : -1;
      return (A.num - B.num) || String(A.localId).localeCompare(String(B.localId)) || a - b;
    });
    gridCards.innerHTML = order.map((ci) => {
      const c = CARDS[ci];
      const price = typeof c.priceUsd === 'number' ? money(c.priceUsd) : '';
      return `<button type="button" class="gv-card${c.sealed ? ' sealed' : ''}" data-ci="${ci}" aria-label="Inspect ${esc(c.name)}">`
        + `<span class="gv-img"><img src="${esc(cardThumb(c))}" alt="" loading="lazy" decoding="async"></span>`
        + `<span class="gv-name">${esc(cardName(c))}</span>`
        + `<span class="gv-meta"><span class="gv-num">${c.sealed ? 'Sealed' : '#' + esc(c.localId)}</span>${price ? `<b>${price}</b>` : '<span class="gv-np">No price</span>'}</span></button>`;
    }).join('');
    gridView.scrollTop = 0;
  }
  $('viewWheel').addEventListener('click', () => { if (gridOn) setView('wheel'); });
  $('viewGrid').addEventListener('click', () => { if (!gridOn) setView('grid'); });
  gridCards.addEventListener('click', (e) => {
    const b = e.target.closest('.gv-card'); if (!b) return;
    const ci = +b.dataset.ci;
    if (slotOf[ci] == null) return;
    openZoomFor(slotOf[ci], b.querySelector('img'));
  });

  // Era-grouped dropdown, newest sets first. Only sets with data appear.
  const SET_GROUPS = [
    { series: '30th Celebration', ids: ['30th', '30th-c'] },
    { series: 'First Partner Illustration', ids: ['fpic3', 'fpic2', 'fpic1'] },
    { series: 'Mega Evolution', ids: ['me05', 'me04', 'me03', 'me02.5', 'me02', 'me01'] },
    { series: 'Scarlet & Violet', ids: ['sv10.5w', 'sv10.5b', 'sv10', 'sv09', 'sv08.5', 'sv08', 'sv07', 'sv06.5', 'sv06', 'sv05', 'sv04.5', 'sv04', 'sv03.5', 'sv03', 'sv02', 'sv01'] },
    { series: 'Promos', ids: ['fpp', 'svp', 'swshp', 'smp', 'xyp', 'bwp', 'dpp', 'hgssp', 'np', 'basep'] },
  ];
  const setBtn = $('setBtn'), setMenu = $('setMenu');
  function toggleSetMenu(open) {
    setMenu.hidden = !open;
    setBtn.setAttribute('aria-expanded', String(open));
    if (open && setMenu._sync) setMenu._sync(); // categorised picker built below
  }
  setBtn.addEventListener('click', () => toggleSetMenu(setMenu.hidden));

  // --- Other games: Magic (Scryfall) & Lorcana (Lorcast), fetched on demand ----
  const GAME_SETS = [
    { game: 'magic', label: 'Magic: The Gathering', sets: [
      // most recent Magic sets (newest first), per Scryfall. + Strixhaven pinned.
      { id: 'mtg-fra', code: 'fra', name: 'Reality Fracture' },
      { id: 'mtg-hob', code: 'hob', name: 'The Hobbit' },
      { id: 'mtg-msh', code: 'msh', name: 'Marvel Super Heroes' },
      { id: 'mtg-sos', code: 'sos', name: 'Secrets of Strixhaven' },
      { id: 'mtg-tmt', code: 'tmt', name: 'Teenage Mutant Ninja Turtles' },
      { id: 'mtg-ecl', code: 'ecl', name: 'Lorwyn Eclipsed' },
      { id: 'mtg-tla', code: 'tla', name: 'Avatar: The Last Airbender' },
      { id: 'mtg-spm', code: 'spm', name: "Marvel's Spider-Man" },
      { id: 'mtg-eoe', code: 'eoe', name: 'Edge of Eternities' },
      { id: 'mtg-fin', code: 'fin', name: 'Final Fantasy' },
      { id: 'mtg-tdm', code: 'tdm', name: 'Tarkir: Dragonstorm' },
      { id: 'mtg-dft', code: 'dft', name: 'Aetherdrift' },
      { id: 'mtg-j25', code: 'j25', name: 'Foundations Jumpstart' },
      { id: 'mtg-fdn', code: 'fdn', name: 'Foundations' },
      { id: 'mtg-dsk', code: 'dsk', name: 'Duskmourn: House of Horror' },
      { id: 'mtg-blb', code: 'blb', name: 'Bloomburrow' },
      { id: 'mtg-acr', code: 'acr', name: "Assassin's Creed" },
      { id: 'mtg-mh3', code: 'mh3', name: 'Modern Horizons 3' },
      { id: 'mtg-big', code: 'big', name: 'The Big Score' },
      { id: 'mtg-otj', code: 'otj', name: 'Outlaws of Thunder Junction' },
      { id: 'mtg-clu', code: 'clu', name: 'Ravnica: Clue Edition' },
      { id: 'mtg-mkm', code: 'mkm', name: 'Murders at Karlov Manor' },
      { id: 'mtg-lci', code: 'lci', name: 'The Lost Caverns of Ixalan' },
      { id: 'mtg-woe', code: 'woe', name: 'Wilds of Eldraine' },
      { id: 'mtg-ltr', code: 'ltr', name: 'The Lord of the Rings: Tales of Middle-earth' },
      { id: 'mtg-mat', code: 'mat', name: 'March of the Machine: The Aftermath' },
      { id: 'mtg-mom', code: 'mom', name: 'March of the Machine' },
      { id: 'mtg-stx', code: 'stx', name: 'Strixhaven: School of Mages' },
    ] },
    { game: 'lorcana', label: 'Disney Lorcana', sets: [
      { id: 'lor-14', code: '14', name: 'Hyperia City' },
      { id: 'lor-13', code: '13', name: 'Attack of the Vine!' },
      { id: 'lor-12', code: '12', name: 'Wilds Unknown' },
      { id: 'lor-11', code: '11', name: 'Winterspell' },
      { id: 'lor-10', code: '10', name: 'Whispers in the Well' },
      { id: 'lor-9', code: '9', name: 'Fabled' },
      { id: 'lor-8', code: '8', name: 'Reign of Jafar' },
      { id: 'lor-7', code: '7', name: "Archazia's Island" },
      { id: 'lor-6', code: '6', name: 'Azurite Sea' },
      { id: 'lor-5', code: '5', name: 'Shimmering Skies' },
      { id: 'lor-4', code: '4', name: "Ursula's Return" },
      { id: 'lor-3', code: '3', name: 'Into the Inklands' },
      { id: 'lor-2', code: '2', name: 'Rise of the Floodborn' },
      { id: 'lor-1', code: '1', name: 'The First Chapter' },
    ] },
    { game: 'onepiece', label: 'One Piece', sets: [
      { id: 'op-OP17', code: 'OP17', name: "The World's Strongest Warriors" },
      { id: 'op-OP16', code: 'OP16', name: 'The Time of Battle' },
      { id: 'op-OP15', code: 'OP15', name: "Adventure on Kami's Island" },
      { id: 'op-OP14', code: 'OP14', name: "The Azure Sea's Seven" },
      { id: 'op-OP13', code: 'OP13', name: 'Carrying on his Will' },
      { id: 'op-OP12', code: 'OP12', name: 'Legacy of the Master' },
      { id: 'op-OP11', code: 'OP11', name: 'A Fist of Divine Speed' },
      { id: 'op-OP10', code: 'OP10', name: 'Royal Blood' },
      { id: 'op-OP09', code: 'OP09', name: 'Emperors in the New World' },
      { id: 'op-OP08', code: 'OP08', name: 'Two Legends' },
      { id: 'op-OP07', code: 'OP07', name: '500 Years in the Future' },
      { id: 'op-OP06', code: 'OP06', name: 'Wings of the Captain' },
      { id: 'op-OP05', code: 'OP05', name: 'Awakening of the New Era' },
      { id: 'op-OP01', code: 'OP01', name: 'Romance Dawn' },
    ] },
  ];
  const gameSetMeta = (id) => {
    for (const g of GAME_SETS) for (const s of g.sets) if (s.id === id) return { code: s.code, name: s.name, game: g.game };
    return null;
  };
  // simple original game glyphs (ball / star / ink drop / straw hat) — generic
  // icons drawn with currentColor, NOT trademarked wordmarks. Used on the picker
  // tabs and as the per-set mark for games whose sets have no individual logo.
  const GAME_GLYPH = {
    pokemon: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 12h6M15 12h6" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="2.7" fill="currentColor"/></svg>',
    magic: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.5 6.8L21 11l-6.5 2.2L12 20l-2.5-6.8L3 11l6.5-2.2z" fill="currentColor"/></svg>',
    lorcana: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c1.6 2.7 4.2 3.4 4.2 6.3a4.2 4.2 0 11-8.4 0C7.8 6.4 10.4 5.7 12 3z" fill="currentColor"/></svg>',
    onepiece: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 14.5C4.5 10.4 7.9 7 12 7s7.5 3.4 7.5 7.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 15.2h18" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
  };
  // per-set mark: Pokémon = tcgdex set logo, Magic = Scryfall set symbol, else null
  // ordered logo candidates for a set: local override → game source (tcgdex / Scryfall
  // symbol) → sealed booster-box image → game logo. markEl walks this on <img> error.
  const setMarkChain = (game, s) => {
    const out = [];
    if (SET_LOGO_OVERRIDE[s.id]) out.push(SET_LOGO_OVERRIDE[s.id]);
    if (game === 'pokemon') out.push(setLogoPng({ id: s.id }));
    else if (game === 'magic' && s.code) out.push(safeImg(`https://svgs.scryfall.io/sets/${s.code}.svg`));
    const box = localSetImage(s.id);
    if (box) out.push(box);
    out.push(`assets/logos/${game}.png?v=79`);
    return [...new Set(out.filter(Boolean))];
  };
  const setMarkSrc = (game, s) => setMarkChain(game, s)[0];
  // --- Categorised, searchable set picker: games as tabs, sets in a scroll list --
  function buildSetPicker() {
    const NAV = [{
      game: 'pokemon', label: 'Pokémon',
      sets: SET_GROUPS.flatMap((grp) => grp.ids.filter((id) => SETS[id]).map((id) => ({ id, name: SETS[id].set.name, count: SETS[id].set.total, external: false }))),
    }, ...GAME_SETS.map((g) => ({ game: g.game, label: g.label, sets: g.sets.map((s) => ({ id: s.id, name: s.name, code: s.code, count: null, external: true })) }))];
    let activeGame = 'pokemon', query = '';
    setMenu.innerHTML =
      `<div class="sm-tabs" role="tablist">${NAV.map((n) => `<button type="button" class="sm-tab" data-game="${n.game}"><span class="sm-tab-ic">${GAME_GLYPH[n.game] || ''}</span><span>${({ pokemon: 'Pokémon', magic: 'Magic', lorcana: 'Lorcana', onepiece: 'One Piece' })[n.game] || n.label}</span></button>`).join('')}</div>`
      + `<div class="sm-search-wrap"><input class="sm-search" type="search" placeholder="Filter sets…" aria-label="Filter sets"></div>`
      + `<div class="sm-list" id="smList"></div>`;
    const listEl = setMenu.querySelector('#smList'), searchEl = setMenu.querySelector('.sm-search');
    function renderTabs() { setMenu.querySelectorAll('.sm-tab').forEach((t) => t.classList.toggle('active', t.dataset.game === activeGame)); }
    function markEl(game, s) {
      const mark = document.createElement('span');
      mark.className = 'sm-set-mark';
      const cands = setMarkChain(game, s);
      if (!cands.length) { mark.innerHTML = GAME_GLYPH[game] || ''; return mark; }
      const cls = (u) => (u.indexOf('svgs.scryfall.io') !== -1 ? 'sym' : 'logo');
      const img = document.createElement('img');
      img.alt = ''; img.loading = 'lazy'; img.className = cls(cands[0]);
      let i = 0;
      img.onerror = () => { // walk the chain: logo → symbol → sealed box → game logo → glyph
        if (++i < cands.length) { img.className = cls(cands[i]); img.src = cands[i]; }
        else mark.innerHTML = GAME_GLYPH[game] || '';
      };
      img.src = cands[0];
      mark.appendChild(img);
      return mark;
    }
    function renderList() {
      const nav = NAV.find((n) => n.game === activeGame), q = query.trim().toLowerCase();
      const sets = nav.sets.filter((s) => !q || s.name.toLowerCase().includes(q));
      listEl.replaceChildren();
      if (!sets.length) { const e = document.createElement('div'); e.className = 'sm-empty'; e.textContent = 'No sets match.'; listEl.appendChild(e); return; }
      for (const s of sets) {
        const item = document.createElement('button');
        item.type = 'button'; item.className = 'sm-set'; item.dataset.set = s.id;
        item.classList.toggle('active', DATA.set.id === s.id);
        item.appendChild(markEl(nav.game, s));
        const nm = document.createElement('span'); nm.className = 'sm-set-name'; nm.textContent = s.name;
        item.appendChild(nm);
        if (s.count != null) { const c = document.createElement('span'); c.className = 'sm-set-count'; c.textContent = String(s.count); item.appendChild(c); }
        item.addEventListener('click', async () => {
          toggleSetMenu(false); if (DATA.set.id === s.id) return;
          // every path fetches/builds the cards first, decodes the landing cards,
          // and only then swaps the wheel (no blank faces, no half-built set)
          let ok = true;
          document.body.classList.add('switching');   // the old wheel dims while the new set loads
          if (s.external) ok = await ensureExternalSet(s.id);
          else if (!SETS[s.id]) { const built = buildSetFromIndex(s.id); if (built) SETS[s.id] = built; else ok = await ensureTcgdexSet(s.id); }
          if (!ok) { document.body.classList.remove('switching'); return; }
          await preloadLanding(s.id, 'first');
          loadSet(s.id);
          landOnFirstCard();
        });
        listEl.appendChild(item);
      }
    }
    setMenu.querySelectorAll('.sm-tab').forEach((t) => t.addEventListener('click', () => { activeGame = t.dataset.game; renderTabs(); renderList(); searchEl.focus(); }));
    searchEl.addEventListener('input', () => { query = searchEl.value; renderList(); });
    setMenu._sync = () => { // on open: jump to the current set's game, clear the filter
      // same Pokémon list as the set index, so newly discovered sets (30th Celebration) are reachable mid-carousel
      NAV[0].sets = setsForGame('pokemon').map((s) => ({ ...s, external: false }));
      const cur = DATA && DATA.set && DATA.set.id;
      const found = NAV.find((n) => n.sets.some((s) => s.id === cur));
      activeGame = found ? found.game : 'pokemon'; query = ''; searchEl.value = '';
      renderTabs(); renderList();
    };
    renderTabs(); renderList();
  }
  buildSetPicker();
  const MTG_COLOR = { W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green' };
  const magicTypes = (c) => {
    const cols = c.colors && c.colors.length ? c.colors : (c.color_identity || []);
    if (!cols.length) return ['Colorless'];
    return cols.length > 1 ? ['Gold'] : [MTG_COLOR[cols[0]] || 'Colorless'];
  };
  const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : '');
  async function fetchJSON(url) { const r = await fetch(url); if (!r.ok) throw new Error(r.status); return r.json(); }
  // premium variants (Enchanted, Iconic, serialized, borderless) are usually
  // FOIL-ONLY: prices.usd is null but usd_foil/usd_etched holds their real (high)
  // value. Use it so they're priced — and therefore sort to the FRONT of the
  // wheel where they belong, instead of being buried, price-less, at the back.
  const usdPrice = (p) => {
    if (!p) return null;
    const v = p.usd || p.usd_foil || p.usd_etched;
    return v ? parseFloat(v) : null;
  };
  // Scryfall's hard limit for /cards/search is 2 a second, and a 429 locks the client
  // out for 30 seconds (scryfall.com/docs/api/rate-limits, checked 27 Oct). Every
  // search passes this gate; the set browser's background price loading goes slower
  // still, and after a 429 nothing is sent until the lockout has passed.
  let sfLast = 0, sfSlow = false, sfBlockedUntil = 0;   // sfSlow: the set browser is loading prices in the background
  const sfGate = async () => {
    const now = performance.now();
    const wait = Math.max(sfLast + (sfSlow ? 800 : 550), sfBlockedUntil) - now;
    sfLast = now + Math.max(0, wait);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  };
  async function sfJSON(url) {
    await sfGate();
    const r = await fetch(url);
    if (r.status === 429) { sfBlockedUntil = performance.now() + 31000; throw new Error('429'); }
    if (!r.ok) throw new Error(r.status);
    return r.json();
  }
  async function fetchMagicSet(code) {
    // unique=prints = EVERY printing (showcase / borderless / extended / serialized
    // full-arts — the valuable variants), not collapsed to one per card
    let out = [], url = `https://api.scryfall.com/cards/search?q=set%3A${code}+game%3Apaper&unique=prints&order=set`;
    for (let p = 0; url && p < 16 && out.length < 2600; p++) { const j = await sfJSON(url); out.push(...(j.data || [])); url = j.has_more ? j.next_page : null; }
    return out.map((c, i) => {
      // double-faced cards keep their image under card_faces[0], not top-level
      const u = c.image_uris || (c.card_faces && c.card_faces[0] && c.card_faces[0].image_uris) || {};
      return { c, i, img: u.large || u.normal };
    }).filter((x) => x.img).map(({ c, i, img }) => ({
      id: `mtg-${code}-${c.collector_number}`, num: parseInt(c.collector_number, 10) || (i + 1), localId: c.collector_number,
      name: c.name, rarity: cap(c.rarity), category: 'Magic', types: magicTypes(c),
      image: img, fullImg: true,
      // Scryfall doesn't price most serialized cards — backfill from the bundled
      // TCGplayer prices (window.MAGIC_PRICES, keyed by tcgplayer_id) when it's null.
      priceUsd: usdPrice(c.prices) ?? ((window.MAGIC_PRICES && window.MAGIC_PRICES[c.tcgplayer_id]) || null),
      priceVariant: 'normal', variants: {}, cardmarket: null, imageOk: true, illustrator: c.artist || '', released: c.released_at || null,
      meta: [
        ['Type', c.type_line], ['Mana', c.mana_cost], ['Set', c.set_name],
        ['Foil', c.prices && c.prices.usd_foil ? `$${(+c.prices.usd_foil).toFixed(2)}` : null],
      ],
      flavor: c.oracle_text || '',
    }));
  }
  async function fetchLorcanaSet(code) {
    const j = await fetchJSON(`https://api.lorcast.com/v0/sets/${code}/cards`);
    const arr = Array.isArray(j) ? j : (j.results || j.cards || []);
    return arr.map((c, i) => {
      const u = (c.image_uris && c.image_uris.digital) || {};   // Lorcast nests under .digital
      return { c, i, img: u.large || u.normal };
    }).filter((x) => x.img).map(({ c, i, img }) => ({
      id: `lor-${code}-${c.collector_number}`, num: parseInt(c.collector_number, 10) || (i + 1), localId: c.collector_number,
      name: c.version ? `${c.name} — ${c.version}` : c.name, rarity: c.rarity || '', category: 'Lorcana', types: [c.ink || 'Colorless'],
      image: img, fullImg: true,
      priceUsd: usdPrice(c.prices),
      priceVariant: 'normal', variants: {}, cardmarket: null, imageOk: true,
      illustrator: (c.illustrators || []).join(', '),
      meta: [
        ['Ink', c.ink], ['Cost', c.cost != null ? String(c.cost) : null],
        ['Type', (c.type || []).join(' · ')],
        ['Stats', (c.strength != null && c.willpower != null) ? `${c.strength}/${c.willpower}` : null],
        ['Lore', c.lore != null ? String(c.lore) : null],
      ],
      flavor: c.text || '',
    }));
  }
  // One Piece: dotgg blocks browser CORS + is too big for proxies, so the card
  // DATA is bundled (data/onepiece.js -> window.OP_CARDS); IMAGES load live from
  // dotgg's CDN (no CORS needed for <img>).
  const OP_RARITY = { C: 'Common', UC: 'Uncommon', R: 'Rare', SR: 'Super Rare', SEC: 'Secret Rare', L: 'Leader', P: 'Promo', SP: 'Special', TR: 'Treasure' };
  // One Piece alt-arts (the valuable _p variants) carry price "0" but a real
  // foilPrice — use the foil so they're valued, not sunk to $0 at the back.
  const opPrice = (c) => {
    const reg = parseFloat(c.price), foil = parseFloat(c.foilPrice);
    return reg > 0 ? reg : (foil > 0 ? foil : null);
  };
  // the One Piece bundle is 1.8 MB — load it ON DEMAND (only when a One Piece set
  // is opened) instead of on every page load, so the wheel boots fast.
  let opPromise = null;
  function ensureOnePiece() {
    if (window.OP_CARDS) return Promise.resolve();
    if (!opPromise) opPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'data/onepiece.js'; s.onload = resolve; s.onerror = () => reject(new Error('one piece data failed to load'));
      document.head.appendChild(s);
    });
    return opPromise;
  }
  async function fetchOnePieceSet(code) {
    await ensureOnePiece();
    const all = window.OP_CARDS || [];
    return all.filter((c) => c.set === code && c.id).map((c, i) => ({
      id: `op-${c.id}`, num: parseInt((c.id.split('-')[1] || '').replace(/\D/g, ''), 10) || (i + 1), localId: c.id,
      name: c.name, rarity: OP_RARITY[c.rarity] || c.rarity || '', category: 'One Piece', types: [c.Color || 'Colorless'],
      image: `https://static.dotgg.gg/onepiece/card/${c.id}.webp`, fullImg: true,
      priceUsd: opPrice(c),
      priceVariant: 'normal', variants: {}, cardmarket: null, imageOk: true, illustrator: '',
      meta: [
        ['Color', c.Color], ['Card', c.cardType], ['Cost', c.Cost], ['Power', c.Power], ['Counter', c.Counter],
        ['Foil', c.foilPrice ? `$${(+c.foilPrice).toFixed(2)}` : null],
      ],
      flavor: c.Effect || '',
    }));
  }
  // fetch an external set's cards into SETS (no wheel change). Shared by the set
  // browser's lazy price loading and by opening the set, so each set is fetched once.
  const extJobs = {};
  function ensureExternalSet(id) {
    if (SETS[id]) return Promise.resolve(true);
    if (extJobs[id]) return extJobs[id];
    const meta = gameSetMeta(id);
    if (!meta) return Promise.resolve(false);
    return (extJobs[id] = (async () => {
      try {
        const cards = meta.game === 'magic' ? await fetchMagicSet(meta.code)
          : meta.game === 'lorcana' ? await fetchLorcanaSet(meta.code)
          : await fetchOnePieceSet(meta.code);
        if (!cards.length) throw new Error('empty');
        const SOURCE = { magic: 'Scryfall', lorcana: 'Lorcast', onepiece: 'dotgg' };
        SETS[id] = {
          set: { id, name: meta.name, total: cards.length, official: cards.length, logo: '', external: true },
          cards, snapshotAt: new Date().toISOString(), source: SOURCE[meta.game] || 'market',
        };
        return true;
      } catch { delete extJobs[id]; return false; }
    })());
  }
  let loadingGame = false;
  async function loadExternalSet(id) {
    if (SETS[id]) { loadSet(id); return; }
    const meta = gameSetMeta(id);
    if (!meta || loadingGame) return;
    loadingGame = true;
    const btnLogo = $('setBtnLogo'), btnName = $('setBtnName');
    btnLogo.hidden = true; btnName.hidden = false; btnName.textContent = `Loading ${meta.name}`;
    try {
      if (await ensureExternalSet(id)) loadSet(id);
      else btnName.textContent = `Couldn't load ${meta.name}`;
    } finally { loadingGame = false; }
  }

  // ---- load ANY of the 217 sets into the wheel, built straight from the in-memory tcgcsv
  //      index (window.CARD_INDEX) — no fetch, no CORS. The index already carries image,
  //      number, rarity and price for every card, which is all the wheel/inspect need. ----
  function buildSetFromIndex(groupId) {
    const IDX = window.CARD_INDEX; if (!Array.isArray(IDX)) return null;
    const rows = IDX.filter((c) => c.s === groupId);
    if (!rows.length) return null;
    const setName = rows[0].sn || groupId;
    const cards = rows.map((c, i) => {
      const local = (c.num || '').split('/')[0] || String(i + 1);   // "114/147" → "114"
      return {
        id: c.i, num: parseInt(local, 10) || (i + 1), localId: local,
        name: c.n, rarity: c.rar || '', category: 'Pokemon', types: [],
        image: (c.img || '').replace('_200w', '_400w'), fullImg: true,
        priceUsd: c.p != null ? c.p : null, priceVariant: 'normal', variants: {}, cardmarket: null, imageOk: true,
        illustrator: '', meta: [['Set', setName]], flavor: '',
      };
    });
    const official = parseInt((rows[0].num || '').split('/')[1], 10) || cards.length;   // set size from the "x/y" denominator
    return { set: { id: groupId, name: setName, total: cards.length, official, logo: '', external: true }, cards, snapshotAt: new Date().toISOString(), source: 'TCGplayer' };
  }
  async function loadPokemonSet(id) {
    if (SETS[id]) { loadSet(id); return true; }
    const built = buildSetFromIndex(id);
    if (!built) return false;
    SETS[id] = built; loadSet(id); return true;
  }

  // ---- live tcgdex fallback for AUTO-DISCOVERED sets the index doesn't carry
  //      yet (day-one releases like the next "Pitch Black"): fetch the set list
  //      straight from tcgdex and show it unpriced — prices arrive when the
  //      catalogues catch up. Image urls are tcgdex bases, so the wheel's
  //      normal quality ladder applies untouched. ----
  async function ensureTcgdexSet(id) {
    if (SETS[id]) return true;
    try {
      const r = await fetch(`https://api.tcgdex.net/v2/en/sets/${encodeURIComponent(id)}`);
      if (!r.ok) return false;
      const d = await r.json();
      const cards = (d.cards || []).map((c, i) => ({
        id: c.id, localId: c.localId || String(i + 1), num: parseInt(c.localId, 10) || (i + 1),
        name: c.name, rarity: '', category: 'Pokemon', types: [], illustrator: '',
        image: c.image || '', priceUsd: null, priceVariant: 'normal', variants: {},
        cardmarket: null, imageOk: !!c.image,
      }));
      if (!cards.length) return false;
      SETS[id] = {
        set: { id, name: d.name || id, total: cards.length, official: (d.cardCount && d.cardCount.official) || cards.length, logo: d.logo || '' },
        cards, snapshotAt: new Date().toISOString(), source: 'TCGdex (unpriced, new release)',
      };
      return true;
    } catch { return false; }
  }
  async function fetchTcgdexSet(id) {
    if (!(await ensureTcgdexSet(id))) return false;
    loadSet(id);
    return true;
  }

  // ---- Full-set merge (bundled ∪ index) for bundled Pokémon sets --------------
  // The bundled data/cards-<set>.js files carry only ONE printing per card number,
  // but TCGplayer's catalogue (the in-memory index) also lists the special-pattern
  // reprints (Poké Ball / Master Ball Pattern, Holiday Calendar, secret rares above
  // the set total). P wants EVERY card of the set on the wheel, so for the sets
  // below we rebuild the card list as the union: every index row of the group is
  // kept (nothing dropped), and the base printing of each number is enriched with
  // the richer bundled record (tcgdex high-res art, types for the tint, Cardmarket
  // trend, illustrator, variant prices). Bundled-only sets / other games are
  // untouched, and the ?set=<groupId> index path (already full) never hits this.
  //
  // Map = bundled set id → verified TCGplayer group id (the index `s` field). Only
  // sets confirmed to be a strict subset of a single clean group are listed; fpp
  // (different numbering) and the Black Star Promo sets are intentionally absent so
  // their bundled cards are never dropped.
  const POKE_SET_GROUP = {
    'sv01': '22873', 'sv02': '23120', 'sv03': '23228', 'sv03.5': '23237',
    'sv04': '23286', 'sv04.5': '23353', 'sv05': '23381', 'sv06': '23473',
    'sv06.5': '23529', 'sv07': '23537', 'sv08': '23651', 'sv08.5': '23821',
    'sv09': '24073', 'sv10': '24269', 'sv10.5b': '24325', 'sv10.5w': '24326',
    'me01': '24380', 'me02': '24448', 'me02.5': '24541', 'me03': '24587', 'me04': '24655',
    'me05': '24688', '30th': '24722',
  };
  // strip a baked-in "093 131" / "093/131" out of an index name, then lowercase —
  // so "Amarys 093 131" matches the bundled "Amarys" when picking the base printing
  const idxNameNorm = (n) => (n || '').replace(/\b\d{1,4}\s*[\/ ]\s*\d{1,4}\b/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  function mergeFullSet(id) {
    const gid = POKE_SET_GROUP[id];
    const IDX = window.CARD_INDEX;
    if (!gid || !SETS[id] || SETS[id]._merged || !Array.isArray(IDX)) return;
    const rows = IDX.filter((c) => c.s === gid);
    if (rows.length <= SETS[id].cards.length) { SETS[id]._merged = true; return; } // index adds nothing → keep bundled
    const setName = SETS[id].set.name;
    // bundled cards grouped by number, so the base printing of each number can be enriched
    const bundledByNum = new Map();
    for (const b of SETS[id].cards) { if (!bundledByNum.has(b.num)) bundledByNum.set(b.num, []); bundledByNum.get(b.num).push(b); }
    // base tcgdex art per number — the shortest-named bundled printing (= the plain
    // base card). Special-pattern index reprints (Master Ball / Poké Ball Pattern)
    // whose TCGplayer scan is missing fall back to THIS so they show real artwork.
    const baseArtByNum = new Map();
    for (const [num, list2] of bundledByNum) {
      const base = list2.filter((b) => !b.fullImg && !b.sealed && typeof b.image === 'string' && b.image.startsWith('https://assets.tcgdex.net/'))
        .sort((x, y) => x.name.length - y.name.length)[0];
      if (base) baseArtByNum.set(num, base.image);
    }
    const used = new Set();
    const cards = rows.map((c, i) => {
      const local = (c.num || '').split('/')[0] || String(i + 1);
      const num = parseInt(local, 10) || (i + 1);
      // base card built straight from the index row (same shape buildSetFromIndex uses)
      const idxCard = {
        id: c.i, num, localId: local,
        name: c.n, rarity: c.rar || '', category: 'Pokemon', types: [],
        image: (c.img || '').replace('_200w', '_400w'), fullImg: true,
        priceUsd: c.p != null ? c.p : null, priceVariant: 'normal', variants: {}, cardmarket: null, imageOk: true,
        illustrator: '', meta: [['Set', setName]], flavor: '',
        fallbackImage: baseArtByNum.get(num) || null, // base printing's tcgdex art if the TCGplayer scan 404s
      };
      // enrich the base printing of this number from the bundled record (richer art +
      // metadata). Match the bundled card by normalized name; fall back to the
      // shortest-named (= base) bundled card. Each bundled card enriches at most once.
      const pool = (bundledByNum.get(num) || []).filter((b) => !used.has(b));
      if (pool.length) {
        const nn = idxNameNorm(c.n);
        let b = pool.find((x) => idxNameNorm(x.name) === nn) ||
                pool.slice().sort((x, y) => x.name.length - y.name.length)[0];
        used.add(b);
        return { ...b, priceUsd: typeof b.priceUsd === 'number' ? b.priceUsd : idxCard.priceUsd };
      }
      return idxCard;
    });
    // sensible order: by card number, base printing before its variant reprints
    cards.sort((a, b) => (a.num - b.num) || (String(a.id).length - String(b.id).length) || String(a.id).localeCompare(String(b.id)));
    SETS[id].cards = cards;
    SETS[id].set.total = cards.length;
    SETS[id]._merged = true;
    // drop any caches built from the old (bundled-only) list so the wheel rebuilds full
    delete cardListCache[id]; delete domCache[id]; _speciesIndex = null;
  }

  // --- Curated "First Partner Illustration Collection" sets --------------------
  // These 2026 promos aren't cataloged as singles on TCGplayer yet, but their cards
  // live in the index under the Mega Evolution Promo group (24451): #037–045 are
  // Series 1, #046–054 are Series 2. Series 3 (#055–063) isn't released (Aug 2026).
  // Surface each released series as its own browsable/inspectable set, box-art tile.
  const CURATED_FP = [
    { id: 'fpic1', name: 'First Partner Illustration · Series 1', group: '24451', lo: 37, hi: 45, box: '673436' },
    { id: 'fpic2', name: 'First Partner Illustration · Series 2', group: '24451', lo: 46, hi: 54, box: '688712' },
    { id: 'fpic3', name: 'First Partner Illustration · Series 3', group: '24451', lo: 55, hi: 63, box: '695400' },   // releases Aug 2026 — auto-activates once tcgcsv catalogues #055–063
  ];
  function buildCuratedSet(def) {
    const IDX = window.CARD_INDEX; if (!Array.isArray(IDX)) return null;
    const rows = IDX.filter((c) => {
      const n = parseInt(c.num, 10);
      return c.s === def.group && n >= def.lo && n <= def.hi && !/staff|cosmos|exclusive|prerelease|pok[eé]mon center/i.test(c.n);
    });
    if (rows.length < (def.hi - def.lo + 1) * 0.5) return null;          // not enough of the series catalogued yet
    const byNum = {}; for (const c of rows) { const k = parseInt(c.num, 10); if (!byNum[k]) byNum[k] = c; }
    const cards = Object.keys(byNum).map(Number).sort((a, b) => a - b).map((k, i) => {
      const c = byNum[k];
      return {
        id: c.i, num: i + 1, localId: String(i + 1).padStart(3, '0'), name: c.n.replace(/\s+\d{1,3}$/, ''),   // in-collection 1..9 (matches bundled Series 1)
        rarity: c.rar || 'Promo', category: 'Pokemon', types: [],
        image: (c.img || '').replace('_200w', '_400w'), fullImg: true,
        priceUsd: c.p != null ? c.p : null, priceVariant: 'normal', variants: {}, cardmarket: null, imageOk: true,
        illustrator: '', meta: [['Set', def.name], ['Promo', 'MEP ' + String(k).padStart(3, '0')]], flavor: '',
      };
    });
    return { set: { id: def.id, name: def.name, total: cards.length, official: cards.length, logo: '', external: true, curated: true }, cards, snapshotAt: new Date().toISOString(), source: 'TCGplayer' };
  }
  for (const def of CURATED_FP) {
    if (!(SETS[def.id] && (SETS[def.id].cards || []).length)) { const built = buildCuratedSet(def); if (built) SETS[def.id] = built; }  // Series 1 already bundled with local art — keep it
    if (SETS[def.id]) SET_LOGO_OVERRIDE[def.id] = 'https://tcgplayer-cdn.tcgplayer.com/product/' + def.box + '_400w.jpg';
  }

  // --- Sealed-product price tracker (per active set; verified snapshots only) -
  const sealedDlg = $('sealedDlg');
  function openSealed() {
    const grid = $('sealedGrid');
    grid.replaceChildren();
    $('sealedSet').textContent = DATA.set.name;
    const products = (window.SEALED_PRODUCTS || {})[DATA.set.id] || [];
    $('sealedEmpty').hidden = products.length > 0;
    for (const p of products) {
      const tile = document.createElement('div');
      tile.className = 'sealed-tile';
      const img = document.createElement('img');
      img.loading = 'lazy';
      img.alt = p.name;
      img.src = p.img;
      const nm = document.createElement('div');
      nm.className = 'sp-name';
      nm.textContent = p.name;
      const dt = document.createElement('div');
      dt.className = 'sp-detail';
      dt.textContent = p.detail || '';
      const pr = document.createElement('div');
      pr.className = 'sp-price' + (p.marketUsd == null ? ' pending' : '');
      pr.textContent = p.marketUsd != null ? `$${p.marketUsd.toFixed(2)}` : 'tracking soon';
      const src = document.createElement('div');
      src.className = 'sp-src';
      src.textContent = p.marketUsd != null ? `${p.source} · ${p.checked}` : '';
      tile.append(img, nm, dt, pr, src);
      if (p.note) {
        const note = document.createElement('div');
        note.className = 'sp-note';
        note.textContent = p.note;
        tile.appendChild(note);
      }
      grid.appendChild(tile);
    }
    sealedDlg.showModal();
  }
  $('sealedBtn').addEventListener('click', openSealed);
  $('sealedClose').addEventListener('click', () => sealedDlg.close());
  sealedDlg.addEventListener('click', (e) => { if (e.target === sealedDlg) sealedDlg.close(); });
  document.addEventListener('pointerdown', (e) => {
    if (!setMenu.hidden && !e.target.closest?.('.set-dropdown')) toggleSetMenu(false);
  });

  // --- Input: wheel ---------------------------------------------------------------
  wheel.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (zoom.open) return;
    let d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (e.deltaMode === 1) d *= 16; else if (e.deltaMode === 2) d *= 100;
    if (REDUCED) { goTo(current + Math.sign(d), true); return; }
    velocity = Math.max(-MAX_VEL, Math.min(MAX_VEL, velocity + d * WHEEL_GAIN));
    mode = 'wheeling';
  }, { passive: false });

  // --- Input: drag ----------------------------------------------------------------
  let dragX = 0, lastX = 0, lastT = 0, dragVel = 0, dragMoved = 0, dragDirty = false;
  wheel.addEventListener('pointerdown', (e) => {
    if (zoom.open) return;
    try { wheel.setPointerCapture(e.pointerId); } catch { /* inactive pointer */ }
    wheel.classList.add('dragging');
    mode = 'dragging';
    velocity = 0; dragMoved = 0;
    dragX = lastX = e.clientX; lastT = performance.now(); dragVel = 0;
  });
  wheel.addEventListener('pointermove', (e) => {
    if (mode !== 'dragging') return;
    const dx = e.clientX - lastX;
    const now = performance.now();
    dragMoved += Math.abs(dx);
    position -= dx / spacing;
    clampPos();
    const dt = Math.max(1, now - lastT);
    dragVel = 0.7 * dragVel + 0.3 * (-(dx / spacing) * (1000 / 60) / dt);
    lastX = e.clientX; lastT = now;
    dragDirty = true;   // drawn once per frame by tick(); pointer events can fire several times a frame
  });
  function endDrag(e) {
    if (mode !== 'dragging') return;
    wheel.classList.remove('dragging');
    const clicked = dragMoved < 10; // trackpads wobble a few px during a click
    if (clicked) {
      // pointer capture retargets e.target to the wheel — hit-test the actual
      // point instead, so cards AND the inspect bracket receive real clicks
      const hit = document.elementFromPoint(e.clientX, e.clientY);
      const cardEl = hit?.closest?.('.card');
      mode = 'idle';
      if (cardEl) {
        const slot = slotOf[Number(cardEl.dataset.i)];
        // ANY clicked card opens its OWN inspect — centered or off to the side.
        // openZoomFor repositions the wheel behind the modal when slot!==current,
        // and uses the clicked element as the FLIP source for the morph.
        openZoomFor(slot, cardEl);
      } else {
        mode = 'snapping'; target = Math.round(position);
      }
    } else if (REDUCED) {
      goTo(Math.round(position), true);
    } else {
      velocity = Math.max(-MAX_VEL, Math.min(MAX_VEL, dragVel));
      mode = 'gliding';
    }
  }
  wheel.addEventListener('pointerup', endDrag);
  wheel.addEventListener('pointercancel', endDrag);

  // --- Search + set switcher ----------------------------------------------------------
  const searchEl = $('search');
  const dl = $('cardNames'); // populated per-set by loadSet()
  function doSearch() {
    const q = searchEl.value.trim().toLowerCase();
    if (!q) return;
    let ci = -1;
    const tail = q.match(/·\s*(\d+)\s*$/);
    if (tail) ci = CARDS.findIndex(c => c.num === parseInt(tail[1], 10));
    if (ci < 0 && /^\d+$/.test(q)) ci = CARDS.findIndex(c => c.num === parseInt(q, 10));
    if (ci < 0) {
      const hit = view.find(i => CARDS[i].name.toLowerCase().includes(q)); // first in display order
      if (hit !== undefined) ci = hit;
    }
    if (ci >= 0) { goTo(slotOf[ci]); searchEl.blur(); }
  }
  searchEl.addEventListener('change', doSearch);
  searchEl.addEventListener('keydown', (e) => {
    e.stopPropagation(); // typing never drives the wheel
    if (e.key === 'Enter') { e.preventDefault(); doSearch(); }
  });

  // --- Input: keyboard --------------------------------------------------------------
  addEventListener('keydown', (e) => {
    if (zoom.open || !wheelReady || document.body.classList.contains('home-open')) return;
    if (e.target === searchEl || e.target.closest?.('.set-dropdown')) return;
    if (e.key === 'Escape' && !setMenu.hidden) { toggleSetMenu(false); return; }
    if (e.target === rail && (e.key === 'PageDown' || e.key === 'PageUp')) {
      e.preventDefault();
      goTo(current + (e.key === 'PageDown' ? 10 : -10));
      return;
    }
    switch (e.key) {
      case 'ArrowRight': case 'ArrowDown': e.preventDefault(); goTo(current + 1); break;
      case 'ArrowLeft': case 'ArrowUp': e.preventDefault(); goTo(current - 1); break;
      case 'Home': e.preventDefault(); goTo(0); break;
      case 'End': e.preventDefault(); goTo(N - 1); break;
      case 'Enter': case ' ': {
        // inspect the current card no matter where focus sits — arrow-key browsing
        // never moves focus, so requiring a focused card made Enter feel dead.
        // Native buttons/links/inputs keep their own activation.
        const t = e.target;
        if (t instanceof Element && t.closest('button, a, input, select, textarea')
            && !t.classList.contains('card')) break;
        e.preventDefault();
        openZoom();
        break;
      }
    }
  });

  // --- Input: minimap scrub -----------------------------------------------------------
  let scrubbing = false;
  function railIndex(e) {
    const r = (scrub ? scrub.track : railArc).getBoundingClientRect();
    const f = (e.clientX - r.left) / (r.width || 1);
    return Math.max(0, Math.min(N - 1, Math.floor(f * N)));
  }
  rail.addEventListener('pointerdown', (e) => {
    if (zoom.open) return;
    scrubbing = true; holdHigh = true;
    goTo(railIndex(e));
    try { rail.setPointerCapture(e.pointerId); } catch { /* inactive pointer */ }
  });
  rail.addEventListener('pointermove', (e) => { if (scrubbing) goTo(railIndex(e)); });
  const scrubEnd = () => { scrubbing = false; if (holdHigh) { holdHigh = false; render(true); } };   // landed: the near cards sharpen
  rail.addEventListener('pointerup', scrubEnd);
  rail.addEventListener('pointercancel', scrubEnd);

  rail.addEventListener('pointerenter', () => schedulePrefetch());   // about to scrub: keep the small scans warming

  // --- Zoom view ------------------------------------------------------------------------
  const fmt = (v, cur) => (typeof v === 'number' ? (cur === 'EUR' ? '€' : '$') + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—');
  const VARIANT_LABEL = { normal: 'Normal', holofoil: 'Holofoil', 'reverse-holofoil': 'Reverse holo' };
  let zoomReturnEl = null;

  // --- Wishlist & collection (persisted; card ids are set-qualified, e.g. me02-125)
  function loadList(key) {
    try { return new Set(JSON.parse(localStorage.getItem(key) || '[]')); }
    catch { return new Set(); }
  }
  const wishlist = loadList('pokex.wishlist');
  const collection = loadList('pokex.collection');
  function saveList(key, set) { localStorage.setItem(key, JSON.stringify([...set])); }
  function updateListCounts() {
    $('wishCount').textContent = String(wishlist.size);
    $('collCount').textContent = String(collection.size);
  }
  function updateListButtons(card) {
    const w = wishlist.has(card.id), c = collection.has(card.id);
    const wb = $('wishBtn'), cb = $('collBtn');
    wb.setAttribute('aria-pressed', String(w));
    wb.querySelector('.ic').textContent = w ? '♥' : '♡';
    wb.querySelector('.lb').textContent = w ? 'Wishlisted' : 'Wishlist';
    cb.setAttribute('aria-pressed', String(c));
    cb.querySelector('.ic').textContent = c ? '◆' : '◇';
    cb.querySelector('.lb').textContent = c ? 'Collected' : 'Collection';
  }
  // Share opens a small menu: copy the link, copy the name and price, post to X or
  // Reddit, or the device's own share sheet where there is one (Faisal, 27 Oct)
  const shareMenu = $('shareMenu');
  const shareText = () => { const c = zoomLangCard; if (!c) return ''; const p = typeof c.priceUsd === 'number' ? ` · ${money(c.priceUsd)}` : ''; return `${cardName(c)} (${DATA.set.name})${p}`; };
  const toggleShare = (open) => {
    shareMenu.hidden = !open;
    $('shareBtn').setAttribute('aria-expanded', String(open));
    if (open) shareMenu.querySelector('[data-share="native"]').hidden = !navigator.share;
  };
  $('shareBtn').addEventListener('click', (e) => { e.preventDefault(); toggleShare(shareMenu.hidden); });
  document.addEventListener('pointerdown', (e) => { if (!shareMenu.hidden && !e.target.closest('#shareMenu, #shareBtn')) toggleShare(false); });
  shareMenu.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-share]'); if (!b) return;
    const url = $('shareBtn').href, text = shareText(), kind = b.dataset.share;
    const done = (label) => { const old = b.textContent; b.textContent = label; setTimeout(() => { b.textContent = old; toggleShare(false); }, 900); };
    if (kind === 'link') navigator.clipboard?.writeText(url).then(() => done('Copied')).catch(() => {});
    else if (kind === 'text') navigator.clipboard?.writeText(`${text}\n${url}`).then(() => done('Copied')).catch(() => {});
    else if (kind === 'x') { window.open(`https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank', 'noopener'); toggleShare(false); }
    else if (kind === 'reddit') { window.open(`https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(text)}`, '_blank', 'noopener'); toggleShare(false); }
    else if (kind === 'native' && navigator.share) navigator.share({ title: text, text, url }).catch(() => {}).finally(() => toggleShare(false));
  });
  // share the FOCUSED (not inspected) card straight from the caption
  $('capShare').addEventListener('click', () => {
    if (!focusedCard) return;
    const btn = $('capShare'), lbl = btn.querySelector('span');
    const url = `${location.origin}${location.pathname}?set=${encodeURIComponent(DATA.set.id)}&card=${focusedCard.num}`;
    navigator.clipboard?.writeText(url).then(() => {
      btn.classList.add('copied'); lbl.textContent = 'Copied';
      setTimeout(() => { btn.classList.remove('copied'); lbl.textContent = 'Share'; }, 1400);
    }).catch(() => {});
  });

  // "more cards" gallery view (openGallery/closeGallery hoisted below)
  $('moreCardsBtn').addEventListener('click', () => openGallery());
  $('galleryBack').addEventListener('click', () => closeGallery());

  // Light: a lamp over the card. A specular highlight and a holo band follow the
  // pointer as the card tilts toward it (strongest on foil rarities), instead of a
  // flat wash over the whole card (Faisal, 27 Oct)
  $('lightBtn').addEventListener('click', () => {
    const lit = cardFaces.classList.toggle('lit');
    $('lightBtn').setAttribute('aria-pressed', lit ? 'true' : 'false');
    if (lit) { cardFaces.style.setProperty('--lx', '0.5'); cardFaces.style.setProperty('--ly', '0.28'); }
  });
  // the collection page can't load every set's data, so a save also keeps what it
  // needs to show the card: name, set, picture, number and the price that day
  // (collection.html prefers today's price whenever the card's set is bundled)
  const SAVED_KEY = 'crowns.saved';
  function rememberCard(card) {
    if (!card || !DATA) return;
    let m = {};
    try { m = JSON.parse(localStorage.getItem(SAVED_KEY) || '{}') || {}; } catch { /* fresh */ }
    m[card.id] = { name: cardName(card), sub: splitName(card.name).sub || '', setId: DATA.set.id, setName: DATA.set.name,
      game: gameOf(DATA.set.id), num: card.num, localId: card.localId || '', img: cardThumb(card), sealed: !!card.sealed,
      price: typeof card.priceUsd === 'number' ? card.priceUsd : null, at: new Date().toISOString().slice(0, 10) };
    try { localStorage.setItem(SAVED_KEY, JSON.stringify(m)); } catch { /* storage full */ }
  }
  $('wishBtn').addEventListener('click', () => {
    const card = cardAt(current);
    wishlist.has(card.id) ? wishlist.delete(card.id) : wishlist.add(card.id);
    if (wishlist.has(card.id)) rememberCard(card);
    saveList('pokex.wishlist', wishlist);
    updateListButtons(card);
    updateListCounts();
    refreshCapMarks(card);
  });
  $('collBtn').addEventListener('click', () => {
    const card = cardAt(current);
    collection.has(card.id) ? collection.delete(card.id) : collection.add(card.id);
    if (collection.has(card.id)) rememberCard(card);
    saveList('pokex.collection', collection);
    updateListButtons(card);
    updateListCounts();
    refreshCapMarks(card);
  });
  function refreshCapMarks(card) {
    let marks = capMeta.querySelector('.cap-marks');
    if (!marks) {
      marks = document.createElement('span');
      marks.className = 'cap-marks';
      capMeta.appendChild(marks);
    }
    marks.replaceChildren();
    if (wishlist.has(card.id)) {
      const s = document.createElement('span');
      s.className = 'mk-wish';
      s.textContent = '♥';
      marks.appendChild(s);
    }
    if (collection.has(card.id)) {
      const s = document.createElement('span');
      s.className = 'mk-coll';
      s.textContent = ' ◆';
      marks.appendChild(s);
    }
  }

  // --- Inspect scene: editorial title + rarity text + animated holo backdrop --
  const zTitle = $('zTitle');
  const zRarity = $('zRarity'), zNumber = $('zNumber');
  let sceneTweens = [];

  // the NAME — a top header; per-char rise reveal (no clip — it's never masked)
  function buildTitle(card) {
    zTitle.replaceChildren();
    zTitle.style.setProperty('--name-glow', rarityColor(card.rarity) + '66');
    const { name, sub } = splitName(card.name); // Lorcana "Character — Title" → 2 lines
    for (const word of name.split(' ')) { // words intact (no mid-word wrap)
      const w = document.createElement('span');
      w.className = 'wd';
      for (const ch of word) {
        const s = document.createElement('span');
        s.className = 'ch';
        s.textContent = ch;
        w.appendChild(s);
      }
      zTitle.append(w, ' ');
    }
    let subEl = null;
    if (sub) { subEl = document.createElement('span'); subEl.className = 'z-subtitle'; subEl.textContent = sub; zTitle.append(subEl); }
    if (window.gsap && !REDUCED) {
      // subtle: a quiet fade + small lift, gentle stagger — no 3D slam, no flare
      const chars = zTitle.querySelectorAll('.ch');
      sceneTweens.push(gsap.fromTo(chars,
        { yPercent: 24, opacity: 0 },
        { yPercent: 0, opacity: 1, duration: 0.5, ease: 'power2.out',
          stagger: { each: 0.018, from: 'start' }, delay: 0.05 }));
      if (subEl) sceneTweens.push(gsap.fromTo(subEl, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out', delay: 0.34 }));
    }
  }

  // rarity as TEXT under the name (no badge), in its signature color
  function buildRarity(card) {
    const label = card.sealed ? 'Sealed Product' : (card.rarity || '');
    zRarity.textContent = label.toUpperCase();
    zRarity.className = 'z-rarity-line' + (card.sealed ? '' : ' rar-' + raritySlug(card.rarity)); // special rarities get flair
    zRarity.style.setProperty('--rarity-color', card.sealed ? 'var(--ember-glint)' : rarityColor(card.rarity));
    // card number under the rarity — big, pitch white (e.g. 116/086)
    // one plain line under the name: the set (and the card's number in it)
    zNumber.textContent = card.sealed ? DATA.set.name : `${DATA.set.name} · ${card.localId}/${String(DATA.set.official).padStart(3, '0')}`;
    if (window.gsap && !REDUCED) {
      sceneTweens.push(gsap.fromTo([zRarity, zNumber], { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out', delay: 0.3 }));
    }
  }

  // hand-made holographic energy frames for specific cards (keyed by card.id).
  // Local PNGs with a dark centre → composited with mix-blend-mode:screen.
  const CARD_FX = {
    'me04-088': 'assets/card-fx/me04-088-froakie-fx.png',
    'me04-116': 'assets/card-fx/me04-116-greninja-fx.png',
  };
  function applyCardFx(card) {
    const fx = $('cardFx');
    const src = card && !card.sealed ? CARD_FX[card.id] : null;
    if (!src) { fx.hidden = true; fx.style.backgroundImage = ''; fx.style.opacity = '0'; return; }
    fx.style.backgroundImage = `url('${src}')`;
    fx.hidden = false;
    if (window.gsap && !REDUCED) {
      sceneTweens.push(gsap.fromTo(fx, { opacity: 0 },
        { opacity: 1, duration: 0.8, ease: 'power2.out', delay: 0.35 })); // settles in as the card lands
    } else {
      fx.style.opacity = '1'; // reduced motion: just show it
    }
  }
  function paintZoomScene(card) {
    buildTitle(card);
    buildRarity(card);
    applyCardFx(card);
    holoSetTint(cardTintColor(card)); // backdrop takes the card's own colour
  }
  function resetZoomScene() {
    sceneTweens.forEach(t => t && t.kill());
    sceneTweens = [];
    if (window.gsap) gsap.set(zTitle, { clearProps: 'transform,--name-flare' });
    zTitle.replaceChildren();
    zRarity.textContent = '';
    const fx = $('cardFx'); fx.hidden = true; fx.style.opacity = '0'; fx.style.backgroundImage = '';
    closeGallery(); // next open starts on the card, not the gallery
  }

  // --- three.js holographic animated backdrop --------------------------------
  const HOLO_FRAG = `
    precision highp float;
    uniform float uTime; uniform vec2 uRes; uniform vec3 uTint;
    void main(){
      vec2 uv = gl_FragCoord.xy / uRes.xy;
      vec2 p = uv - 0.5; p.x *= uRes.x / uRes.y;
      float t = uTime * 0.12;             // clearly in motion
      float w1 = sin((p.x + p.y) * 3.5 + t * 6.2831);
      float w2 = sin((p.x - p.y) * 6.0 - t * 5.0 + sin(p.x * 4.0 + t * 3.0));
      float w3 = sin(length(p) * 8.0 - t * 8.0); // radial ripple — visible flow
      float m = (w1 + w2 + w3 * 0.6) * 0.2 + 0.5;
      vec3 irid = 0.5 + 0.5 * cos(6.2831 * (vec3(0.0, 0.33, 0.66) + m * 1.4));
      vec3 col = mix(uTint, irid, 0.30);  // the card's colour dominates, iridescence is the shimmer
      float vig = smoothstep(1.35, 0.10, length(p));
      col *= 0.16 + 0.52 * vig;           // bright at the periphery so motion reads
      col += irid * 0.05;                 // faint iridescent bloom
      gl_FragColor = vec4(col, 1.0);
    }`;
  let holo = null;
  function initHolo() {
    if (holo || !window.THREE) return;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: $('holoBg'), antialias: false, alpha: false, powerPreference: 'low-power' });
    } catch { holo = false; return; } // no WebGL — static bg fallback stays
    renderer.setPixelRatio(Math.min(1.3, devicePixelRatio || 1));
    const scene = new THREE.Scene();
    const camera = new THREE.Camera();
    const uniforms = { uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) }, uTint: { value: new THREE.Color(0.2, 0.35, 0.7) } };
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      uniforms, vertexShader: 'void main(){ gl_Position = vec4(position, 1.0); }', fragmentShader: HOLO_FRAG,
    })));
    holo = { renderer, scene, camera, uniforms, tintTo: null };
    const resize = () => { renderer.setSize(innerWidth, innerHeight, false); uniforms.uRes.value.set(innerWidth, innerHeight); };
    resize(); addEventListener('resize', resize);
  }
  function holoSetTint(hex) {
    if (!holo) return;
    const n = parseInt(hex.slice(1), 16);
    holo.tintTo = new THREE.Color(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
  }
  function holoRender(ms) {
    if (!holo || !zoom.open) return;
    holo.uniforms.uTime.value = REDUCED ? 9.0 : ms / 1000; // frozen frame if reduced
    if (holo.tintTo) holo.uniforms.uTint.value.lerp(holo.tintTo, 0.04); // ease the recolor
    holo.renderer.render(holo.scene, holo.camera);
  }

  // --- subtle BACKDROP-only parallax: the blurred art drifts with the cursor for
  // depth, but the NAME and CARD never move (so the name can never clip/clash).
  let parallax = null;
  function initParallax() {
    if (!window.gsap || REDUCED) return;
    const q = (el, p, d) => gsap.quickTo(el, p, { duration: d, ease: 'power3' });
    parallax = { bx: q($('zoomBg'), 'x', 1.2), by: q($('zoomBg'), 'y', 1.2) };
  }
  function applyParallax(e) {
    if (!parallax || !zoom.open) return;
    const nx = e.clientX / innerWidth - 0.5, ny = e.clientY / innerHeight - 0.5;
    parallax.bx(nx * -26); parallax.by(ny * -22);
  }
  function resetParallax() {
    if (!parallax) return;
    parallax.bx(0); parallax.by(0);
  }

  // Zoom animation lifecycle: every WAAPI animation registers here; open and
  // close each cancel leftovers, and a generation token kills stale rAF opens.
  const zoomAnims = [];
  const reg = (a) => { zoomAnims.push(a); return a; };
  const cancelZoomAnims = () => { while (zoomAnims.length) zoomAnims.pop().cancel(); };
  let openGen = 0;
  let imgGen = 0; // invalidates in-flight high-res upgrades when a newer card opens

  // Per-card animated inspect backdrops (local, transcoded web-friendly).
  // All printings of a chase card share its animation.
  const VIDEO_BG = {
    // Mega Charizard X ex (me02) — blue-flame animation
    'me02-013': 'assets/video/charizard-x.mp4',
    'me02-109': 'assets/video/charizard-x.mp4',
    'me02-125': 'assets/video/charizard-x.mp4',
    'me02-130': 'assets/video/charizard-x.mp4',
    // Mega Greninja ex (me04)
    'me04-022': 'assets/video/greninja.mp4',
    'me04-100': 'assets/video/greninja.mp4',
    'me04-116': 'assets/video/greninja.mp4',
    'me04-122': 'assets/video/greninja.mp4',
  };

  // --- Cardmarket trend chart (avg30 -> avg7 -> avg1) -------------------------------------
  const SVGNS = 'http://www.w3.org/2000/svg';
  function svgEl(tag, attrs) {
    const el = document.createElementNS(SVGNS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
    return el;
  }
  // editorial line+area chart. Points sit on a TRUE elapsed-time x-axis (p.t =
  // 0..1 across the 30-day window) — NOT evenly spaced — so the 30→7→1-day
  // samples read as real time. A smooth Catmull-Rom curve joins them; holo
  // printing rides a dashed overlay; faint week gridlines anchor the span.
  let sparkSeq = 0;
  // smooth cubic path through [{x,y}] (Catmull-Rom → bezier)
  function smoothPath(p) {
    if (p.length < 2) return '';
    let d = `M${p[0].x.toFixed(1)},${p[0].y.toFixed(1)}`;
    for (let i = 0; i < p.length - 1; i++) {
      const a = p[i - 1] || p[i], b = p[i], c = p[i + 1], e = p[i + 2] || c;
      const c1x = b.x + (c.x - a.x) / 6, c1y = b.y + (c.y - a.y) / 6;
      const c2x = c.x - (e.x - b.x) / 6, c2y = c.y - (e.y - b.y) / 6;
      d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${c.x.toFixed(1)},${c.y.toFixed(1)}`;
    }
    return d;
  }
  const SPARK = { W: 344, H: 128, PX: 14, PT: 16, PB: 24 };
  function sparkline(seriesList) {
    const all = seriesList.map(s => s.pts.filter(p => typeof p.v === 'number'));
    if (!all[0] || all[0].length < 2) return null;
    const { W, H, PX, PT, PB } = SPARK;
    const vs = all.flat().map(p => p.v);
    const mn = Math.min(...vs), mx = Math.max(...vs), span = (mx - mn) || mx * 0.1 || 1;
    const lo = mn - span * 0.22, hi = mx + span * 0.22, rng = hi - lo;
    const y = (v) => PT + (H - PT - PB) * (1 - (v - lo) / rng);
    const x = (t) => PX + t * (W - 2 * PX); // x by elapsed-time fraction, not index
    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'spark', role: 'img', preserveAspectRatio: 'none' });
    const gid = `sf${++sparkSeq}`;
    const defs = svgEl('defs', {});
    const grad = svgEl('linearGradient', { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 });
    grad.append(
      svgEl('stop', { offset: '0%', 'stop-color': seriesList[0].color, 'stop-opacity': 0.34 }),
      svgEl('stop', { offset: '100%', 'stop-color': seriesList[0].color, 'stop-opacity': 0 }));
    defs.append(grad); svg.append(defs);
    // weekly gridlines (3wk / 2wk / 1wk ago) so the 30-day span reads as time
    for (const t of [7 / 30, 14 / 30, 23 / 30]) {
      svg.append(svgEl('line', { class: 'spark-grid', x1: x(t).toFixed(1), x2: x(t).toFixed(1), y1: PT, y2: H - PB }));
    }
    all.forEach((pts, si) => {
      if (pts.length < 2) return;
      const color = seriesList[si].color;
      const xy = pts.map(p => ({ x: x(p.t), y: y(p.v) }));
      const path = smoothPath(xy);
      if (si === 0) {
        svg.append(svgEl('path', { d: `${path} L${xy[xy.length - 1].x.toFixed(1)},${H - PB} L${xy[0].x.toFixed(1)},${H - PB} Z`, fill: `url(#${gid})`, stroke: 'none' }));
      }
      svg.append(svgEl('path', {
        d: path, fill: 'none', stroke: color,
        'stroke-width': si > 0 ? 1.5 : 2.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
        ...(si > 0 ? { 'stroke-dasharray': '4 4', opacity: 0.65 } : {}),
      }));
      if (si === 0) {
        const lx = xy[xy.length - 1].x, ly = xy[xy.length - 1].y;
        svg.append(svgEl('circle', { cx: lx, cy: ly, r: 6.5, fill: 'none', stroke: color, 'stroke-opacity': 0.35 }));
        svg.append(svgEl('circle', { cx: lx, cy: ly, r: 3.4, fill: color }));
        pts.forEach((p, i) => {
          const lab = svgEl('text', { x: x(p.t).toFixed(1), y: H - 7, class: 'spark-lab',
            'text-anchor': i === 0 ? 'start' : (i === pts.length - 1 ? 'end' : 'middle') });
          lab.textContent = p.l; svg.append(lab);
        });
      }
    });
    return svg;
  }
  const SUB_LABEL = { '30d': '30 days ago', '7d': '7 days ago', 'now': 'today' };
  function buildCharts(card) {
    const box = $('zCharts');
    box.replaceChildren();
    const cm = card.cardmarket;
    if (!cm) return;
    // three real samples placed on a true 30-day timeline: the 30-day average
    // anchors the far left, the 7-day average sits ~3/4 across, latest = today.
    const toPts = (src) => [
      { l: '30d', t: 0, v: eurToUsd(src.avg30) },
      { l: '7d', t: 23 / 30, v: eurToUsd(src.avg7) },
      { l: 'now', t: 1, v: eurToUsd(src.avg1) },
    ];
    const seriesList = [{ pts: toPts(cm), color: tierColor('--spectral') }];
    if (cm.holo) seriesList.push({ pts: toPts(cm.holo), color: tierColor('--phantom') });
    const primary = seriesList[0].pts.filter(p => typeof p.v === 'number');
    if (primary.length < 2) return;
    const sp = sparkline(seriesList);
    if (!sp) return;
    const wrap = document.createElement('figure');
    wrap.className = 'chart';
    const cap = document.createElement('figcaption');
    cap.textContent = cm.holo ? 'Price · last 30 days (normal / holo)' : 'Price · last 30 days';
    sp.setAttribute('aria-label', 'Price over the last 30 days, in USD');
    const tip = document.createElement('div'); tip.className = 'spark-tip'; tip.hidden = true;
    const tipVal = document.createElement('b'); tipVal.className = 'tip-val';
    const tipSub = document.createElement('span'); tipSub.className = 'tip-sub';
    tip.append(tipVal, tipSub);
    wrap.append(cap, sp, tip);
    box.appendChild(wrap);

    // --- interactivity: a crosshair + highlighted point + tooltip follow the cursor
    const { W, H, PX, PT, PB } = SPARK; // must match sparkline()
    const vs = seriesList.flatMap(s => s.pts).filter(p => typeof p.v === 'number').map(p => p.v);
    const mn = Math.min(...vs), mx = Math.max(...vs), span = (mx - mn) || mx * 0.1 || 1;
    const lo = mn - span * 0.22, rng = (mx + span * 0.22) - lo;
    const yOf = (v) => PT + (H - PT - PB) * (1 - (v - lo) / rng);
    const xOf = (t) => PX + t * (W - 2 * PX);
    const cross = svgEl('line', { class: 'spark-cross', y1: PT - 2, y2: H - PB, x1: 0, x2: 0, opacity: 0 });
    const hot = svgEl('circle', { class: 'spark-hot', r: 4.5, cx: 0, cy: 0, opacity: 0, stroke: seriesList[0].color });
    sp.append(cross, hot);
    sp.style.touchAction = 'none';
    const move = (e) => {
      const r = sp.getBoundingClientRect();
      if (!r.width) return;
      const f = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
      // snap to the nearest real sample by TIME position, not even index
      let p = primary[0], best = Infinity;
      for (const cand of primary) { const dd = Math.abs(cand.t - f); if (dd < best) { best = dd; p = cand; } }
      const px = xOf(p.t), py = yOf(p.v);
      cross.setAttribute('x1', px); cross.setAttribute('x2', px); cross.setAttribute('opacity', 0.4);
      hot.setAttribute('cx', px); hot.setAttribute('cy', py); hot.setAttribute('opacity', 1);
      tipVal.textContent = `$${p.v.toFixed(2)}`;
      tipSub.textContent = SUB_LABEL[p.l] || p.l;
      tip.hidden = false;
      const wrapR = wrap.getBoundingClientRect();
      tip.style.left = `${(px / W) * r.width + (r.left - wrapR.left)}px`;
      tip.style.top = `${(py / H) * r.height + (r.top - wrapR.top)}px`;
    };
    sp.addEventListener('pointermove', move);
    sp.addEventListener('pointerleave', () => {
      tip.hidden = true; cross.setAttribute('opacity', 0); hot.setAttribute('opacity', 0);
    });
  }

  // TCGplayer variant table — clean hairline rows (the "holofoil price" view)
  function buildVariantTable(card) {
    const tbl = $('zTable');
    tbl.replaceChildren();
    const entries = Object.entries(card.variants ?? {});
    if (!entries.length) return;
    const hd = document.createElement('div');
    hd.className = 'z-hd';
    hd.textContent = 'TCGplayer · USD';
    tbl.appendChild(hd);
    const head = document.createElement('div');
    head.className = 'row head';
    for (const h of ['Variant', 'low', 'mid', 'market']) {
      const s = document.createElement(h === 'Variant' ? 'em' : 'span');
      s.textContent = h;
      if (h === 'Variant') s.className = 'vname';
      head.appendChild(s);
    }
    tbl.appendChild(head);
    for (const [v, p] of entries) {
      const row = document.createElement('div');
      row.className = 'row';
      const nm = document.createElement('em');
      nm.className = 'vname';
      nm.textContent = VARIANT_LABEL[v] ?? v;
      row.appendChild(nm);
      for (const key of ['low', 'mid', 'market']) {
        const s = document.createElement('span');
        if (key === 'market') s.className = 'mkt';
        s.textContent = fmt(p[key]);
        row.appendChild(s);
      }
      tbl.appendChild(row);
    }
  }

  // pull-rate ladder as clean hairline rows, tucked inside a disclosure so it's
  // never "out in the open": collapsed for cards, expanded for sealed products.
  function buildPulls(card, ladder) {
    const box = $('zPulls');
    box.replaceChildren();
    const disc = $('pullsBox');
    if (!ladder) { if (disc) disc.hidden = true; return; }
    if (disc) { disc.hidden = false; disc.open = !!card.sealed; }
    for (const [rar, rate] of Object.entries(ladder.rates)) {
      const row = document.createElement('div');
      row.className = 'pull-row' + (rar === card.rarity ? ' cur' : '');
      const nm = document.createElement('span');
      nm.className = 'pull-rar';
      nm.textContent = rar;
      nm.style.color = rarityColor(rar);
      const od = document.createElement('span');
      od.className = 'pull-odds';
      const pool = CARDS.reduce((n, c) => n + (c.rarity === rar ? 1 : 0), 0);
      od.textContent = pool ? `${rarityRate(rate)} · ${pool} in set` : rarityRate(rate);
      row.append(nm, od);
      box.appendChild(row);
    }
  }

  // --- "More <species> cards" — a button that opens a full gallery view -------
  let familyGroup = [], familySpecies = '';
  function buildFamily(card) {
    familyGroup = card.sealed ? [] : speciesGroup(card.name)
      .filter(e => e.card.id !== card.id)
      .sort((a, b) => (b.card.priceUsd ?? -1) - (a.card.priceUsd ?? -1));
    familySpecies = card.name.replace(/^Mega\s+/i, '').replace(/\s+(?:ex|gx|v|vmax|vstar)$/i, '');
    const btn = $('moreCardsBtn');
    btn.replaceChildren();
    btn.hidden = !familyGroup.length;
    if (!familyGroup.length) return;
    // preview: up to three overlapping card thumbnails, a label, then a → arrow
    const thumbs = document.createElement('span'); thumbs.className = 'mc-thumbs';
    for (const { card: c } of familyGroup.slice(0, 3)) {
      const im = document.createElement('img');
      im.loading = 'lazy'; im.alt = ''; im.src = cardImg(c, 'low.webp');
      thumbs.appendChild(im);
    }
    const lab = document.createElement('span'); lab.className = 'mc-label';
    lab.textContent = `${familyGroup.length} more ${familySpecies} card${familyGroup.length > 1 ? 's' : ''}`;
    const arr = document.createElement('span'); arr.className = 'mc-arrow'; arr.setAttribute('aria-hidden', 'true');
    arr.textContent = '→';
    btn.append(thumbs, lab, arr);
  }
  function openGallery() {
    if (!familyGroup.length) return;
    const grid = $('galleryGrid');
    grid.replaceChildren();
    $('galleryTitle').textContent = `${familySpecies} · ${familyGroup.length} cards`;
    for (const { setId, card: c } of familyGroup) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'gallery-card';
      b.title = `${c.name} — ${SETS[setId].set.name}`;
      const img = document.createElement('img');
      img.loading = 'lazy'; img.alt = c.name; img.src = cardImg(c, 'low.webp');
      const meta = document.createElement('div'); meta.className = 'gc-meta';
      const setS = document.createElement('span'); setS.className = 'gc-set'; setS.textContent = SETS[setId].set.name;
      const priceS = document.createElement('span'); priceS.className = 'gc-price';
      priceS.textContent = typeof c.priceUsd === 'number' ? `$${c.priceUsd.toFixed(2)}`
        : (c.cardmarket?.trend != null ? `$${eurToUsd(c.cardmarket.trend).toFixed(2)}` : '—');
      meta.append(setS, priceS);
      b.append(img, meta);
      b.addEventListener('click', () => { closeGallery(); inspectRef(setId, c.id); });
      grid.appendChild(b);
    }
    $('cardCol').style.display = 'none';
    $('zoomPanel').style.display = 'none';
    const gal = $('zGallery');
    gal.hidden = false; gal.setAttribute('aria-hidden', 'false');
    if (window.gsap && !REDUCED) {
      gsap.fromTo(gal, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'power2.out' });
      gsap.fromTo(grid.children, { opacity: 0, y: 18 },
        { opacity: 1, y: 0, duration: 0.45, stagger: 0.025, ease: 'power3.out' });
    }
  }
  function closeGallery() {
    const gal = $('zGallery');
    gal.hidden = true; gal.setAttribute('aria-hidden', 'true');
    $('cardCol').style.display = '';
    $('zoomPanel').style.display = '';
  }

  // jump the open inspect to another card (loads its set if needed)
  function inspectRef(setId, cardId) {
    if (DATA.set.id !== setId) loadSet(setId);
    const ci = CARDS.findIndex(c => c.id === cardId);
    if (ci < 0) return;
    openZoomFor(slotOf[ci]);
  }

  const openZoom = () => openZoomFor(current);

  // a subtle wind-gust when a card is inspected (user-gesture triggered; the
  // browser blocks it on the non-gesture deep-link open, which we swallow)
  // created on the first inspect, so the 577 KB file is never fetched by a page
  // load (it used to start downloading on every set page before anyone clicked)
  let whoosh = null;
  function playWhoosh() {
    try {
      if (!whoosh) { whoosh = new Audio('assets/sfx/swipe-whoosh.wav'); whoosh.volume = 0.056; } // ≈ -25 dB; very subtle. tune this knob for loudness
      whoosh.currentTime = 0; whoosh.play().catch(() => {});
    } catch { /* no audio */ }
  }

  function openZoomFor(i, srcEl) {
    const card = cardAt(i);
    playWhoosh();
    const wasOpen = zoom.open; // already inspecting → in-place switch, not a fresh open
    cancelZoomAnims();
    // a cancelled morph never fires its onfinish — so unconditionally restore any
    // wheel card a previous (now-cancelled) morph left hidden, before we reassign
    if (zoomReturnEl) zoomReturnEl.style.visibility = '';
    zoomClosing = false;
    // FLIP source = the card the user actually clicked, captured before any reposition
    const flipSrc = (srcEl ?? els[view[i]].el).getBoundingClientRect();
    if (i !== current) goTo(i, true); // reposition behind the modal; close returns here
    zoomReturnEl = ((MOBILE || gridOn) && srcEl) ? srcEl : els[view[i]].el;   // mobile / grid: morph back to the card that was clicked, not the hidden wheel el
    // pin the featured card's width so the action row + "more cards" button can
    // cap to it (computed from the CSS sizing formula — no layout needed yet)
    const _cardW = innerWidth < 1024
      ? Math.min(innerWidth * 0.78, innerHeight * 0.46)               // sized by width below 1024
      : Math.min(innerHeight * 0.58, innerWidth * 0.60) * (734 / 1024); // height * aspect
    $('cardCol').style.setProperty('--featured-card-w', `${_cardW.toFixed(1)}px`);
    zoomImg.alt = card.name;
    // blur-up: show THIS card's low scan instantly (already cached by the wheel),
    // then sharpen to high.webp — small and usually already warmed by the wheel's
    // idle prefetch, so the inspect crisps almost immediately. The heavy PNG loads
    // quietly afterward only to feed the loupe (no visible flash; same image).
    const ig = ++imgGen;
    tiltCard.classList.toggle('sealed', !!card.sealed); // floats the render, no frame
    tiltCard.classList.toggle('ext-card', !!card.fullImg); // Magic/Lorcana = square-corner JPGs, round them more
    tintInspect(card);   // inspect backdrop takes on the card's own colour (style unchanged)
    // SHARED-ELEMENT CONTINUITY: open the featured card on the EXACT bytes the
    // wheel card is already painting, so frame 1 of the morph is pixel-identical
    // (no decode flash, no blur-up). Then sharpen on the SAME element with NO
    // opacity fade — it's the same picture at higher resolution.
    const wheelImg = els[view[i]].img;
    const liveSrc = wheelImg && (wheelImg.currentSrc || wheelImg.src);
    if (card.sealed) {
      zoomImg.src = card.image; // local transparent product render
    } else {
      // open on the wheel's live bytes; if the wheel never resolved this card
      // (deep-link straight to inspect) and its primary art is a dead asset,
      // start on the base-printing fallback rather than a broken full url.
      zoomImg.src = liveSrc || cardImg(card, 'low.webp') || cardImgFallback(card, 'high.webp');
      if (card.imageOk !== false) {
        const webp = new Image();
        webp.onload = () => {
          if (ig !== imgGen) return; // a newer card took over
          zoomImg.src = webp.src; // same picture, higher res — never fade the card
          const png = new Image();
          png.onload = () => { if (ig === imgGen) zoomImg.src = png.src; };
          png.src = cardImg(card, 'high.png');
        };
        // dead primary (e.g. missing TCGplayer pattern scan) -> sharpen to the base art instead
        webp.onerror = () => {
          if (ig !== imgGen) return;
          const fb = cardImgFallback(card, 'high.webp');
          if (fb) zoomImg.src = fb;
        };
        webp.src = cardImg(card, 'high.webp');
      }
    }
    // EN↔JA printing toggle (P). VERIFIED: tcgdex ja is a separate Japanese
    // catalogue (M2/M2a/... own ids + card lists), NOT a locale mirror — a
    // path swap 404s for every international card. The button stays dormant
    // until window.JA_MAP (a real per-card EN→JA mapping, future data build)
    // exists, so it can never show the wrong printing.
    zoomLangCard = card;
    const jaSrc = window.JA_MAP && window.JA_MAP[card.id];
    langBtn.hidden = !jaSrc;
    setLangUI(false);
    $('zoomBgArt').src = card.sealed ? card.image : (cardImg(card, 'low.webp') || cardImgFallback(card, 'low.webp'));
    paintZoomScene(card); // editorial title + holo badge + backdrop tint
    updateListButtons(card);
    // share link: a real anchor — click copies, right-click/long-press works too
    $('shareBtn').href =
      `${location.origin}${location.pathname}?set=${encodeURIComponent(DATA.set.id)}&card=${card.num}`;

    // animated backdrop: loads only for mapped hero cards, never under reduced motion
    const vid = $('zoomVideo');
    vid.pause();
    vid.removeAttribute('src');
    vid.load();
    const vsrc = VIDEO_BG[card.id];
    if (vsrc && !REDUCED) {
      vid.src = vsrc;
      vid.currentTime = 0;
    }

    resetMag();

    // --- editorial data column: hero price, quick stats, graph, table, credit
    const zPrice = $('zPrice'), zQuick = $('zQuick'), zCredit = $('zCredit');
    zPrice.replaceChildren(); zQuick.replaceChildren(); zCredit.replaceChildren();
    const amt = document.createElement('div'); amt.className = 'amt';
    const lbl = document.createElement('div'); lbl.className = 'lbl'; // the variant (e.g. Holofoil)
    const src = document.createElement('div'); src.className = 'src'; // where it's from (subtle)
    zPrice.append(amt, lbl, src);

    if (card.sealed) {
      const m = card.sealedMeta;
      amt.textContent = m.marketUsd != null ? money(m.marketUsd) : 'Tracking';
      amt.classList.toggle('none', m.marketUsd == null);
      lbl.textContent = 'Sealed product';
      src.textContent = m.marketUsd != null ? `${m.source} · ${m.checked}` : 'price not yet sourced';
      $('zCharts').replaceChildren();
      $('zTable').replaceChildren();
      $('moreCardsBtn').hidden = true; // sealed products have no "other cards"
      buildPulls(card, null);
    } else {
      const usd = typeof card.priceUsd === 'number' ? card.priceUsd
        : (card.cardmarket?.trend != null ? eurToUsd(card.cardmarket.trend) : null);
      amt.textContent = usd != null ? money(usd) : '—';
      amt.classList.toggle('none', usd == null);
      // clear variant label (Holofoil / Normal / Reverse holo) + subtle source —
      // spaced away from the price by CSS so it never reads as stuffed
      lbl.textContent = typeof card.priceUsd === 'number'
        ? (VARIANT_LABEL[card.priceVariant] ?? card.priceVariant)
        : (card.cardmarket?.trend != null ? 'Cardmarket trend' : 'Unpriced');
      // foil variants read as the foil itself — iridescent label treatment
      lbl.classList.toggle('holo',
        typeof card.priceUsd === 'number' &&
        (card.priceVariant === 'holofoil' || card.priceVariant === 'reverse-holofoil'));
      src.textContent = typeof card.priceUsd === 'number'
        ? `${card.fullImg ? (DATA.source || 'market') : 'TCGplayer'} · market price`
        : (card.cardmarket?.trend != null ? 'converted from EUR' : '');
      if (card.fullImg) {
        // external games (Magic/Lorcana): show their OWN data; skip Pokemon-only bits
        $('zCharts').replaceChildren();
        $('zTable').replaceChildren();
        $('moreCardsBtn').hidden = true;
        buildPulls(card, null); // no Pokemon pull ladder for external games — hide it
      } else {
        // the one trend line: how the card moved over the last 30 days (Cardmarket averages)
        const cm = card.cardmarket;
        if (cm && typeof cm.avg30 === 'number' && typeof cm.avg1 === 'number' && cm.avg30 > 0) {
          const d = (cm.avg1 - cm.avg30) / cm.avg30 * 100;
          const t = document.createElement('p'); t.className = 'z-trend';
          const b = document.createElement('b'); b.className = d >= 0 ? 'up' : 'down';
          b.textContent = `${d >= 0 ? 'Up' : 'Down'} ${Math.abs(d).toFixed(1)}%`;
          t.append(b, ' over the last 30 days');
          zQuick.appendChild(t);
        }
        $('zCharts').replaceChildren();
        $('zTable').replaceChildren();
        buildPulls(card, null);
        buildFamily(card);
      }

    }

    // Holo intensity by rarity
    const r = (card.rarity || '').toLowerCase();
    $('cardFaces').dataset.foil = (/holo|foil|rare|illustration|secret|hyper|ultra|enchanted|legendary|mythic|iconic|epic|super|special|treasure/.test(r) || /holo/.test(card.priceVariant || '')) ? '1' : '0';
    const k = REDUCED ? 0 :
      /hyper|special illustration/.test(r) ? 1 :
      /illustration|ultra|mega/.test(r) ? 0.75 :
      /holo|rare/.test(r) ? 0.45 : 0.22;
    shine.style.setProperty('--shine-k', String(k));
    tiltCard.style.transform = '';
    resetFaces(); // always present face-front on a fresh open / card switch

    // Aristide-style SHARED-ELEMENT MORPH: the featured card flies + grows out of
    // the wheel slot, transform-only — it never fades. Only the backdrop fades.
    // Data blocks settle in after the card lands. (Timings pinned in layout-constants.js)
    // Done SYNCHRONOUSLY after showModal (the dialog is laid out by then), so the
    // animation's first painted frame is already the wheel slot — no rAF gap to
    // flash through and no occluded-tab throttle to stall on.
    if (!wasOpen) { zoom.showModal(); zoomClose.focus(); }
    // once the inspect backdrop has fully faded in, the page under it stops
    // drawing (body.zoom-open): nothing composites behind an opaque inspect
    clearTimeout(zoomCoverT);
    zoomCoverT = setTimeout(() => { if (zoom.open && !zoomClosing) document.body.classList.add('zoom-open'); }, REDUCED ? 0 : L.BACKDROP_FADE_DURATION + 80);
    if (!REDUCED) {
      const gen = ++openGen;
      const dst = tiltCard.getBoundingClientRect(); // forces layout — valid now
      const panel = $('zoomPanel');
      if (dst.width && wasOpen) {
        // in-place switch to another card of the same Pokémon: a quick scale settle.
        // transform-only — the card never fades (the image just swaps underneath)
        reg(tiltCard.animate(
          [{ transform: 'scale(0.965)' }, { transform: 'none' }],
          { duration: 320, easing: L.EASE_PREMIUM }));
        [...panel.children].forEach((el, idx) => reg(el.animate(
          [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }],
          { duration: 320, delay: idx * 34, easing: L.EASE_PREMIUM, fill: 'backwards' })));
      } else if (dst.width) {
        const dx = (flipSrc.left + flipSrc.width / 2) - (dst.left + dst.width / 2);
        const dy = (flipSrc.top + flipSrc.height / 2) - (dst.top + dst.height / 2);
        const s = flipSrc.width / dst.width;
        const from = `translate(${dx}px, ${dy}px) scale(${s})`;
        // belt-and-suspenders: pin the card at the wheel slot for the very first
        // paint (in case the animation's first sample lands a hair late)
        tiltCard.style.transform = from;
        // transform-only flight — the CARD never fades, only flies + grows
        const morph = reg(tiltCard.animate(
          [{ transform: from }, { transform: 'none' }],
          { duration: L.OPEN_DURATION, easing: L.EASE_PREMIUM }));
        if (zoomReturnEl) zoomReturnEl.style.visibility = 'hidden'; // no double image during the flight
        morph.onfinish = () => {
          tiltCard.style.transform = '';                  // resting state = CSS none (no end-snap)
          if (zoomReturnEl) zoomReturnEl.style.visibility = ''; // cancelled morphs never fire this, so unconditional is safe
        };
        // insurance: if the tab is occluded mid-flight the onfinish can stall —
        // the wheel card must never stay hidden past the open while inspect shows
        setTimeout(() => {
          if (zoom.open && zoomReturnEl && zoomReturnEl.style.visibility === 'hidden') zoomReturnEl.style.visibility = '';
        }, L.OPEN_DURATION + 140);
        // data settles in AFTER the card lands — slide+fade (data may move; the card may not)
        [...panel.children].forEach((el, idx) => reg(el.animate(
          [{ opacity: 0, transform: `translateY(${L.STAGGER_TRANSLATE_Y}px)` }, { opacity: 1, transform: 'none' }],
          { duration: L.STAGGER_CHILD_DURATION, delay: L.STAGGER_BASE_DELAY + idx * L.STAGGER_STEP, easing: L.EASE_PREMIUM, fill: 'backwards' })));
        // the backdrop is the ONLY layer that fades on open
        reg(document.querySelector('.zoom-bg').animate(
          [{ opacity: 0 }, { opacity: 1 }], { duration: L.BACKDROP_FADE_DURATION, easing: 'ease-out' }));
      }
      // the animation backdrop breathes in only once playback truly starts; play
      // attempts retry as the buffer fills — if autoplay never succeeds, static stays
      if (vid.src) {
        vid.addEventListener('playing', () => {
          if (gen !== openGen) return;
          reg(vid.animate([{ opacity: 0 }, { opacity: 1 }],
            { duration: 1400, delay: 200, easing: 'ease-in-out', fill: 'forwards' }));
        }, { once: true });
        const tryPlay = () => { if (gen === openGen && vid.paused) vid.play().catch(() => {}); };
        tryPlay();
        vid.addEventListener('canplaythrough', tryPlay, { once: true });
        setTimeout(tryPlay, 1200);
        setTimeout(tryPlay, 3000);
      }
    }
  }

  let zoomClosing = false, zoomCoverT = 0;
  const uncoverPage = () => { clearTimeout(zoomCoverT); document.body.classList.remove('zoom-open'); };
  function closeZoom() {
    uncoverPage();   // the wheel shows again under the fading backdrop as the card flies home
    cardFaces.classList.remove('lit'); $('lightBtn').setAttribute('aria-pressed', 'false'); // light off on close
    if (zoomReturnEl) zoomReturnEl.style.visibility = ''; // any close path re-shows the wheel card
    // no card to fly back to (closed before any open) → just close, don't deref null
    if (REDUCED || !zoomReturnEl) { zoomClosing = false; zoom.close(); return; }
    if (zoomClosing) return;
    zoomClosing = true;
    openGen++;            // invalidate any pending open choreography
    cancelZoomAnims();    // stop in-flight reveal before the exit starts
    resetMag();
    tiltCard.style.transform = ''; // reset pointer tilt so fly-back never starts skewed
    const src = zoomReturnEl.getBoundingClientRect();
    const dst = tiltCard.getBoundingClientRect();
    const dx = (src.left + src.width / 2) - (dst.left + dst.width / 2);
    const dy = (src.top + src.height / 2) - (dst.top + dst.height / 2);
    const s = dst.width ? src.width / dst.width : 0.3;
    // re-hide the wheel card so the reverse morph lands on a clean slot (no double
    // image); reveal it the instant the morphing card arrives back in the slot
    if (zoomReturnEl) zoomReturnEl.style.visibility = 'hidden';
    // transform-only reverse morph — the card shrinks back into the slot, never fades
    const anim = reg(tiltCard.animate(
      [{ transform: 'none' }, { transform: `translate(${dx}px, ${dy}px) scale(${s})` }],
      { duration: L.CLOSE_DURATION, easing: L.EASE_PREMIUM }));
    const panel = $('zoomPanel');
    // panel + backdrop + title fade out (these are NOT the card — fading is fine)
    reg(panel.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 240, easing: 'ease-out', fill: 'forwards' }));
    reg(document.querySelector('.zoom-bg').animate([{ opacity: 1 }, { opacity: 0 }], { duration: 320, fill: 'forwards' }));
    reg(zTitle.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: 'ease-out', fill: 'forwards' }));
    anim.onfinish = () => {
      if (zoomReturnEl) zoomReturnEl.style.visibility = ''; // wheel card reappears as the inspect card lands
      tiltCard.style.transform = '';
      zoomClosing = false;
      zoom.close();
    };
    // insurance: WAAPI freezes in occluded tabs — never leave the dialog (or the
    // hidden wheel card) stuck
    setTimeout(() => {
      if (zoomClosing) { if (zoomReturnEl) zoomReturnEl.style.visibility = ''; zoomClosing = false; zoom.close(); }
    }, L.CLOSE_INSURANCE_TIMEOUT);
  }

  zoom.addEventListener('close', () => {
    uncoverPage();
    zoomClosing = false;
    tiltCard.style.transform = '';
    tiltCard.style.visibility = '';                       // never leave the featured card hidden
    if (zoomReturnEl) zoomReturnEl.style.visibility = ''; // any close path (Esc/backdrop) re-shows the wheel card
    resetFaces();
    resetZoomScene();
    cancelZoomAnims(); // drop filled exit animations so the next open starts clean
    const vid = $('zoomVideo');
    vid.pause();
    vid.removeAttribute('src');
    vid.load();
    // the close paths clear the source card's inline visibility, which falls back
    // to the stylesheet's hidden .card: re-render so the focused card is back
    // (it used to stay invisible after every inspect)
    render(true);
    zoomReturnEl?.focus();
  });
  // (the high-res quality ladder lives in openZoomFor's preloader; the visible
  // img only ever receives URLs that already decoded, so it can't error-flash)
  zoom.addEventListener('cancel', (e) => { e.preventDefault(); closeZoom(); });
  zoomClose.addEventListener('click', closeZoom);
  $('zoomBack').addEventListener('click', closeZoom);
  // .zoom-body fills the dialog, so empty-area clicks land on it, never on the dialog itself
  zoom.addEventListener('click', (e) => {
    if (e.target === zoom || e.target.classList?.contains('zoom-body')) closeZoom();
  });
  zoom.addEventListener('pointermove', applyParallax); // aristide depth parallax

  // Loupe: click the card to magnify; pointer pans the magnified scan.
  const MAG = 2.2;
  let magOn = false;
  function magTransform(fx, fy) {
    const k = (1 - 1 / MAG) * 100;
    zoomImg.style.transform =
      `scale(${MAG}) translate(${(-Math.max(0, Math.min(1, fx)) * k).toFixed(2)}%, ${(-Math.max(0, Math.min(1, fy)) * k).toFixed(2)}%)`;
  }
  function resetMag() {
    magOn = false;
    tiltCard.classList.remove('mag');
    zoomImg.style.transform = '';
  }
  function pointerFrac(e) {
    const r = tiltCard.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
  }
  // Hold-and-drag to spin the card fully around its Y axis (shows the printed
  // back); release springs it back to face-front. A plain click (no drag) still
  // toggles the loupe. Rotation lives on .card-faces; tilt lives on .tilt-card.
  let holdPointer = null, rotateStartX = 0, rotating = false, suppressClick = false;
  function resetFaces() {
    rotating = false;
    tiltCard.classList.remove('rotating');
    cardFaces.style.transition = 'none';
    cardFaces.style.transform = '';
  }
  tiltZone.addEventListener('pointerdown', (e) => {
    if (magOn) return; // in loupe mode a click pans/exits; no spin
    holdPointer = e.pointerId;
    rotateStartX = e.clientX;
    rotating = false;
    try { tiltZone.setPointerCapture(e.pointerId); } catch { /* inactive pointer */ }
  });
  function endHold(e) {
    if (holdPointer !== e.pointerId) return;
    try { tiltZone.releasePointerCapture(e.pointerId); } catch { /* already released */ }
    holdPointer = null;
    if (rotating) {
      suppressClick = true; // the drag must not also toggle the loupe
      tiltCard.classList.remove('rotating');
      cardFaces.style.transition = 'transform 620ms cubic-bezier(0.22, 1, 0.36, 1)';
      cardFaces.style.transform = 'rotateY(0deg)'; // spring back to the front
      rotating = false;
    }
  }
  tiltZone.addEventListener('pointerup', endHold);
  tiltZone.addEventListener('pointercancel', endHold);

  tiltZone.addEventListener('click', (e) => {
    if (suppressClick) { suppressClick = false; return; } // ignore the drag's click
    const f = pointerFrac(e);
    if (!f) return;
    const [fx, fy] = f;
    if (fx < 0 || fx > 1 || fy < 0 || fy > 1) return; // outside the card itself
    magOn = !magOn;
    tiltCard.classList.toggle('mag', magOn);
    if (magOn) { tiltCard.style.transform = ''; magTransform(fx, fy); }
    else zoomImg.style.transform = '';
  });

  tiltZone.addEventListener('pointermove', (e) => {
    // hold-drag → spin around Y (full 360 reachable by dragging across)
    if (holdPointer === e.pointerId && !magOn) {
      const dx = e.clientX - rotateStartX;
      if (!rotating && Math.abs(dx) > 6) {
        rotating = true;
        tiltCard.classList.add('rotating');
        tiltCard.style.transform = '';      // drop pointer-tilt while spinning
        cardFaces.style.transition = 'none';
        shine.style.setProperty('--shine-k', '0');
      }
      if (rotating) {
        cardFaces.style.transform = `rotateY(${(dx * 0.7).toFixed(1)}deg)`;
        return;
      }
    }
    const f = pointerFrac(e);
    if (!f) return;
    const [fx, fy] = f;
    if (magOn) { magTransform(fx, fy); return; }
    if (REDUCED) return;
    const tiltK = cardFaces.classList.contains('lit') ? 20 : 14;   // under the lamp the card turns further toward it
    const rx = (0.5 - fy) * tiltK, ry = (fx - 0.5) * tiltK;
    tiltCard.style.transform = `rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
    cardFaces.style.setProperty('--lx', fx.toFixed(3));
    cardFaces.style.setProperty('--ly', fy.toFixed(3));
    shine.style.setProperty('--mx', `${(fx * 100).toFixed(1)}%`);
    shine.style.setProperty('--my', `${(fy * 100).toFixed(1)}%`);
  });
  tiltZone.addEventListener('pointerleave', () => { if (!magOn && !rotating) tiltCard.style.transform = ''; });

  // --- Idle prefetch: warm high.webp so the wheel stays crisp anywhere, WITHOUT a
  // boot-time request storm. The old version fired the WHOLE set (3 chains over
  // every card) ~1.5s after load — on a merged 300+ card set that's 300 image
  // requests at once, saturating the connection and stalling the on-screen cards'
  // own high-res upgrades. Instead we warm cards in PROXIMITY order around the
  // current position, one request at a time, on requestIdleCallback — near cards
  // first, only as the browser is idle, and re-centred whenever the user moves.
  // The visible window (±10) is already eager-loaded by render()/wantImage.
  const ric = window.requestIdleCallback || ((fn) => setTimeout(() => fn({ timeRemaining: () => 8 }), 200));
  const PF_RADIUS = 60;        // warm up to ±60 cards out from where the user is sitting
  let pfScheduled = false;
  // urls already requested (cache warm), so a set opened again, or another set that
  // shares an index, never blocks or repeats the warm-up
  const pfDone = new Set();
  // pfDone tracks PREFETCH progress only; els[].loaded stays the visible-img state.
  // first the whole set's small scans, nearest first (a dial scrub can drop the wheel
  // anywhere, and those cards must land on art), then high.webp within the radius
  function pfPick() {
    const c = Math.max(0, Math.min(N - 1, Math.round(position)));
    const thumb = (i) => { if (i < 0 || i >= N || !els[i] || els[i].loaded) return ''; const u = thumbImg(CARDS[i]); return u && !pfDone.has(u) ? u : ''; };
    for (let d = 0; d < N; d++) {
      const u = thumb(c + d) || (d ? thumb(c - d) : '');
      if (u) return u;
    }
    const high = (i) => {
      if (i < 0 || i >= N || !els[i] || CARDS[i].imageOk === false) return '';
      const l = els[i].loaded; if (l === 'high' || l === 'full' || l === 'fallback') return '';
      const u = cardImg(CARDS[i], 'high.webp'); return u && !pfDone.has(u) ? u : '';
    };
    for (let d = 0; d <= PF_RADIUS; d++) {
      const u = high(c + d) || (d ? high(c - d) : '');
      if (u) return u;
    }
    return '';
  }
  function pfStep(deadline) {
    pfScheduled = false;
    let budget = 3; // a few per idle slice, then yield
    while (budget-- > 0 && (!deadline || deadline.timeRemaining() > 2)) {
      const url = pfPick();
      if (!url) return;           // nothing left near the user — wait for them to move
      pfDone.add(url);            // mark issued so we never re-pick (cache, not visible state)
      const im = new Image();
      im.decoding = 'async';
      im.onload = im.onerror = () => schedulePrefetch(); // chain the next on completion
      im.src = url;
    }
    schedulePrefetch();
  }
  function schedulePrefetch() {
    if (pfScheduled) return;
    pfScheduled = true;
    ric(pfStep);
  }
  // expose the trigger loadSet() already calls via `pfNext = 0` (kept for compatibility);
  // re-centre + resume warming whenever a set loads or the wheel settles on a new card.
  let pfNext = 0; // legacy flag loadSet() pokes; we re-arm prefetch on it
  setTimeout(schedulePrefetch, 1200);

  // ======================================================================
  // SET BROWSER: the way into every set (replaces THE INDEX, 27 Oct 2026).
  // Follows the references named in docs/design/direction.md ("Set page"):
  // Scryfall's set listing + slim set header (logo, card count, release date,
  // total value), Pokedesk's set row (the real set logo beside its total value)
  // and the Wizards Hobbit gallery (grouped browse under heavy headings). The game
  // switch is the four real game logos, each optically sized (G13). Every number
  // is computed from the same card data the wheel shows; what we don't have is
  // left out, never estimated (G7).
  // ======================================================================
  const homeEl = $('home'), homeScroll = $('homeScroll');
  // h = the logo's display height at 2560, set per logo by eye so the four read
  // at the same visual weight (Pokémon is dense, One Piece is a wide two-liner)
  const HOME_GAMES = [
    { game: 'pokemon', name: 'Pokémon', short: 'Pokémon', logo: 'assets/logos/pokemon.png', h: 58 },
    { game: 'magic', name: 'Magic: The Gathering', short: 'Magic', logo: 'assets/logos/magic.png', h: 70 },
    { game: 'lorcana', name: 'Disney Lorcana', short: 'Lorcana', logo: 'assets/logos/lorcana.png', h: 66 },
    { game: 'onepiece', name: 'One Piece', short: 'One Piece', logo: 'assets/logos/onepiece.png', h: 46 },
  ];
  const gameOf = (id) => (id.startsWith('lor-') ? 'lorcana' : id.startsWith('op-') ? 'onepiece' : id.startsWith('mtg-') ? 'magic' : 'pokemon');
  const GAME_SHORT = Object.fromEntries(HOME_GAMES.map((g) => [g.game, g.short]));
  // where each game's prices come from (shown once, in the browser's subtitle)
  const GAME_SOURCE = { pokemon: 'TCGplayer', magic: 'Scryfall', lorcana: 'Lorcast', onepiece: 'dotgg' };

  function setsForGame(game) {
    if (game === 'pokemon') {
      const bundled = SET_GROUPS.flatMap((grp) => grp.ids.filter((id) => SETS[id]).map((id) => ({ id, name: SETS[id].set.name, count: SETS[id].set.total })));
      const known = new Set(bundled.map((s) => s.id));
      // auto-discovered sets (tcgdex) join automatically — the next set drops in by itself
      const fresh = NEW_SETS.filter((s) => !known.has(s.id) && !SETS[s.id])
        .map((s) => ({ id: s.id, name: s.name, count: s.count, logo: s.logo || '', fresh: true }));
      return [...fresh, ...bundled];
    }
    const g = GAME_SETS.find((x) => x.game === game);
    return g ? g.sets.map((s) => ({ id: s.id, name: s.name, code: s.code })) : [];
  }

  // --- Auto set discovery: when tcgdex publishes a new Pokémon set (the next
  // "Pitch Black"), it appears in the browser automatically — no data work, no
  // redeploy. We scan the two NEWEST series (new mainline sets always land
  // there), diff against what we bundle, and cache the result for 12h.
  let NEW_SETS = [];
  async function discoverSets() {
    const KEY = 'pokex.freshSets4';   // v4: keeps each set's tcgdex logo path for the set browser tile
    // filler sets that clutter the shelf: no logos on tcgdex, few/no card
    // images, not what anyone opens the tracker for
    const FILLER = /energy|first battle|trainer kit|deck/i;
    try {
      const c = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (c && Date.now() - c.at < 12 * 3600e3) { NEW_SETS = c.sets; return; }
    } catch { /* cold cache */ }
    try {
      const rs = await fetch('https://api.tcgdex.net/v2/en/series');
      if (!rs.ok) return;
      const series = (await rs.json()).filter((s) => s.id !== 'tcgp');   // physical TCG only
      const found = [];
      for (const sid of series.slice(-2).map((s) => s.id)) {
        const r = await fetch(`https://api.tcgdex.net/v2/en/series/${sid}`);
        if (!r.ok) continue;
        const d = await r.json();
        (d.sets || []).forEach((s) => {
          const count = (s.cardCount && (s.cardCount.official || s.cardCount.total)) || 0;
          if (count > 0 && !FILLER.test(s.name)) found.push({ id: s.id, name: s.name, count, logo: s.logo || '' });
        });
      }
      NEW_SETS = found.reverse();   // newest first
      try { localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), sets: NEW_SETS })); } catch { /* storage full */ }
      if (!homeEl.hidden && sbGame === 'pokemon') renderBrowser('pokemon', true);   // drop the new tiles in
    } catch { /* offline — the browser shows the bundled sets only */ }
  }

  // ---- formatting ----
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const money = (v) => '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fmtMonth = (iso) => { const m = /^(\d{4})-(\d{2})/.exec(iso || ''); return m ? `${MONTHS[+m[2] - 1]} ${m[1]}` : ''; };
  const fmtDay = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? `${+m[3]} ${MONTHS[+m[2] - 1]} ${m[1]}` : ''; };
  const yearOf = (iso) => { const m = /^(\d{4})/.exec(iso || ''); return m ? +m[1] : null; };
  const cardName = (c) => splitName(c.name).name;

  // ---- release dates: one request per game to that game's own catalogue
  // (tcgdex / Scryfall / Lorcast), cached for a day. One Piece has no dated feed,
  // so its sets show no date rather than a guessed one. ----
  const RELEASED = {};      // set id → 'YYYY-MM-DD'
  const CAT_COUNT = {};     // set id → printed card count from the catalogue (Magic, before its cards load)
  const relJobs = {};
  const cacheGet = (k, age) => { try { const c = JSON.parse(localStorage.getItem(k) || 'null'); return c && Date.now() - c.at < age ? c.v : null; } catch { return null; } };
  const cachePut = (k, v) => { try { localStorage.setItem(k, JSON.stringify({ at: Date.now(), v })); } catch { /* full */ } };
  function loadReleased(game) {
    if (relJobs[game]) return relJobs[game];
    return (relJobs[game] = (async () => {
      const KEY = 'crowns.catalog.' + game;
      let map = cacheGet(KEY, 864e5);
      if (!map) {
        map = {};
        try {
          if (game === 'pokemon') {
            const r = await fetch('https://api.tcgdex.net/v2/graphql', { method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ query: '{ sets(filters:{}) { id releaseDate } }' }) });
            const j = await r.json();
            for (const s of (j.data && j.data.sets) || []) if (s.releaseDate) map[s.id] = { d: s.releaseDate };
          } else if (game === 'magic') {
            const j = await (await fetch('https://api.scryfall.com/sets')).json();
            const want = new Set(GAME_SETS.find((g) => g.game === 'magic').sets.map((s) => s.code));
            for (const s of j.data || []) if (want.has(s.code)) map['mtg-' + s.code] = { d: s.released_at, n: s.card_count };
          } else if (game === 'lorcana') {
            const j = await (await fetch('https://api.lorcast.com/v0/sets')).json();
            for (const s of j.results || []) map['lor-' + s.code] = { d: s.released_at };
          }
          if (Object.keys(map).length) cachePut(KEY, map);
        } catch { /* offline: no dates, nothing invented */ }
      }
      for (const [id, v] of Object.entries(map)) { if (v.d) RELEASED[id] = v.d; if (v.n) CAT_COUNT[id] = v.n; }
      return map;
    })());
  }

  // ---- per-set numbers, from the same card list the wheel shows ----
  // ORIG_CARDS holds each bundled set's own numbered cards, captured at boot
  // before mergeFullSet folds in TCGplayer's pattern reprints, so the tile, the
  // set header and the count never shift while you browse.
  const statCache = {};
  // live-API sets (Magic, Lorcana, One Piece) keep their tile numbers for 12 h, so a
  // return visit paints instantly and doesn't re-download every set from the APIs
  const STAT_TTL = 12 * 3600e3;
  const statKey = (id) => 'crowns.stats.' + id;
  function storeStats(id, st) {
    if (!st || !st.count) return;
    cachePut(statKey(id), { count: st.count, priced: st.priced, value: st.value,
      top: st.top.map((c) => ({ id: c.id, name: c.name, num: c.num, localId: c.localId, priceUsd: c.priceUsd, image: c.image, fullImg: c.fullImg })) });
  }
  function setStats(id) {
    if (statCache[id]) return statCache[id];
    const src = ORIG_CARDS[id] || (SETS[id] && SETS[id].cards);
    if (!src || !src.length) {
      const c = gameOf(id) !== 'pokemon' ? cacheGet(statKey(id), STAT_TTL) : null;
      return c && c.count && Array.isArray(c.top) ? (statCache[id] = { ...c, cached: true }) : null;
    }
    let value = 0, priced = 0, count = 0;
    const ranked = [];
    for (const c of src) {
      if (c.sealed) continue;
      count++;
      if (typeof c.priceUsd === 'number' && c.priceUsd > 0) { value += c.priceUsd; priced++; ranked.push(c); }
    }
    ranked.sort((a, b) => b.priceUsd - a.priceUsd);
    return (statCache[id] = { count, priced, value, top: ranked.slice(0, 3) });
  }
  // a small, fast image of a card for tiles and the grid (never the 1 MB scan)
  const cardThumb = (card) => {
    if (!card) return '';
    if (card.sealed) return card.image;
    if (!card.fullImg) return cardImg(card, 'low.webp');
    const u = cardImg(card, 'high.webp');
    if (u.indexOf('cards.scryfall.io/large/') !== -1) return u.replace('/large/', '/normal/');
    if (u.indexOf('cards.lorcast.io/') !== -1) return u.replace('/large/', '/normal/');
    return u;
  };
  // the set's own mark for a tile: local official logo → tcgdex logo (webp, a
  // fifth of the png) → Scryfall set symbol. Never the game logo: a tile with no
  // set mark shows its real top cards instead.
  function tileMarks(game, s) {
    const out = [];
    if (SET_LOGO_OVERRIDE[s.id] && SET_LOGO_OVERRIDE[s.id].indexOf('tcgplayer-cdn') === -1) out.push(SET_LOGO_OVERRIDE[s.id]);
    if (game === 'pokemon') {
      // the set's own tcgdex logo path (series/id, from the data: deriving it from
      // the id breaks for promos), webp first; promos tcgdex has no logo for stay
      // unrequested, so no 404s land in the console
      const base = (SETS[s.id] && SETS[s.id].set.logo) || s.logo || '';
      if (base && !NO_TCGDEX_LOGO.has(s.id) && safeImg(base + '.png')) { out.push(base + '.webp'); out.push(base + '.png'); }
    } else if (game === 'magic' && s.code) out.push(safeImg(`https://svgs.scryfall.io/sets/${s.code}.svg`));
    return [...new Set(out.filter(Boolean))];
  }
  const NO_TCGDEX_LOGO = new Set(['30th', '30th-c', 'sv05', 'svp', 'basep']);   // verified 404 on tcgdex (27 Oct)
  // official marks drawn for light packaging (dark red / grey type): they sit on a
  // pale label plate, like a slab label, instead of vanishing into the navy
  const LIGHT_PLATE = new Set(['op-OP16', 'op-OP17']);
  // per-set colour for the tile's art wash: the set logo's own colours (G12)
  const setWash = (id, game) => ((AMBIENCE_OVERRIDE[id] || (window.SET_COLORS || {})[id] || UNIVERSE_AMB[game] || ['#3b62b8'])[0]);

  // ---- external games' numbers load lazily (their cards come from live APIs),
  // one set at a time, visible tiles first; the cards are kept, so opening that
  // set afterwards is instant ----
  const statQueue = [], statPending = new Set();
  let statBusy = false;
  function wantStats(id) {
    if (statCache[id] || statPending.has(id) || SETS[id] && setStats(id)) return;
    statPending.add(id); statQueue.push(id); pumpStats();
  }
  async function pumpStats() {
    if (statBusy) return;
    statBusy = true;
    while (statQueue.length) {
      const id = statQueue.shift();
      if (gameOf(id) !== sbGame && !homeEl.hidden) { statPending.delete(id); continue; }   // the user switched games
      sfSlow = true;
      const ok = await ensureExternalSet(id);
      sfSlow = false;
      statPending.delete(id);
      if (!ok) { const t = homeScroll.querySelector(`[data-set="${CSS.escape(id)}"]`); if (t) t.classList.add('no-data'); continue; }
      delete statCache[id];
      storeStats(id, setStats(id));
      fillTile(id);
    }
    statBusy = false;
  }

  // ---- markup ----
  const imgChain = (cls, marks, alt) => marks.length
    ? `<img class="${cls}" src="${esc(marks[0])}" data-chain="${esc(JSON.stringify(marks.slice(1)))}" alt="${esc(alt)}" decoding="async">` : '';
  // a tile says one short thing under its mark: when the set came out and what it
  // is worth (Faisal, 27 Oct: no cards and stacked subtext when picking a set).
  // The full figures live on the set page.
  const money0 = (v) => '$' + Math.round(v).toLocaleString('en-US');
  // a set that borrows its parent's wordmark (30th Classic Collection) names itself in its line
  const borrowsMark = (id) => !!SET_LOGO_OVERRIDE[id] && Object.keys(SET_LOGO_OVERRIDE).some((k) => k !== id && SET_LOGO_OVERRIDE[k] === SET_LOGO_OVERRIDE[id]) && !/^30th$/.test(id);
  function tileLine(id, fresh) {
    const parts = [];
    if (borrowsMark(id) && SETS[id]) parts.push(SETS[id].set.name);
    else if (RELEASED[id]) parts.push(fmtMonth(RELEASED[id]));
    const st = fresh ? null : setStats(id);
    if (st && st.priced) parts.push(money0(st.value));
    return parts.join(' · ') || ' ';
  }
  function tileHTML(game, s) {
    const marks = tileMarks(game, s);
    // a wordmark carries the name; a bare set symbol (Scryfall) does not, so the name is set under it
    const sym = marks.length && marks[0].indexOf('svgs.scryfall') !== -1;
    const mark = !marks.length ? `<span class="sbt-mark sbt-name">${esc(s.name)}</span>`
      : imgChain('sbt-logo' + (sym ? ' sym' : '') + (LIGHT_PLATE.has(s.id) ? ' on-light' : ''), marks, s.name)
        + (sym ? `<span class="sbt-mark sbt-name with-sym">${esc(s.name)}</span>` : `<span class="sbt-name sr-only">${esc(s.name)}</span>`);
    return `<a class="sbt${marks.length ? '' : ' nologo'}" href="app.html?set=${encodeURIComponent(s.id)}" data-set="${esc(s.id)}" data-game="${game}" style="--wash:${setWash(s.id, game)}">`
      + `<span class="sbt-art">${mark}</span><span class="sbt-line">${esc(tileLine(s.id, s.fresh))}</span></a>`;
  }
  // repaint a tile's line once its prices or release date arrive
  function fillTile(id) {
    const el = homeScroll.querySelector(`.sbt[data-set="${CSS.escape(id)}"]`);
    if (!el) return;
    if (!setStats(id) && gameOf(id) === 'pokemon') return;   // a just-discovered set keeps its date line
    el.querySelector('.sbt-line').textContent = tileLine(id);
  }

  // ---- grouping: Pokémon by era (its series), the others by release year ----
  function groupsFor(game) {
    const sets = setsForGame(game);
    if (game === 'pokemon') {
      const FEATURED = new Set(['30th', '30th-c', 'fpic1', 'fpic2', 'fpic3']);
      const promo = (s) => /promo|partner pack/i.test(s.name) && !/illustration/i.test(s.name);
      const groups = [];
      const anniversary = ['30th', '30th-c', 'fpic3', 'fpic2', 'fpic1'].filter((id) => SETS[id]).map((id) => sets.find((s) => s.id === id)).filter(Boolean);
      if (anniversary.length) groups.push({ title: '30th anniversary', sets: anniversary });
      const fresh = sets.filter((s) => s.fresh && !promo(s));
      if (fresh.length) groups.push({ title: 'Just released', sets: fresh });
      for (const g of SET_GROUPS) {
        if (g.series === 'Promos') continue;
        const list = g.ids.filter((id) => SETS[id] && !FEATURED.has(id)).map((id) => sets.find((s) => s.id === id)).filter(Boolean);
        if (list.length) groups.push({ title: g.series, sets: list });
      }
      const promos = [...sets.filter((s) => s.fresh && promo(s)), ...(SET_GROUPS.find((g) => g.series === 'Promos') || { ids: [] }).ids.filter((id) => SETS[id]).map((id) => sets.find((s) => s.id === id)).filter(Boolean)];
      if (promos.length) groups.push({ title: 'Black Star Promos', sets: promos });
      return groups;
    }
    const years = new Map(), undated = [];
    for (const s of sets) { const y = yearOf(RELEASED[s.id]); if (y) { if (!years.has(y)) years.set(y, []); years.get(y).push(s); } else undated.push(s); }
    if (!years.size) return [{ title: game === 'onepiece' ? 'Booster sets' : 'Sets', sets }];
    const out = [...years.entries()].sort((a, b) => b[0] - a[0]).map(([y, list]) => ({ title: String(y), sets: list.sort((a, b) => (RELEASED[b.id] || '').localeCompare(RELEASED[a.id] || '')), year: true }));
    if (undated.length) out.push({ title: 'More sets', sets: undated });
    return out;
  }
  function groupMeta(gr) {
    const ys = gr.sets.map((s) => yearOf(RELEASED[s.id])).filter(Boolean);
    const span = !gr.year && ys.length ? (Math.min(...ys) === Math.max(...ys) ? String(ys[0]) : `${Math.min(...ys)}–${Math.max(...ys)}`) : '';
    return [span, `${gr.sets.length} ${gr.sets.length === 1 ? 'set' : 'sets'}`].filter(Boolean).join(' · ');
  }

  // ---- build + switch ----
  let homeBuilt = false, sbGame = 'pokemon', sbObserver = null;
  function buildHome() {
    if (homeBuilt) return; homeBuilt = true;
    homeScroll.innerHTML = `<div class="sb" id="sb">
        <nav class="sb-games" id="sbGames" role="tablist" aria-label="Choose a game">
          ${HOME_GAMES.map((g) => `<button type="button" role="tab" class="sb-game" data-game="${g.game}" aria-selected="false" style="--lh:${g.h}px"><img src="${g.logo}" alt="${esc(g.name)}" draggable="false"></button>`).join('')}
        </nav>
        <header class="sb-head">
          <div class="sb-titles"><h1 class="sb-title" id="sbTitle"></h1><p class="sb-sub" id="sbSub"></p></div>
          <label class="sb-find"><span class="sr-only">Find a set</span><input id="sbFind" type="search" placeholder="Find a set" autocomplete="off"></label>
        </header>
        <div class="sb-body" id="sbBody"></div>
      </div>`;
    $('sbGames').addEventListener('click', (e) => {
      const b = e.target.closest('.sb-game'); if (!b || b.dataset.game === sbGame) return;
      renderBrowser(b.dataset.game);
      try { history.replaceState(history.state, '', 'app.html?game=' + b.dataset.game); } catch { /* file:// */ }
    });
    $('sbFind').addEventListener('input', applyFind);
    // tiles and featured cards are real links; a plain click opens the set in place
    homeScroll.addEventListener('click', (e) => {
      const a = e.target.closest('a[data-set]');
      if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
      e.preventDefault();
      enterSet(gameOf(a.dataset.set), a.dataset.set, { from: a, cardId: a.dataset.card || null });
    });
    // per-logo optical sizing (G13): CSS gives every set mark the same visual
    // area from its real aspect ratio, so wide wordmarks and tall badges match
    homeScroll.addEventListener('load', (e) => {
      const img = e.target;
      if (!(img instanceof HTMLImageElement) || !img.classList.contains('sbt-logo') || !img.naturalHeight) return;
      img.style.setProperty('--ar', (img.naturalWidth / img.naturalHeight).toFixed(3));
    }, true);
    // logo fallbacks walk their chain; a tile whose chain runs out shows its cards
    homeScroll.addEventListener('error', (e) => {
      const img = e.target;
      // loads cut off because a set was opened are not dead logos (the browser is
      // repainted fresh when it is shown again): don't walk the chain for them
      if (homeEl.hidden || !(img instanceof HTMLImageElement) || !img.dataset.chain) return;
      let rest = []; try { rest = JSON.parse(img.dataset.chain); } catch { /* none */ }
      if (rest.length) { img.dataset.chain = JSON.stringify(rest.slice(1)); img.classList.toggle('sym', rest[0].indexOf('svgs.scryfall') !== -1); img.src = rest[0]; return; }
      const tile = img.closest('.sbt');
      const name = tile && tile.querySelector('.sbt-name.sr-only');
      if (name) { name.className = 'sbt-mark sbt-name'; tile.classList.add('nologo'); }
      img.remove();
    }, true);
    // warm a set while the pointer rests on its tile (merge its full printing list
    // and build its wheel cards on idle), so the click that opens it is cheap
    const warmed = new Set();
    homeScroll.addEventListener('pointerover', (e) => {
      const a = e.target.closest && e.target.closest('a[data-set]');
      const id = a && a.dataset.set;
      if (!id || warmed.has(id) || !SETS[id]) return;
      warmed.add(id);
      ric(() => { try { mergeFullSet(id); buildSetDom(id); } catch { /* warmed on click instead */ } });
    });
    if ('IntersectionObserver' in window) {
      sbObserver = new IntersectionObserver((entries) => {
        for (const en of entries) if (en.isIntersecting) { const id = en.target.dataset.set; if (gameOf(id) !== 'pokemon') wantStats(id); sbObserver.unobserve(en.target); }
      }, { root: homeScroll, rootMargin: '300px 0px' });
    }
  }
  function applyFind() {
    const q = ($('sbFind').value || '').trim().toLowerCase();
    homeScroll.classList.toggle('finding', !!q);
    homeScroll.querySelectorAll('.sbt').forEach((t) => { t.hidden = !!q && !t.querySelector('.sbt-name').textContent.toLowerCase().includes(q); });
    homeScroll.querySelectorAll('.sb-group').forEach((g) => { g.hidden = !g.querySelector('.sbt:not([hidden])'); });
    const empty = $('sbEmpty');
    if (empty) empty.hidden = !q || !!homeScroll.querySelector('.sbt:not([hidden])');
  }
  function renderBrowser(game, quiet) {
    buildHome();
    sbGame = game;
    homeScroll.querySelectorAll('.sb-game').forEach((b) => { const on = b.dataset.game === game; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); });
    const meta = HOME_GAMES.find((g) => g.game === game);
    const sets = setsForGame(game);
    $('sbTitle').textContent = `${meta.short} sets`;
    $('sbSub').textContent = `${sets.length} sets · newest first · prices from ${GAME_SOURCE[game]}`;
    $('sbFind').value = '';
    homeScroll.classList.remove('finding');
    const body = $('sbBody');
    const paint = () => {
      const groups = groupsFor(game);
      body.innerHTML = groups.map((gr) => `<section class="sb-group"><h2 class="sb-era"><span class="sb-era-t">${esc(gr.title)}</span><span class="sb-era-m">${esc(groupMeta(gr))}</span></h2>`
          + `<div class="sb-grid">${gr.sets.map((s) => tileHTML(game, s)).join('')}</div></section>`).join('')
        + '<p class="sb-empty" id="sbEmpty" hidden>No set matches that name.</p>';
      // Pokémon numbers are local: paint every tile now. Others load as they scroll in.
      if (game === 'pokemon') body.querySelectorAll('.sbt').forEach((t) => fillTile(t.dataset.set));
      else {
        let missing = false;
        body.querySelectorAll('.sbt').forEach((t) => {
          const id = t.dataset.set;
          if (SETS[id] || setStats(id)) fillTile(id);
          else { missing = true; if (sbObserver) sbObserver.observe(t); else wantStats(id); }
        });
        if (game === 'onepiece' && missing) ensureOnePiece().catch(() => {});   // one bundle feeds every One Piece tile
      }
      if (!quiet && window.gsap && !REDUCED) {
        // arrivals: the visible tiles rise in order, expo-out (direction.md motion)
        const vis = [...body.querySelectorAll('.sb-era, .sbt')].filter((el) => el.getBoundingClientRect().top < innerHeight).slice(0, 26);
        gsap.fromTo(vis, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.6, ease: 'expo.out', stagger: 0.028, clearProps: 'opacity,transform' });
      }
    };
    homeScroll.scrollTop = 0;
    paint();
    // dates arrive from the catalogue: regroup by year (Magic, Lorcana) or just re-label
    loadReleased(game).then(() => {
      if (sbGame !== game || homeEl.hidden) return;
      if (game === 'magic' || game === 'lorcana') { paint(); return; }
      body.querySelectorAll('.sbt').forEach((t) => { const s = sets.find((x) => x.id === t.dataset.set); t.querySelector('.sbt-line').textContent = tileLine(t.dataset.set, s && s.fresh); });
      body.querySelectorAll('.sb-group').forEach((g, i) => { const gr = groupsFor(game)[i]; if (gr) g.querySelector('.sb-era-m').textContent = groupMeta(gr); });
    });
  }

  // ---- open a set from the browser: wait for its cards (external sets fetch),
  // then the browser fades while the wheel sweeps in and the tile's logo flies
  // into the set header (shared-element move, expo-out) ----
  let entering = false;
  async function enterSet(game, setId, opts = {}) {
    if (entering) return;
    entering = true;
    const tile = opts.from || null;
    if (tile) tile.classList.add('opening');
    let ok = true;
    if (game === 'pokemon') {
      if (!SETS[setId]) { const built = buildSetFromIndex(setId); if (built) SETS[setId] = built; else ok = await ensureTcgdexSet(setId); }
    } else ok = await ensureExternalSet(setId);
    if (ok) await preloadLanding(setId, opts.cardId ? 'card' : 'first');
    if (tile) tile.classList.remove('opening');
    if (!ok) { if (tile) tile.classList.add('no-data'); entering = false; return; }
    const fromLogo = tile && tile.querySelector('.sbt-logo');
    const fromRect = fromLogo ? fromLogo.getBoundingClientRect() : null;
    try { history.pushState({ set: setId }, '', 'app.html?set=' + encodeURIComponent(setId)); } catch { /* file:// */ }
    hideHome();
    loadSet(setId);
    if (opts.cardId) {
      const ci = CARDS.findIndex((c) => c.id === opts.cardId);
      if (ci >= 0 && slotOf[ci] != null) { position = target = slotOf[ci]; velocity = 0; mode = 'idle'; current = -1; render(true); if (MOBILE && mcar) mScrollTo(slotOf[ci], false); }
      else landOnFirstCard();
    } else landOnFirstCard();
    if (window.gsap && !REDUCED) {
      gsap.fromTo('#setHead', { opacity: 0 }, { opacity: 1, duration: 0.5, ease: 'power2.out', clearProps: 'opacity' });
      const dst = $('setBtnLogo');
      if (fromRect && dst && !dst.hidden) {
        const fly = () => {
          const r = dst.getBoundingClientRect();
          if (!r.width) return;
          const s = fromRect.width / r.width;
          gsap.fromTo(dst, { x: fromRect.left - r.left + (fromRect.width - r.width) / 2, y: fromRect.top - r.top + (fromRect.height - r.height) / 2, scale: s, transformOrigin: '50% 50%' },
            { x: 0, y: 0, scale: 1, duration: 0.62, ease: 'expo.out', clearProps: 'transform' });
        };
        if (dst.complete && dst.naturalWidth) fly(); else dst.addEventListener('load', fly, { once: true });
      }
    }
    entering = false;
  }
  // drop the wheel on the set's FIRST card (lowest collector number), not the priciest
  function landOnFirstCard() {
    let bestCi = -1, bestNum = Infinity;
    for (let i = 0; i < CARDS.length; i++) {
      const c = CARDS[i]; if (c.sealed) continue;
      const n = typeof c.num === 'number' ? c.num : parseInt(c.localId, 10);
      if (n != null && !isNaN(n) && n < bestNum) { bestNum = n; bestCi = i; }
    }
    if (bestCi < 0 || slotOf[bestCi] == null) return;
    position = target = slotOf[bestCi]; velocity = 0; mode = 'idle'; current = -1; render(true);
    if (MOBILE && mcar) mScrollTo(slotOf[bestCi], false);   // mobile carousel lands on the first card too
  }
  function showHome(game) {
    buildHome();
    const first = homeEl.hidden;
    homeEl.hidden = false;
    document.body.classList.add('home-open');
    if (setMenu && !setMenu.hidden) toggleSetMenu(false);
    if (zoom.open) zoom.close();
    // the browser's light pool is neutral: no single set owns the room
    document.body.style.removeProperty('--app-accent');
    const g = game || (wheelReady && DATA ? gameOf(DATA.set.id) : null) || sbGame || 'pokemon';
    renderBrowser(g, !first);
    if (first && window.gsap && !REDUCED) {
      gsap.fromTo('.sb-game', { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: 0.55, ease: 'expo.out', stagger: 0.06, clearProps: 'opacity,transform' });
      gsap.fromTo('.sb-titles, .sb-find', { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.6, ease: 'expo.out', delay: 0.12, clearProps: 'opacity,transform' });
    }
  }
  function hideHome() {
    homeEl.hidden = true;
    document.body.classList.remove('home-open');
    if (wheelReady && DATA) setAmbience(DATA.set.id);   // the stage returns to the set's colours
  }
  // back / forward between the browser and a set, without reloading
  addEventListener('popstate', () => {
    const q = new URLSearchParams(location.search);
    const id = q.get('set'), g = q.get('game');
    if (id && (SETS[id] || gameSetMeta(id))) {
      if (!homeEl.hidden) hideHome();
      if (!DATA || DATA.set.id !== id || !wheelReady) {
        if (SETS[id]) preloadLanding(id, 'first').then(() => { loadSet(id); landOnFirstCard(); });
        else enterSet(gameOf(id), id);
      }
    } else showHome(HOME_GAMES.some((x) => x.game === g) ? g : null);
  });

  // ========================================================================
  // MOBILE — purpose-built phone view (PWA). The 3D wheel doesn't translate to
  // a small touch screen, so on phones we hide it (CSS) and drive a clean
  // horizontal snap-carousel instead, reusing view[] / setCurrent / cardImg /
  // openZoomFor. The wheel stays in the DOM but never animates here: goTo() is
  // rerouted to scroll the carousel, so search, the keyboard, the scrubber and
  // deep-links keep working. Everything is gated on MOBILE / body.mobile — the
  // desktop wheel is untouched.
  // ------------------------------------------------------------------------
  function mStride() {                        // centre-to-centre distance of one card
    const a = mcar.children[0], b = mcar.children[1];
    return (a && b) ? (b.offsetLeft - a.offsetLeft) : (a ? a.offsetWidth : (mcar.clientWidth || 1));
  }
  function mCenteredSlot() {
    return Math.max(0, Math.min(view.length - 1, Math.round(mcar.scrollLeft / mStride())));
  }
  function mLoadImg(img, card, q) {
    if (card.sealed) { img.dataset.q = 'high'; img.src = card.image; return; }
    if (card.fullImg) {                       // Magic/Lorcana/index — one url, no quality ladder
      img.dataset.q = 'high'; img.src = cardImg(card, 'high.webp');
      img.onerror = () => { if (img.dataset.q === 'fb') return; const fb = cardImgFallback(card, 'high.webp'); if (fb) { img.dataset.q = 'fb'; img.src = fb; } };
      return;
    }
    if (q === 'high') {                       // preload hi-res, swap in when ready (no flash)
      // nothing on screen yet: show the small scan at once, so the centred card is
      // never an empty slot while the big one downloads
      if (!img.getAttribute('src')) { img.dataset.q = 'low'; img.src = cardImg(card, 'low.webp'); }
      const pre = new Image(); pre.decoding = 'async';
      pre.onload = () => { img.dataset.q = 'high'; img.src = pre.src; };
      pre.onerror = () => { const fb = cardImgFallback(card, 'high.webp'); if (fb) { img.dataset.q = 'high'; img.src = fb; } };
      pre.src = cardImg(card, 'high.webp');
    } else {
      img.dataset.q = 'low'; img.src = cardImg(card, 'low.webp');
    }
  }
  function mLazyAround(slot) {                 // hi-res the centred card, low-res its neighbours
    if (!mcar) return;
    const R = 4;
    for (let s = Math.max(0, slot - R); s <= Math.min(view.length - 1, slot + R); s++) {
      const b = mcar.children[s]; if (!b) continue;
      const img = b.firstElementChild, card = CARDS[view[s]];
      const want = (s === slot) ? 'high' : 'low';
      if (img.dataset.q === 'high' || (img.dataset.q === 'low' && want === 'low')) continue;
      mLoadImg(img, card, want);
    }
  }
  function mSyncCurrent(slot) {                // a card centred → drive the shared state + caption
    position = target = slot; velocity = 0; mode = 'idle';
    setCurrent(slot);                          // reuses the full caption / counter / dial logic
    const kids = mcar ? mcar.children : [];
    for (let s = 0; s < kids.length; s++) kids[s].classList.toggle('on', s === slot);
    scrubTo(mScrub, slot); scrubCard(mScrub, slot);
  }
  function mScrollTo(slot, smooth) {           // programmatic move (goTo / scrubber / search / land)
    if (!mcar || !mcar.children.length) return;
    mProg = true;                              // suppress the swipe-settle handler while we drive it
    mcar.scrollTo({ left: slot * mStride(), behavior: smooth ? 'smooth' : 'auto' });
    mSyncCurrent(slot); mLazyAround(slot);
    clearTimeout(mProgT); mProgT = setTimeout(() => { mProg = false; }, smooth ? 540 : 110);
  }
  function onMScroll() {                        // user swipe → snap settle → sync
    if (mProg) return;
    clearTimeout(mScrollT);
    mScrollT = setTimeout(() => {
      const slot = mCenteredSlot();
      if (slot !== current) mSyncCurrent(slot);
      mLazyAround(slot);
    }, 80);
  }
  function mobileBuild() {                      // (re)build the strip in the current view order
    if (!MOBILE || !mcar) return;
    mcar.replaceChildren(...view.map((ci, slot) => {
      const card = CARDS[ci];
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'm-card' + (card.sealed ? ' sealed' : '');
      b.dataset.slot = slot;
      b.setAttribute('aria-label', 'Inspect ' + card.name);
      const img = document.createElement('img');
      img.alt = card.name; img.draggable = false; img.decoding = 'async';
      b.appendChild(img);
      return b;
    }));
    // read the slot when the frame runs: a set opened from the browser lands on its
    // first card right after this, and the old captured value dragged it back to the end
    requestAnimationFrame(() => mScrollTo(current >= 0 ? current : 0, false));
  }
  function bindScrub() {                        // drag the scrubber to fly through the set
    const track = mScrub.sd;
    let dragging = false;
    const move = (e) => {
      const r = mScrub.track.getBoundingClientRect();
      const slot = Math.max(0, Math.min(N - 1, Math.floor((e.clientX - r.left) / (r.width || 1) * N)));
      scrubTo(mScrub, slot); scrubCard(mScrub, slot);
      mScrollTo(slot, false);
    };
    track.addEventListener('pointerdown', (e) => { dragging = true; try { track.setPointerCapture(e.pointerId); } catch (err) { /* inactive pointer */ } move(e); });
    track.addEventListener('pointermove', (e) => { if (dragging) move(e); });
    const end = () => { dragging = false; };
    track.addEventListener('pointerup', end);
    track.addEventListener('pointercancel', end);
  }
  function mobileInit() {
    document.body.classList.toggle('mobile', MOBILE);
    if (!MOBILE || mViewport) return;
    // carousel stage, inserted just above <main> so the caption sits beneath it
    mViewport = document.createElement('div');
    mViewport.className = 'm-stage';
    mcar = document.createElement('div');
    mcar.id = 'mcar'; mcar.className = 'm-car';
    mcar.setAttribute('aria-roledescription', 'carousel');
    mcar.setAttribute('aria-label', 'Cards');
    mViewport.appendChild(mcar);
    document.querySelector('main').before(mViewport);
    mcar.addEventListener('scroll', onMScroll, { passive: true });
    mcar.addEventListener('click', (e) => {
      const b = e.target.closest('.m-card'); if (!b) return;
      const slot = +b.dataset.slot;
      if (slot !== current) { mScrollTo(slot, true); return; }  // tap a peek card → centre it
      openZoomFor(slot, b);                                     // tap the focused card → inspect
    });
    // search: a 🔍 toggle drops the existing #search field into a full-width bar
    const tgl = document.createElement('button');
    tgl.type = 'button'; tgl.className = 'm-searchtgl'; tgl.setAttribute('aria-label', 'Search cards');
    tgl.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/></svg>';
    tgl.addEventListener('click', () => {
      const open = document.body.classList.toggle('msearch-open');
      if (open) searchEl.focus(); else searchEl.blur();
    });
    document.querySelector('.chrome-right').appendChild(tgl);
    searchEl.addEventListener('change', () => document.body.classList.remove('msearch-open'));
    // scrubber — drag to fly through the whole set
    mscrub = document.createElement('div');
    mscrub.className = 'm-scrub';
    document.querySelector('main').after(mscrub);
    mScrub = makeScrub(mscrub);
    const legend = document.querySelector('.minimap .dial-legend');
    if (legend) { const l = legend.cloneNode(true); l.classList.add('m-legend'); mscrub.appendChild(l); }
    bindScrub();
    mobileBuild();
  }
  MQ_MOBILE.addEventListener('change', (e) => {
    MOBILE = e.matches;
    document.body.classList.toggle('mobile', MOBILE);
    if (MOBILE) { mobileInit(); mobileBuild(); }
  });

  // --- Boot --------------------------------------------------------------------------------
  measure();
  initHolo();
  initParallax();
  requestAnimationFrame(ambientLoop);
  updateListCounts();
  const qs = new URLSearchParams(location.search);
  const reqSet = qs.get('set');
  const deepCard = parseInt(qs.get('card'), 10);
  const reqGame = qs.get('game');
  const validGame = reqGame && HOME_GAMES.some((g) => g.game === reqGame);
  const isExternalReq = reqSet && gameSetMeta(reqSet);
  // open the deep-linked card's inspect (by collector number) once its set is loaded
  const openDeep = () => {
    let ci = CARDS.findIndex((c) => c.num === deepCard);     // match by collector number (correct for lazy/tcgdex sets too)
    if (ci < 0 && deepCard >= 1 && deepCard <= N) ci = deepCard - 1;   // fallback: positional
    if (ci >= 0 && slotOf[ci] != null) {
      position = slotOf[ci]; current = -1; render(true);
      setTimeout(() => openZoomFor(slotOf[ci]), 450);
    }
  };
  requestAnimationFrame(tick);
  mobileInit();   // on phones: build the snap-carousel before the first set loads
  discoverSets(); // fire-and-forget: new tcgdex sets appear in the browser automatically
  // no set asked for → the set browser (no wheel is built until a set is chosen,
  // so the browser paints fast); a set → straight onto its wheel
  if (isExternalReq) {
    Promise.resolve(loadExternalSet(reqSet)).then(() => { if (SETS[reqSet]) { if (deepCard >= 1) openDeep(); } else showHome(gameOf(reqSet)); });
  } else if (reqSet && SETS[reqSet]) {
    loadSet(reqSet); openDeep();
  } else if (reqSet) {                                   // unrecognized id → lazy-fetch the tcgdex Pokémon set into the wheel
    loadPokemonSet(reqSet).then((ok) => { if (ok) { if (deepCard >= 1) openDeep(); } else showHome(validGame ? reqGame : null); });
  } else {
    showHome(validGame ? reqGame : null);
  }
})();
