// Crowns store demo: one sealed product (product.html?id=<TCGplayer product id>; ?set=&box= still works).
// Data and model: store-data.js (window.STORE). Shared parts (cart, one-size images, header): store-ui.js.
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const S = window.STORE, U = window.STOREUI, G = window.gsap;
  const { fmt2, fmtDate, esc } = S;
  const { REDUCED, EASE } = U;
  const qs = new URLSearchParams(location.search);

  // ---------------------------------------------------------------- which product
  function fromUrl() {
    const q = new URLSearchParams(location.search);
    return S.byId(q.get('id')) || (q.get('set') && S.bySetKey(q.get('set'), q.get('box') || 'pc-etb')) || S.byId(684452);
  }
  let P = fromUrl();
  const siblings = (p) => S.products().filter((x) => x.setId === p.setId).sort((a, b) => b.price - a.price);

  // ---------------------------------------------------------------- the box image, its gallery and the light pool
  const heroImg = $('heroImg');
  heroImg.dataset.norm = 'hero';
  function aimPool() {   // the shared ground's one light pool sits behind the box (viewport coordinates; the ground is fixed)
    const r = $('fig').getBoundingClientRect(), y = r.top + scrollY;
    document.body.style.setProperty('--app-pool-x', ((r.left + r.width / 2) / innerWidth * 100).toFixed(1) + '%');
    document.body.style.setProperty('--app-pool-y', ((y + r.height / 2) / innerHeight * 100).toFixed(1) + '%');
  }
  addEventListener('resize', aimPool);
  function boxColour(img) {
    try {
      const W = 40, H = 40, c = document.createElement('canvas'); c.width = W; c.height = H;
      const x = c.getContext('2d', { willReadFrequently: true });
      x.drawImage(img, 0, 0, W, H);
      const d = x.getImageData(0, 0, W, H).data;
      const bins = Array.from({ length: 12 }, () => ({ w: 0, r: 0, g: 0, b: 0 }));
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 160) continue;
        const r = d[i], g = d[i + 1], b = d[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b);
        const s = mx ? (mx - mn) / mx : 0, v = mx / 255;
        if (s < 0.22 || v < 0.3) continue;
        let h = mx === r ? ((g - b) / (mx - mn)) % 6 : mx === g ? (b - r) / (mx - mn) + 2 : (r - g) / (mx - mn) + 4;
        h = (h * 60 + 360) % 360;
        const k = Math.floor(h / 30) % 12, w = s * v;
        bins[k].w += w; bins[k].r += r * w; bins[k].g += g * w; bins[k].b += b * w;
      }
      const best = bins.reduce((a, b) => (b.w > a.w ? b : a));
      return best.w ? `rgb(${Math.round(best.r / best.w)}, ${Math.round(best.g / best.w)}, ${Math.round(best.b / best.w)})` : null;
    } catch (e) { return null; }
  }
  let gallery = [], galleryAt = 0;
  function mediaOf(p) {
    const items = [{ k: 'box', label: 'The box', src: p.hero, thumb: p.img, alt: `${p.set} ${p.name}` }];
    if (S.PACK[p.setId]) items.push({ k: 'pack', label: 'A booster pack', src: S.PACK[p.setId], thumb: S.PACK[p.setId], alt: `${p.set} booster pack` });
    const top = S.topCards(p.setId, 1)[0];
    if (top) items.push({ k: 'chase', label: `Top hit: ${top.name}`, src: top.img, thumb: top.thumb, alt: `${top.name}, ${top.rarity}`, card: true });
    return items;
  }
  function renderThumbs() {
    $('thumbs').innerHTML = gallery.map((m, i) => `<button class="pd-thumb" type="button" aria-pressed="${i === galleryAt}" data-i="${i}" aria-label="${esc(m.label)}">
      <img class="${m.card ? 'is-card ' : ''}${/^https?:/.test(m.thumb) ? 'pd-fade' : ''}" data-norm="thumb" src="${esc(m.thumb)}" alt=""></button>`).join('');
    $('gal').hidden = gallery.length < 2;
    U.normaliseAll($('thumbs'));
    syncGal();
    U.markLoaded();
  }
  function syncGal() {
    $('galPrev').disabled = galleryAt <= 0;
    $('galNext').disabled = galleryAt >= gallery.length - 1;
    $('thumbs').querySelectorAll('.pd-thumb').forEach((b, j) => b.setAttribute('aria-pressed', String(j === galleryAt)));
  }
  function showMedia(i, dir) {
    const m = gallery[i]; if (!m) return;
    galleryAt = i; syncGal();
    const next = new Image();
    next.src = m.src;
    const show = () => {
      heroImg.src = m.src; heroImg.alt = m.alt;
      heroImg.classList.toggle('is-card', !!m.card);
      U.placeIn(heroImg, U.FILL.hero, !!m.card);
      if (!/^https?:/.test(m.src)) { const col = boxColour(next); if (col) document.body.style.setProperty('--app-accent', col); }
      aimPool();
      if (dir && G && !REDUCED) G.fromTo(heroImg, { opacity: 0, x: 36 * dir }, { opacity: 1, x: 0, duration: 0.55, ease: EASE });
      else if (G) G.set(heroImg, { opacity: 1, x: 0 });
    };
    const ready = (next.decode ? next.decode() : Promise.resolve()).catch(() => {});
    if (dir && G && !REDUCED) G.to(heroImg, { opacity: 0, x: -24 * dir, duration: 0.18, ease: 'power2.in', onComplete: () => ready.then(show) });
    else ready.then(show);
  }
  $('thumbs').addEventListener('click', (e) => {
    const b = e.target.closest('.pd-thumb'); if (!b || +b.dataset.i === galleryAt) return;
    showMedia(+b.dataset.i, +b.dataset.i > galleryAt ? 1 : -1);
  });
  $('galPrev').addEventListener('click', () => { if (galleryAt > 0) showMedia(galleryAt - 1, -1); });
  $('galNext').addEventListener('click', () => { if (galleryAt < gallery.length - 1) showMedia(galleryAt + 1, 1); });

  // ---------------------------------------------------------------- the right column
  function fadeSwap(el, html) {   // prices swap with a short, calm crossfade; they never count or roll
    if (el.innerHTML === html) return;
    el.innerHTML = html;
    if (G && !REDUCED) G.fromTo(el, { opacity: 0.25 }, { opacity: 1, duration: 0.28, ease: 'power1.out', overwrite: true });
  }
  const badge = (x) => (x.status === 'sold' ? '<span class="pd-label">Sold out</span>' : x.status === 'soon' ? '<span class="pd-label">Coming soon</span>' : '');

  function renderBuy(p) {
    const game = S.gameOf(p.game), c = p.contents;
    $('crumbGame').textContent = game.name;
    $('crumbGame').href = `store.html?game=${p.game}`;
    $('crumbSet').textContent = p.set;
    $('titleSet').textContent = p.set;
    $('titleType').textContent = p.name;
    fadeSwap($('price'), fmt2(p.price));
    const ref = p.status === 'soon' ? 'At TCGplayer presale market price' : 'At TCGplayer market price';
    fadeSwap($('priceRef'), `${ref}, checked ${fmtDate(p.checked)}` + (c ? ` <span aria-hidden="true">·</span> <b>${fmt2(p.price / c.packs)}</b> a pack` : ''));
    // stock and the button: in stock, sold out (a demo state) or coming soon (set not released yet)
    const add = $('addBtn');
    if (p.status === 'sold') {
      $('stock').innerHTML = '<i class="pd-dot off" aria-hidden="true"></i><span>Sold out</span>';
      add.textContent = 'Sold out'; add.disabled = true;
    } else if (p.status === 'soon') {
      $('stock').innerHTML = `<span class="pd-label">Coming soon</span><span class="pd-arrive">Releases <b>${fmtDate(p.released)}</b></span>`;
      add.textContent = 'Notify me'; add.disabled = true;
    } else {
      $('stock').innerHTML = `<i class="pd-dot" aria-hidden="true"></i><span>In stock</span><span class="pd-stock-sep" aria-hidden="true"></span><span class="pd-arrive">Arrives by <b>${S.SHIP[0].date}</b></span>`;
      add.textContent = 'Add to cart'; add.disabled = false;
    }
    $('stickyImg').src = p.img;
    $('stickyName').innerHTML = `<span class="pd-sticky-set">${esc(p.set)} </span>${esc(p.name)}`;
    $('stickyPrice').textContent = fmt2(p.price);
    document.title = `${p.set} ${p.name} · Crowns store demo`;
  }
  function renderOpts(p) {
    $('opts').innerHTML = siblings(p).map((x) => {
      const on = x.id === p.id;
      return `<button class="pd-opt" type="button" role="radio" aria-checked="${on}" tabindex="${on ? 0 : -1}" data-id="${x.id}">
        <span class="pd-radio" aria-hidden="true"></span>
        <span><span class="pd-opt-name">${esc(x.name)}</span>${x.contents ? `<span class="pd-opt-sub">${x.contents.packs} packs</span>` : ''}${badge(x)}</span>
        <span class="pd-opt-price">${fmt2(x.price)}</span>
      </button>`;
    }).join('');
  }
  // the same kind of box in the neighbouring sets of this game (newest first), five at most
  function setChoices(p) {
    const sets = S.setsOf(p.game).map((s) => {
      const list = S.products().filter((x) => x.setId === s.id);
      return { ...s, pick: list.find((x) => x.key === p.key) || list.filter((x) => x.group === p.group).sort((a, b) => b.price - a.price)[0] || null, list };
    }).filter((s) => s.pick || s.id === p.setId);
    const i = Math.max(0, sets.findIndex((s) => s.id === p.setId));
    const from = Math.max(0, Math.min(i - 2, sets.length - 5));
    return sets.slice(from, from + 5);
  }
  function renderSets(p) {
    const game = S.gameOf(p.game);
    $('setsSub').textContent = p.series ? `${p.series} series` : game.full;
    $('sets').innerHTML = setChoices(p).map((s) => {
      const on = s.id === p.setId, target = on ? p : s.pick;
      const logo = S.logoOf(s.id);
      return `<button class="pd-set" type="button" role="radio" aria-checked="${on}" tabindex="${on ? 0 : -1}" data-id="${target.id}" aria-label="${esc(s.name)}, ${esc(target.name)} ${fmt2(target.price)}">
        ${logo ? `<img class="pd-set-logo pd-fade" src="${logo}" alt="">` : `<span class="pd-set-name">${esc(s.name)}</span>`}
        <span class="pd-set-p">${fmt2(target.price)}</span></button>`;
    }).join('');
  }

  // ---------------------------------------------------------------- sections below
  function renderHits(p) {
    const list = S.topCards(p.setId, 5);
    $('hits').hidden = !list.length;
    if (!list.length) return;
    $('hitsH').textContent = `Top hits in ${p.set}`;
    $('hitsNote').textContent = `The five most valuable cards in the set. ${S.cardsSource(p.setId)}.`;
    $('hitsRow').innerHTML = list.map((c) => `
      <li><img class="pd-fade" src="${esc(c.img)}" alt="${esc(c.name)}" loading="lazy" decoding="async">
        <span class="pd-hit-name">${esc(c.name)}</span><span class="pd-hit-rar">${esc(c.rarity)}</span>
        <span class="pd-hit-price">${fmt2(c.price)}</span></li>`).join('');
  }
  function renderBand(p) {
    const c = p.contents, game = S.gameOf(p.game);
    $('insideList').innerHTML = c ? c.items.map(([n, t]) => `<li><b>${n}</b><span>${esc(t)}</span></li>`).join('') : '';
    if (!c) $('insideSrc').textContent = 'This box has not been checked against a retailer listing yet, so its contents are not listed.';
    else $('insideSrc').innerHTML = (c.src.url ? `As listed by <a href="${c.src.url}" target="_blank" rel="noopener">${esc(c.src.label)}</a>.` : 'Pack count as printed on the box.') + (c.packLine ? ` ${S.PACK_LINE}` : '');
    const rows = [['Game', esc(game.full)]];
    if (p.series) rows.push(['Series', esc(p.series)]);
    rows.push(['Set', esc(p.set)], [p.status === 'soon' ? 'Releases' : 'Released', fmtDate(p.released)], ['Product', esc(p.name)]);
    if (p.pcExclusive) rows.push(['Edition', 'Pokémon Center exclusive']);
    rows.push(['Condition', 'Factory sealed, new'],
      ['Price source', `<a href="https://www.tcgplayer.com/product/${p.id}" target="_blank" rel="noopener">TCGplayer product ${p.id}</a>, ${p.status === 'soon' ? 'presale ' : ''}market price on ${fmtDate(p.checked)}`]);
    $('details').innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
    $('shipping').innerHTML = (p.status === 'soon' ? `<dt>Ships</dt><dd>From release day, ${fmtDate(p.released)}</dd>` : '')
      + (p.status ? '' : S.SHIP.map((s) => `<dt>${s.name}</dt><dd>Arrives by ${s.date}</dd>`).join(''))
      + '<dt>Delivery cost</dt><dd>None in this demo, as nothing ships</dd>'
      + '<dt>Returns</dt><dd>Your store’s own policy sits here. This demo takes no orders.</dd>';
  }

  // product cards: no panel behind them, the box on the ground, all at one visual size
  const cardHTML = (x) => `<li><a class="pd-card${x.status === 'sold' ? ' is-sold' : ''}" href="${S.url(x)}" data-id="${x.id}">
      <span class="pd-card-stage"><img data-norm="card" src="${esc(x.img)}" alt="" loading="lazy" decoding="async"></span>
      <span class="pd-card-set">${esc(x.set)}${badge(x)}</span><span class="pd-card-name">${esc(x.name)}</span>
      <span class="pd-card-price">${fmt2(x.price)}</span></a></li>`;
  const car = { items: [], page: 0, per: 5 };
  function renderCarousel(p) {
    const game = S.gameOf(p.game);
    $('moreH').textContent = p.series ? `More from the ${p.series} series` : `More ${game.name} sealed`;
    const pool = S.products().filter((x) => x.game === p.game && x.setId !== p.setId && (!p.series || x.series === p.series))
      .sort((a, b) => b.released.localeCompare(a.released) || b.price - a.price);
    car.items = [...pool.filter((x) => x.group === p.group), ...pool.filter((x) => x.group !== p.group)].slice(0, 20);
    $('more').hidden = !car.items.length;
    $('carTrack').innerHTML = car.items.map(cardHTML).join('');
    car.page = 0;
    layoutCarousel(false);
    U.normaliseAll($('carTrack'));
  }
  function layoutCarousel(animate) {
    const w = $('car').clientWidth;
    car.per = Math.max(2, Math.min(5, Math.floor((w + 24) / 300)));
    $('car').style.setProperty('--per', car.per);
    const pages = Math.max(1, Math.ceil(car.items.length / car.per));
    car.page = Math.min(car.page, pages - 1);
    const first = Math.min(car.page * car.per, Math.max(0, car.items.length - car.per));   // whole cards only
    const li = $('carTrack').children[0];
    const step = li ? li.getBoundingClientRect().width + parseFloat(getComputedStyle($('carTrack')).columnGap || 0) : 0;
    const x = -first * step;
    if (animate && G && !REDUCED) G.to($('carTrack'), { x, duration: 0.7, ease: EASE, overwrite: true });
    else if (G) G.set($('carTrack'), { x }); else $('carTrack').style.transform = `translateX(${x}px)`;
    [...$('carTrack').children].forEach((el, i) => { const vis = i >= first && i < first + car.per; el.inert = !vis; el.setAttribute('aria-hidden', String(!vis)); });
    $('carCount').textContent = `${car.page + 1} / ${pages}`;
    $('carPrev').disabled = car.page === 0;
    $('carNext').disabled = car.page >= pages - 1;
    $('carPrev').hidden = $('carNext').hidden = $('carCount').hidden = pages < 2;
  }
  $('carPrev').addEventListener('click', () => { car.page--; layoutCarousel(true); });
  $('carNext').addEventListener('click', () => { car.page++; layoutCarousel(true); });
  addEventListener('resize', () => layoutCarousel(false));
  (() => {   // swipe on touch: a horizontal drag of 40px turns the page
    let x0 = null;
    $('car').addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') x0 = e.clientX; });
    $('car').addEventListener('pointerup', (e) => {
      if (x0 == null) return;
      const dx = e.clientX - x0; x0 = null;
      if (Math.abs(dx) < 40) return;
      const pages = Math.ceil(car.items.length / car.per);
      car.page = Math.max(0, Math.min(pages - 1, car.page + (dx < 0 ? 1 : -1))); layoutCarousel(true);
    });
  })();

  const RECENT_KEY = 'crowns-store-recent';
  function renderRecent(p) {
    let prev = [];
    try { prev = (JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') || []).map(Number).filter((id) => id !== p.id && S.byId(id)); } catch (e) { prev = []; }
    try { localStorage.setItem(RECENT_KEY, JSON.stringify([p.id, ...prev].slice(0, 8))); } catch (e) { /* private mode: the row stays hidden */ }
    const items = prev.slice(0, 5).map(S.byId);
    $('recent').hidden = !items.length;
    $('recentRow').innerHTML = items.map(cardHTML).join('');
    U.normaliseAll($('recentRow'));
  }
  function renderRip(p) {
    const ev = p.game === 'pokemon' ? S.packValue(p.setId) : null, c = p.contents;
    $('rip').hidden = ev == null;
    if (ev == null) return;
    $('ripLine').innerHTML = `On the <a href="rip.html">Crowns Rip Lab</a> model, an average ${esc(p.set)} pack holds about `
      + `<b>${fmt2(ev)}</b> of singles you could resell, after selling fees and with bulk counted as nothing.`
      + (c ? ` This box works out at <b>${fmt2(p.price / c.packs)}</b> a pack.` : '');
  }
  function renderFoot(p) {
    let t = `Box prices: TCGplayer market via TCGCSV, checked ${fmtDate(p.checked)}. Card prices: ${S.cardsSource(p.setId) || 'TCGplayer market'}.`;
    if (p.game === 'pokemon') t += ` Pack value: the <a href="rip.html">Crowns Rip Lab</a> model (market less about 20% for fees and shipping, cards under $2 counted as $0; `
      + (S.studied(p.setId) ? 'pull rates from the published study named in Rip Lab).' : 'pull rates are the Scarlet &amp; Violet era estimate, as no study for this set is published yet).');
    $('footSources').innerHTML = t;
  }

  // ---------------------------------------------------------------- render and navigation
  function render(animate) {
    const p = P;
    renderBuy(p);
    gallery = mediaOf(p); galleryAt = 0;
    renderThumbs();
    showMedia(0, animate ? 1 : 0);
    renderOpts(p); renderSets(p); renderHits(p); renderBand(p); renderCarousel(p); renderRecent(p); renderRip(p); renderFoot(p);
    U.markLoaded();
  }
  function withCards(p) {   // Pokémon card files load on demand; refresh the parts that use them
    S.loadCards(p.setId).then((ok) => {
      if (!ok || P !== p) return;
      const was = gallery[galleryAt] && gallery[galleryAt].k;
      gallery = mediaOf(p);
      galleryAt = Math.max(0, gallery.findIndex((m) => m.k === was));
      renderThumbs(); renderHits(p); renderRip(p); renderFoot(p); U.markLoaded();
    });
  }
  // a choice inside this product (box, set) replaces the history entry; a move to another product adds one,
  // so Back walks back through products and then to the store
  function go(id, how) {
    const next = S.byId(id); if (!next || next === P) return;
    const wantKey = P.key, wantName = P.dataName, setMove = next.setId !== P.setId;
    P = next;
    const u = `product.html?id=${P.id}${REDUCED ? '&motion=reduced' : ''}`;
    if (how === 'push') history.pushState({ id: P.id }, '', u); else history.replaceState({ id: P.id }, '', u);
    $('boxNote').textContent = how === 'set' && P.key !== wantKey ? `${P.set} has no ${wantName}, so this shows its ${P.name}.` : '';
    render(true); withCards(P);
    if (how === 'push') scrollTo({ top: 0, behavior: REDUCED ? 'auto' : 'smooth' });
    void setMove;
  }
  addEventListener('popstate', () => { P = fromUrl(); $('boxNote').textContent = ''; render(true); withCards(P); });
  $('opts').addEventListener('click', (e) => { const b = e.target.closest('.pd-opt'); if (b) go(+b.dataset.id, 'replace'); });
  $('sets').addEventListener('click', (e) => { const b = e.target.closest('.pd-set'); if (b) go(+b.dataset.id, 'set'); });
  for (const id of ['opts', 'sets']) {
    $(id).addEventListener('keydown', (e) => {
      if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      const bs = [...$(id).querySelectorAll('[role="radio"]')], i = bs.indexOf(document.activeElement);
      if (i < 0) return;
      e.preventDefault(); e.stopPropagation();
      const n = bs[(i + (e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : bs.length - 1)) % bs.length];
      const target = +n.dataset.id;
      go(target, id === 'sets' ? 'set' : 'replace');
      const f = $(id).querySelector(`[data-id="${target}"]`); if (f) f.focus();
    });
  }
  for (const id of ['carTrack', 'recentRow']) {
    $(id).addEventListener('click', (e) => {
      const a = e.target.closest('.pd-card'); if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
      e.preventDefault(); go(+a.dataset.id, 'push');
    });
  }

  // ---------------------------------------------------------------- buying: the cart lives in store-ui.js
  $('addBtn').addEventListener('click', () => U.addToCart(P.id));
  $('stickyAdd').addEventListener('click', () => U.addToCart(P.id));
  const sticky = $('sticky');
  let addVisible = true, footVisible = false;
  // one gold action on screen: the bar shows only while the panel's button is out of view, and steps aside at the foot
  function syncSticky() {
    const on = !P.status && !addVisible && !footVisible && !U.isCartOpen();
    sticky.classList.toggle('show', on);
    sticky.setAttribute('aria-hidden', String(!on));
    $('stickyAdd').tabIndex = on ? 0 : -1;
  }
  U.onCart(syncSticky);
  if (window.IntersectionObserver) {
    new IntersectionObserver(([e]) => { addVisible = e.isIntersecting; syncSticky(); }).observe($('addBtn'));
    new IntersectionObserver(([e]) => { footVisible = e.isIntersecting; syncSticky(); }).observe(document.querySelector('.pd-foot'));
  }

  // ---------------------------------------------------------------- boot
  history.replaceState({ id: P.id }, '', `product.html?id=${P.id}${REDUCED ? '&motion=reduced' : ''}`);
  // the set's card file is small and local: wait for it (max 900 ms) so the gallery and top hits land with the box
  Promise.race([S.loadCards(P.setId), new Promise((r) => setTimeout(r, 900))]).then(() => {
    render(false);
    intro();
    withCards(P);
  });
  void qs;
  function intro() {   // one arrival: the box rises into its light, the facts settle beside it
    document.documentElement.classList.add('pd-ready');
    if (!G || REDUCED) return;
    const tl = G.timeline({ defaults: { ease: EASE } });
    tl.from('.pd-fig', { opacity: 0, y: 28, duration: 0.8 }, 0.05)
      .from('.pd-info > *', { opacity: 0, y: 12, duration: 0.55, stagger: 0.05 }, 0.18)
      .from('.pd-util, .pd-gal', { opacity: 0, duration: 0.5 }, 0.3);
  }
})();
