import { $, $$, api, esc, money, stars, productImage, toast, state, isAuthed, navigate, setCartCount, refreshCounts, setTitle, errorState, isDatabaseMode } from '../core.js';

const ALL_SORTS = [['', 'Featured'], ['price_asc', 'Price: low to high'], ['price_desc', 'Price: high to low'], ['name_asc', 'Name: A–Z'], ['name_desc', 'Name: Z–A'], ['rating', 'Top rated'], ['newest', 'Newest']];
const SORTS = () => ALL_SORTS;
const KEYS = ['q', 'category', 'sort', 'page', 'limit', 'minPrice', 'maxPrice', 'inStock', 'minRating'];

/* ---------- shared card + actions (also used by wishlist / product page) ---------- */
export function productCard(p) {
  const wished = state.wishlist.has(p.id);
  const stock = p.stock === 0 ? '<span class="stock-out" data-testid="stock-status">Out of stock</span>'
    : p.stock <= 3 ? `<span class="stock-low" data-testid="stock-status">Only ${p.stock} left</span>` : '<span class="small muted" data-testid="stock-status">In stock</span>';
  const action = p.stock === 0 ? `<button class="btn sm" disabled data-testid="add-to-cart" aria-label="${esc(p.name)} is out of stock">Sold out</button>`
    : p.variants ? `<a class="btn sm secondary" href="/product/${p.id}" data-testid="choose-options" aria-label="Choose options for ${esc(p.name)}">Options</a>`
    : `<button class="btn sm" data-add="${p.id}" data-testid="add-to-cart" aria-label="Add ${esc(p.name)} to cart">Add</button>`;
  return `<article class="product-card" data-testid="product-card" data-product-id="${p.id}" aria-label="${esc(p.name)}">
    <div class="thumb"><a href="/product/${p.id}" tabindex="-1" aria-hidden="true">${productImage(p)}</a>
      ${p.onSale ? '<span class="badge warn" data-testid="sale-badge">Sale</span>' : ''}
      <button class="icon-btn" data-wish="${p.id}" aria-pressed="${wished}" aria-label="${wished ? 'Remove' : 'Add'} ${esc(p.name)} ${wished ? 'from' : 'to'} wishlist" data-testid="wishlist-toggle">${wished ? '♥' : '♡'}</button></div>
    <div class="body">
      <span class="cat">${esc(p.category)}</span>
      <a class="name" href="/product/${p.id}" data-testid="product-name">${esc(p.name)}</a>
      ${stars(p.rating, p.reviewCount)}
      ${stock}
      <div class="foot"><span class="price" data-testid="product-price">${money(p.price)}${p.originalPrice ? `<s>${money(p.originalPrice)}</s>` : ''}</span>${action}</div>
    </div></article>`;
}
function loginFirst(msg) {
  toast(msg, 'info');
  navigate(`/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`);
}
export async function addToCart(productId, name, btn, extra = {}) {
  if (!isAuthed()) return loginFirst('Sign in to add items to your cart');
  if (btn) btn.disabled = true;
  try {
    const cart = await api('/cart', { method: 'POST', body: { productId, qty: 1, ...extra } });
    setCartCount(cart.count);
    toast(`Added ${name} to cart`);
    if (btn) { const t = btn.textContent; btn.textContent = 'Added ✓'; setTimeout(() => { btn.textContent = t; btn.disabled = false; }, 1200); }
    return cart;
  } catch (err) {
    if (btn) btn.disabled = false;
    if (err.status !== 401) toast(err.message, 'error');
    throw err;
  }
}
export async function toggleWishlist(id, name, btn) {
  if (!isAuthed()) return loginFirst('Sign in to save items to your wishlist');
  const on = state.wishlist.has(id);
  try {
    if (on) await api(`/wishlist/${id}`, { method: 'DELETE' }); else await api('/wishlist', { method: 'POST', body: { productId: id } });
    on ? state.wishlist.delete(id) : state.wishlist.add(id);
    toast(on ? `Removed ${name} from wishlist` : `Saved ${name} to wishlist`, on ? 'info' : 'success');
    if (btn) { btn.setAttribute('aria-pressed', String(!on)); btn.textContent = on ? '♡' : '♥'; btn.setAttribute('aria-label', `${on ? 'Add' : 'Remove'} ${name} ${on ? 'to' : 'from'} wishlist`); }
    refreshCounts();
    document.dispatchEvent(new CustomEvent('wishlist-changed', { detail: { id, saved: !on } }));
  } catch (err) { if (err.status !== 401) toast(err.message, 'error'); }
}
export function bindCardActions(root, lookup) {
  root.addEventListener('click', e => {
    const add = e.target.closest('[data-add]');
    if (add) { const p = lookup(+add.dataset.add); addToCart(p.id, p.name, add).catch(() => {}); }
    const wish = e.target.closest('[data-wish]');
    if (wish) { const p = lookup(+wish.dataset.wish); toggleWishlist(p.id, p.name, wish); }
  });
}

