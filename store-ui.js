// Crowns store demo: shared interface parts for store.html and product.html.
// Header behaviour, one-visual-size box images, the persisted demo cart and checkout (no payment fields),
// Needs store-data.js (window.STORE) and gsap.
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const S = window.STORE, G = window.gsap;
  const REDUCED = new URLSearchParams(location.search).get('motion') === 'reduced';   // project rule: ?motion=reduced opts in
  const EASE = 'expo.out';
  if (G) G.ticker.lagSmoothing(0);   // arrivals finish on the clock even if a frame stalls
  const DUR = (s) => (REDUCED ? 0 : s);

  // ---------------------------------------------------------------- header
  const topbar = $('topbar');
  function setHdr() { if (topbar) document.documentElement.style.setProperty('--hdr', topbar.offsetHeight + 'px'); }
  setHdr();
  addEventListener('resize', setHdr);
  // phones: the bar tucks away while reading down and returns on any scroll up
  let lastY = scrollY;
  const phone = matchMedia('(max-width:720px)');
  addEventListener('scroll', () => {
    if (!topbar) return;
    const y = scrollY;
    topbar.classList.toggle('scrolled', y > 12);
    if (phone.matches && Math.abs(y - lastY) > 4) topbar.classList.toggle('tuck', y > lastY && y > 160);
    if (!phone.matches) topbar.classList.remove('tuck');
    lastY = y;
  }, { passive: true });

  // ---------------------------------------------------------------- remote images fade in once loaded
  document.addEventListener('load', (e) => { if (e.target.classList && e.target.classList.contains('pd-fade')) e.target.classList.add('ok'); }, true);
  const markLoaded = () => document.querySelectorAll('img.pd-fade').forEach((i) => { if (i.complete && i.naturalWidth) i.classList.add('ok'); });

  // ---------------------------------------------------------------- one visual size for every box
  // Each image is measured by its opaque pixels (official renders carry wide transparent margins, cutouts almost
  // none), then scaled so the box itself covers the same area inside a fixed stage, centred on the box, never stretched.
  const boxCache = {};
  function opaqueBox(img) {
    const key = img.currentSrc || img.src;
    if (boxCache[key]) return boxCache[key];
    const nw = img.naturalWidth, nh = img.naturalHeight;
    let r = [0, 0, nw, nh];
    try {
      const M = 120, c = document.createElement('canvas'), sc = M / Math.max(nw, nh);
      c.width = Math.max(1, Math.round(nw * sc)); c.height = Math.max(1, Math.round(nh * sc));
      const x = c.getContext('2d', { willReadFrequently: true });
      x.drawImage(img, 0, 0, c.width, c.height);
      const d = x.getImageData(0, 0, c.width, c.height).data;
      let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
      for (let y = 0; y < c.height; y++) for (let xx = 0; xx < c.width; xx++) {
        if (d[(y * c.width + xx) * 4 + 3] > 24) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      }
      if (x1 >= x0 && y1 >= y0) r = [x0 / sc, y0 / sc, (x1 - x0 + 1) / sc, (y1 - y0 + 1) / sc];
    } catch (e) { /* cross-origin card art: opaque all over, the full frame is the card */ }
    boxCache[key] = r;
    return r;
  }
  // fill = the box's side (square root of its area) as a share of the stage's shorter side; cards fill the height
  function placeIn(img, fill, card) {
    const st = img.parentElement, W = st.clientWidth, H = st.clientHeight;
    const nw = img.naturalWidth, nh = img.naturalHeight;
    if (!W || !H || !nw || !nh) return;
    const [bx, by, bw, bh] = opaqueBox(img);
    let k = card ? (H * 0.92) / bh : (Math.min(W, H) * fill) / Math.sqrt(bw * bh);
    k = Math.min(k, (W * 0.94) / bw, (H * 0.94) / bh);
    img.style.width = Math.round(nw * k) + 'px';
    img.style.height = Math.round(nh * k) + 'px';
    img.style.left = Math.round(W / 2 - (bx + bw / 2) * k) + 'px';
    img.style.top = Math.round(H / 2 - (by + bh / 2) * k) + 'px';
  }
  const FILL = { hero: 0.62, thumb: 0.66, card: 0.62, line: 0.7, tile: 0.68 };
  function normalise(img) {
    const role = img.dataset.norm;
    if (!role) return;
    const go = () => placeIn(img, FILL[role] || 0.6, img.classList.contains('is-card'));
    if (img.complete && img.naturalWidth) go(); else img.addEventListener('load', go, { once: true });
  }
  const normaliseAll = (root = document) => root.querySelectorAll('img[data-norm]').forEach(normalise);
  let normTimer = 0;
  addEventListener('resize', () => { clearTimeout(normTimer); normTimer = setTimeout(() => normaliseAll(), 80); });

  // ---------------------------------------------------------------- cart and demo checkout (no payment fields, nothing is charged)
  // Kept on this device (localStorage), so the shop front and every product page share one cart.
  const CART_KEY = 'crowns-store-cart';
  const readCart = () => { try { return (JSON.parse(localStorage.getItem(CART_KEY) || '[]') || []).filter((x) => x && S.byId(x.id) && x.qty > 0); } catch (e) { return []; } };
  const cart = readCart();
  const saveCart = () => { try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch (e) { /* private mode: the cart lasts for this page */ } };
  if (!$('cart')) {
    document.body.insertAdjacentHTML('beforeend', `
      <div class="pd-scrim" id="scrim" hidden></div>
      <aside class="pd-cart" id="cart" aria-label="Cart" aria-hidden="true">
        <div class="pd-cart-head"><h2 class="pd-cart-h" id="cartTitle">Your cart</h2><button class="pd-x" id="cartClose" type="button" aria-label="Close cart">Close</button></div>
        <ol class="pd-steps" id="steps" aria-label="Checkout steps"><li class="on">Cart</li><li>Delivery</li><li>Review</li><li>Done</li></ol>
        <div class="pd-cart-body" id="cartBody"></div><div class="pd-cart-foot" id="cartFoot"></div>
      </aside>`);
  }
  const cartEl = $('cart'), scrim = $('scrim');
  let cartView = 'cart', lastFocus = null, shipK = 'tracked', placed = null;
  const listeners = [];
  const VIEWS = ['cart', 'delivery', 'review', 'done'];
  const count = () => cart.reduce((s, it) => s + it.qty, 0);
  const total = () => cart.reduce((s, it) => s + it.qty * S.byId(it.id).price, 0);
  const shipOf = () => S.SHIP.find((s) => s.k === shipK) || S.SHIP[0];
  const esc = S.esc, fmt2 = S.fmt2;

  function syncCount() {
    const n = count(), b = $('cartCount');
    if (b) { b.textContent = n; b.classList.toggle('has', n > 0); }
    if ($('cartBtn')) $('cartBtn').setAttribute('aria-label', `Open cart, ${n} item${n === 1 ? '' : 's'}`);
  }
  const lineHTML = (it, i, editable) => {
    const p = S.byId(it.id);
    return `<div class="pd-line"><span class="pd-line-stage"><img data-norm="line" src="${esc(p.img)}" alt=""></span>
      <div><div class="pd-line-name">${esc(p.set)} ${esc(p.name)}</div>
      <div class="pd-line-sub">${fmt2(p.price)} each, TCGplayer market</div>
      <div class="pd-line-row">${editable
        ? `<span class="pd-qty"><button type="button" data-act="dec" data-i="${i}" aria-label="One less">&minus;</button><span>${it.qty}</span><button type="button" data-act="inc" data-i="${i}" aria-label="One more">+</button></span>`
        : `<span class="pd-line-sub">Quantity ${it.qty}</span>`}
      <span class="pd-line-price">${fmt2(p.price * it.qty)}</span></div></div></div>`;
  };
  function renderCart() {
    const at = VIEWS.indexOf(cartView);
    [...$('steps').children].forEach((li, i) => li.classList.toggle('on', i <= at));
    $('cartTitle').textContent = { cart: 'Your cart', delivery: 'Delivery', review: 'Check your order', done: 'Order placed' }[cartView];
    const body = $('cartBody'), foot = $('cartFoot'), s = shipOf();
    if (cartView === 'done') {
      body.innerHTML = placed.lines + `<dl class="pd-sum"><dt>${esc(placed.ship.name)}</dt><dd>Arrives by ${placed.ship.date}</dd><dt class="tot">Total</dt><dd class="tot">${fmt2(placed.total)}</dd></dl>`
        + '<div class="pd-done"><p>This was the demo checkout, so nothing was charged and nothing ships.</p><p>A real store sends the confirmation and tracking from here.</p></div>';
      foot.innerHTML = '<button class="pd-ghost" type="button" data-act="close">Back to the store</button>';
      normaliseAll(body);
      return;
    }
    if (!cart.length) {
      body.innerHTML = '<p class="pd-cart-empty">Your cart is empty.</p>';
      foot.innerHTML = '<button class="pd-ghost" type="button" data-act="close">Keep browsing</button>';
      return;
    }
    const lines = cart.map((it, i) => lineHTML(it, i, cartView === 'cart')).join('');
    if (cartView === 'cart') {
      body.innerHTML = lines + `<dl class="pd-sum"><dt>Subtotal</dt><dd>${fmt2(total())}</dd></dl>`;
      foot.innerHTML = '<button class="pd-add" type="button" data-act="delivery">Choose delivery</button><p class="pd-cart-note">Demo store: there is no payment step, and no order is sent.</p>';
    } else if (cartView === 'delivery') {
      body.innerHTML = `<div class="pd-ship" role="radiogroup" aria-label="Delivery">${S.SHIP.map((o) => `
        <button class="pd-ship-opt" type="button" role="radio" aria-checked="${o.k === shipK}" data-act="ship" data-k="${o.k}">
          <span class="pd-radio" aria-hidden="true"></span>
          <span><span class="pd-ship-name">${o.name}</span><span class="pd-ship-sub">Arrives by ${o.date}</span></span>
        </button>`).join('')}</div><p class="pd-cart-note">This demo charges nothing for delivery, because nothing ships.</p>`;
      foot.innerHTML = '<button class="pd-add" type="button" data-act="review">Review order</button><button class="pd-ghost" type="button" data-act="back-cart">Back to cart</button>';
    } else {
      body.innerHTML = lines + `<dl class="pd-sum"><dt>${s.name}</dt><dd>Arrives by ${s.date}</dd><dt>Delivery cost</dt><dd>None in the demo</dd>`
        + `<dt class="tot">Total</dt><dd class="tot">${fmt2(total())}</dd></dl>`;
      foot.innerHTML = '<button class="pd-add" type="button" data-act="place">Place demo order</button><button class="pd-ghost" type="button" data-act="back-delivery">Back to delivery</button>';
    }
    normaliseAll(body);
  }
  const isOpen = () => cartEl.classList.contains('open');
  function openCart(view) {
    cartView = view || 'cart'; renderCart();
    lastFocus = document.activeElement;
    cartEl.classList.add('open'); cartEl.setAttribute('aria-hidden', 'false'); scrim.hidden = false;
    listeners.forEach((f) => f());
    if (G) {
      G.killTweensOf([cartEl, scrim]);
      G.fromTo(cartEl, { x: '102%' }, { x: '0%', duration: DUR(0.55), ease: EASE, onComplete: () => normaliseAll(cartEl) });
      G.fromTo(scrim, { opacity: 0 }, { opacity: 1, duration: DUR(0.3), ease: 'power2.out' });
    } else cartEl.style.transform = 'none';
    $('cartClose').focus({ preventScroll: true });
  }
  function closeCart() {
    const done = () => { cartEl.classList.remove('open'); scrim.hidden = true; listeners.forEach((f) => f()); };
    cartEl.setAttribute('aria-hidden', 'true');
    if (cartView === 'done') cartView = 'cart';
    if (G && !REDUCED) { G.to(cartEl, { x: '102%', duration: 0.4, ease: 'power2.in', onComplete: done }); G.to(scrim, { opacity: 0, duration: 0.3 }); }
    else done();
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }
  function addToCart(id) {
    const p = S.byId(id);
    if (!p || p.status) return;   // sold out and coming soon are not for sale
    const it = cart.find((x) => x.id === id);
    if (it) it.qty++; else cart.push({ id, qty: 1 });
    saveCart(); syncCount(); openCart('cart');
  }
  if ($('cartBtn')) $('cartBtn').addEventListener('click', () => openCart('cart'));
  $('cartClose').addEventListener('click', closeCart);
  scrim.addEventListener('click', closeCart);
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen()) closeCart(); });
  cartEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const act = b.dataset.act, i = +b.dataset.i;
    if (act === 'inc') cart[i].qty++;
    else if (act === 'dec') { cart[i].qty--; if (cart[i].qty <= 0) cart.splice(i, 1); }
    else if (act === 'ship') shipK = b.dataset.k;
    else if (act === 'delivery' || act === 'back-delivery') cartView = 'delivery';
    else if (act === 'review') cartView = 'review';
    else if (act === 'back-cart') cartView = 'cart';
    else if (act === 'place') {
      placed = { lines: cart.map((it, j) => lineHTML(it, j, false)).join(''), ship: shipOf(), total: total() };
      cart.length = 0; cartView = 'done';
    } else if (act === 'close') { closeCart(); return; }
    saveCart(); syncCount(); renderCart();
    const f = cartEl.querySelector(act === 'ship' ? `[data-k="${shipK}"]` : '.pd-cart-foot button');
    if (f) f.focus({ preventScroll: true });
  });
  syncCount();

  window.STOREUI = { REDUCED, EASE, DUR, markLoaded, placeIn, normalise, normaliseAll, FILL, addToCart, openCart, isCartOpen: isOpen,
    onCart: (f) => listeners.push(f), setHdr };
})();
