import { $, $$, state, store, api, esc, navigate, isAuthed, isAdmin, setAuth, refreshCounts, toast, ApiError, loadRuntime, isDatabaseMode, runtime } from './core.js';

/* ---------------- routes (history API, lazy-loaded views) ---------------- */
const routes = [
  [/^\/$/, null],
  [/^\/login$/, 'auth', 'login'], [/^\/login\/verify$/, 'auth', 'verify'],
  [/^\/register$/, 'auth', 'register'], [/^\/forgot-password$/, 'auth', 'forgot'],
  [/^\/shop$/, 'shop', 'list'], [/^\/product\/(\d+)$/, 'product', 'render'],
  [/^\/wishlist$/, 'cart', 'wishlist'], [/^\/cart$/, 'cart', 'cart'],
  [/^\/checkout\/complete\/([\w-]+)$/, 'checkout', 'complete'],
  [/^\/checkout(?:\/(address|delivery|payment|review))?$/, 'checkout', 'wizard'],
  [/^\/orders$/, 'orders', 'list'], [/^\/orders\/([\w-]+)$/, 'orders', 'detail'],
  [/^\/settings$/, 'account', 'settings'],
  [/^\/account(?:\/(profile|security|avatar|settings))?$/, 'account', 'render'],
  [/^\/admin(?:\/(products|orders|users))?$/, 'admin', 'render'],
  [/^\/lab$/, 'lab', 'render'], [/^\/mailbox$/, 'mailbox', 'render'], [/^\/docs$/, 'docs', 'render']
];