/* ---------- flash sale countdown (practice page.clock) ---------- */
function countdown(node) {
  const tick = () => {
    if (!document.body.contains(node)) return clearInterval(t);
    const now = new Date(); const end = new Date(now); end.setHours(24, 0, 0, 0);
    const s = Math.floor((end - now) / 1000);
    node.textContent = [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map(n => String(n).padStart(2, '0')).join(':');
  };
  const t = setInterval(tick, 1000); tick();
}

/* ================= PRODUCT LIST ================= */
export async function list(el, { query, isCurrent }) {
  const q = Object.fromEntries(KEYS.map(k => [k, query.get(k) || '']));
  setTitle(q.q ? `Search: ${q.q}` : 'Shop');
  const cats = await api('/categories', { quiet: true });
  if (!isCurrent()) return;
  const selected = new Set(q.category.split(',').filter(Boolean));
  el.innerHTML = `
    <div class="promo-bar" data-testid="promo-bar"><span>🏷️ Use code <strong>SAVE10</strong> for 10% off · <span id="deal" data-testid="deal-of-day">Loading today's deal…</span></span>
      <span>Flash sale ends in <strong class="mono" data-testid="sale-countdown" id="countdown">--:--:--</strong></span></div>
    <div class="page-head">
      <h1 data-testid="shop-title">${q.q ? `Results for “${esc(q.q)}”` : 'All products'}</h1>
      <form class="row" id="search-form" role="search" style="flex:1;max-width:460px;flex-wrap:nowrap">
        <input type="search" name="q" value="${esc(q.q)}" placeholder="Search products…" aria-label="Search products" data-testid="search" autocomplete="off">
        <button class="btn" data-testid="search-btn">Search</button>
      </form>
    </div>
    <button class="btn secondary filters-toggle" id="filters-toggle" aria-expanded="false" aria-controls="filters" data-testid="filters-toggle" style="margin-bottom:14px">⚙ Filters</button>
    <div class="shop-layout">
      <aside class="filters card" id="filters" aria-label="Filters" data-testid="filters">
        <fieldset><legend>Category</legend>
          ${cats.map(c => `<label class="check"><span><input type="checkbox" name="category" value="${esc(c.name)}" ${selected.has(c.name) ? 'checked' : ''} data-testid="filter-category-${esc(c.name.toLowerCase())}"> ${esc(c.name)}</span><span class="n">${c.count}</span></label>`).join('')}
        </fieldset>
        <fieldset><legend>Price</legend>
          <div class="row" style="flex-wrap:nowrap"><input type="number" min="0" name="minPrice" value="${esc(q.minPrice)}" placeholder="Min" aria-label="Minimum price" data-testid="min-price"><span>–</span><input type="number" min="0" name="maxPrice" value="${esc(q.maxPrice)}" placeholder="Max" aria-label="Maximum price" data-testid="max-price"></div>
          <button class="btn secondary sm" style="margin-top:8px" id="apply-price" data-testid="apply-price">Apply price</button>
        </fieldset>
        <fieldset><legend>Availability</legend><label class="check"><span><input type="checkbox" name="inStock" ${q.inStock === 'true' ? 'checked' : ''} data-testid="filter-in-stock"> In stock only</span></label></fieldset>
        <fieldset><legend>Rating</legend>
          <select name="minRating" aria-label="Minimum rating" data-testid="filter-rating">${[['', 'Any rating'], ['4', '4★ & up'], ['3', '3★ & up'], ['2', '2★ & up']].map(([v, l]) => `<option value="${v}" ${q.minRating === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
        </fieldset>
        <button class="btn link" id="clear-filters" data-testid="clear-filters">Clear all filters</button>
      </aside>
      <section aria-label="Products">
        <div class="toolbar">
          <span class="muted" data-testid="results-count" aria-live="polite"></span>
          <div class="row">
            <label class="small" for="sort">Sort by</label>
            <select id="sort" data-testid="sort">${SORTS().map(([v, l]) => `<option value="${v}" ${q.sort === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
            <label class="small" for="limit">Show</label>
            <select id="limit" data-testid="page-size">${[12, 24, 48].map(n => `<option ${String(q.limit || 12) === String(n) ? 'selected' : ''}>${n}</option>`).join('')}</select>
          </div>
        </div>
        <div class="products" id="grid" data-testid="product-grid" aria-busy="true"></div>
        <nav class="pagination" id="pager" aria-label="Pagination" data-testid="pagination"></nav>
      </section>
    </div>`;
  countdown($('#countdown', el));
  api('/deal', { quiet: true }).then(d => { const n = $('#deal', el); if (n) n.innerHTML = `Deal of the day: <a href="/product/${d.product.id}" data-testid="deal-link">${esc(d.product.name)}</a> — <strong data-testid="deal-percent">${d.percentOff}% off</strong>`; })
    .catch(() => { const n = $('#deal', el); if (n) n.textContent = 'No deal today'; });

  const params = { ...q };
  let items = [];
  const grid = $('#grid', el), pager = $('#pager', el), count = $('[data-testid=results-count]', el);
  const sync = (push = false) => {
    const sp = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null));
    const url = '/shop' + (sp.toString() ? `?${sp}` : '');
    push ? history.pushState({}, '', url) : history.replaceState({}, '', url);
  };
  const load = async () => {
    grid.setAttribute('aria-busy', 'true');
    grid.innerHTML = Array.from({ length: 6 }, () => '<div class="skeleton" data-testid="skeleton"></div>').join('');
    try {
      const sp = new URLSearchParams(Object.entries({ ...params, limit: params.limit || 12, page: params.page || 1 }).filter(([, v]) => v !== '' && v != null));
      const d = await api(`/products?${sp}`);
      if (!isCurrent()) return;
      items = d.items;
      count.textContent = `${d.total} product${d.total === 1 ? '' : 's'}`;
      grid.innerHTML = d.items.length ? d.items.map(productCard).join('')
        : `<div class="empty" style="grid-column:1/-1" data-testid="empty-results"><div class="big">🔍</div><p><strong>No products found</strong></p><p>Try a different search or clear your filters.</p></div>`;
      grid.setAttribute('aria-busy', 'false');
      drawPager(d);
    } catch (err) {
      if (!isCurrent()) return;
      count.textContent = '';
      pager.innerHTML = '';
      grid.setAttribute('aria-busy', 'false');
      errorState(grid, err, load);
    }
  };
  const drawPager = d => {
    if (d.pages <= 1) { pager.innerHTML = `<span class="small muted" data-testid="page-info">Page 1 of 1</span>`; return; }
    const btn = (label, page, attrs = '') => `<button class="btn secondary sm" data-page="${page}" ${attrs}>${label}</button>`;
    pager.innerHTML = btn('‹ Prev', d.page - 1, `data-testid="prev" aria-label="Previous page" ${d.page <= 1 ? 'disabled' : ''}`)
      + Array.from({ length: d.pages }, (_, i) => btn(i + 1, i + 1, `data-testid="page-${i + 1}" aria-label="Page ${i + 1}" ${i + 1 === d.page ? 'aria-current="page"' : ''}`)).join('')
      + btn('Next ›', d.page + 1, `data-testid="next" aria-label="Next page" ${d.page >= d.pages ? 'disabled' : ''}`)
      + `<span class="small muted" data-testid="page-info">Page ${d.page} of ${d.pages}</span>`;
  };
  pager.onclick = e => { const b = e.target.closest('[data-page]'); if (!b || b.disabled) return; params.page = b.dataset.page; sync(true); load(); window.scrollTo(0, 0); };
  const refilter = () => { params.page = ''; sync(); load(); };

  const sf = $('#search-form', el);
  let t;
  sf.q.oninput = () => { clearTimeout(t); t = setTimeout(() => { params.q = sf.q.value.trim(); $('[data-testid=shop-title]', el).innerHTML = params.q ? `Results for “${esc(params.q)}”` : 'All products'; refilter(); }, 400); };
  sf.onsubmit = e => { e.preventDefault(); clearTimeout(t); params.q = sf.q.value.trim(); $('[data-testid=shop-title]', el).innerHTML = params.q ? `Results for “${esc(params.q)}”` : 'All products'; refilter(); };
  $$('[name=category]', el).forEach(cb => (cb.onchange = () => { params.category = $$('[name=category]:checked', el).map(c => c.value).join(','); refilter(); }));
  $('[name=inStock]', el).onchange = e => { params.inStock = e.target.checked ? 'true' : ''; refilter(); };
  const ratingFilter = $('[name=minRating]', el);
  if (ratingFilter) ratingFilter.onchange = e => { params.minRating = e.target.value; refilter(); };
  $('#apply-price', el).onclick = () => { params.minPrice = $('[name=minPrice]', el).value; params.maxPrice = $('[name=maxPrice]', el).value; refilter(); };
  $('#sort', el).onchange = e => { params.sort = e.target.value; refilter(); };
  $('#limit', el).onchange = e => { params.limit = e.target.value === '12' ? '' : e.target.value; refilter(); };
  $('#clear-filters', el).onclick = () => navigate('/shop');
  $('#filters-toggle', el).onclick = e => { const f = $('#filters', el); const open = !f.classList.contains('open'); f.classList.toggle('open', open); e.currentTarget.setAttribute('aria-expanded', String(open)); };
  bindCardActions(grid, id => items.find(p => p.id === id));
  load();
}



