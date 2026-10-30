import { request as requestV2, V2HttpError } from './api-v2.js';

// Core helpers shared by every view: API client, auth state, toasts, modals, forms, images.
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export { $, $$ };

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* storage blocked */ } }
};
export { store };

export const state = {
  token: store.get('shoplab.token'),
  user: JSON.parse(store.get('shoplab.user') || 'null'),
  cartCount: 0,
  wishlist: new Set(),
  meta: null
};
export const isAuthed = () => !!state.token;
export const isAdmin = () => state.user && state.user.role === 'admin';

export function setAuth(token, user) {
  state.token = token; state.user = user;
  store.set('shoplab.token', token);
  store.set('shoplab.user', user ? JSON.stringify(user) : null);
  document.dispatchEvent(new CustomEvent('auth-changed'));
}

/* ---------------- HTML helpers ---------------- */
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const money = n => '$' + (+n || 0).toFixed(2);
export const fmtDate = iso => new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
export function stars(rating, count) {
  const full = Math.round(rating || 0);
  return `<span class="stars" aria-label="Rated ${rating || 0} out of 5${count !== undefined ? `, ${count} reviews` : ''}">${'★'.repeat(full)}${'☆'.repeat(5 - full)}${count !== undefined ? `<span class="n">(${count})</span>` : ''}</span>`;
}
export function setTitle(t) { document.title = t ? `${t} · VORTEX` : 'VORTEX · AUTOMATION PLAYGROUND'; }

const CAT_COLORS = {
  Electronics: ['#0e7490', '#cffafe'], Books: ['#6d28d9', '#ede9fe'], Home: ['#b45309', '#fef3c7'],
  Toys: ['#be123c', '#ffe4e6'], Fashion: ['#15803d', '#dcfce7']
};
/** Deterministic SVG product image — no network, identical in every run (good for visual tests). */
export function productImage(p, variant = 0) {
  const [dark, light] = CAT_COLORS[p.category] || ['#44403c', '#f5f5f4'];
  const initials = esc(p.name.replace(/[^A-Za-z0-9 ]/g, '').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase());
  const seed = (p.id * 37 + variant * 11) % 100;
  const shapes = [
    `<circle cx="${140 + seed}" cy="150" r="${70 + (seed % 25)}" fill="${dark}" opacity=".16"/><circle cx="${250 - seed / 2}" cy="${110 + seed / 3}" r="44" fill="${dark}" opacity=".22"/>`,
    `<rect x="${90 + seed / 2}" y="70" width="170" height="170" rx="26" fill="${dark}" opacity=".15" transform="rotate(${seed - 50} 200 150)"/>`,
    `<path d="M${60 + seed} 240 L200 ${50 + seed / 2} L${340 - seed / 3} 240 Z" fill="${dark}" opacity=".15"/>`
  ];
  return `<svg viewBox="0 0 400 300" role="img" aria-label="${esc(p.name)}${variant ? ` view ${variant + 1}` : ''}" xmlns="http://www.w3.org/2000/svg">
    <rect width="400" height="300" fill="${light}"/>${shapes[(p.id + variant) % 3]}
    <text x="200" y="172" text-anchor="middle" font-family="ui-sans-serif,system-ui,Arial" font-size="64" font-weight="800" fill="${dark}">${initials}</text>
    <text x="200" y="210" text-anchor="middle" font-family="ui-monospace,monospace" font-size="13" fill="${dark}" opacity=".7">${esc(p.sku || '')}</text></svg>`;
}

/* ---------------- API client ---------------- */
export const runtime = { storage: 'unavailable', recoveryAvailable: false };
export const isDatabaseMode = () => runtime.storage === 'postgres';
export async function loadRuntime() {
  runtime.storage = 'unavailable';
  runtime.recoveryAvailable = false;
  try {
    const res = await fetch('/api/config', { cache: 'no-store' });
    if (!res.ok) throw new Error('Configuration unavailable');
    const config = await res.json();
    if (!['postgres', 'memory'].includes(config.storage)) throw new Error('Invalid configuration');
    runtime.storage = config.storage;
    runtime.recoveryAvailable = config.recoveryAvailable === true;
  } catch { throw new Error('The service is temporarily unavailable. Please try again.'); }
  return runtime.storage;
}

