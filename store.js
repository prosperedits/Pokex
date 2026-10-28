// Crowns store demo: the shop front (store.html). Every sealed product in data/sealed.js, filterable by game and
// kind of box, sortable by newest set or price; each one opens product.html?id=<TCGplayer product id>.
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const S = window.STORE, U = window.STOREUI, G = window.gsap;
  const { fmt2, fmtDate, esc } = S;
  const ALL = S.products();
  const q = new URLSearchParams(location.search);
  const state = {
    game: S.GAMES.some((g) => g.id === q.get('game')) ? q.get('game') : 'all',
    type: S.GROUPS.some((g) => g.id === q.get('type')) ? q.get('type') : 'all',
    sort: ['new', 'high', 'low'].includes(q.get('sort')) ? q.get('sort') : 'new',
  };
  const checked = ALL.map((p) => p.checked).sort().pop();

  $('footSources').textContent = `Prices: TCGplayer market via TCGCSV, checked ${fmtDate(checked)}; coming-soon boxes show TCGplayer presale market prices. `
    + 'The sold-out labels show how that state looks in this demo; they are not live stock. Product photos: the publishers’ own, cut from TCGplayer '
    + 'and the official Pokémon site. Release dates and product names: TCGplayer’s catalogue.';
  document.body.style.setProperty('--app-pool-y', '14%');
  document.body.style.setProperty('--app-pool-w', '70vmax');
  document.body.style.setProperty('--app-pool-h', '34vmax');

  const inGame = (p) => state.game === 'all' || p.game === state.game;
  const inType = (p) => state.type === 'all' || p.group === state.type;

  function renderGames() {
    const opts = [{ id: 'all', name: 'All' }, ...S.GAMES];
    $('games').innerHTML = opts.map((g) => {
      const n = g.id === 'all' ? ALL.length : ALL.filter((p) => p.game === g.id).length, on = g.id === state.game;
      const face = g.logo ? `<img src="${g.logo}" alt="${esc(g.name)}">` : `<span class="st-game-all">${esc(g.name)}</span>`;
      return `<button class="st-game" type="button" role="radio" aria-checked="${on}" tabindex="${on ? 0 : -1}" data-game="${g.id}">${face}<small>${n}</small></button>`;
    }).join('');
  }
  function renderTypes() {
    const pool = ALL.filter(inGame);
    const opts = [{ id: 'all', name: 'Every kind' }, ...S.GROUPS];
    $('type').innerHTML = opts.map((g) => {
      const n = g.id === 'all' ? pool.length : pool.filter((p) => p.group === g.id).length;
      return `<option value="${g.id}"${g.id === state.type ? ' selected' : ''}${n ? '' : ' disabled'}>${esc(g.name)} (${n})</option>`;
    }).join('');
    $('sort').value = state.sort;
  }
  const order = {
    new: (a, b) => b.released.localeCompare(a.released) || b.price - a.price,
    high: (a, b) => b.price - a.price,
    low: (a, b) => a.price - b.price,
  };
  const PAGE = 40;
  let shown = PAGE;
  function renderGrid(animate, keep) {
    if (!keep) shown = PAGE;
    const all = ALL.filter((p) => inGame(p) && inType(p)).sort(order[state.sort]);
    const list = all.slice(0, shown);
    $('count').textContent = `${all.length} ${all.length === 1 ? 'box' : 'boxes'}`;
    $('empty').hidden = all.length > 0;
    const left = all.length - list.length;
    $('more').hidden = left <= 0;
    $('more').textContent = `Show ${Math.min(PAGE, left)} more of ${left}`;
    // the first two rows load at once, the rest as they near the screen
    $('grid').innerHTML = list.map((p, i) => `<li><a class="st-item${p.status === 'sold' ? ' is-sold' : ''}" href="${S.url(p)}">
        <span class="st-stage"><img data-norm="tile" src="${esc(p.img)}" alt="${esc(p.set + ' ' + p.name)}"${i < 10 ? '' : ' loading="lazy"'} decoding="async"></span>
        <span class="st-set">${esc(p.set)}${p.status === 'sold' ? '<span class="pd-label">Sold out</span>' : p.status === 'soon' ? '<span class="pd-label">Coming soon</span>' : ''}</span>
        <span class="st-name">${esc(p.name)}</span>
        <span class="st-price">${fmt2(p.price)}</span></a></li>`).join('');
    U.normaliseAll($('grid'));
    if (animate && G && !U.REDUCED) G.fromTo('#grid', { opacity: 0.2 }, { opacity: 1, duration: 0.35, ease: 'power1.out', overwrite: true });
    const u = new URL(location.href);
    for (const k of ['game', 'type', 'sort']) { if (state[k] === (k === 'sort' ? 'new' : 'all')) u.searchParams.delete(k); else u.searchParams.set(k, state[k]); }
    history.replaceState(null, '', u);
  }

  $('games').addEventListener('click', (e) => {
    const b = e.target.closest('.st-game'); if (!b || b.dataset.game === state.game) return;
    state.game = b.dataset.game;
    if (state.type !== 'all' && !ALL.some((p) => inGame(p) && p.group === state.type)) state.type = 'all';
    renderGames(); renderTypes(); renderGrid(true);
  });
  $('games').addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    const bs = [...$('games').querySelectorAll('.st-game')], i = bs.indexOf(document.activeElement); if (i < 0) return;
    e.preventDefault();
    const n = bs[(i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : bs.length - 1)) % bs.length];
    n.click(); $('games').querySelector(`[data-game="${n.dataset.game}"]`).focus();
  });
  $('type').addEventListener('change', () => { state.type = $('type').value; renderGrid(true); });
  $('sort').addEventListener('change', () => { state.sort = $('sort').value; renderGrid(true); });
  $('clearType').addEventListener('click', () => { state.type = 'all'; renderTypes(); renderGrid(true); });
  $('more').addEventListener('click', () => {
    const first = shown;
    shown += PAGE; renderGrid(false, true);
    const next = $('grid').children[first]; if (next) next.querySelector('a').focus({ preventScroll: true });
  });

  renderGames(); renderTypes(); renderGrid(false);
  document.documentElement.classList.add('pd-ready');
  if (G && !U.REDUCED) G.from('.st-head, .st-bar', { opacity: 0, y: 10, duration: 0.5, ease: U.EASE, stagger: 0.06 });
})();
