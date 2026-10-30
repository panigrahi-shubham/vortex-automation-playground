import { $, api, esc, setTitle, fmtDate, toast, state, isDatabaseMode } from '../core.js';

export async function render(el, { query, isCurrent }) {
  setTitle('Test inbox');
  if (isDatabaseMode()) {
    el.innerHTML = `<div class="empty" data-testid="mailbox-unavailable"><div class="big">📬</div><h1>Test inbox unavailable</h1><p>The database test inbox requires a local test key. Read development recovery codes with npm run test:inbox -- your-email-address in the project terminal. This inbox is disabled in production.</p><a class="btn" href="/shop">Back to the shop</a></div>`;
    return;
  }
  const initial = query.get('to') || (state.user ? state.user.email : '');
  el.innerHTML = `<div class="page-head"><div><h1>Test inbox</h1><p class="muted" style="margin:0">Every email VORTEX “sends” lands here — OTP codes, reset codes, order confirmations. Also available as <code>GET /api/test/mailbox?to=</code>.</p></div></div>
    <form class="card row" id="mb-form" style="margin-bottom:16px" role="search">
      <label class="sr-only" for="mb-to">Email address</label>
      <input id="mb-to" type="email" placeholder="someone@shoplab.test (blank = all)" value="${esc(initial)}" data-testid="mailbox-email" style="flex:1;min-width:220px">
      <button class="btn" data-testid="mailbox-refresh">Refresh</button>
      <label class="check"><input type="checkbox" id="auto" data-testid="mailbox-auto"> Auto-refresh (3 s)</label>
      <button type="button" class="btn link" id="clear" data-testid="mailbox-clear">Clear inbox</button>
    </form>
    <section class="card" aria-live="polite" data-testid="mailbox-list"></section>`;
  const list = $('[data-testid=mailbox-list]', el), form = $('#mb-form', el);
  const load = async () => {
    const to = $('#mb-to', el).value.trim();
    const mails = await api(`/test/mailbox${to ? `?to=${encodeURIComponent(to)}` : ''}`, { quiet: true });
    if (!isCurrent()) return;
    list.innerHTML = mails.length ? mails.map(m => `<article class="mail" data-testid="mail">
      <div class="spread"><strong data-testid="mail-subject">${esc(m.subject)}</strong><span class="small muted">${fmtDate(m.createdAt)}</span></div>
      <div class="small muted">To: <span data-testid="mail-to">${esc(m.to)}</span></div>
      <p style="margin:6px 0 0" data-testid="mail-body">${esc(m.body)}</p>
      ${m.code ? `<p style="margin:8px 0 0">Code: <span class="code" data-testid="mail-code">${esc(m.code)}</span> <button class="btn link sm" data-copy="${esc(m.code)}" data-testid="copy-code">Copy</button></p>` : ''}
    </article>`).join('') : '<p class="muted" data-testid="mailbox-empty" style="margin:0">No emails yet.</p>';
  };
  form.onsubmit = e => { e.preventDefault(); load(); };
  list.onclick = async e => {
    const b = e.target.closest('[data-copy]'); if (!b) return;
    try { await navigator.clipboard.writeText(b.dataset.copy); b.textContent = 'Copied!'; } catch { toast('Clipboard permission denied', 'error'); }
  };
  $('#clear', el).onclick = async () => { await api('/test/mailbox', { method: 'DELETE' }); load(); };
  let timer;
  $('#auto', el).onchange = e => {
    clearInterval(timer);
    if (e.target.checked) timer = setInterval(() => (isCurrent() ? load() : clearInterval(timer)), 3000);
  };
  load();
}