let renderId = 0;
async function router() {
  if (runtime.storage === 'unavailable') return;
  const id = ++renderId;
  const el = $('#app');
  const path = location.pathname.replace(/\/+$/, '') || '/';
  const query = new URLSearchParams(location.search);
  closeMenus();
  highlightNav(path);
  const match = routes.map(([re, mod, fn]) => ({ m: path.match(re), mod, fn })).find(r => r.m);
  if (!match) return notFound(el);
  if (!match.mod) return navigate('/shop', { replace: true });
  try {
    const view = await import(`./views/${match.mod}.js`);
    if (id !== renderId) return;
    el.innerHTML = '';
    await view[match.fn](el, { params: match.m.slice(1), query, isCurrent: () => id === renderId });
    if (id === renderId) { window.scrollTo(0, 0); el.dataset.route = path; }
  } catch (err) {
    console.error(err);
    if (id !== renderId) return;
    if (err instanceof ApiError && err.status === 401) return; // session handler already redirected
    el.innerHTML = `<div class="empty" role="alert" data-testid="page-error"><div class="big">⚠️</div><h1>Could not load this page</h1><p>${esc(err.message)}</p><button class="btn secondary" onclick="location.reload()">Reload</button></div>`;
  }
}
function notFound(el) {
  document.title = 'Page not found · VORTEX';
  el.innerHTML = `<div class="empty" data-testid="not-found"><div class="big">🧭</div><h1>Page not found</h1><p>No page lives at <code>${esc(location.pathname)}</code>.</p><a class="btn" href="/shop">Back to the shop</a></div>`;
}
function highlightNav(path) {
  $$('.main-nav a').forEach(a => { const on = path === a.getAttribute('href') || path.startsWith(a.getAttribute('href') + '/'); on ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'); });
}
window.addEventListener('popstate', router);
window.addEventListener('route', router);

// Intercept same-origin links for client-side navigation
const SERVER_PAGES = /^\/(api|terms|bank|lab\/)/;
document.addEventListener('click', e => {
  const a = e.target.closest('a[href]');
  if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const href = a.getAttribute('href');
  if (!href.startsWith('/') || a.target || a.hasAttribute('download') || SERVER_PAGES.test(href)) return;
  e.preventDefault();
  navigate(href);
});

/* ---------------- header / user menu ---------------- */
function initials(u) { return esc((u.name || u.username).split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase()); }
export function avatarHtml(u, cls = '') {
  return u.avatar ? `<img class="avatar ${cls}" src="${u.avatar}" alt="" data-testid="avatar-img">` : `<span class="avatar ${cls}" aria-hidden="true">${initials(u)}</span>`;
}
function renderHeader() {
  const slot = $('#user-slot');
  $$('[data-auth]').forEach(el => (el.hidden = !isAuthed()));
  $$('[data-admin]').forEach(el => (el.hidden = !isAdmin()));
  if (!isAuthed()) {
    slot.innerHTML = `<a class="icon-link" href="/login" data-testid="nav-login">Sign in</a>`;
    return;
  }
  const u = state.user || { username: '?' };
  slot.innerHTML = `<div class="user-menu">
    <button class="user-menu-btn" id="user-menu-btn" aria-haspopup="menu" aria-expanded="false" aria-controls="user-menu" data-testid="user-menu">
      ${avatarHtml(u)}<span data-testid="user-name">${esc(u.name || u.username)}</span><span class="caret" aria-hidden="true">▾</span></button>
    <div class="menu" id="user-menu" role="menu" aria-label="Account">
      <div class="small muted" style="padding:6px 10px">Signed in as <strong data-testid="signed-in-as">${esc(u.username)}</strong></div><hr>
      <a role="menuitem" href="/account" data-testid="menu-account">My account</a>
      <a role="menuitem" href="/orders" data-testid="menu-orders">My orders</a>
      <a role="menuitem" href="/wishlist" data-testid="menu-wishlist">Wishlist</a>
      ${isAdmin() ? '<a role="menuitem" href="/admin" data-testid="menu-admin">Admin console</a>' : ''}
      <hr><button role="menuitem" data-testid="logout">Sign out</button>
    </div></div>`;
  const btn = $('#user-menu-btn'), menu = $('#user-menu');
  btn.onclick = e => { e.stopPropagation(); const open = !menu.classList.contains('open'); menu.classList.toggle('open', open); btn.setAttribute('aria-expanded', String(open)); };
  $('[data-testid=logout]', menu).onclick = logout;
}
function closeMenus() {
  $$('.menu.open').forEach(m => m.classList.remove('open'));
  $$('[aria-expanded="true"][aria-haspopup]').forEach(b => b.setAttribute('aria-expanded', 'false'));
  $('#main-nav').classList.remove('open'); $('#hamburger').setAttribute('aria-expanded', 'false');
}
document.addEventListener('click', e => { if (!e.target.closest('.user-menu')) $$('.user-menu .menu.open').forEach(m => m.classList.remove('open')); });
async function logout() {
  try { await api('/logout', { method: 'POST' }); } catch { /* already signed out */ }
  setAuth(null, null);
  toast('You have been signed out', 'info');
  navigate('/login');
}
document.addEventListener('auth-changed', () => { renderHeader(); refreshCounts(); connectEvents(); });

$('#hamburger').onclick = () => {
  const nav = $('#main-nav'); const open = !nav.classList.contains('open');
  nav.classList.toggle('open', open); $('#hamburger').setAttribute('aria-expanded', String(open));
};

/* ---------------- theme ---------------- */
$('#theme-toggle').onclick = () => {
  const dark = document.documentElement.dataset.theme !== 'dark';
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  store.set('shoplab.theme', dark ? 'dark' : 'light');
};

/* ---------------- cookie consent (practice dismissing overlays) ---------------- */
function cookieBanner() {
  if (store.get('shoplab.cookies')) return;
  const el = document.createElement('div');
  el.className = 'cookie card';
  el.setAttribute('role', 'region'); el.setAttribute('aria-label', 'Cookie consent'); el.dataset.testid = 'cookie-banner';
  el.innerHTML = `<p style="margin-bottom:10px"><strong>We use cookies 🍪</strong><br><span class="small muted">Only pretend ones. Tests can skip this banner by setting <code>localStorage['shoplab.cookies']</code>.</span></p>
    <div class="row"><button class="btn sm" data-testid="cookie-accept">Accept all</button><button class="btn secondary sm" data-testid="cookie-reject">Reject non-essential</button></div>`;
  el.querySelector('[data-testid=cookie-accept]').onclick = () => { store.set('shoplab.cookies', 'accepted'); el.remove(); };
  el.querySelector('[data-testid=cookie-reject]').onclick = () => { store.set('shoplab.cookies', 'rejected'); el.remove(); };
  document.body.append(el);
}

/* ---------------- chaos panel ---------------- */
async function loadChaos() {
  try {
    const c = await api('/chaos', { quiet: true });
    $('#c-lat').value = c.latencyMs; $('#c-err').value = c.errorRate; $('#c-bug').checked = c.bugMode;
    $('#c-ttl').value = c.sessionTtlSec; $('#c-prog').value = c.orderProgressSec;
    const on = c.latencyMs > 0 || c.errorRate > 0 || c.bugMode;
    $('#chaos-dot').classList.toggle('on', on);
    $('#chaos-dot').setAttribute('aria-label', on ? 'Chaos active' : 'Chaos off');
  } catch { /* ignore */ }
}
$('#chaos').addEventListener('toggle', () => { if ($('#chaos').open) loadChaos(); });
$('#c-apply').onclick = async () => {
  await api('/chaos', { method: 'POST', body: { latencyMs: +$('#c-lat').value, errorRate: +$('#c-err').value, bugMode: $('#c-bug').checked, sessionTtlSec: +$('#c-ttl').value, orderProgressSec: +$('#c-prog').value } });
  toast('Chaos settings applied', 'info'); loadChaos();
};
$('#c-reset').onclick = async () => {
  await api('/reset', { method: 'POST' });
  setAuth(null, null); toast('Server reset — all data restored to seed', 'info'); loadChaos(); navigate('/login');
};

/* ---------------- command palette (Ctrl/Cmd+K) ---------------- */
const PAGES = [['Shop', '/shop'], ['Cart', '/cart'], ['Wishlist', '/wishlist'], ['Orders', '/orders'], ['Account', '/account'], ['UI Lab', '/lab'], ['Test Inbox', '/mailbox'], ['API Docs', '/docs'], ['Admin console', '/admin']];
function openPalette() {
  if ($('.palette')) return;
  const el = document.createElement('div');
  el.className = 'palette';
  el.innerHTML = `<div class="box" role="dialog" aria-modal="true" aria-label="Command palette" data-testid="palette">
    <input role="combobox" aria-expanded="true" aria-controls="palette-list" aria-autocomplete="list" placeholder="Search products or jump to a page…" data-testid="palette-input" aria-label="Search products or pages">
    <ul id="palette-list" role="listbox" data-testid="palette-results"></ul></div>`;
  document.body.append(el);
  const input = $('input', el), list = $('ul', el);
  let items = [], sel = 0, t;
  const draw = () => {
    list.innerHTML = items.length ? items.map((it, i) => `<li role="option" id="pal-${i}" aria-selected="${i === sel}" data-href="${esc(it.href)}">${esc(it.label)}<span class="muted small">${esc(it.kind)}</span></li>`).join('') : '<li class="muted" aria-disabled="true">No matches</li>';
    input.setAttribute('aria-activedescendant', items.length ? `pal-${sel}` : '');
  };
  const search = async () => {
    const q = input.value.trim().toLowerCase();
    const pages = PAGES.filter(([label]) => !isDatabaseMode() || !['Test Inbox'].includes(label));
    items = pages.filter(([l]) => l.toLowerCase().includes(q)).map(([label, href]) => ({ label, href, kind: 'Page' }));
    if (q.length >= 2) {
      try { const r = await api(`/products?q=${encodeURIComponent(q)}&limit=6`, { quiet: true }); items = [...r.items.map(p => ({ label: p.name, href: `/product/${p.id}`, kind: p.category })), ...items]; } catch { /* ignore */ }
    }
    sel = 0; draw();
  };
  const close = () => el.remove();
  const go = href => { close(); navigate(href); };
  input.oninput = () => { clearTimeout(t); t = setTimeout(search, 200); };
  input.onkeydown = e => {
    if (e.key === 'ArrowDown') { sel = Math.min(sel + 1, items.length - 1); draw(); e.preventDefault(); }
    if (e.key === 'ArrowUp') { sel = Math.max(sel - 1, 0); draw(); e.preventDefault(); }
    if (e.key === 'Enter' && items[sel]) go(items[sel].href);
    if (e.key === 'Escape') close();
  };
  list.onclick = e => { const li = e.target.closest('li[data-href]'); if (li) go(li.dataset.href); };
  el.onmousedown = e => { if (e.target === el) close(); };
  search(); input.focus();
}
$('#palette-btn').onclick = openPalette;
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); }
});