export class ApiError extends Error {
  constructor(status, message, data) { super(message); this.status = status; this.data = data || {}; this.fields = (data && data.fields) || null; }
}
let inflight = 0;
const loader = () => document.getElementById('loader');
export async function api(path, { method = 'GET', body, headers = {}, quiet = false, raw = false } = {}) {
  if (runtime.storage === 'unavailable') throw new ApiError(503, 'The service is temporarily unavailable. Please try again.');
  inflight++; if (!quiet) loader().hidden = false;
  try {
    if (isDatabaseMode()) {
      try {
        const data = await requestV2(path, { method, body, headers, token: state.token, raw });
        return data;
      } catch (err) {
        if (err instanceof V2HttpError) {
          if (err.status === 401 && state.token && !path.startsWith('/login')) sessionExpired(err.data && err.data.code);
          throw new ApiError(err.status, err.message, err.data);
        }
        throw err;
      }
    }
    const opts = { method, headers: { ...headers } };
    if (body instanceof Blob) { opts.body = body; opts.headers['Content-Type'] = body.type || 'application/octet-stream'; }
    else if (body !== undefined) { opts.body = JSON.stringify(body); opts.headers['Content-Type'] = 'application/json'; }
    if (state.token) opts.headers.Authorization = `Bearer ${state.token}`;
    let res;
    try { res = await fetch('/api' + path, opts); }
    catch { throw new ApiError(0, 'Network error — please check your connection and try again'); }
    if (raw) return res;
    const data = res.status === 204 ? null : await res.json().catch(() => null);
    if (!res.ok) {
      if (res.status === 401 && state.token && !path.startsWith('/login')) sessionExpired(data && data.code);
      throw new ApiError(res.status, (data && data.error) || `Request failed (${res.status})`, data);
    }
    return data;
  } finally {
    inflight--; if (inflight <= 0) { inflight = 0; loader().hidden = true; }
  }
}
function sessionExpired(code) {
  setAuth(null, null);
  const here = location.pathname + location.search;
  navigate(`/login?returnTo=${encodeURIComponent(here)}&reason=${code === 'SESSION_EXPIRED' ? 'expired' : 'signin'}`, { replace: true });
}

/* ---------------- navigation ---------------- */
export function navigate(url, { replace = false } = {}) {
  if (replace) history.replaceState({}, '', url); else history.pushState({}, '', url);
  window.dispatchEvent(new Event('route'));
}
/** Redirects guests to /login and returns false. */
export function requireAuth() {
  if (isAuthed()) return true;
  navigate(`/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`, { replace: true });
  return false;
}

/* ---------------- counts in header ---------------- */
export async function refreshCounts() {
  const cartEl = $('#cart-count'), wlEl = $('#wishlist-count');
  if (!isAuthed()) { state.cartCount = 0; state.wishlist = new Set(); }
  else {
    try {
      const [cart, wl] = await Promise.all([api('/cart', { quiet: true }), api('/wishlist', { quiet: true })]);
      state.cartCount = cart.count; state.wishlist = new Set(wl.map(p => p.id));
    } catch { /* leave old values */ }
  }
  cartEl.textContent = state.cartCount; cartEl.dataset.zero = String(!state.cartCount);
  wlEl.textContent = state.wishlist.size; wlEl.dataset.zero = String(!state.wishlist.size);
}
export function setCartCount(n) {
  state.cartCount = n; const el = $('#cart-count'); el.textContent = n; el.dataset.zero = String(!n);
}

/* ---------------- toasts ---------------- */
export function toast(message, type = 'success', timeout = 4000) {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.dataset.testid = 'toast';
  el.dataset.type = type;
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  el.innerHTML = `<span class="msg">${esc(message)}</span><button aria-label="Dismiss notification">×</button>`;
  el.querySelector('button').onclick = () => el.remove();
  $('#toasts').append(el);
  if (timeout) setTimeout(() => el.remove(), timeout);
  return el;
}

