import { $, $$, api, esc, money, stars, productImage, toast, state, isAuthed, navigate, setCartCount, refreshCounts, setTitle, errorState, isDatabaseMode } from '../core.js';
import { t } from '../locale.js';

const ALL_SORTS = [['', 'Featured'], ['price_asc', 'Price: low to high'], ['price_desc', 'Price: high to low'], ['name_asc', 'Name: A–Z'], ['name_desc', 'Name: Z–A'], ['rating', 'Top rated'], ['newest', 'Newest']];
const SORTS = () => ALL_SORTS;
const KEYS = ['q', 'category', 'sort', 'page', 'limit', 'minPrice', 'maxPrice', 'inStock', 'minRating'];

/* ---------- shared card + actions (also used by wishlist / product page) ---------- */
export function productCard(p) {
  const wished = state.wishlist.has(p.id);
  const stock = p.stock === 0 ? `<span class="stock-out" data-testid="stock-status">${t("Out of stock")}</span>`
    : p.stock <= 3 ? `<span class="stock-low" data-testid="stock-status">${t("Only {count} left", { count: p.stock })}</span>` : `<span class="small muted" data-testid="stock-status">${t("In stock")}</span>`;
  const action = p.stock === 0 ? `<button class="btn sm" disabled data-testid="add-to-cart" aria-label="${t("{name} is out of stock", { name: esc(p.name) })}">${t("Sold out")}</button>`
    : p.variants ? `<a class="btn sm secondary" href="/product/${p.id}" data-testid="choose-options" aria-label="${t("Choose options for {name}", { name: esc(p.name) })}">${t("Options")}</a>`
    : `<button class="btn sm" data-add="${p.id}" data-testid="add-to-cart" aria-label="${t("Add {name} to cart", { name: esc(p.name) })}">${t("Add")}</button>`;
  return `<article class="product-card" data-testid="product-card" data-product-id="${p.id}" aria-label="${esc(p.name)}">
    <div class="thumb"><a href="/product/${p.id}" tabindex="-1" aria-hidden="true">${productImage(p)}</a>
      ${p.onSale ? `<span class="badge warn" data-testid="sale-badge">${t("Sale")}</span>` : ''}
      <button class="icon-btn" data-wish="${p.id}" aria-pressed="${wished}" aria-label="${t(wished ? 'Remove {name} from wishlist' : 'Add {name} to wishlist', { name: esc(p.name) })}" data-testid="wishlist-toggle">${wished ? '♥' : '♡'}</button></div>
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
  if (!isAuthed()) return loginFirst(t("Sign in to add items to your cart"));
  if (btn) btn.disabled = true;
  try {
    const cart = await api('/cart', { method: 'POST', body: { productId, qty: 1, ...extra } });
    setCartCount(cart.count);
    toast(t("Added {name} to cart", { name }));
    if (btn) { const originalText = btn.textContent; btn.textContent = t("Added ✓"); setTimeout(() => { btn.textContent = originalText; btn.disabled = false; }, 1200); }
    return cart;
  } catch (err) {
    if (btn) btn.disabled = false;
    if (err.status !== 401) toast(err.message, 'error');
    throw err;
  }
}
export async function toggleWishlist(id, name, btn) {
  if (!isAuthed()) return loginFirst(t("Sign in to save items to your wishlist"));
  const on = state.wishlist.has(id);
  try {
    if (on) await api(`/wishlist/${id}`, { method: 'DELETE' }); else await api('/wishlist', { method: 'POST', body: { productId: id } });
    on ? state.wishlist.delete(id) : state.wishlist.add(id);
    toast(on ? `Removed ${name} from wishlist` : `Saved ${name} to wishlist`, on ? 'info' : 'success');
    if (btn) { btn.setAttribute('aria-pressed', String(!on)); btn.textContent = on ? '♡' : '♥'; btn.setAttribute('aria-label', t(on ? 'Add {name} to wishlist' : 'Remove {name} from wishlist', { name })); }
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
  setTitle(q.q ? t("Search: {query}", { query: q.q }) : t("Shop"));
  const cats = await api('/categories', { quiet: true });
  if (!isCurrent()) return;
  const selected = new Set(q.category.split(',').filter(Boolean));
  el.innerHTML = `
    <div class="promo-bar" data-testid="promo-bar"><span>🏷️ ${t("Use code")} <strong>SAVE10</strong> ${t("for 10% off")} · <span id="deal" data-testid="deal-of-day">${t("Loading today's deal…")}</span></span>
      <span>${t("Flash sale ends in")} <strong class="mono" data-testid="sale-countdown" id="countdown">--:--:--</strong></span></div>
    <div class="page-head">
      <h1 data-testid="shop-title">${q.q ? t("Results for “{query}”", { query: esc(q.q) }) : t("All products")}</h1>
      <form class="row" id="search-form" role="search" style="flex:1;max-width:460px;flex-wrap:nowrap">
        <input type="search" name="q" value="${esc(q.q)}" placeholder="${t("Search products…")}" aria-label="${t("Search products")}" data-testid="search" autocomplete="off">
        <button class="btn" data-testid="search-btn">${t("Search")}</button>
      </form>
    </div>
    <button class="btn secondary filters-toggle" id="filters-toggle" aria-expanded="false" aria-controls="filters" data-testid="filters-toggle" style="margin-bottom:14px">${t("⚙ Filters")}</button>
    <div class="shop-layout">
      <aside class="filters card" id="filters" aria-label="${t("Filters")}" data-testid="filters">
        <fieldset><legend>${t("Category")}</legend>
          ${cats.map(c => `<label class="check"><span><input type="checkbox" name="category" value="${esc(c.name)}" ${selected.has(c.name) ? 'checked' : ''} data-testid="filter-category-${esc(c.name.toLowerCase())}"> ${esc(c.name)}</span><span class="n">${c.count}</span></label>`).join('')}
        </fieldset>
        <fieldset><legend>${t("Price")}</legend>
          <div class="row" style="flex-wrap:nowrap"><input type="number" min="0" name="minPrice" value="${esc(q.minPrice)}" placeholder="${t("Min")}" aria-label="${t("Minimum price")}" data-testid="min-price"><span>–</span><input type="number" min="0" name="maxPrice" value="${esc(q.maxPrice)}" placeholder="${t("Max")}" aria-label="${t("Maximum price")}" data-testid="max-price"></div>
          <button class="btn secondary sm" style="margin-top:8px" id="apply-price" data-testid="apply-price">${t("Apply price")}</button>
        </fieldset>
        <fieldset><legend>${t("Availability")}</legend><label class="check"><span><input type="checkbox" name="inStock" ${q.inStock === 'true' ? 'checked' : ''} data-testid="filter-in-stock"> ${t("In stock only")}</span></label></fieldset>
        <fieldset><legend>${t("Rating")}</legend>
          <select name="minRating" aria-label="${t("Minimum rating")}" data-testid="filter-rating">${[['', 'Any rating'], ['4', '4★ & up'], ['3', '3★ & up'], ['2', '2★ & up']].map(([v, l]) => `<option value="${v}" ${q.minRating === v ? 'selected' : ''}>${t(l)}</option>`).join('')}</select>
        </fieldset>
        <button class="btn link" id="clear-filters" data-testid="clear-filters">${t("Clear all filters")}</button>
      </aside>
      <section aria-label="${t("Products")}">
        <div class="toolbar">
          <span class="muted" data-testid="results-count" aria-live="polite"></span>
          <div class="row">
            <label class="small" for="sort">${t("Sort by")}</label>
            <select id="sort" data-testid="sort">${SORTS().map(([v, l]) => `<option value="${v}" ${q.sort === v ? 'selected' : ''}>${t(l)}</option>`).join('')}</select>
            <label class="small" for="limit">${t("Show")}</label>
            <select id="limit" data-testid="page-size">${[12, 24, 48].map(n => `<option ${String(q.limit || 12) === String(n) ? 'selected' : ''}>${n}</option>`).join('')}</select>
          </div>
        </div>
        <div class="products" id="grid" data-testid="product-grid" aria-busy="true"></div>
        <nav class="pagination" id="pager" aria-label="${t("Pagination")}" data-testid="pagination"></nav>
      </section>
    </div>`;
  countdown($('#countdown', el));
  api('/deal', { quiet: true }).then(d => { const n = $('#deal', el); if (n) n.innerHTML = `${t("Deal of the day:")} <a href="/product/${d.product.id}" data-testid="deal-link">${esc(d.product.name)}</a> — <strong data-testid="deal-percent">${t("{percent}% off", { percent: d.percentOff })}</strong>`; })
    .catch(() => { const n = $('#deal', el); if (n) n.textContent = t("No deal today"); });

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
      count.textContent = t(d.total === 1 ? '{count} product' : '{count} products', { count: d.total });
      grid.innerHTML = d.items.length ? d.items.map(productCard).join('')
        : `<div class="empty" style="grid-column:1/-1" data-testid="empty-results"><div class="big">🔍</div><p><strong>${t("No products found")}</strong></p><p>${t("Try a different search or clear your filters.")}</p></div>`;
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
    if (d.pages <= 1) { pager.innerHTML = `<span class="small muted" data-testid="page-info">${t("Page {page} of {pages}", { page: 1, pages: 1 })}</span>`; return; }
    const btn = (label, page, attrs = '') => `<button class="btn secondary sm" data-page="${page}" ${attrs}>${label}</button>`;
    pager.innerHTML = btn(t("‹ Prev"), d.page - 1, `data-testid="prev" aria-label="${t("Previous page")}" ${d.page <= 1 ? 'disabled' : ''}`)
      + Array.from({ length: d.pages }, (_, i) => btn(i + 1, i + 1, `data-testid="page-${i + 1}" aria-label="${t("Page {page}", { page: i + 1 })}" ${i + 1 === d.page ? 'aria-current="page"' : ''}`)).join('')
      + btn(t("Next ›"), d.page + 1, `data-testid="next" aria-label="${t("Next page")}" ${d.page >= d.pages ? 'disabled' : ''}`)
      + `<span class="small muted" data-testid="page-info">${t("Page {page} of {pages}", { page: d.page, pages: d.pages })}</span>`;
  };
  pager.onclick = e => { const b = e.target.closest('[data-page]'); if (!b || b.disabled) return; params.page = b.dataset.page; sync(true); load(); window.scrollTo(0, 0); };
  const refilter = () => { params.page = ''; sync(); load(); };

  const sf = $('#search-form', el);
  let searchTimer;
  const search = () => {
    params.q = sf.q.value.trim();
    $('[data-testid=shop-title]', el).textContent = params.q ? t("Results for “{query}”", { query: params.q }) : t("All products");
    refilter();
  };
  sf.q.oninput = () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { if (isCurrent()) search(); }, 400);
  };
  sf.onsubmit = e => {
    e.preventDefault();
    clearTimeout(searchTimer);
    search();
  };
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



