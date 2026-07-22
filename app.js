// Phantasmal Flames — wheel carousel.
// Single position scalar (card units) owned by an explicit interaction state
// machine: idle | wheeling | dragging | gliding | snapping | jumping.
// All dynamic text via textContent; images restricted to assets.tcgdex.net.

(() => {
  'use strict';

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
  const TIERS = [
    { max: 1, var: '--tier-1', label: 'T1' },
    { max: 5, var: '--tier-2', label: 'T2' },
    { max: 20, var: '--tier-3', label: 'T3' },
    { max: 75, var: '--tier-4', label: 'T4' },
    { max: Infinity, var: '--tier-5', label: 'T5' },
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
  // tcgdex set logos live at /en/<series>/<id>/logo; the series is the set id's
  // alpha prefix (sv05 -> sv, me03 -> me). Derive it instead of trusting
  // set.logo — sv05 (Temporal Forces) shipped with a wrong /en/me/ path, which
  // 404s and leaves an empty, dark set button. Deriving fixes that whole class.
  // tcgdex carries no set LOGO for a few sets (only a symbol) — supply the
  // wordmark locally so the dropdown + selector never fall back to a glyph.
  const SET_LOGO_OVERRIDE = {
    'me05': 'assets/setlogos/me05.png',        // Pitch Black (not on tcgdex yet; Bulbagarden archive art)
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
    'mtg-sos': 'assets/setlogos/mtg-sos.png',  // Secrets of Strixhaven
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
  function glowSwap(el, text) {
    if (el.textContent === text) return;
    el.textContent = text;
    if (REDUCED) return;
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
  // 3D dial: one bar per card on an arc that curves INTO the screen (z). Each bar
  // is positioned with translate3d(x,0,z); the .rail's perspective makes the
  // receding ends smaller — real depth, not a flat tilt. pt() returns [x, z].
  const dialPt = (th, R) => [R * Math.sin(th), -R * (1 - Math.cos(th))];
  function buildDial() {
    const w = Math.round(rail.clientWidth) || 1000;
    const chord = Math.min(w * 0.5, 780);                    // dial span
    // P: a perfectly FLAT dial — straight baseline, upright ticks, instantly
    // readable (the speedometer arc is retired)
    const arcY = () => 0, arcRot = () => 0;
    const n = Math.min(N, 240);
    let s = `<div class="dial-stage" style="--dial-w:${chord.toFixed(0)}px">`
      + `<svg class="dial-arc" width="${chord.toFixed(0)}" height="6" viewBox="0 0 ${chord.toFixed(0)} 6"`
      + ` style="left:${(-chord / 2).toFixed(0)}px;bottom:-4px" aria-hidden="true">`
      + `<path d="M0 3 L ${chord.toFixed(1)} 3"`
      + ` fill="none" stroke="rgba(170,205,255,0.24)" stroke-width="1"/></svg>`;
    for (let i = 0; i < n; i++) {
      const f = n > 1 ? i / (n - 1) : 0.5, x = (f - 0.5) * chord, edge = 1 - Math.abs(f - 0.5) * 2;
      const len = 4 + 6 * edge;                              // a touch taller toward the middle, tapering at the ends
      s += `<i class="dtick" data-i="${i}" style="transform:translate3d(${x.toFixed(1)}px,0,0);height:${len.toFixed(1)}px;opacity:${(0.38 + 0.34 * edge).toFixed(2)}"></i>`;
    }
    s += '<i class="dknob"></i></div>';
    railArc.innerHTML = s;
    dial = { chord, n, _cur: -1, _curEl: null, arcY, arcRot };
    recolorDial();
  }
  // paint each dial bar in its card's price-tier colour (the dial doubles as a
  // heat strip). view[] must be valid for the ACTIVE set — applySort re-calls this.
  function recolorDial() {
    if (!dial || view.length !== N) return;
    railArc.querySelectorAll('.dtick').forEach((t) => {
      const slot = Math.round((+t.dataset.i) / (dial.n - 1 || 1) * (N - 1));
      const card = cardAt(slot);
      if (!card) return;
      const c = tierColor(tierOf(card).var);
      t.style.color = c;
      t.style.background = `linear-gradient(to top, transparent, ${c})`;
    });
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
  const stageGlow = $('stageGlow');
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
    langBtn.querySelector('.lb').textContent = ja ? 'English' : '日本語';
    langBtn.classList.toggle('active', ja);
  }
  if (langBtn) langBtn.addEventListener('click', () => {
    const card = zoomLangCard; if (!card) return;
    const jaSrc = window.JA_MAP && window.JA_MAP[card.id];
    if (!zoomJa) {
      if (!jaSrc) return;
      const g = ++imgGen;                       // cancel any pending EN sharpeners
      const probe = new Image();
      probe.onload = () => { if (g === imgGen) { zoomImg.src = probe.src; setLangUI(true); } };
      probe.onerror = () => { if (g === imgGen) { langBtn.classList.add('na'); setTimeout(() => langBtn.classList.remove('na'), 900); } };
      probe.src = jaSrc;
    } else {
      ++imgGen;
      zoomImg.src = cardImg(card, 'high.webp'); // EN high is already cached
      setLangUI(false);
    }
  });

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
      if (!card.sealed) img.loading = 'lazy'; // browser skips offscreen fetches until near view
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
          if (!card.fullImg && img.dataset.q === 'high') { // tcgdex high failed -> drop to low
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
      el.append(img, ph, tag);
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
      slot.img.dataset.q = 'high';
      slot.img.src = cardImg(card, 'high.webp');
      slot.loaded = 'full';
      return;
    }
    if (q === 'high' && card.imageOk === false) q = 'low';
    if (q === 'high') {
      const pre = new Image();
      pre.decoding = 'async';
      pre.onload = () => { slot.img.dataset.q = 'high'; slot.img.src = pre.src; slot.loaded = 'high'; };
      // tcgdex high.webp missing -> fall back to the base printing's art, else low
      pre.onerror = () => {
        const fb = cardImgFallback(card, 'high.webp');
        if (fb) { slot.img.dataset.q = 'fallback'; slot.img.src = fb; slot.loaded = 'high'; }
      };
      pre.src = cardImg(card, 'high.webp');
    } else if (!slot.loaded) {
      slot.img.dataset.q = 'low';
      slot.img.src = cardImg(card, 'low.webp');
      slot.loaded = 'low';
    }
  }

  // --- Layout ------------------------------------------------------------------
  function measure() {
    const h = wheel.clientHeight * L.WHEEL_CARD_HEIGHT_FACTOR; // pinned in layout-constants.js
    cardW = h * (734 / 1024);
    spacing = cardW; // base unit; the focus-pocket curve shapes actual gaps
  }
  addEventListener('resize', () => { syncArc(); measure(); buildDial(); render(true); });

  // --- Render ------------------------------------------------------------------
  const WINDOW = 10; // paint ±10 around position (smaller cards pack more in view)
  let painted = new Set();
  function render(force) {
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
      const scale = 0.98 + 0.56 * Math.exp(-(d * d) / 1.0);
      const bright = 0.66 + 0.34 * pocket;   // clearer side cards (P: more clarity)
      // the frame: side cards keep the centre's eye-line, dive back in Z, and
      // turn toward the focused card — one shared vanishing point (.track)
      const arcY = (1 - pocket) * spacing * 0.012;
      const zRec = -Math.pow(1 - pocket, 1.6) * 240;   // neighbours stay near, the wall dives
      const yaw = Math.max(-42, Math.min(42, -d * 38)) * (1 - pocket * 0.55);
      const el = els[view[i]].el;
      el.style.visibility = 'visible';
      // breathing fan (P: the focus needs AIR): the first neighbour sits a
      // full card out — clear gap around the focused card — then 0.40 slices
      const xu = d * 0.40 + Math.sign(d) * Math.min(ad, 1) * 0.62;
      el.style.transform =
        `translate3d(${(xu * spacing - cardW / 2).toFixed(2)}px, -50%, 0)` +
        ` translateY(${arcY.toFixed(2)}px) translateZ(${zRec.toFixed(1)}px)` +
        ` rotateY(${yaw.toFixed(2)}deg) scale(${scale.toFixed(4)})`;
      // dim via composited overlay opacity (a per-frame filter:brightness forces repaints)
      el.style.setProperty('--dim', (1 - bright).toFixed(3));
      el.style.zIndex = String(100 - Math.round(ad * 10));
      // hold quality upgrades during fast travel; decode work causes hitching
      wantImage(view[i], (ad < 3.5 && Math.abs(velocity) < 0.18) ? 'high' : 'low');
    }
    painted = next;

    const idx = Math.max(0, Math.min(N - 1, Math.round(position)));
    if (idx !== current || force) setCurrent(idx);
  }

  // --- Current-card UI (caption, minimap, counter, glow, focus) ---------------
  const priceTween = { v: 0 }; // shared target for the count-up price
  function setCurrent(idx) {
    if (current >= 0 && current !== idx) {
      tickEls[current].classList.remove('cur');
      const prev = els[view[current]].el;
      prev.tabIndex = -1;
      prev.classList.remove('center');
      prev.setAttribute('aria-hidden', 'true');
      prev.removeAttribute('role');       // drop the button semantics it got while centered
      prev.removeAttribute('aria-label'); // (it's clickable for the mouse, but hidden from AT again)
    }
    current = idx;
    const card = cardAt(idx);
    const tier = tierOf(card);
    const color = tierColor(tier.var);

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
    glowSwap(capName, cn.name); // ALL-CAPS via CSS; seeps in between cards
    capRarity.className = 'cap-rarity-top' + (card.sealed ? '' : ' rar-' + raritySlug(card.rarity)); // special rarities get flair
    // rarity rides the TOP line, above the wheel, in its signature color
    if (card.sealed) capRarity.style.color = 'var(--ember-glint)';
    else capRarity.style.color = rarityColor(card.rarity);
    const rarityLine = card.sealed ? 'SEALED PRODUCT' : (card.rarity ? card.rarity.toUpperCase() : ' ');
    capRarity.hidden = !rarityLine.trim();   // no rarity → no empty pill (P: "the empty bar")
    glowSwap(capRarity, rarityLine);
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
      if (window.gsap && !REDUCED) {
        gsap.killTweensOf(priceTween);
        gsap.to(priceTween, {
          v: capUsd, duration: 0.4, ease: 'power3.out',
          onUpdate: () => { capPrice.textContent = `$${priceTween.v.toFixed(2)}`; },
        });
        // insurance for frozen tickers (occluded tab): snap to the final value
        setTimeout(() => {
          if (priceTween.target === capUsd) { priceTween.v = capUsd; capPrice.textContent = `$${capUsd.toFixed(2)}`; }
        }, 520);
      } else {
        priceTween.v = capUsd;
        capPrice.textContent = `$${capUsd.toFixed(2)}`;
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

    // dial: ride the knob along the 3D arc + light the current segment
    if (dial) {
      const f = N > 1 ? idx / (N - 1) : 0.5;
      const kx = (f - 0.5) * dial.chord;
      const knob = railArc.querySelector('.dknob');
      if (knob) knob.style.transform = `translate3d(${kx.toFixed(1)}px,${(dial.arcY ? dial.arcY(kx) : 0).toFixed(1)}px,0) rotate(${(dial.arcRot ? dial.arcRot(kx) : 0).toFixed(2)}deg)`; // knob rides the dial curve
      const ti = Math.round(f * (dial.n - 1));
      if (ti !== dial._cur) {
        if (dial._curEl) dial._curEl.classList.remove('cur');
        dial._curEl = railArc.querySelector(`.dtick[data-i="${ti}"]`);
        if (dial._curEl) dial._curEl.classList.add('cur');
        dial._cur = ti;
      }
    }

    // valuable cards (>= $20) get the hot title treatment
    const hot = typeof card.priceUsd === 'number' && card.priceUsd >= 20;
    capName.classList.toggle('hot', hot);
    if (hot) capName.style.setProperty('--hot-color', color);

    // repainting the full-screen glow every index at glide speed is jank; settle first
    if (Math.abs(velocity) < 0.2) {
      stageGlow.style.setProperty('--glow-color',
        tier.label ? color + '2e' : 'rgba(108,46,166,0.18)');
      // warm the full-res PNG for the settled card so inspect opens at max
      // quality with zero wait (the wheel itself only ever needs webp)
      if (!card.sealed && card.imageOk !== false && !pngWarm.has(card.id)) {
        pngWarm.add(card.id);
        const pre = new Image();
        pre.decoding = 'async';
        pre.src = cardImg(card, 'high.png');
      }
      // the wheel settled on a new card — re-centre the idle prefetch so the cards
      // the user is now near get warmed first (cheap: no-op if already scheduled)
      if (typeof schedulePrefetch === 'function') schedulePrefetch();
    }
  }
  const pngWarm = new Set();

  // --- rAF loop -----------------------------------------------------------------
  function clampPos() {
    if (position < 0) { position = 0; velocity = 0; }
    if (position > N - 1) { position = N - 1; velocity = 0; }
  }
  // Background drift lives in the physics loop — CSS animation timelines are
  // frozen on this machine, but rAF demonstrably runs (the wheel moves).
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
    const k = (1 + Math.sin(t * TAU / 9)) / 2;
    stageGlow.style.opacity = (0.74 + 0.26 * k).toFixed(3);
    stageGlow.style.transform = `scale(${(1 + 0.08 * k).toFixed(4)})`;
    // inspect backdrop: slow Ken Burns over the blurred card art, every card
    if (zoom.open) {
      zoomBgArt.style.transform =
        `translate3d(${(Math.sin(t * TAU / 26) * 1.8).toFixed(3)}%, ${(Math.cos(t * TAU / 21) * 1.4).toFixed(3)}%, 0)` +
        ` scale(${(1.07 + Math.sin(t * TAU / 33) * 0.06).toFixed(4)})`;
    }
  }

  let driftFrame = 0;
  function tick(ms) {
    // every 2nd frame: the drift is slow, 30fps is invisible, churn halves
    if (!REDUCED && (driftFrame++ & 1)) driftBg(ms || performance.now());
    if (zoom.open) holoRender(ms || performance.now()); // animated inspect backdrop
    if (topo && document.body.dataset.game === 'pokemon') topo.render(ms || performance.now()); // Pokémon topo drift
    if (zoom.open && document.body.dataset.game === 'pokemon') { if (!zoomTopo) buildZoomTopo(); if (zoomTopo) { zoomTopo.color.set(insColor); zoomTopo.render(ms || performance.now()); } } // Pokémon inspect topo, tinted to the card
    if (floorFX && !zoom.open && !document.body.classList.contains('home-open')) floorFX.render(ms || performance.now()); // stage floor under the wheel
    if (mode === 'gliding' || mode === 'wheeling') {
      position += velocity;
      velocity *= FRICTION;
      clampPos();
      if (Math.abs(velocity) < SNAP_VELOCITY) {
        mode = 'snapping';
        target = Math.max(0, Math.min(N - 1, Math.round(position)));
      }
      render();
    } else if (mode === 'snapping' || mode === 'jumping') {
      const k = mode === 'jumping' ? SNAP_K * 1.3 : SNAP_K;
      position += (target - position) * k;
      if (Math.abs(target - position) < 0.0008) { position = target; mode = 'idle'; }
      render();
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
    const [a, b, c] = [cols[0], cols[1] ?? cols[0], cols[2] ?? cols[1] ?? cols[0]];
    // feed the per-set signature colour to the themed backdrops:
    // Lorcana bottom glow (--set-glow), One Piece rain tint (--op-rain*), Pokémon topo hue
    const bs = document.body.style;
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
  // Sample the card art → feed --ins-lit/--ins-deep (the .zoom-uni gradient, all universes)
  // and insColor (the Pokémon #zoomTopo shader base, applied each frame in tick()).
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
    // CORS blob → ImageBitmap → canvas is untainted, so pixels are readable (CDNs that block CORS keep the fallback)
    fetch(url, { mode: 'cors' }).then((res) => res.ok ? res.blob() : Promise.reject()).then(createImageBitmap).then((bm) => {
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
    // per-universe carousel backdrop (stars / rain), switched via body[data-game]
    const universe = id.startsWith('lor-') ? 'lorcana' : id.startsWith('op-') ? 'onepiece' : id.startsWith('mtg-') ? 'magic' : 'pokemon';
    document.body.dataset.game = universe;
    if (universe === 'lorcana') buildStarfield();
    else if (universe === 'pokemon') buildTopo();
    CARDS = setCardList(id); // numbered singles + sealed products
    N = CARDS.length;
    const dom = buildSetDom(id);
    els = dom.els;
    tickByCard = dom.ticks;
    track.replaceChildren(...els.map(e => e.el));
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
    $('snapshotLabel').textContent =
      `${DATA.set.name} · ${DATA.set.total} cards · market snapshot via ${DATA.source || 'TCGdex'} · refreshed ${new Date(DATA.snapshotAt).toLocaleString()}`;
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
      : [SET_LOGO_OVERRIDE[id], setLogoPng(DATA.set)].filter(Boolean));
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
    current = -1;
    painted = new Set();
    buildDial();          // redraw the arced dial for this set's card count
    applySort(sortMode); // rebuilds view/ticks order and lands per mode
    recolorDial();       // dial heat-strip colours need the NEW view order
    buildFloor();        // stage floor (all universes) — lazy singleton
    // relight the stage in THIS set's signature colour, read from its local
    // sealed render (Perfect Order → green, etc.); async, guards re-switch
    setAmbience(id);
    kickWheelIntro();    // belt sweeps in from the right + caption/dial entrance
  }

  // Era-grouped dropdown, newest sets first. Only sets with data appear.
  const SET_GROUPS = [
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
      // 25 most recent Magic sets (newest first), per Scryfall. + Strixhaven pinned.
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
        item.addEventListener('click', () => { toggleSetMenu(false); if (DATA.set.id === s.id) return; s.external ? loadExternalSet(s.id) : loadSet(s.id); });
        listEl.appendChild(item);
      }
    }
    setMenu.querySelectorAll('.sm-tab').forEach((t) => t.addEventListener('click', () => { activeGame = t.dataset.game; renderTabs(); renderList(); searchEl.focus(); }));
    searchEl.addEventListener('input', () => { query = searchEl.value; renderList(); });
    setMenu._sync = () => { // on open: jump to the current set's game, clear the filter
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
  async function fetchMagicSet(code) {
    // unique=prints = EVERY printing (showcase / borderless / extended / serialized
    // full-arts — the valuable variants), not collapsed to one per card
    let out = [], url = `https://api.scryfall.com/cards/search?q=set%3A${code}+game%3Apaper&unique=prints&order=set`;
    for (let p = 0; url && p < 16 && out.length < 2600; p++) { const j = await fetchJSON(url); out.push(...(j.data || [])); url = j.has_more ? j.next_page : null; }
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
      priceVariant: 'normal', variants: {}, cardmarket: null, imageOk: true, illustrator: c.artist || '',
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
  let loadingGame = false;
  async function loadExternalSet(id) {
    if (SETS[id]) { loadSet(id); return; }
    const meta = gameSetMeta(id);
    if (!meta || loadingGame) return;
    loadingGame = true;
    const btnLogo = $('setBtnLogo'), btnName = $('setBtnName');
    btnLogo.hidden = true; btnName.hidden = false; btnName.textContent = `Loading ${meta.name}…`;
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
      loadSet(id);
    } catch (e) {
      btnName.textContent = `Couldn't load ${meta.name}`;
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
  async function fetchTcgdexSet(id) {
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
        cards, snapshotAt: new Date().toISOString(), source: 'TCGdex (unpriced — new release)',
      };
      loadSet(id);
      return true;
    } catch { return false; }
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
  let dragX = 0, lastX = 0, lastT = 0, dragVel = 0, dragMoved = 0;
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
    render();
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
    if (zoom.open) return;
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
    const r = railArc.getBoundingClientRect();
    // pointer x relative to centre, over the arc's screen span (≈ chord)
    const span = dial ? dial.chord : r.width;
    const f = (e.clientX - (r.left + r.width / 2)) / span + 0.5;
    return Math.round(Math.max(0, Math.min(1, f)) * (N - 1));
  }
  rail.addEventListener('pointerdown', (e) => {
    if (zoom.open) return;
    scrubbing = true;
    goTo(railIndex(e));
    try { rail.setPointerCapture(e.pointerId); } catch { /* inactive pointer */ }
  });
  rail.addEventListener('pointermove', (e) => { if (scrubbing) goTo(railIndex(e)); });
  rail.addEventListener('pointerup', () => { scrubbing = false; });
  rail.addEventListener('pointercancel', () => { scrubbing = false; });

  // hover tooltip: number + name of the card under the pointer (shown via CSS
  // .rail:hover; built lazily so buildDial can rebuild railArc freely)
  let dialTip = null;
  const dialTipShow = (e) => {
    if (zoom.open || MOBILE) return;
    if (!dialTip || !dialTip.isConnected) {
      dialTip = document.createElement('span');
      dialTip.className = 'dial-tip';
      rail.appendChild(dialTip);
    }
    const card = cardAt(railIndex(e));
    if (!card) return;
    const num = document.createElement('b');
    num.textContent = card.sealed ? 'SEALED' : String(card.localId ?? '');
    dialTip.replaceChildren(num, document.createTextNode(card.name));
    const r = rail.getBoundingClientRect();
    dialTip.style.left = `${Math.max(70, Math.min(r.width - 70, e.clientX - r.left)).toFixed(0)}px`;
  };
  rail.addEventListener('pointerenter', dialTipShow);
  rail.addEventListener('pointermove', dialTipShow);

  // --- Zoom view ------------------------------------------------------------------------
  const fmt = (v, cur) => (typeof v === 'number' ? (cur === 'EUR' ? '€' : '$') + v.toFixed(2) : '—');
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
  $('shareBtn').addEventListener('click', (e) => {
    e.preventDefault(); // the copy IS the share; the href stays a real link
    const btn = e.currentTarget;
    navigator.clipboard?.writeText(btn.href).then(() => {
      btn.classList.add('copied');
      btn.querySelector('.ic').textContent = '✓';
      btn.querySelector('.lb').textContent = 'Copied';
      setTimeout(() => {
        btn.classList.remove('copied');
        btn.querySelector('.ic').textContent = '⤴';
        btn.querySelector('.lb').textContent = 'Share';
      }, 1400);
    }).catch(() => { /* clipboard denied — the anchor still right-click-copies */ });
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

  $('lightBtn').addEventListener('click', () => {   // whole-card light wash, sudden + soft
    const lit = cardFaces.classList.toggle('lit');
    $('lightBtn').setAttribute('aria-pressed', lit ? 'true' : 'false');
  });
  $('wishBtn').addEventListener('click', () => {
    const card = cardAt(current);
    wishlist.has(card.id) ? wishlist.delete(card.id) : wishlist.add(card.id);
    saveList('pokex.wishlist', wishlist);
    updateListButtons(card);
    updateListCounts();
    refreshCapMarks(card);
  });
  $('collBtn').addEventListener('click', () => {
    const card = cardAt(current);
    collection.has(card.id) ? collection.delete(card.id) : collection.add(card.id);
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
    zNumber.textContent = card.sealed ? '' : `${card.localId}/${String(DATA.set.official).padStart(3, '0')}`;
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
  const whoosh = new Audio('assets/sfx/swipe-whoosh.wav');
  whoosh.volume = 0.056; // ≈ -25 dB (10^(-25/20)); very subtle. tune this knob for loudness
  function playWhoosh() { try { whoosh.currentTime = 0; whoosh.play().catch(() => {}); } catch { /* no audio */ } }

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
    zoomReturnEl = (MOBILE && srcEl) ? srcEl : els[view[i]].el;   // mobile: morph back to the carousel card, not the hidden wheel el
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
    const qrow = (k, v, sub) => {
      const q = document.createElement('div'); q.className = 'q';
      const kk = document.createElement('span'); kk.className = 'k'; kk.textContent = k;
      const vv = document.createElement('span'); vv.className = 'v';
      if (v instanceof Node) vv.append(v); else vv.textContent = v;
      if (sub) { const s = document.createElement('span'); s.className = 'sub'; s.textContent = sub; vv.appendChild(s); }
      q.append(kk, vv); zQuick.appendChild(q);
    };

    if (card.sealed) {
      const m = card.sealedMeta;
      amt.textContent = m.marketUsd != null ? `$${m.marketUsd.toFixed(2)}` : 'Tracking';
      amt.classList.toggle('none', m.marketUsd == null);
      lbl.textContent = 'Sealed product';
      src.textContent = m.marketUsd != null ? `${m.source} · ${m.checked}` : 'price not yet sourced';
      if (m.detail) qrow('Contents', m.detail);
      $('zCharts').replaceChildren();
      $('zTable').replaceChildren();
      $('moreCardsBtn').hidden = true; // sealed products have no "other cards"
      buildPulls(card, pullLadderFor(DATA.set.id)); // what's inside: the set's odds
      zCredit.textContent = m.note || (m.marketUsd != null ? `verified ${m.source} · ${m.checked}` : 'price tracking pending');
    } else {
      const usd = typeof card.priceUsd === 'number' ? card.priceUsd
        : (card.cardmarket?.trend != null ? eurToUsd(card.cardmarket.trend) : null);
      amt.textContent = usd != null ? `$${usd.toFixed(2)}` : '—';
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
        if (Array.isArray(card.meta)) for (const [k, v] of card.meta) { if (v) qrow(k, v); }
        $('zCharts').replaceChildren();
        $('zTable').replaceChildren();
        $('moreCardsBtn').hidden = true;
        buildPulls(card, null); // no Pokemon pull ladder for external games — hide it
      } else {
        if (card.cardmarket) {
          const cm = card.cardmarket;
          const v = document.createElement('span');
          v.append(`$${eurToUsd(cm.trend ?? cm.avg1).toFixed(2)}`);
          if (typeof cm.avg30 === 'number' && typeof cm.avg1 === 'number' && cm.avg30 > 0) {
            const d = (cm.avg1 - cm.avg30) / cm.avg30 * 100;
            const dl = document.createElement('span');
            dl.className = 'delta ' + (d >= 0 ? 'up' : 'down');
            dl.textContent = `${d >= 0 ? '▲' : '▼'}${Math.abs(d).toFixed(1)}%`;
            v.appendChild(dl);
          }
          qrow('30-day trend', v);
        }
        buildCharts(card);
        buildVariantTable(card);
        buildPulls(card, pullLadderFor(DATA.set.id)); // full odds, collapsed behind a disclosure
        buildFamily(card);
      }
      const bits = [];
      if (card.illustrator) bits.push(`illus. ${card.illustrator}`);
      bits.push(`№ ${card.localId}/${String(DATA.set.official).padStart(3, '0')}`);
      bits.push(`refreshed ${new Date(DATA.snapshotAt).toLocaleDateString()}`);
      zCredit.textContent = bits.join('   ·   ');
    }

    // Holo intensity by rarity
    const r = (card.rarity || '').toLowerCase();
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

  let zoomClosing = false;
  function closeZoom() {
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
    const rx = (0.5 - fy) * 14, ry = (fx - 0.5) * 14;
    tiltCard.style.transform = `rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
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
  const pfDone = new Set();    // card indices whose high.webp request has been issued (cache warm)
  // pfDone tracks PREFETCH progress only; els[].loaded stays the visible-img state.
  // pick the nearest not-yet-warmed card within the radius of the current centre
  function pfPick() {
    const c = Math.max(0, Math.min(N - 1, Math.round(position)));
    const want = (i) => i >= 0 && i < N && els[i] && !pfDone.has(i)
      && els[i].loaded !== 'high' && els[i].loaded !== 'full' && els[i].loaded !== 'fallback'
      && CARDS[i].imageOk !== false;
    for (let d = 0; d <= PF_RADIUS; d++) {
      if (want(c + d)) return c + d;
      if (d && want(c - d)) return c - d;
    }
    return -1;
  }
  function pfStep(deadline) {
    pfScheduled = false;
    let budget = 3; // a few per idle slice, then yield
    while (budget-- > 0 && (!deadline || deadline.timeRemaining() > 2)) {
      const i = pfPick();
      if (i < 0) return;          // nothing left near the user — wait for them to move
      pfDone.add(i);              // mark issued so we never re-pick (cache, not visible state)
      const im = new Image();
      im.decoding = 'async';
      im.onload = im.onerror = () => schedulePrefetch(); // chain the next on completion
      // for full-url cards there's no quality ladder; warming the same url primes the cache
      im.src = cardImg(CARDS[i], 'high.webp');
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

  // --- HOME: hero → "Get started" → pick a GAME (bare logos floating in 3D) →
  // pick a SET → drop into that set on its first card. GSAP for every transition.
  const homeEl = $('home'), homeScroll = $('homeScroll');
  const HOME_GAMES = [
    { game: 'pokemon', name: 'Pokémon', accent: '#ffcb05', card: 'assets/hallway/pokemon.webp' },
    { game: 'magic', name: 'Magic: The Gathering', accent: '#e8943b', card: 'assets/hallway/magic.jpg' },
    { game: 'lorcana', name: 'Disney Lorcana', accent: '#7fd4f4', card: 'assets/hallway/lorcana.avif' },
    { game: 'onepiece', name: 'One Piece', accent: '#ff5b4d', card: 'assets/hallway/onepiece.webp' },
  ];
  // per-universe world language for the picker gates: a giant engraved sigil
  // (stroke-only, rotates imperceptibly), a flavor line, and the particle MODE
  // the uniFX shader speaks in that column (0 sparks · 1 starlight · 2 sea
  // mist · 3 embers — each a different motion/shape/twinkle signature)
  const UNI_LORE = {
    pokemon: { tag: 'The original chase', fx: 0, sigil: '<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="50" cy="50" r="41"/><path d="M9 50h26M65 50h26"/><circle cx="50" cy="50" r="15"/><circle cx="50" cy="50" r="6.5"/></svg>' },
    lorcana: { tag: 'Ink & starlight', fx: 1, sigil: '<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M50 8l7.8 30.5L88 46l-30.2 7.5L50 84l-7.8-30.5L12 46l30.2-7.5z"/><circle cx="50" cy="46" r="34"/></svg>' },
    onepiece: { tag: 'Chart the Grand Line', fx: 2, sigil: '<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="50" cy="50" r="26"/><circle cx="50" cy="50" r="9"/><path d="M50 6v18M50 76v18M6 50h18M76 50h18M19 19l13 13M68 68l13 13M81 19L68 32M32 68L19 81"/><circle cx="50" cy="6" r="3.4"/><circle cx="50" cy="94" r="3.4"/><circle cx="6" cy="50" r="3.4"/><circle cx="94" cy="50" r="3.4"/></svg>' },
    magic: { tag: 'Spellcraft & steel', fx: 3, sigil: '<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M50 12L86 38 72 82H28L14 38z"/><circle cx="50" cy="12" r="5"/><circle cx="86" cy="38" r="5"/><circle cx="72" cy="82" r="5"/><circle cx="28" cy="82" r="5"/><circle cx="14" cy="38" r="5"/><circle cx="50" cy="52" r="12"/></svg>' },
  };
  // the universe-selector scene: P's crown-vortex generation with four magenta
  // placeholders, measured by scripts/uniselect-extract.py (re-run it and paste
  // its geometry here if the source art changes). Slots are left→right; the
  // crown is the deal origin; occ = each seat's front layer (crown glow /
  // swirl crossings render OVER the card — the chroma rule).
  const UNI_SCENE = {
    imgW: 2752, imgH: 1536, crown: { x: 1376, y: 860 },
    slots: [
      { cx: 531.82, cy: 786.33, w: 461.85, h: 685.04, angle: -26.779, occ: { x: 169, y: 535, w: 725, h: 536 } },
      { cx: 977.92, cy: 402.44, w: 238.14, h: 331.98, angle: -17.788, occ: { x: 914, y: 259, w: 231, h: 336 } },
      { cx: 1757.5, cy: 260.5, w: 231.0, h: 313.0, angle: 0.0, occ: { x: 1638, y: 257, w: 239, h: 164 } },
      { cx: 2269.19, cy: 690.18, w: 571.86, h: 841.05, angle: 21.927, occ: { x: 1844, y: 261, w: 849, h: 912 } },
    ],
  };
  function setsForGame(game) {
    if (game === 'pokemon') {
      const bundled = SET_GROUPS.flatMap((grp) => grp.ids.filter((id) => SETS[id]).map((id) => ({ id, name: SETS[id].set.name, count: SETS[id].set.total })));
      const known = new Set(bundled.map((s) => s.id));
      // auto-discovered sets (tcgdex) lead the grid — the next set drops in by itself
      const fresh = NEW_SETS.filter((s) => !known.has(s.id) && !SETS[s.id])
        .map((s) => ({ id: s.id, name: s.name, count: s.count, fresh: true }));
      return [...fresh, ...bundled];
    }
    const g = GAME_SETS.find((x) => x.game === game);
    return g ? g.sets.map((s) => ({ id: s.id, name: s.name, code: s.code })) : [];
  }

  // --- Auto set discovery: when tcgdex publishes a new Pokémon set (the next
  // "Pitch Black"), it appears in the grid automatically — no data work, no
  // redeploy. We scan the two NEWEST series (new mainline sets always land
  // there), diff against what we bundle, and cache the result for 12h.
  let NEW_SETS = [];
  async function discoverSets() {
    const KEY = 'pokex.freshSets3';   // v3: also excludes energy/intro filler (P: weird tiles, no real cards)
    // filler sets that clutter the shelf: no logos on tcgdex, few/no card
    // images, not what anyone opens the tracker for
    const FILLER = /energy|first battle|trainer kit|deck/i;
    const refreshGrid = () => {       // if the user is already ON the grid, drop the new tiles in
      const hv = $('hvSets');
      if (NEW_SETS.length && hv && !hv.hidden && pickGame === 'pokemon') buildSetGrid('pokemon');
    };
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
          if (count > 0 && !FILLER.test(s.name)) found.push({ id: s.id, name: s.name, count });
        });
      }
      NEW_SETS = found.reverse();   // newest first
      try { localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), sets: NEW_SETS })); } catch { /* storage full */ }
      refreshGrid();
    } catch { /* offline — the grid shows the bundled sets only */ }
  }
  let homeBuilt = false, pickGame = 'pokemon';
  function buildHome() {
    if (homeBuilt) return; homeBuilt = true;
    const UNI_ORDER = ['pokemon', 'lorcana', 'onepiece', 'magic'].map((id) => HOME_GAMES.find((g) => g.game === id)).filter(Boolean);
    homeScroll.innerHTML = `<div class="home-stage" id="homeStageEl">
        <div class="hv hv-hero" id="hvHero">
          <div class="hero-glow" aria-hidden="true"></div>
          <p class="hero-kicker">P&reg; Cards</p>
          <h1 class="hero-title"><span class="ht1">Every card.</span><span class="ht2">One wheel.</span></h1>
          <p class="hero-sub">Five universes &middot; every set &middot; one place</p>
          <button type="button" class="get-started" id="getStarted">Get started <span aria-hidden="true">&rarr;</span></button>
        </div>
        <div class="hv hv-pick" id="hvPick" hidden>
          <div class="uni-scene" id="uniScene">
            <img class="us-bg" id="usBg" src="assets/bg/uniselect-bg.jpg?v=1" alt="" draggable="false">
            <video class="us-video" id="usVideo" src="assets/bg/uniselect-commit.mp4?v=1" muted playsinline preload="auto" aria-hidden="true"></video>
            ${UNI_ORDER.map((g, i) => `<button type="button" class="us-card" data-game="${g.game}" data-slot="${i}" style="--accent:${g.accent}" aria-label="${g.name}"><img class="us-art" src="${g.card}" alt="" draggable="false"><span class="us-flash" aria-hidden="true"></span><span class="us-chip"><img src="assets/logos/${g.game}.png?v=79" alt=""><b>${setsForGame(g.game).length} sets</b></span></button>`).join('')}
            ${UNI_SCENE.slots.map((s, i) => s.occ ? `<img class="us-occ" data-slot="${i}" src="assets/bg/uniselect-occ-${i}.png?v=1" alt="" aria-hidden="true" draggable="false">` : '').join('')}
          </div>
          <div class="uni-head"><span class="uh-kick">Crowns &middot; live market</span><span class="uh-title">Choose your universe</span></div>
        </div>
        <div class="hv hv-sets" id="hvSets" hidden>
          <p class="pick-prompt" id="setsTitle">Choose a set</p>
          <div class="set-grid" id="setGrid"></div>
          <button type="button" class="pick-back" id="setsBack"><span class="pb-arrow" aria-hidden="true">&larr;</span> All universes</button>
        </div>
      </div>`;
    // ---- scene placement: one cover-fit for the plate, the seats, and the
    // occluders — everything shares the source-pixel frame, so nothing can
    // drift against the baked gold card frames. Below 760px the scene swaps
    // to a 2x2 grid (CSS .us-fallback owns all layout there).
    const usScene = $('uniScene');
    function usPlace() {
      const fallback = innerWidth < 760;
      $('hvPick').classList.toggle('us-fallback', fallback);
      if (fallback) { usScene.querySelectorAll('.us-bg, .us-card, .us-occ').forEach((el) => el.removeAttribute('style')); usScene.querySelectorAll('.us-card').forEach((el) => { el.style.setProperty('--accent', HOME_GAMES.find((g) => g.game === el.dataset.game)?.accent || '#7fd4f4'); }); return; }
      const { imgW: W, imgH: H, slots } = UNI_SCENE;
      const s = Math.max(innerWidth / W, innerHeight / H);
      const ox = (innerWidth - W * s) / 2, oy = (innerHeight - H * s) / 2;
      const bg = $('usBg');
      bg.style.left = ox + 'px'; bg.style.top = oy + 'px';
      bg.style.width = (W * s) + 'px'; bg.style.height = (H * s) + 'px';
      // the commit video (16:9, near-identical aspect) wears the plate's rect
      const vid = $('usVideo');
      if (vid) { vid.style.left = ox + 'px'; vid.style.top = oy + 'px'; vid.style.width = (W * s) + 'px'; vid.style.height = (H * s) + 'px'; }
      usScene.querySelectorAll('.us-card').forEach((el) => {
        const sl = slots[+el.dataset.slot];
        // centre in PX (not translate(-50%,-50%)): GSAP re-serializes percent
        // translates unreliably per-axis, which un-seated cards after the deal
        el.style.left = (sl.cx * s + ox - sl.w * s / 2) + 'px'; el.style.top = (sl.cy * s + oy - sl.h * s / 2) + 'px';
        el.style.width = (sl.w * s) + 'px'; el.style.height = (sl.h * s) + 'px';
        // the seat rotation goes THROUGH gsap so its transform cache stays
        // authoritative across the deal / commit tweens (raw style writes
        // behind gsap's back leave stale caches that mis-seat later tweens)
        if (window.gsap) gsap.set(el, { rotation: sl.angle, x: 0, y: 0, scale: 1 });
        else el.style.transform = `rotate(${sl.angle}deg)`;
      });
      usScene.querySelectorAll('.us-occ').forEach((el) => {
        const o = slots[+el.dataset.slot].occ;
        el.style.left = (o.x * s + ox) + 'px'; el.style.top = (o.y * s + oy) + 'px';
        el.style.width = (o.w * s) + 'px'; el.style.height = (o.h * s) + 'px';
      });
    }
    addEventListener('resize', usPlace);
    usPlace();
    // the whole scene is one rigid plane that leans with the cursor — depth
    // comes from the tilt (and the baked art), never from layers shearing
    // against the frames they must stay registered with
    if (window.gsap && !REDUCED) {
      homeScroll.addEventListener('pointermove', (e) => {
        if ($('hvPick').hidden || $('hvPick').classList.contains('us-fallback')) return;
        const nx = e.clientX / innerWidth - 0.5, ny = e.clientY / innerHeight - 0.5;
        gsap.to(usScene, { x: nx * 16, y: ny * 11, rotateY: nx * 4, rotateX: -ny * 2.6, duration: 0.65, ease: 'power2.out', overwrite: 'auto' });
      });
    }
    // COMMIT: P's Seedance transition. The video opens on this exact scene, so
    // the real cards fade back into their magenta placeholders, the vortex
    // spins the deck, hurls one card INTO the camera, and its chroma face
    // floods the lens — that flood is the wipe under which the shelf resolves.
    const VID = { rate: 2.6, revealAt: 9.35, guardMs: 5500 };
    let committing = false;
    function commitReveal(game, vid) {
      if (!committing) return; committing = false;
      revealSetsInPlace(game);
      if (vid) { vid.pause(); gsap.to(vid, { opacity: 0, duration: 0.35, ease: 'power2.out', onComplete: () => gsap.set(vid, { clearProps: 'opacity,visibility' }) }); }
      gsap.set('#uniScene .us-card, #uniScene .us-occ, #uniScene .us-chip', { clearProps: 'opacity,transform,visibility' });
      usPlace();   // re-seat everything for the return trip
    }
    usScene.addEventListener('click', (e) => {
      const b = e.target.closest('.us-card'); if (!b || committing) return;
      const vid = $('usVideo');
      // no readyState gate: play() streams a cold video fine, and the 5.5s
      // guard force-reveals if it truly can't start (P missed it first-click)
      const canPlay = vid && window.gsap && !REDUCED && !$('hvPick').classList.contains('us-fallback');
      if (!canPlay) { revealSetsInPlace(b.dataset.game); return; }
      committing = true;
      const game = b.dataset.game;
      gsap.fromTo(b.querySelector('.us-flash'), { opacity: 0 }, { opacity: 0.55, duration: 0.1, ease: 'power1.in', yoyo: true, repeat: 1 });
      gsap.to('#uniScene .us-card, #uniScene .us-occ', { opacity: 0, duration: 0.3, ease: 'power2.in', delay: 0.05 });
      vid.currentTime = 0; vid.playbackRate = VID.rate;
      gsap.set(vid, { visibility: 'visible' });
      gsap.fromTo(vid, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'power1.out' });
      const onTime = () => { if (vid.currentTime >= VID.revealAt) { vid.removeEventListener('timeupdate', onTime); commitReveal(game, vid); } };
      vid.addEventListener('timeupdate', onTime);
      vid.addEventListener('ended', () => commitReveal(game, vid), { once: true });
      const guard = setTimeout(() => { vid.removeEventListener('timeupdate', onTime); commitReveal(game, vid); }, VID.guardMs);
      vid.play().then(() => {}).catch(() => { clearTimeout(guard); vid.removeEventListener('timeupdate', onTime); commitReveal(game, vid); });
    });
    // dpad: arrows walk the dealt cards, Enter commits (native button)
    usScene.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const cards = [...usScene.querySelectorAll('.us-card')];
      const cur = cards.indexOf(document.activeElement);
      const next = cur < 0 ? 0 : Math.min(cards.length - 1, Math.max(0, cur + (e.key === 'ArrowRight' ? 1 : -1)));
      cards[next].focus(); e.preventDefault();
    });
    $('getStarted').addEventListener('click', goPick);
    $('setsBack').addEventListener('click', () => switchView('hvSets', 'hvPick'));
    $('setGrid').addEventListener('click', (e) => { const b = e.target.closest('[data-set]'); if (b) enterSet(pickGame, b.dataset.set); });
    HOME_GAMES.forEach((g) => { const im = new Image(); im.src = g.card; }); // preload the seated cards
  }

  // generic crossfade/scale between two home views
  // clean opacity crossfade — NO container scale/blur (that made the whole grid
  // appear to "reframe"); the directional motion belongs to the grid items only.
  function switchView(fromId, toId, build) {
    const from = $(fromId), to = $(toId);
    const reveal = () => { from.hidden = true; if (build) build(); to.hidden = false;
      if (window.gsap && !REDUCED) gsap.fromTo(to, { opacity: 0 }, { opacity: 1, duration: 0.4, ease: 'power2.out' }); };
    if (!window.gsap || REDUCED) { reveal(); return; }
    gsap.to(from, { opacity: 0, duration: 0.24, ease: 'power2.in', onComplete: () => { gsap.set(from, { clearProps: 'opacity' }); reveal(); } });
  }
  // "wall-less hallway": the hero line rushes past the camera, then a card from
  // each game flies AT you out of the corridor (Pokémon first), spreading from
  // centre to its spot, and cross-dissolves into that game's logo. The logos it
  // becomes ARE the picker — so the cinematic intro resolves straight into it.
  function goPick() {
    const hero = $('hvHero'), pick = $('hvPick');
    if (!window.gsap || REDUCED) { hero.hidden = true; pick.hidden = false; return; }
    pick.hidden = false;
    const logos = [...pick.querySelectorAll('.pick-logo')];
    const logoImgs = logos.map((b) => b.querySelector('img'));
    const prompt = pick.querySelector('.pick-prompt');
    gsap.set(prompt, { opacity: 0 });
    gsap.set(logoImgs, { opacity: 0 }); // hidden until each game's card resolves into it
    const cx = innerWidth / 2;
    const cards = logos.map((btn, i) => {
      const card = document.createElement('img');
      card.className = 'hall-card'; card.alt = ''; card.src = HOME_GAMES[i].card;
      btn.appendChild(card);
      return card;
    });
    gsap.set(cards, { xPercent: -50, yPercent: -50, transformOrigin: '50% 50%' }); // centre on the logo
    const tl = gsap.timeline({ onComplete: () => {
      cards.forEach((c) => c.remove());
      gsap.set(logoImgs, { clearProps: 'opacity' });
    } });
    // hero rushes toward + past the camera (sells moving down the hall)
    tl.to(hero, { opacity: 0, scale: 1.5, filter: 'blur(22px)', duration: 0.62, ease: 'power2.in' }, 0);
    tl.add(() => { hero.hidden = true; gsap.set(hero, { clearProps: 'all' }); }, 0.52);
    cards.forEach((card, i) => {
      const t = 0.42 + i * 0.34;                                  // Pokémon first, then in order
      const r = logos[i].getBoundingClientRect();
      const startX = (cx - (r.left + r.width / 2)) * 0.55;        // emerge from the corridor mouth
      tl.fromTo(card,
        { z: -2600, x: startX, rotateX: 13, opacity: 0, filter: 'blur(16px)' },
        { z: 70, x: 0, rotateX: 0, opacity: 1, filter: 'blur(0px)', duration: 0.74, ease: 'power2.out' }, t);
      tl.to(card, { z: 26, opacity: 0, scale: 1.08, duration: 0.36, ease: 'power2.inOut' }, t + 0.64); // → becomes the logo
      tl.to(logoImgs[i], { opacity: 1, duration: 0.42, ease: 'power2.out' }, t + 0.68);
    });
    tl.to(prompt, { opacity: 1, duration: 0.5, ease: 'power2.out' }, '>-0.2');
  }
  function buildSetGrid(game) {
    pickGame = game;
    const sets = setsForGame(game);
    { const nm = HOME_GAMES.find((g) => g.game === game)?.name || ''; const SH = { pokemon: 60, magic: 74, lorcana: 74, onepiece: 52 }; $('setsTitle').innerHTML = `<span class="sets-kick">Crowns &middot; ${sets.length} sets &middot; live prices</span><img class="sets-logo" src="assets/logos/${game}.png?v=79" alt="${nm}" style="height:${SH[game] || 62}px">`; }
    $('hvSets').style.setProperty('--accent', HOME_GAMES.find((g) => g.game === game)?.accent || '#7fd4f4');
    const oldSig = $('hvSets').querySelector('.sets-sigil');   // the watermark era is over (P: clean)
    if (oldSig) oldSig.remove();
    const grid = $('setGrid');
    grid.innerHTML = (() => {
      const tile = (s) => {
        // auto-discovered sets pull their logo straight from tcgdex; bundled sets
        // walk the usual chain (real per-set logo → symbol → sealed box → game logo)
        const cands = s.fresh
          ? [`https://assets.tcgdex.net/en/${(s.id.match(/^[a-z]+/i) || ['xx'])[0]}/${s.id}/logo.png`, `assets/logos/${game}.png?v=79`]
          : setMarkChain(game, s);
        const sig = String(s.code || s.name).slice(0, 4);
        const art = cands.length
          ? `<img class="st-logo ${game}" src="${cands[0]}" data-fb='${JSON.stringify(cands.slice(1))}' alt="" loading="lazy"><span class="st-fallback" aria-hidden="true">${GAME_GLYPH[game] || ''}</span>`
          : `<span class="st-sigil">${sig}</span>`;
        const nameLine = (s.name && s.name !== s.code && s.name !== sig) ? `<span class="st-name">${s.name}</span>` : '';
        return `<button type="button" class="set-tile" data-set="${s.id}"><span class="st-art">${art}</span>${nameLine}${s.count ? `<span class="st-count">${s.count} cards</span>` : ''}${s.fresh ? '<span class="st-new">New</span>' : ''}</button>`;
      };
      const label = (t) => `<div class="sg-label" role="presentation"><span>${t}</span></div>`;
      const isPromo = (s) => game === 'pokemon' && /promo|partner/i.test(s.name) && !/illustration/i.test(s.name);
      const regular = sets.filter((s) => !isPromo(s)), promos = sets.filter(isPromo);
      const promoTile = promos.length
        ? `<button type="button" class="set-tile set-tile-promos" data-set="${promos[0].id}"><span class="st-art"><span class="st-sigil">✦</span></span><span class="st-name">Promos</span><span class="st-count">${promos.length} sets</span></button>` : '';
      if (game !== 'pokemon') return regular.map(tile).join('') + promoTile;
      // Pokémon: era sections — grouped headings beat one endless wall of tiles
      // (category-page research: grouping under section labels cuts choice fatigue)
      const ERA = (s) => s.id.startsWith('fpic') ? 'First Partner Illustration'
        : s.id.startsWith('me') ? 'Mega Evolution'
        : s.id.startsWith('sv') ? 'Scarlet & Violet' : 'Just discovered';
      const order = ['Just discovered', 'First Partner Illustration', 'Mega Evolution', 'Scarlet & Violet'];
      const bins = new Map();
      regular.forEach((s) => { const e = ERA(s); if (!bins.has(e)) bins.set(e, []); bins.get(e).push(s); });
      let html = '';
      order.forEach((era) => { const b = bins.get(era); if (b && b.length) html += label(era) + b.map(tile).join(''); });
      if (promoTile) html += label('Promos') + promoTile;
      return html;
    })();
    grid.querySelectorAll('img.st-logo').forEach((img) => { // walk the logo fallback chain on error
      let fb; try { fb = JSON.parse(img.dataset.fb || '[]'); } catch (e) { fb = []; }
      img.onerror = () => { if (fb.length) img.src = fb.shift(); else img.classList.add('st-hide'); };
    });
  }
  // the chosen column has already expanded to fill the screen — reveal its set list
  // right there in the same frame (sets stagger up; the picker is hidden underneath).
  function revealSetsInPlace(game) {
    buildSetGrid(game);
    $('hvPick').hidden = true;
    $('hvSets').hidden = false;
    if (window.gsap) gsap.set('#hvSets', { clearProps: 'opacity' });
    if (window.gsap && !REDUCED) {
      // calm, functional entrance: a quiet fade-up cascade — no plate flips,
      // no watermark theatre (P: clean and smooth)
      gsap.from('#hvSets .pick-prompt', { opacity: 0, y: -10, duration: 0.45, ease: 'power2.out' });
      gsap.fromTo('#setGrid .sg-label, #setGrid .set-tile', { opacity: 0, y: 16 },
        { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out', stagger: 0.016, delay: 0.03, clearProps: 'transform' });
      gsap.from('#setsBack', { opacity: 0, x: -10, duration: 0.45, delay: 0.1, clearProps: 'opacity,transform' });
    }
  }
  // deep-link path (no column to expand): plain crossfade into the set list
  function goSets(game) {
    switchView('hvPick', 'hvSets', () => {
      buildSetGrid(game);
      if (window.gsap && !REDUCED) gsap.fromTo('#setGrid .set-tile', { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out', stagger: 0.022, delay: 0.06, clearProps: 'transform' });
    });
  }
  function goHero() { switchView('hvPick', 'hvHero'); }
  async function enterSet(game, setId) {
    hideHome();
    if (game === 'pokemon') {
      // bundled → instant; in the price index → build from it; brand-new on
      // tcgdex (auto-discovered) → live fetch, unpriced until the data lands
      if (SETS[setId]) loadSet(setId);
      else if (!(await loadPokemonSet(setId)) && !(await fetchTcgdexSet(setId))) loadSet(HOME_SET);
      landOnFirstCard();
    }
    else { await loadExternalSet(setId); landOnFirstCard(); }
    // a clean flourish that leads into the set's carousel
    if (window.gsap && !REDUCED) gsap.fromTo('main', { opacity: 0.35, scale: 0.985 },
      { opacity: 1, scale: 1, duration: 0.55, ease: 'power3.out', transformOrigin: '50% 50%', clearProps: 'transform' });
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
  function showHome() {
    homeEl.hidden = false;
    document.body.classList.add('home-open');
    buildHome();
    // straight to the universe picker — the "Every card / One wheel" splash is gone
    $('hvHero').hidden = true; $('hvPick').hidden = false; $('hvSets').hidden = true;
    if (!window.gsap) return;
    gsap.fromTo('#usBg', { opacity: 0 }, { opacity: 1, duration: 0.9, ease: 'power2.out', clearProps: 'opacity' });
    gsap.fromTo('#hvPick .uni-head > *', { opacity: 0, y: -10 },
      { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out', stagger: 0.09, delay: 0.3, clearProps: 'opacity,transform' });
    if (REDUCED || $('hvPick').classList.contains('us-fallback')) {
      gsap.fromTo('#hvPick .us-card, #hvPick .us-occ', { opacity: 0 }, { opacity: 1, duration: 0.5, ease: 'power2.out', stagger: 0.05, clearProps: 'opacity' });
      return;
    }
    // THE DEAL: the crown throws each universe's card out of the vortex to its
    // seat; the front glow settles over them, then the chips light up
    const { imgW: W, imgH: H, crown, slots } = UNI_SCENE;
    const s = Math.max(innerWidth / W, innerHeight / H);
    document.querySelectorAll('#uniScene .us-card').forEach((el) => {
      const sl = slots[+el.dataset.slot];
      gsap.fromTo(el,
        { x: (crown.x - sl.cx) * s * 0.92, y: (crown.y - sl.cy) * s * 0.92, scale: 0.28, rotation: sl.angle + 32, opacity: 0 },
        { x: 0, y: 0, scale: 1, rotation: sl.angle, opacity: 1, duration: 0.8, ease: 'back.out(1.25)', delay: 0.22 + (+el.dataset.slot) * 0.09, clearProps: 'opacity' });
    });
    gsap.fromTo('#uniScene .us-occ', { opacity: 0 }, { opacity: 1, duration: 0.45, ease: 'power2.out', delay: 0.85, clearProps: 'opacity' });
    gsap.fromTo('#uniScene .us-chip', { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.07, delay: 0.9, ease: 'power3.out', clearProps: 'transform' });
  }
  function hideHome() { homeEl.hidden = true; document.body.classList.remove('home-open'); }
  document.querySelector('.lockup').addEventListener('click', () => { location.href = 'index.html'; }); // brand mark → real homepage

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
    if (mscrub) {
      const f = N > 1 ? slot / (N - 1) : 0.5;
      mscrub.querySelector('.m-scrub-fill').style.width = (f * 100) + '%';
      mscrub.querySelector('.m-scrub-thumb').style.left = (f * 100) + '%';
    }
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
    const s = current >= 0 ? current : 0;
    requestAnimationFrame(() => mScrollTo(s, false));
  }
  function bindScrub() {                        // drag the scrubber to fly through the set
    const track = mscrub.querySelector('.m-scrub-track');
    const bubble = mscrub.querySelector('.m-scrub-bubble');
    let dragging = false;
    const fracAt = (e) => { const r = track.getBoundingClientRect(); return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)); };
    const move = (e) => {
      const f = fracAt(e), slot = Math.round(f * (N - 1));
      const card = CARDS[view[slot]];
      bubble.hidden = false;
      bubble.style.left = (f * 100) + '%';
      bubble.textContent = card.sealed ? 'Sealed' : ('#' + card.localId);
      mScrollTo(slot, false);
    };
    track.addEventListener('pointerdown', (e) => { dragging = true; try { track.setPointerCapture(e.pointerId); } catch (err) { /* inactive pointer */ } move(e); });
    track.addEventListener('pointermove', (e) => { if (dragging) move(e); });
    const end = () => { dragging = false; setTimeout(() => { bubble.hidden = true; }, 450); };
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
    mscrub.innerHTML = '<div class="m-scrub-track"><div class="m-scrub-fill"></div><div class="m-scrub-thumb"></div></div><div class="m-scrub-bubble" hidden></div>';
    document.querySelector('main').after(mscrub);
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
  // a set we don't carry (or no set) → drop into that universe's set picker
  const toUniverse = () => {
    homeEl.hidden = false; document.body.classList.add('home-open'); buildHome();
    $('hvHero').hidden = true; $('hvPick').hidden = true; goSets(reqGame);
  };
  requestAnimationFrame(tick);
  mobileInit();   // on phones: build the snap-carousel before the first set loads
  discoverSets(); // fire-and-forget: new tcgdex sets appear in the grid automatically
  if (isExternalReq) {
    Promise.resolve(loadExternalSet(reqSet)).then(() => { if (deepCard >= 1) openDeep(); });
  } else if (reqSet && SETS[reqSet]) {
    loadSet(reqSet); openDeep();
  } else if (reqSet) {                                   // unrecognized id → lazy-fetch the tcgdex Pokémon set into the wheel
    loadPokemonSet(reqSet).then((ok) => { if (ok) { if (deepCard >= 1) openDeep(); } else { loadSet(HOME_SET); if (validGame) toUniverse(); else showHome(); } });
  } else {
    loadSet(HOME_SET);
    if (validGame) toUniverse(); else showHome();
  }
})();