/* ---------------- modals ---------------- */
let modalSeq = 0;
export function openModal(inner, { wide = false, label = 'Dialog', testid = 'modal', onClose } = {}) {
  const id = `modal-${++modalSeq}`;
  const prevFocus = document.activeElement;
  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop';
  wrap.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="${id}-title" aria-label="${esc(label)}" data-testid="${testid}">${inner.replace('data-modal-title', `id="${id}-title"`)}</div>`;
  $('#overlay-root').append(wrap);
  const close = () => { wrap.remove(); document.removeEventListener('keydown', onKey); prevFocus && prevFocus.focus && prevFocus.focus(); onClose && onClose(); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  wrap.addEventListener('mousedown', e => { if (e.target === wrap) close(); });
  setTimeout(() => { const f = wrap.querySelector('[autofocus], input, select, textarea, button'); f && f.focus(); });
  return { el: wrap.firstElementChild, close };
}
export function confirmDialog({ title, message, confirmText = 'Confirm', cancelText = 'Cancel', danger = false }) {
  return new Promise(resolve => {
    let done = false;
    const m = openModal(`<h2 data-modal-title>${esc(title)}</h2><p>${esc(message)}</p>
      <div class="modal-actions"><button class="btn secondary" data-act="cancel" data-testid="confirm-cancel">${esc(cancelText)}</button>
      <button class="btn ${danger ? 'danger' : ''}" data-act="ok" data-testid="confirm-ok">${esc(confirmText)}</button></div>`,
      { label: title, testid: 'confirm-dialog', onClose: () => { if (!done) resolve(false); } });
    m.el.querySelector('[data-act=ok]').onclick = () => { done = true; m.close(); resolve(true); };
    m.el.querySelector('[data-act=cancel]').onclick = () => { done = true; m.close(); resolve(false); };
  });
}

/* ---------------- forms ---------------- */
/** Renders a labelled field with an error slot. testid defaults to the name. */
export function field({ name, label, type = 'text', value = '', testid, hint = '', attrs = '', options = null, id }) {
  const fid = id || `f-${name}`;
  const t = testid || name;
  const describe = `${fid}-error${hint ? ` ${fid}-hint` : ''}`;
  let control;
  if (options) {
    control = `<select id="${fid}" name="${name}" data-testid="${t}" aria-describedby="${describe}" ${attrs}>${options.map(o => {
      const [v, l] = Array.isArray(o) ? o : [o, o];
      return `<option value="${esc(v)}" ${String(v) === String(value) ? 'selected' : ''}>${esc(l)}</option>`;
    }).join('')}</select>`;
  } else if (type === 'textarea') {
    control = `<textarea id="${fid}" name="${name}" data-testid="${t}" aria-describedby="${describe}" ${attrs}>${esc(value)}</textarea>`;
  } else {
    control = `<input id="${fid}" name="${name}" type="${type}" value="${esc(value)}" data-testid="${t}" aria-describedby="${describe}" ${attrs}>`;
  }
  return `<div class="field" data-field="${name}"><label for="${fid}">${esc(label)}</label>${control}
    ${hint ? `<div class="hint" id="${fid}-hint">${hint}</div>` : ''}<p class="field-error" id="${fid}-error" data-testid="${t}-error"></p></div>`;
}
export function clearErrors(form) {
  $$('[aria-invalid]', form).forEach(el => el.removeAttribute('aria-invalid'));
  $$('.field-error', form).forEach(el => (el.textContent = ''));
  const a = $('[data-form-alert]', form); if (a) { a.hidden = true; a.textContent = ''; }
}
export function showErrors(form, fields) {
  let first = null;
  for (const [k, msg] of Object.entries(fields || {})) {
    const input = $(`[name="${k}"]`, form);
    const err = $(`[data-field="${k}"] .field-error`, form);
    if (input) { input.setAttribute('aria-invalid', 'true'); first = first || input; }
    if (err) err.textContent = msg;
  }
  first && first.focus();
}
export function formAlert(form, message, type = 'error') {
  const a = $('[data-form-alert]', form);
  if (!a) return toast(message, 'error');
  a.className = `alert ${type}`; a.textContent = message; a.hidden = false;
}
export const formData = form => Object.fromEntries(new FormData(form).entries());
export async function busy(btn, fn, text = 'Please wait…') {
  const html = btn.innerHTML;
  btn.disabled = true; btn.setAttribute('aria-busy', 'true');
  btn.innerHTML = `<span class="spinner" aria-hidden="true"></span> ${esc(text)}`;
  try { return await fn(); } finally { btn.disabled = false; btn.removeAttribute('aria-busy'); btn.innerHTML = html; }
}
export async function getMeta() {
  if (!state.meta) state.meta = await api('/meta', { quiet: true });
  return state.meta;
}
export function errorState(el, err, retry) {
  el.innerHTML = `<div class="empty" data-testid="error-state" role="alert"><div class="big">⚠️</div><p><strong>Something went wrong.</strong></p><p data-testid="error-message">${esc(err.message)}</p>
    ${retry ? '<button class="btn secondary" data-testid="retry">Try again</button>' : ''}</div>`;
  if (retry) el.querySelector('[data-testid=retry]').onclick = retry;
}