/* ---------------- server-sent events: live order status ---------------- */
let es = null;
function connectEvents() {
  if (es) { es.close(); es = null; }
  if (!isAuthed() || !window.EventSource || isDatabaseMode()) return;
  es = new EventSource(`/api/events?token=${encodeURIComponent(state.token)}`);
  es.addEventListener('order-status', e => {
    const d = JSON.parse(e.data);
    toast(`Order ${d.orderId} is now ${d.status}`, 'info');
    window.dispatchEvent(new CustomEvent('order-status', { detail: d }));
  });
  es.onerror = () => { if (!isAuthed()) { es.close(); es = null; } };
}

/* ---------------- boot ---------------- */
(async function boot() {
  try { await loadRuntime(); }
  catch {
    document.documentElement.dataset.storage = 'unavailable';
    document.title = 'Service unavailable · VORTEX';
    $('#chaos').hidden = true;
    $$('.main-nav, .header-actions').forEach(el => { el.hidden = true; });
    $('#app').innerHTML = `<section class="empty card" role="alert" data-testid="service-unavailable"><h1>Service temporarily unavailable</h1><p>We could not connect to the store. Please try again in a moment.</p><button class="btn" data-testid="retry-service">Try again</button><p><a href="/pages/testing-guide.html" target="_self">Read the testing guide</a></p></section>`;
    $('[data-testid="retry-service"]').onclick = () => location.reload();
    return;
  }
  document.documentElement.dataset.storage = isDatabaseMode() ? 'postgres' : 'memory';
  if (isDatabaseMode()) {
    $$('[data-legacy-only]').forEach(el => { el.hidden = true; });
    $('#chaos').hidden = true;
  }
  if (isAuthed()) {
    try { const me = await api('/me', { quiet: true }); setAuth(state.token, me);
      if (isDatabaseMode()) { const { applyAccountSettings } = await import('./views/account.js'); applyAccountSettings(await api('/me/settings', { quiet: true })); }
    }
    catch { /* 401 handled by api() */ }
  }
  renderHeader(); refreshCounts(); connectEvents(); cookieBanner();
  if (!isDatabaseMode()) loadChaos();
  router();
})();




