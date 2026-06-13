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
  const safeImg = (url) => (typeof url === 'string' && url.startsWith('https://assets.tcgdex.net/')) ? url : '';

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
  const capName = $('capName'), capMeta = $('capMeta'), capPrice = $('capPrice'),
    capRarity = $('capRarity'), counter = $('counter');
  const stageGlow = $('stageGlow');
  const zoom = $('zoom'), zoomImg = $('zoomImg'), zoomClose = $('zoomClose');
  const tiltZone = $('tiltZone'), tiltCard = $('tiltCard'), shine = $('shine'), cardFaces = $('cardFaces');

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
      el.inert = true;
      const img = document.createElement('img');
      img.alt = card.sealed ? `${card.name} — sealed product` : `${card.name} — card ${card.localId} of ${data.set.name}`;
      img.draggable = false;
      const ph = document.createElement('div');
      ph.className = 'ph';
      ph.textContent = card.name;
      if (card.sealed) {
        el.classList.add('sealed');     // floats the transparent render, no card frame
        img.src = card.image;           // local PNG — no webp quality ladder
      } else {
        img.addEventListener('error', () => {
          if (img.dataset.q === 'high') {            // high failed -> drop to low
            img.dataset.q = 'low';
            img.src = safeImg(card.image + '/low.webp');
          } else {                                    // low failed -> placeholder
            el.classList.add('noimg');
          }
        });
      }
      const tag = document.createElement('span');
      tag.className = 'inspect-tag';
      tag.textContent = 'inspect';
      tag.setAttribute('aria-hidden', 'true'); // the card itself is the button
      el.append(img, ph, tag);
      return { el, img, loaded: card.sealed ? 'high' : null };
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
    if (q === 'high' && card.imageOk === false) q = 'low';
    if (q === 'high') {
      const pre = new Image();
      pre.onload = () => { slot.img.dataset.q = 'high'; slot.img.src = pre.src; slot.loaded = 'high'; };
      pre.src = safeImg(card.image + '/high.webp');
    } else if (!slot.loaded) {
      slot.img.dataset.q = 'low';
      slot.img.src = safeImg(card.image + '/low.webp');
      slot.loaded = 'low';
    }
  }

  // --- Layout ------------------------------------------------------------------
  function measure() {
    const h = wheel.clientHeight * L.WHEEL_CARD_HEIGHT_FACTOR; // pinned in layout-constants.js
    cardW = h * (734 / 1024);
    spacing = cardW; // base unit; the focus-pocket curve shapes actual gaps
  }
  addEventListener('resize', () => { measure(); render(true); });

  // --- Render ------------------------------------------------------------------
  const WINDOW = 10; // paint ±10 around position (smaller cards pack more in view)
  let painted = new Set();
  function render(force) {
    const lo = Math.max(0, Math.floor(position) - WINDOW);
    const hi = Math.min(N - 1, Math.ceil(position) + WINDOW);
    const next = new Set();
    for (let i = lo; i <= hi; i++) next.add(i);
    for (const i of painted) if (!next.has(i)) {
      els[view[i]].el.style.visibility = 'hidden';
    }
    for (let i = lo; i <= hi; i++) {
      const d = i - position;
      const ad = Math.abs(d);
      // premium curve (aristidebenoist-style): one smooth gaussian "bump" —
      // scale, lift, brightness and tilt all ride the same continuous pocket,
      // so the swipe reads as one fluid wave instead of stepped keyframes
      const pocket = Math.exp(-(d * d) / 1.1); // wide: smooth depth/tilt/light
      // scale rides a SHARP pocket so only the focused card grows — the field
      // around it stays at its base size (P: focus decently bigger, rest same)
      const sPocket = Math.exp(-(d * d) / 0.42);
      const scale = 0.84 + 0.34 * sPocket;
      const bright = 0.58 + 0.42 * pocket;
      // spherical ring: side cards sink a touch, recede in Z, and turn away
      // around Y — one shared vanishing point (perspective lives on .track)
      const arcY = (1 - pocket) * spacing * 0.045;
      const zRec = -(1 - pocket) * 110;
      const yaw = Math.max(-26, Math.min(26, -d * 9)) * (1 - pocket * 0.5);
      const el = els[view[i]].el;
      el.style.visibility = 'visible';
      // deck fan: side cards overlap ~15% of their width; only the focused
      // card gets full clearance (neighbor centers sit at 1.0 card out)
      const xu = d * 0.66 + Math.sign(d) * Math.min(ad, 1) * 0.34;
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
      prev.inert = true;
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
    cEl.removeAttribute('aria-hidden');
    cEl.inert = false;
    cEl.setAttribute('role', 'button');
    cEl.setAttribute('aria-label', `Inspect ${card.name}`);

    glowSwap(capName, card.name); // ALL-CAPS via CSS; seeps in between cards
    // rarity rides the TOP line, above the wheel, in its signature color
    if (card.sealed) capRarity.style.color = 'var(--ember-glint)';
    else capRarity.style.color = rarityColor(card.rarity);
    const rarityLine = card.sealed ? 'SEALED PRODUCT' : (card.rarity ? card.rarity.toUpperCase() : ' ');
    glowSwap(capRarity, rarityLine);
    capMeta.replaceChildren();
    const num = document.createElement('span');
    num.textContent = card.sealed
      ? (card.sealedMeta.detail || 'sealed product')
      : `${card.localId}/${String(DATA.set.official).padStart(3, '0')}`;
    capMeta.appendChild(num);
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

    counter.textContent = String(idx + 1).padStart(3, '0');
    const span = document.createElement('span');
    span.textContent = `/${N}`;
    counter.appendChild(span);

    // dial tracks the current slot along the tick strip
    $('railThumb').style.left =
      `${(ticksBox.offsetLeft + (idx / (N - 1)) * ticksBox.offsetWidth).toFixed(1)}px`;

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
        pre.src = safeImg(card.image + '/high.png');
      }
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
      `translate3d(${(Math.sin(t * TAU / 28) * 3.2).toFixed(3)}%, ${(Math.cos(t * TAU / 23) * 2).toFixed(3)}%, 0)` +
      ` scale(${(1.06 + Math.sin(t * TAU / 37) * 0.05).toFixed(4)})`;
    bgGrain.style.transform =
      `translate3d(${(Math.sin(t * TAU / 50 + 2) * 2).toFixed(3)}%, ${(Math.cos(t * TAU / 41) * 1.3).toFixed(3)}%, 0)`;
    // the keylight sways slowly and breathes a touch harder than the glass
    bgLight.style.transform =
      `translate3d(${(Math.sin(t * TAU / 45 + 1) * 4).toFixed(3)}%, ${(Math.cos(t * TAU / 38) * 3).toFixed(3)}%, 0)`;
    bgLight.style.opacity = (0.78 + 0.22 * Math.sin(t * TAU / 17)).toFixed(3);
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
    target = Math.max(0, Math.min(N - 1, idx));
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
    tickEls.forEach(t => ticksBox.appendChild(t)); // reorder existing nodes
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
  }
  let sortMode = 'value-desc';
  $('sortCtl').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-sort]');
    if (!btn) return;
    for (const b of $('sortCtl').querySelectorAll('button')) {
      b.setAttribute('aria-pressed', String(b === btn));
    }
    sortMode = btn.dataset.sort;
    applySort(sortMode);
  });

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
    bgLight.style.background =
      `radial-gradient(95% 72% at 50% -14%, ${hexA(a, 0.17)} 0%, transparent 62%),` +
      ` radial-gradient(72% 95% at 106% 80%, ${hexA(b, 0.13)} 0%, transparent 58%),` +
      ` linear-gradient(118deg, transparent 36%, ${hexA(c, 0.09)} 50%, transparent 64%)`;
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

  // --- Set switching -----------------------------------------------------------------
  function loadSet(id) {
    DATA = SETS[id];
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
      o.value = `${c.name} · ${c.localId}`;
      dl.appendChild(o);
    });
    // footer snapshot label + staleness follow the set
    $('snapshotLabel').textContent =
      `${DATA.set.name} · ${DATA.set.total} cards · market snapshot via TCGdex · refreshed ${new Date(DATA.snapshotAt).toLocaleString()}`;
    $('staleNotice').hidden = Date.now() - Date.parse(DATA.snapshotAt) <= 7 * 864e5;
    // selector reflects the active set
    const btnLogo = $('setBtnLogo');
    btnLogo.src = safeImg(DATA.set.logo + '.png');
    btnLogo.alt = DATA.set.name;
    $('setBtn').setAttribute('aria-label', `${DATA.set.name} — switch set`);
    setMenu.querySelectorAll('.set-item').forEach((b) => {
      b.classList.toggle('active', b.dataset.set === id);
    });
    pfNext = 0; // restart idle prefetch for this set
    current = -1;
    painted = new Set();
    applySort(sortMode); // rebuilds view/ticks order and lands per mode
    // relight the stage in this set's colors (async; guard against re-switch)
    extractLogoColors(safeImg(DATA.set.logo + '.png'), (cols) => {
      if (DATA.set.id !== id) return;
      applyAmbience(cols || AMB_DEFAULT);
    });
  }

  // Era-grouped dropdown, newest sets first. Only sets with data appear.
  const SET_GROUPS = [
    { series: 'Mega Evolution', ids: ['me04', 'me03', 'me02.5', 'me02', 'me01'] },
    { series: 'Scarlet & Violet', ids: ['sv10.5w', 'sv10.5b', 'sv10', 'sv09', 'sv08.5', 'sv08', 'sv07', 'sv06.5', 'sv06', 'sv05', 'sv04.5', 'sv04', 'sv03.5', 'sv03', 'sv02', 'sv01'] },
  ];
  const setBtn = $('setBtn'), setMenu = $('setMenu');
  function toggleSetMenu(open) {
    setMenu.hidden = !open;
    setBtn.setAttribute('aria-expanded', String(open));
  }
  for (const group of SET_GROUPS) {
    const ids = group.ids.filter(id => SETS[id]);
    if (!ids.length) continue;
    const head = document.createElement('div');
    head.className = 'set-group';
    head.textContent = group.series;
    setMenu.appendChild(head);
    for (const id of ids) {
      const s = SETS[id].set;
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'set-item';
      item.dataset.set = id;
      const img = document.createElement('img');
      img.src = safeImg(s.logo + '.png');
      img.alt = '';
      img.addEventListener('error', () => { img.style.visibility = 'hidden'; });
      const name = document.createElement('span');
      name.className = 'si-name';
      name.textContent = s.name;
      const count = document.createElement('span');
      count.className = 'si-count';
      count.textContent = String(s.total);
      item.append(img, name, count);
      item.addEventListener('click', () => {
        toggleSetMenu(false);
        if (DATA.set.id !== id) loadSet(id);
      });
      setMenu.appendChild(item);
    }
  }
  setBtn.addEventListener('click', () => toggleSetMenu(setMenu.hidden));

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
        if (slot === current) openZoomFor(slot, cardEl); // focused card → inspect
        else goTo(slot);                                  // any other → glide it to focus
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
    const r = ticksBox.getBoundingClientRect();
    const f = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    return Math.round(f * (N - 1));
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
    $('wishCount').textContent = `♥ ${wishlist.size}`;
    $('collCount').textContent = `◆ ${collection.size}`;
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

  // --- Inspect scene: editorial title + holo badge + animated holo backdrop ---
  const zTitle = $('zTitle');
  const sirBadge = $('sirBadge');
  const RARITY_CODE = {
    'common': 'C', 'uncommon': 'U', 'rare': 'R', 'double rare': 'RR',
    'ace spec rare': 'ACE', 'illustration rare': 'IR', 'ultra rare': 'UR',
    'special illustration rare': 'SIR', 'hyper rare': 'HR',
    'black white rare': 'BWR', 'mega hyper rare': 'MHR',
  };
  let sceneTweens = [];

  // the NAME — per-char spans that rise + sharpen on open (elegant, not glitchy)
  function buildTitle(card) {
    zTitle.replaceChildren();
    zTitle.style.setProperty('--name-glow', rarityColor(card.rarity) + '99');
    // words keep their letters together (inline-block per char would wrap mid-word)
    for (const word of card.name.split(' ')) {
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
    if (window.gsap && !REDUCED) {
      // long smooth rise behind the mask (aristide); total stagger length CAPPED
      sceneTweens.push(gsap.fromTo(zTitle.querySelectorAll('.ch'),
        { yPercent: 125, opacity: 0 },
        { yPercent: 0, opacity: 1, duration: 1.05, ease: 'expo.out',
          stagger: { amount: 0.5, from: 'start' }, delay: 0.05 }));
    }
  }

  // holographic rarity badge left of the card; iridescent sheen drifts (GSAP)
  function buildBadge(card) {
    const code = card.sealed ? 'BOX' : RARITY_CODE[(card.rarity || '').toLowerCase()];
    if (!code) { sirBadge.hidden = true; return; }
    sirBadge.hidden = false;
    sirBadge.replaceChildren();
    const c = document.createElement('div'); c.className = 'code'; c.textContent = code;
    const f = document.createElement('div'); f.className = 'full';
    f.textContent = card.sealed ? 'Sealed' : (card.rarity || '');
    sirBadge.append(c, f);
    if (window.gsap && !REDUCED) {
      const proxy = { x: 0, streak: -80 };
      sceneTweens.push(gsap.to(proxy, { x: 100, duration: 6.5, ease: 'sine.inOut', repeat: -1, yoyo: true,
        onUpdate: () => sirBadge.style.setProperty('--holo-x', proxy.x + '%') }));
      sceneTweens.push(gsap.fromTo(proxy, { streak: -80 }, { streak: 120, duration: 2.6, ease: 'power1.inOut',
        repeat: -1, repeatDelay: 1.6, onUpdate: () => sirBadge.style.setProperty('--holo-streak', proxy.streak + '%') }));
      sceneTweens.push(gsap.fromTo(sirBadge, { opacity: 0, x: -18, scale: 0.9 },
        { opacity: 1, x: 0, scale: 1, duration: 0.5, ease: 'back.out(1.6)', delay: 0.15 }));
    }
  }

  function paintZoomScene(card) {
    buildTitle(card);
    buildBadge(card);
    holoSetTint(rarityColor(card.rarity));
  }
  function resetZoomScene() {
    sceneTweens.forEach(t => t && t.kill());
    sceneTweens = [];
    resetParallax();
    if (window.gsap) gsap.set([zTitle, $('cardCol')], { clearProps: 'transform' });
    zTitle.replaceChildren();
    sirBadge.replaceChildren();
    sirBadge.hidden = true;
  }

  // --- three.js holographic animated backdrop --------------------------------
  const HOLO_FRAG = `
    precision highp float;
    uniform float uTime; uniform vec2 uRes; uniform vec3 uTint;
    void main(){
      vec2 uv = gl_FragCoord.xy / uRes.xy;
      vec2 p = uv - 0.5; p.x *= uRes.x / uRes.y;
      float t = uTime * 0.05;
      float w1 = sin((p.x + p.y) * 4.0 + t * 6.2831);
      float w2 = sin((p.x - p.y) * 7.0 - t * 4.2 + sin(p.x * 3.0 + t * 2.0));
      float m = (w1 + w2) * 0.25 + 0.5;
      vec3 irid = 0.5 + 0.5 * cos(6.2831 * (vec3(0.0, 0.33, 0.66) + m * 1.3));
      vec3 col = mix(uTint, irid, 0.62);
      float vig = smoothstep(1.28, 0.12, length(p));
      col *= 0.11 + 0.40 * vig;           // VIBRANT — lifts the whole screen
      col += irid * 0.06;                 // iridescent bloom
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

  // --- aristide-style mouse parallax: name (far), backdrop (mid), card (near) -
  let parallax = null;
  function initParallax() {
    if (!window.gsap || REDUCED) return;
    const q = (el, p, d) => gsap.quickTo(el, p, { duration: d, ease: 'power3' });
    parallax = {
      nx: q(zTitle, 'x', 1.0), ny: q(zTitle, 'y', 1.0),
      bx: q($('zoomBg'), 'x', 1.25), by: q($('zoomBg'), 'y', 1.25),
      cx: q($('cardCol'), 'x', 0.7), cy: q($('cardCol'), 'y', 0.7),
    };
  }
  function applyParallax(e) {
    if (!parallax || !zoom.open) return;
    const nx = e.clientX / innerWidth - 0.5, ny = e.clientY / innerHeight - 0.5;
    parallax.nx(nx * -58); parallax.ny(ny * -44); // name drifts most (far layer)
    parallax.bx(nx * -30); parallax.by(ny * -26); // backdrop mid
    parallax.cx(nx * 18); parallax.cy(ny * 18);   // card nearest, follows cursor
  }
  function resetParallax() {
    if (!parallax) return;
    parallax.nx(0); parallax.ny(0); parallax.bx(0); parallax.by(0); parallax.cx(0); parallax.cy(0);
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
  // editorial line+area chart: smooth primary line over a fading area fill,
  // a haloed endpoint, faint x labels. Holo printing rides a dashed overlay.
  let sparkSeq = 0;
  function sparkline(seriesList) {
    const all = seriesList.map(s => s.pts.filter(p => typeof p.v === 'number'));
    if (!all[0] || all[0].length < 2) return null;
    const W = 320, H = 118, PX = 12, PT = 14, PB = 20;
    const vs = all.flat().map(p => p.v);
    const mn = Math.min(...vs), mx = Math.max(...vs), span = (mx - mn) || mx * 0.1 || 1;
    const lo = mn - span * 0.22, hi = mx + span * 0.22, rng = hi - lo;
    const y = (v) => PT + (H - PT - PB) * (1 - (v - lo) / rng);
    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'spark', role: 'img', preserveAspectRatio: 'none' });
    const gid = `sf${++sparkSeq}`;
    const defs = svgEl('defs', {});
    const grad = svgEl('linearGradient', { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 });
    grad.append(
      svgEl('stop', { offset: '0%', 'stop-color': seriesList[0].color, 'stop-opacity': 0.34 }),
      svgEl('stop', { offset: '100%', 'stop-color': seriesList[0].color, 'stop-opacity': 0 }));
    defs.append(grad); svg.append(defs);
    all.forEach((pts, si) => {
      if (pts.length < 2) return;
      const color = seriesList[si].color;
      const x = (i) => PX + i * ((W - 2 * PX) / (pts.length - 1));
      const line = pts.map((p, i) => `${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
      if (si === 0) {
        svg.append(svgEl('polygon', { points: `${PX},${H - PB} ${line} ${(W - PX).toFixed(1)},${H - PB}`, fill: `url(#${gid})`, stroke: 'none' }));
      }
      svg.append(svgEl('polyline', {
        points: line, fill: 'none', stroke: color,
        'stroke-width': si > 0 ? 1.5 : 2.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
        ...(si > 0 ? { 'stroke-dasharray': '4 4', opacity: 0.65 } : {}),
      }));
      if (si === 0) {
        const lx = x(pts.length - 1), ly = y(pts[pts.length - 1].v);
        svg.append(svgEl('circle', { cx: lx, cy: ly, r: 6.5, fill: 'none', stroke: color, 'stroke-opacity': 0.35 }));
        svg.append(svgEl('circle', { cx: lx, cy: ly, r: 3.4, fill: color }));
        pts.forEach((p, i) => {
          const lab = svgEl('text', { x: x(i).toFixed(1), y: H - 5, class: 'spark-lab',
            'text-anchor': i === 0 ? 'start' : (i === pts.length - 1 ? 'end' : 'middle') });
          lab.textContent = p.l; svg.append(lab);
        });
      }
    });
    return svg;
  }
  function buildCharts(card) {
    const box = $('zCharts');
    box.replaceChildren();
    const cm = card.cardmarket;
    if (!cm) return;
    const toPts = (src) => [
      { l: '30d', v: eurToUsd(src.avg30) },
      { l: '7d', v: eurToUsd(src.avg7) },
      { l: '24h', v: eurToUsd(src.avg1) },
    ];
    const seriesList = [{ pts: toPts(cm), color: tierColor('--spectral') }];
    if (cm.holo) seriesList.push({ pts: toPts(cm.holo), color: tierColor('--phantom') });
    const sp = sparkline(seriesList);
    if (!sp) return;
    const wrap = document.createElement('figure');
    wrap.className = 'chart';
    const cap = document.createElement('figcaption');
    cap.textContent = cm.holo ? 'Trend · normal / holo' : 'Price trend';
    sp.setAttribute('aria-label', 'Price trend in USD');
    wrap.append(cap, sp);
    box.appendChild(wrap);
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

  // pull-rate ladder as clean hairline rows (sealed view = "what's in the box")
  function buildPulls(card, ladder) {
    const box = $('zPulls');
    box.replaceChildren();
    if (!ladder) return;
    const hd = document.createElement('div');
    hd.className = 'z-hd';
    hd.textContent = `Pull rates · ${DATA.set.name}`;
    box.appendChild(hd);
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

  // --- "Other <species> cards" — clickable strip, jumps to that card ---------
  function buildFamily(card) {
    const box = $('zFamily');
    box.replaceChildren();
    const group = speciesGroup(card.name)
      .filter(e => e.card.id !== card.id)
      .sort((a, b) => (b.card.priceUsd ?? -1) - (a.card.priceUsd ?? -1));
    if (!group.length) return;
    const head = document.createElement('div');
    head.className = 'z-hd';
    const species = card.name.replace(/^Mega\s+/i, '').replace(/\s+(?:ex|gx|v|vmax|vstar)$/i, '');
    head.textContent = `Other ${species}`;
    box.appendChild(head);
    const strip = document.createElement('div');
    strip.className = 'family-strip';
    for (const { setId, card: c } of group) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'family-card';
      btn.title = `${c.name} — ${SETS[setId].set.name}`;
      const img = document.createElement('img');
      img.loading = 'lazy';
      img.alt = c.name;
      img.src = safeImg(c.image + '/low.webp');
      img.addEventListener('error', () => { btn.classList.add('noimg'); });
      const meta = document.createElement('span');
      meta.className = 'family-meta';
      const price = typeof c.priceUsd === 'number' ? `$${c.priceUsd.toFixed(2)}`
        : (c.cardmarket?.trend != null ? `$${eurToUsd(c.cardmarket.trend).toFixed(2)}` : '—');
      meta.textContent = price; // money green via CSS
      btn.append(img, meta);
      btn.addEventListener('click', () => inspectRef(setId, c.id));
      strip.appendChild(btn);
    }
    box.appendChild(strip);
  }

  // jump the open inspect to another card (loads its set if needed)
  function inspectRef(setId, cardId) {
    if (DATA.set.id !== setId) loadSet(setId);
    const ci = CARDS.findIndex(c => c.id === cardId);
    if (ci < 0) return;
    openZoomFor(slotOf[ci]);
  }

  const openZoom = () => openZoomFor(current);

  function openZoomFor(i, srcEl) {
    const card = cardAt(i);
    const wasOpen = zoom.open; // already inspecting → in-place switch, not a fresh open
    cancelZoomAnims();
    zoomClosing = false;
    // FLIP source = the card the user actually clicked, captured before any reposition
    const flipSrc = (srcEl ?? els[view[i]].el).getBoundingClientRect();
    if (i !== current) goTo(i, true); // reposition behind the modal; close returns here
    zoomReturnEl = els[view[i]].el;
    zoomImg.alt = card.name;
    // blur-up: show THIS card's low scan instantly (already cached by the wheel),
    // then sharpen to high.webp — small and usually already warmed by the wheel's
    // idle prefetch, so the inspect crisps almost immediately. The heavy PNG loads
    // quietly afterward only to feed the loupe (no visible flash; same image).
    const ig = ++imgGen;
    tiltCard.classList.toggle('sealed', !!card.sealed); // floats the render, no frame
    // SHARED-ELEMENT CONTINUITY: open the featured card on the EXACT bytes the
    // wheel card is already painting, so frame 1 of the morph is pixel-identical
    // (no decode flash, no blur-up). Then sharpen on the SAME element with NO
    // opacity fade — it's the same picture at higher resolution.
    const wheelImg = els[view[i]].img;
    const liveSrc = wheelImg && (wheelImg.currentSrc || wheelImg.src);
    if (card.sealed) {
      zoomImg.src = card.image; // local transparent product render
    } else {
      zoomImg.src = liveSrc || safeImg(card.image + '/low.webp');
      if (card.imageOk !== false) {
        const webp = new Image();
        webp.onload = () => {
          if (ig !== imgGen) return; // a newer card took over
          zoomImg.src = webp.src; // same picture, higher res — never fade the card
          const png = new Image();
          png.onload = () => { if (ig === imgGen) zoomImg.src = png.src; };
          png.src = safeImg(card.image + '/high.png');
        };
        webp.src = safeImg(card.image + '/high.webp');
      }
    }
    $('zoomBgArt').src = card.sealed ? card.image : safeImg(card.image + '/low.webp');
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
    const lbl = document.createElement('div'); lbl.className = 'lbl';
    zPrice.append(amt, lbl);
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
      lbl.textContent = m.marketUsd != null ? `market · ${m.source} · ${m.checked}` : 'price not yet sourced';
      if (m.detail) qrow('Contents', m.detail);
      $('zCharts').replaceChildren();
      $('zTable').replaceChildren();
      $('zFamily').replaceChildren();
      buildPulls(card, pullLadderFor(DATA.set.id)); // what's inside: the set's odds
      zCredit.textContent = m.note || (m.marketUsd != null ? `verified ${m.source} · ${m.checked}` : 'price tracking pending');
    } else {
      const usd = typeof card.priceUsd === 'number' ? card.priceUsd
        : (card.cardmarket?.trend != null ? eurToUsd(card.cardmarket.trend) : null);
      amt.textContent = usd != null ? `$${usd.toFixed(2)}` : '—';
      amt.classList.toggle('none', usd == null);
      lbl.textContent = typeof card.priceUsd === 'number'
        ? `market · ${VARIANT_LABEL[card.priceVariant] ?? card.priceVariant} · TCGplayer`
        : (card.cardmarket?.trend != null ? 'trend · Cardmarket' : 'unpriced');
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
      const pull = cardPullRate(card);
      if (pull) qrow('Pull rate', pull.text, `1 of ${pull.pool} ${card.rarity}${pull.pool > 1 ? 's' : ''} in set`);
      buildCharts(card);
      buildVariantTable(card);
      buildFamily(card);
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
        // in-place switch to another card of the same Pokémon: quick crossfade,
        // no FLIP (the card is already centered) — reads as a smooth shuffle
        reg(tiltCard.animate(
          [{ opacity: 0.2, transform: 'scale(0.96)' }, { opacity: 1, transform: 'none' }],
          { duration: 300, easing: L.EASE_PREMIUM }));
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
          tiltCard.style.transform = '';                            // resting state = CSS none (no end-snap)
          if (gen === openGen && zoomReturnEl) zoomReturnEl.style.visibility = '';
        };
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
    if (REDUCED) { zoom.close(); return; }
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

  // --- Idle prefetch: warm the cache with every high.webp so the wheel is crisp anywhere ---
  let pfNext = 0;
  function prefetchChain() {
    while (pfNext < N && (els[pfNext].loaded === 'high' || CARDS[pfNext].imageOk === false)) pfNext++;
    if (pfNext >= N) return;
    const i = pfNext++;
    const im = new Image();
    im.decoding = 'async';
    im.onload = im.onerror = () => setTimeout(prefetchChain, 60);
    im.src = safeImg(CARDS[i].image + '/high.webp');
  }
  setTimeout(() => { prefetchChain(); prefetchChain(); prefetchChain(); }, 1500);

  // --- Boot --------------------------------------------------------------------------------
  measure();
  initHolo();
  initParallax();
  updateListCounts();
  const qs = new URLSearchParams(location.search);
  loadSet(SETS[qs.get('set')] ? qs.get('set') : HOME_SET); // ?set=me02.5 deep-links a set
  // ?card=N deep-links a card (by collector number) and opens its inspect
  const deepLink = parseInt(qs.get('card'), 10);
  if (deepLink >= 1 && deepLink <= N) {
    position = slotOf[deepLink - 1];
    current = -1;
    render(true);
  }
  requestAnimationFrame(tick);
  if (deepLink >= 1 && deepLink <= N) setTimeout(() => openZoomFor(slotOf[deepLink - 1]), 450);
})();
