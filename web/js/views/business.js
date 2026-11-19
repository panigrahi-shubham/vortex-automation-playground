import { esc, state as auth, isAuthed, isDatabaseMode, setAuth, navigate, setTitle, toast, money } from '../core.js';
import { createBusinessClient } from '../business-client.js';

const sections = [
  ['overview', 'Overview', '◈'], ['seller', 'Seller centre', '▦'], ['travel', 'Business travel', '↗'],
  ['finance', 'Finance & banking', '⇄'], ['learning', 'Learning academy', '▤']
];
const link = section => section === 'overview' ? '/business' : `/business/${section}`;
const usd = cents => money(cents / 100);
const date = value => new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const badge = status => `<span class="biz-badge biz-${status.toLowerCase()}">${esc(status)}</span>`;
const input = (name, label, options = '') => `<label class="biz-field">${label}<input name="${name}" ${options} required></label>`;
const empty = message => `<div class="biz-empty">${message}</div>`;
const download = (filename, body, type = 'text/plain') => {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

// Native dialogs provide focus trapping, Escape dismissal and keyboard navigation.
function modal(title, body, submitLabel, onSubmit) {
  const previous = document.activeElement;
  const previousAction = previous?.dataset.action, previousId = previous?.dataset.id;
  const dialog = document.createElement('dialog');
  dialog.className = 'biz-dialog'; dialog.setAttribute('aria-labelledby', 'biz-dialog-title');
  dialog.innerHTML = `<form><div class="spread"><h2 id="biz-dialog-title">${esc(title)}</h2><button type="button" class="biz-close" aria-label="Close dialog">×</button></div>
    ${body}<p class="biz-error" role="alert" data-testid="business-form-error"></p>
    <div class="biz-dialog-actions"><button type="button" class="btn secondary" data-cancel>Cancel</button><button class="btn" type="submit">${esc(submitLabel)}</button></div></form>`;
  document.getElementById('overlay-root').append(dialog);
  const close = () => dialog.close();
  let submitting = false;
  dialog.addEventListener('cancel', event => { if (submitting) event.preventDefault(); });
  dialog.querySelector('.biz-close').onclick = close; dialog.querySelector('[data-cancel]').onclick = close;
  dialog.addEventListener('close', () => {
    dialog.remove();
    const replacement = [...document.querySelectorAll('[data-action]')].find(button => button.dataset.action === previousAction && button.dataset.id === previousId);
    const target = previous?.isConnected ? previous : replacement || document.querySelector('#app h1');
    if (target && !target.hasAttribute('tabindex') && target.tagName === 'H1') target.setAttribute('tabindex', '-1');
    target?.focus();
  });
  dialog.querySelector('form').onsubmit = async e => {
    e.preventDefault();
    if (submitting) return;
    submitting = true;
    const buttons = [...dialog.querySelectorAll('button')];
    const button = dialog.querySelector('[type=submit]');
    const originalLabel = button.textContent;
    buttons.forEach(button => { button.disabled = true; });
    button.textContent = 'Saving…'; dialog.setAttribute('aria-busy', 'true');
    const values = Object.fromEntries(new FormData(e.currentTarget));
    try { await onSubmit(values); close(); }
    catch (error) { dialog.querySelector('[role=alert]').textContent = error.message; }
    finally { submitting = false; dialog.removeAttribute('aria-busy'); buttons.forEach(button => { button.disabled = false; }); button.textContent = originalLabel; }
  };
  dialog.showModal();
  return dialog;
}

export async function render(el, { params = [], isCurrent = () => true } = {}) {
  const section = params[0] || 'overview';
  setTitle(`${sections.find(s => s[0] === section)?.[1] || 'Business'} · Vortex Business`);
  if (!isAuthed()) {
    el.innerHTML = `<section class="biz-welcome" data-testid="business-welcome"><span class="biz-eyebrow">VORTEX BUSINESS</span><h1>One workspace.<br>A world of business.</h1><p>Grow your wholesale business, plan your next trip, manage payments and give your team room to learn.</p>
      <div class="row"><a class="btn" href="/login?returnTo=${encodeURIComponent(link(section))}">Sign in to business →</a><a class="btn secondary" href="/register?returnTo=${encodeURIComponent(link(section))}">Create an account</a></div><small>Use your existing Vortex account. Banking and travel are simulated.</small>
      <div class="biz-welcome-grid">${sections.slice(1).map(([, label, icon]) => `<article><span>${icon}</span><h2>${label}</h2></article>`).join('')}</div></section>`;
    return;
  }
  const base = `${isDatabaseMode() ? '/api/v2' : '/api'}/business`;
  const client = createBusinessClient({ base, token: () => auth.token, userKey: auth.user?.id || auth.user?.username, onUnauthorized: () => {
    document.querySelectorAll('.biz-dialog').forEach(dialog => dialog.close());
    setAuth(null, null); navigate(`/login?returnTo=${encodeURIComponent(link(section))}`);
  } });
  const request = client.request;
  let workspace, trips = [], search = '', filter = 'All', busy = false;
  let ledgerSearch = '', ledgerFilter = 'All', ledgerPage = 1, recoveryMessage = '';
  let travelQuery = { from: 'Bengaluru', to: 'Delhi', date: new Date(Date.now() + 86400000).toISOString().slice(0, 10), travellers: '1' };
  el.innerHTML = '<div class="biz-empty" role="status">Opening your business workspace…</div>';
  try { workspace = await request(); }
  catch (error) {
    if (!isCurrent()) return;
    el.innerHTML = `<section class="card" role="alert"><h1>Workspace unavailable</h1><p>${esc(error.message)}</p><button class="btn" data-retry>Try again</button></section>`;
    el.querySelector('[data-retry]').onclick = () => render(el, { params, isCurrent }); return;
  }
  if (!isCurrent()) return;
  async function recover() {
    try {
      const result = await client.recover(workspace);
      if (result) { Object.assign(workspace, result); if (isCurrent()) toast(result.message); }
      recoveryMessage = '';
    } catch (error) { recoveryMessage = error.message; }
  }
  await recover();
  if (!isCurrent()) return;
  async function action(type, payload) {
    const data = await client.action(type, payload, workspace.version);
    Object.assign(workspace, data);
    if (isCurrent()) { draw(); toast(data.message); }
  }
  const s = () => workspace.state;
  function draw() {
    const company = s().company;
    el.innerHTML = `<div class="biz-shell" data-testid="business-portal"><aside class="biz-sidebar"><a class="biz-wordmark" href="/business"><span>V</span> business<span class="biz-beta">DEMO</span></a>
      <div class="biz-company"><div class="biz-company-icon">${esc((company?.name || 'Your business').slice(0, 1))}</div><div><strong>${esc(company?.name || 'Your workspace')}</strong><small>Business workspace</small></div></div>
      <p class="biz-nav-label">WORKSPACE</p><nav aria-label="Business">${sections.map(([id, label, icon]) => `<a href="${link(id)}" ${id === section ? 'aria-current="page"' : ''} data-testid="business-nav-${id}"><span aria-hidden="true">${icon}</span>${label}${id === 'seller' ? '<small>B2B</small>' : ''}</a>`).join('')}</nav>
      <div class="biz-sidebar-bottom">${isDatabaseMode() ? '<a href="/marketplace" data-testid="vortex-nav-marketplace">B2B Marketplace ↗</a>' : ''}<a href="/shop">← Buyer storefront</a><button type="button" data-action="profile">Business profile</button><a href="/pages/testing-guide.html" target="_self">Testing guide ↗</a></div></aside>
      <div class="biz-main"><div class="biz-topline"><span>Workspace <span aria-hidden="true">/</span> <strong>${sections.find(x => x[0] === section)?.[1] || 'Overview'}</strong></span><div class="row"><button class="btn secondary sm" data-action="profile" aria-label="Edit business profile">Profile</button><button class="btn secondary sm" data-action="refresh" aria-label="Refresh workspace">↻ Refresh</button></div></div>
        <p class="biz-demo-note"><span aria-hidden="true">◉</span> Demo business workspace · Sample buyers, simulated bookings and payments. ${isDatabaseMode() ? 'Your changes are saved to your account.' : 'Changes last until the development server resets.'}</p>
        ${recoveryMessage ? `<p class="biz-error" role="alert">${esc(recoveryMessage)}</p>` : ''}
        ${!company ? setup() : section === 'seller' ? seller() : section === 'travel' ? travel() : section === 'finance' ? finance() : section === 'learning' ? learning() : overview()}
      </div></div>`;
    bind();
  }
  function heading(eyebrow, title, description, button = '') {
    return `<div class="biz-heading"><div><p class="biz-eyebrow">${eyebrow}</p><h1>${title}</h1><p>${description}</p></div>${button}</div>`;
  }
  function setup() {
    return `<section class="biz-setup card"><span class="biz-eyebrow">LET’S GET YOU STARTED</span><h1>Make room for your business.</h1><p>Create your private demo business profile. Your buyer account stays available in the storefront.</p><form id="business-setup">
      ${input('name', 'Company name', 'maxlength="100" placeholder="e.g. Northline Trading"')}${input('contact', 'Contact name', `maxlength="100" value="${esc(auth.user?.name || '')}"`)}
      <label class="biz-field">Industry<select name="industry" aria-label="Industry" required><option value="">Choose an industry</option><option>Office & workplace</option><option>Technology</option><option>Professional services</option><option>Retail & distribution</option></select></label>
      <p class="biz-error" role="alert"></p><button class="btn" type="submit">Create business workspace →</button></form></section>`;
  }
  function overview() {
    const revenue = s().orders.filter(o => o.status === 'Shipped').reduce((sum, o) => sum + o.totalCents, 0);
    const done = Object.values(s().learning).filter(p => p.passed).length;
    return `${heading('YOUR BUSINESS AT A GLANCE', `Good to see you, ${esc((auth.user?.name || 'there').split(' ')[0])}.`, 'A clearer view of your work. A little more room to grow.')}
      <section class="biz-hero"><div><span class="biz-eyebrow">BUILT FOR YOUR NEXT CHAPTER</span><h2>Big ambitions.<br>Connected operations.</h2><p>From your first wholesale order to your next business trip, keep everything moving in one place.</p><a class="btn" href="/business/seller">Open seller centre <span aria-hidden="true">↗</span></a></div><div class="biz-hero-art" aria-hidden="true"><div class="biz-orbit"></div><div class="biz-art-card">↗<strong>Business, in motion.</strong><span>SELL · TRAVEL · PAY · LEARN</span></div></div></section>
      <div class="biz-stats">${[['Business balance', usd(s().balanceCents), 'Demo operating account'], ['Wholesale revenue', usd(revenue), 'From shipped orders'], ['Upcoming trips', s().bookings.filter(b => b.status === 'Confirmed' && b.date >= new Date().toISOString().slice(0, 10)).length, 'Confirmed reservations'], ['Certificates earned', done, 'Keep building your skills']].map(([label, value, note]) => `<article class="card"><p>${label}</p><strong>${value}</strong><small>${note}</small></article>`).join('')}</div>
      <div class="biz-section-title"><h2>Your business, connected</h2><span>Four ways to move forward</span></div><div class="biz-module-grid">${[
        ['seller', 'blue', 'SELL & GROW', 'Your seller centre', 'Manage listings, respond to wholesale requests and fulfil business orders.', 'Manage your business'],
        ['travel', 'violet', 'GO FURTHER', 'Business travel, sorted', 'Find a flight, book your team’s trip and keep your itinerary close.', 'Plan a trip'],
        ['finance', 'green', 'STAY IN CONTROL', 'Finance & banking', 'Manage beneficiaries, send simulated payments and reconcile your ledger.', 'View your finances'],
        ['learning', 'amber', 'BUILD WHAT’S NEXT', 'Your learning academy', 'Learn practical business skills and earn completion certificates.', 'Explore courses']
      ].map(([id, color, tag, title, body, cta]) => `<a class="biz-module ${color}" href="${link(id)}"><span class="biz-module-icon" aria-hidden="true">${sections.find(x => x[0] === id)[2]}</span><small>${tag}</small><h3>${title}</h3><p>${body}</p><strong>${cta} <span aria-hidden="true">↗</span></strong></a>`).join('')}</div>
      <section class="card biz-activity"><div class="biz-section-title"><h2>Recent activity</h2><span>Across your workspace</span></div>${s().activity.slice(0, 6).map(event => `<div class="biz-activity-row"><span class="biz-activity-dot" aria-hidden="true"></span><p>${esc(event.message)}</p><time>${date(event.createdAt)}</time></div>`).join('') || empty('Your next business move will appear here.')}</section>`;
  }
  function seller() {
    const products = s().products.filter(p => (filter === 'All' || p.status === filter) && `${p.name} ${p.sku}`.toLowerCase().includes(search.toLowerCase()));
    return `${heading('SELLER CENTRE', 'Built for bigger orders.', 'Your private wholesale catalog, buyer requests and fulfilment.', '<button class="btn" data-action="product-new">+ Add product</button>')}
      <section class="card biz-panel"><div class="biz-section-title"><h2>Product inventory</h2><span>${s().products.length} listings</span></div>
        <div class="biz-toolbar"><label class="biz-search"><span class="sr-only">Search inventory</span><input type="search" id="inventory-search" placeholder="Search by product or SKU" value="${esc(search)}"></label><label class="biz-inline-filter">Status<select id="inventory-status"><option ${filter === 'All' ? 'selected' : ''}>All</option><option ${filter === 'Active' ? 'selected' : ''}>Active</option><option ${filter === 'Draft' ? 'selected' : ''}>Draft</option></select></label></div>
        <div class="biz-table-wrap" role="region" aria-label="Product inventory" tabindex="0"><table><thead><tr><th>Product / SKU</th><th>Unit price</th><th>Available</th><th>Min. order</th><th>Status</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>${products.map(p => `<tr data-testid="business-product-row"><td><strong>${esc(p.name)}</strong><small>${esc(p.sku)}</small></td><td>${usd(p.priceCents)}</td><td>${p.stock} units</td><td>${p.minimum} units</td><td>${badge(p.status)}</td><td><button class="btn secondary sm" data-action="product-edit" data-id="${esc(p.id)}" aria-label="Edit ${esc(p.name)}">Edit</button></td></tr>`).join('') || '<tr><td colspan="6">No products match your search.</td></tr>'}</tbody></table></div></section>
      <section class="card biz-panel"><div class="biz-section-title"><h2>Requests for quotation</h2><button class="btn secondary sm" data-action="rfq-new">+ Sample buyer request</button></div><div class="biz-rfq-grid">${s().rfqs.map(r => {
        const product = s().products.find(p => p.id === r.productId);
        return `<article class="biz-rfq" data-testid="business-rfq"><div class="spread"><small>${r.id}</small>${badge(r.status)}</div><h3>${esc(r.buyer)}</h3><p>${r.quantity} × ${esc(product.name)}</p>${r.quoteCents ? `<p><strong>${usd(r.quoteCents * r.quantity)}</strong> <small>quoted total</small></p>` : '<p class="muted">Awaiting your unit-price quotation</p>'}${r.status === 'New' ? `<button class="btn secondary sm" data-action="quote" data-id="${r.id}">Send quote</button>` : r.status === 'Quoted' ? `<button class="btn secondary sm" data-action="quote-accept" data-id="${r.id}">Simulate buyer acceptance</button>` : '<p class="small">Purchase order created ↓</p>'}</article>`;
      }).join('')}</div></section>
      <section class="card biz-panel"><div class="biz-section-title"><h2>Wholesale orders</h2><span>${s().orders.length} orders</span></div>${s().orders.length ? `<div class="biz-table-wrap"><table><thead><tr><th>Order / buyer</th><th>Items</th><th>Total</th><th>Status</th><th>Fulfilment</th></tr></thead><tbody>${s().orders.map(o => `<tr><td><strong>${o.id}</strong><small>${esc(o.buyer)}</small></td><td>${o.quantity} × ${esc(o.product)}</td><td>${usd(o.totalCents)}</td><td>${badge(o.status)}</td><td>${o.status === 'Confirmed' ? `<div class="row"><button class="btn secondary sm" data-action="ship" data-id="${o.id}">Ship order</button><button class="btn secondary sm" data-action="cancel-order" data-id="${o.id}">Cancel order</button></div>` : `<small>${esc(o.tracking)}</small>`}</td></tr>`).join('')}</tbody></table></div>` : empty('When a sample buyer accepts your quote, their order appears here.')}</section>`;
  }
  function travel() {
    return `${heading('BUSINESS TRAVEL', 'Your next connection.', 'Plan a work trip. Keep the details in one place.')}
      <section class="biz-travel-banner"><span aria-hidden="true">↗</span><div><h2>New places. New possibilities.</h2><p>Demo domestic flights · Economy fares · Full simulated cancellation refund</p></div></section>
      <section class="card biz-panel"><h2>Where are you heading?</h2><form id="travel-search" class="biz-travel-search">${['from', 'to'].map((key, i) => `<label class="biz-field">${i ? 'To' : 'From'}<select name="${key}" aria-label="${i ? 'To' : 'From'}">${workspace.cities.map((city, index) => `<option ${city === travelQuery[key] ? 'selected' : ''}>${city}</option>`).join('')}</select></label>`).join('')}${input('date', 'Departure', `type="date" min="${new Date().toISOString().slice(0, 10)}" value="${travelQuery.date}"`)}${input('travellers', 'Travellers', `type="number" min="1" max="6" value="${travelQuery.travellers}"`)}<button class="btn" type="submit">Search flights</button></form><p class="biz-error" role="alert" id="travel-error"></p>
      <div id="travel-results" aria-live="polite">${trips.length ? `<h3>${trips.length} flights · ${esc(trips[0].from)} → ${esc(trips[0].to)} · ${date(trips[0].date)}</h3>${trips.map(t => `<article class="biz-flight"><div class="biz-airline-mark" aria-hidden="true">↗</div><div><strong>${t.airline}</strong><small>Economy · Non-stop</small></div><div><strong>${t.departure} → ${t.arrival}</strong><small>${t.travellers} traveller${t.travellers > 1 ? 's' : ''}</small></div><div><strong>${usd(t.totalCents)}</strong><small>Total fare · USD</small></div><button class="btn secondary" data-action="book" data-id="${t.id}">Select flight</button></article>`).join('')}` : empty('Search a route to compare available demo flights.')}</div></section>
      <section class="card biz-panel"><div class="biz-section-title"><h2>Your bookings</h2><span>Itineraries & reservations</span></div>${s().bookings.map(b => `<article class="biz-booking" data-testid="business-booking"><div class="spread"><div><small>${b.id}</small><h3>${b.from} → ${b.to}</h3><p>${date(b.date)} · ${b.departure} · ${b.airline}</p><small>${esc(b.traveller)} · ${b.travellers} traveller(s) · ${usd(b.totalCents)}</small></div>${badge(b.status)}</div><div class="row"><button class="btn secondary sm" data-action="itinerary" data-id="${b.id}">Download itinerary</button>${b.status === 'Confirmed' ? `<button class="btn secondary sm" data-action="cancel-trip" data-id="${b.id}">Cancel booking</button>` : '<span class="small">Refund credited to your business balance</span>'}</div></article>`).join('') || empty('Your next business trip starts with a search above.')}</section>`;
  }
  function finance() {
    const transactions = s().ledger.filter(t =>
      `${t.description} ${t.reference}`.toLowerCase().includes(ledgerSearch.toLowerCase()) &&
      (ledgerFilter === 'All' || (ledgerFilter === 'Credit' ? t.amountCents >= 0 : t.amountCents < 0)));
    const pages = Math.max(1, Math.ceil(transactions.length / 10));
    ledgerPage = Math.min(ledgerPage, pages);
    const pageRows = transactions.slice((ledgerPage - 1) * 10, ledgerPage * 10);
    return `${heading('FINANCE & BANKING', 'Every move, accounted for.', 'A simulated operating account for your business.', '<button class="btn" data-action="transfer">↗ Send payment</button>')}
      <div class="biz-finance-grid"><section class="biz-balance"><p>BUSINESS OPERATING ACCOUNT</p><h2 data-testid="business-balance">${usd(s().balanceCents)}</h2><span>Available demo balance · USD</span><div><strong>${esc(s().company.name)}</strong><span>VORTEX DEMO BANK · •••• 2048</span></div></section>
      <section class="card"><div class="biz-section-title"><h2>Beneficiaries</h2><button class="btn secondary sm" data-action="beneficiary" aria-label="Add beneficiary">+ Add</button></div><p class="muted small">Use fictional DEMO- account references only.</p><div class="biz-beneficiaries">${s().beneficiaries.map(b => `<div class="biz-beneficiary"><span aria-hidden="true">${esc(b.name[0])}</span><div><strong>${esc(b.name)}</strong><small>${esc(b.account)}</small></div></div>`).join('')}</div></section></div>
      <section class="card biz-panel"><div class="biz-section-title"><h2>Transaction ledger</h2><button class="btn secondary sm" data-action="statement">↓ Export statement</button></div><div class="biz-toolbar"><label class="biz-search"><span class="sr-only">Search transactions</span><input type="search" id="ledger-search" placeholder="Search transactions or references" value="${esc(ledgerSearch)}"></label><label class="biz-inline-filter">Type<select id="ledger-filter" aria-label="Transaction type">${['All', 'Credit', 'Debit'].map(type => `<option ${type === ledgerFilter ? 'selected' : ''}>${type}</option>`).join('')}</select></label></div><div class="biz-table-wrap" role="region" aria-label="Transaction ledger" tabindex="0"><table><thead><tr><th>Transaction / reference</th><th>Date</th><th>Type</th><th>Amount</th></tr></thead><tbody>${pageRows.map(t => `<tr data-testid="business-transaction"><td><strong>${esc(t.description)}</strong><small>${esc(t.reference)}</small></td><td>${date(t.createdAt)}</td><td>${badge(t.amountCents >= 0 ? 'Credit' : 'Debit')}</td><td class="${t.amountCents >= 0 ? 'biz-positive' : ''}">${t.amountCents >= 0 ? '+' : '−'}${usd(Math.abs(t.amountCents))}</td></tr>`).join('') || '<tr><td colspan="4">No transactions match your search.</td></tr>'}</tbody></table></div><nav class="biz-pagination" aria-label="Transaction pages"><span>${transactions.length} transactions · Page ${ledgerPage} of ${pages}</span><div class="row"><button class="btn secondary sm" data-action="ledger-prev" ${ledgerPage === 1 ? 'disabled' : ''}>Previous</button><button class="btn secondary sm" data-action="ledger-next" ${ledgerPage === pages ? 'disabled' : ''}>Next</button></div></nav></section>`;
  }
  function learning() {
    return `${heading('LEARNING ACADEMY', 'Invest in your next chapter.', 'Practical lessons for the business you’re building.')}
      <div class="biz-learning-banner"><div><span class="biz-eyebrow">SMALL STEPS. LASTING SKILLS.</span><h2>A little learning.<br>A bigger perspective.</h2><p>Read, apply, and earn a certificate at your own pace.</p></div><span aria-hidden="true">▤</span></div>
      <div class="biz-course-grid">${workspace.courses.map(c => {
        const progress = s().learning[c.id]; const percent = progress ? Math.round(progress.completed.length / c.lessons.length * 100) : 0;
        return `<article class="card biz-course" data-testid="business-course"><div class="biz-course-cover ${c.color}"><span aria-hidden="true">${c.id === 'seller' ? '▦' : c.id === 'finance' ? '⇄' : '↗'}</span><small>VORTEX ACADEMY</small></div><div class="biz-course-body"><span class="biz-eyebrow">${c.category}</span><h2>${c.title}</h2><p>${c.lessons.length} lessons · ${c.duration} · Beginner</p>${progress ? `<div class="biz-progress" role="progressbar" aria-label="${esc(c.title)} lesson progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}"><span style="width:${percent}%"></span></div><small>${percent}% of lessons complete${progress.passed ? ' · Assessment passed' : ''}</small><ol class="biz-lessons">${c.lessons.map((lesson, i) => `<li><button data-action="lesson" data-id="${c.id}" data-lesson="${i}"><span>${progress.completed.includes(i) ? '✓' : String(i + 1).padStart(2, '0')}</span>${lesson.title}</button></li>`).join('')}</ol>${progress.passed ? `<button class="btn secondary" data-action="certificate" data-id="${c.id}">↓ Download certificate</button>` : `<button class="btn" data-action="quiz" data-id="${c.id}" ${percent < 100 ? 'disabled' : ''}>Take assessment</button>`}` : `<button class="btn secondary" data-action="enroll" data-id="${c.id}">Enrol in course →</button>`}</div></article>`;
      }).join('')}</div>`;
  }
  function productForm(product) {
    const p = product || { name: '', sku: '', priceCents: 1000, stock: 0, minimum: 1, status: 'Draft' };
    modal(product ? 'Edit product' : 'Add a wholesale product', `${input('name', 'Product name', `maxlength="100" value="${esc(p.name)}"`)}${input('sku', 'SKU', `maxlength="30" value="${esc(p.sku)}"`)}<div class="grid-2">${input('price', 'Unit price (USD)', `type="number" min="0.01" step="0.01" max="1000000" value="${(p.priceCents / 100).toFixed(2)}"`)}${input('stock', 'Available stock', `type="number" min="0" max="1000000" value="${p.stock}"`)}</div>${input('minimum', 'Minimum order quantity', `type="number" min="1" max="1000000" value="${p.minimum}"`)}<label class="biz-field">Listing status<select name="status" aria-label="Listing status"><option ${p.status === 'Draft' ? 'selected' : ''}>Draft</option><option ${p.status === 'Active' ? 'selected' : ''}>Active</option></select></label>`, 'Save product', values => action('product.save', { ...values, id: product?.id, stock: Number(values.stock), minimum: Number(values.minimum) }));
  }
  function profile() {
    const p = s().company || {};
    modal('Business profile', `${input('name', 'Company name', `maxlength="100" value="${esc(p.name || '')}"`)}${input('contact', 'Contact name', `maxlength="100" value="${esc(p.contact || '')}"`)}${input('industry', 'Industry', `maxlength="100" value="${esc(p.industry || '')}"`)}`, 'Save profile', values => action('company.save', values));
  }
  function bind() {
    const form = el.querySelector('#business-setup');
    if (form) form.onsubmit = async event => {
      event.preventDefault(); const button = form.querySelector('button'); button.disabled = true;
      try { await action('company.save', Object.fromEntries(new FormData(form))); }
      catch (error) { form.querySelector('[role=alert]').textContent = error.message; button.disabled = false; }
    };
    const inventorySearch = el.querySelector('#inventory-search');
    if (inventorySearch) inventorySearch.oninput = event => {
      search = event.target.value; draw();
      const input = el.querySelector('#inventory-search'); input.focus(); input.setSelectionRange(event.target.selectionStart, event.target.selectionEnd);
    };
    const status = el.querySelector('#inventory-status'); if (status) status.onchange = event => { filter = event.target.value; draw(); };
    const ledgerInput = el.querySelector('#ledger-search');
    if (ledgerInput) ledgerInput.oninput = event => {
      ledgerSearch = event.target.value; ledgerPage = 1;
      const start = event.target.selectionStart, end = event.target.selectionEnd;
      draw(); const replacement = el.querySelector('#ledger-search'); replacement.focus(); replacement.setSelectionRange(start, end);
    };
    const ledgerType = el.querySelector('#ledger-filter');
    if (ledgerType) ledgerType.onchange = event => { ledgerFilter = event.target.value; ledgerPage = 1; draw(); el.querySelector('#ledger-filter').focus(); };
    const travelForm = el.querySelector('#travel-search');
    if (travelForm) travelForm.onsubmit = async event => {
      event.preventDefault(); const button = travelForm.querySelector('button'); button.disabled = true; button.textContent = 'Finding flights…';
      const values = Object.fromEntries(new FormData(travelForm));
      try {
        trips = await request('/trips?' + new URLSearchParams(values));
        travelQuery = values;
        if (!isCurrent()) return;
        draw(); const nextForm = el.querySelector('#travel-search');
        Object.entries(values).forEach(([key, value]) => { nextForm.elements.namedItem(key).value = value; });
      } catch (error) { if (isCurrent()) el.querySelector('#travel-error').textContent = error.message; }
      finally { button.disabled = false; button.textContent = 'Search flights'; }
    };
    el.onclick = async event => {
      const button = event.target.closest('[data-action]'); if (!button || button.disabled || busy) return;
      const id = button.dataset.id, type = button.dataset.action;
      const product = s().products.find(p => p.id === id), rfq = s().rfqs.find(r => r.id === id);
      try {
        if (type === 'refresh') { busy = true; const fresh = await request(); if (isCurrent()) { workspace = fresh; await recover(); if (isCurrent()) { draw(); toast('Workspace refreshed'); } } }
        if (type === 'ledger-prev') { ledgerPage--; draw(); }
        if (type === 'ledger-next') { ledgerPage++; draw(); }
        if (type === 'profile') profile();
        if (type === 'product-new') productForm();
        if (type === 'product-edit') productForm(product);
        if (type === 'rfq-new') {
          const active = s().products.filter(p => p.status === 'Active' && p.stock >= p.minimum);
          if (!active.length) throw new Error('Add an active product with sufficient stock before creating a buyer request.');
          modal('Create a sample buyer request', `<p class="small muted">Simulate an incoming wholesale enquiry for one of your listings.</p>${input('buyer', 'Sample buyer name', 'maxlength="100" placeholder="e.g. Northline Offices"')}<label class="biz-field">Product<select name="productId" aria-label="Product">${active.map(p => `<option value="${esc(p.id)}">${esc(p.name)} · min ${p.minimum} · ${p.stock} available</option>`).join('')}</select></label>${input('quantity', 'Requested quantity', 'type="number" min="1" max="1000000"')}`, 'Create request', values => action('rfq.create', { ...values, quantity: Number(values.quantity) }));
        }
        if (type === 'cancel-order') modal('Cancel wholesale order?', '<p>The reserved units will return to available inventory. Unshipped orders have not received a demo payment.</p>', 'Cancel order', () => action('order.cancel', { id }));
        if (type === 'quote') modal(`Quote for ${rfq.buyer}`, `<p>${rfq.quantity} × ${esc(s().products.find(p => p.id === rfq.productId).name)}</p>${input('price', 'Quoted unit price (USD)', 'type="number" min="0.01" step="0.01" max="1000000"')}`, 'Send quote', values => action('quote.send', { id, ...values }));
        if (type === 'quote-accept') modal('Simulate buyer acceptance', `<p>This demo buyer will accept your quote and reserve ${rfq.quantity} units of stock. This creates a purchase order in your private workspace.</p>`, 'Accept quote', () => action('quote.accept', { id }));
        if (type === 'ship') modal('Ship wholesale order', `${input('tracking', 'Tracking reference', 'maxlength="60" placeholder="e.g. DEMO-TRACK-2048"')}<p class="small muted">Shipping credits the sample buyer’s simulated payment to your business balance.</p>`, 'Confirm shipment', values => action('order.ship', { id, ...values }));
        if (type === 'beneficiary') modal('Add a beneficiary', `${input('name', 'Beneficiary name', 'maxlength="100"')}${input('account', 'Demo account reference', 'maxlength="30" pattern="DEMO-[A-Za-z0-9-]+" placeholder="DEMO-1234"')}<p class="small muted">Use fictional information. No real bank connection is made.</p>`, 'Add beneficiary', values => action('beneficiary.add', values));
        if (type === 'transfer') modal('Send a business payment', `<label class="biz-field">Beneficiary<select name="beneficiaryId" aria-label="Beneficiary">${s().beneficiaries.map(b => `<option value="${b.id}">${esc(b.name)} · ${esc(b.account)}</option>`).join('')}</select></label>${input('amount', 'Amount (USD)', 'type="number" min="0.01" step="0.01" max="1000000"')}${input('reference', 'Payment reference', 'maxlength="60"')}<p>Available demo balance: <strong>${usd(s().balanceCents)}</strong></p>`, 'Review payment', values => {
          setTimeout(() => modal('Review your payment', `<p>Send <strong>${esc(money(values.amount))}</strong> to <strong>${esc(s().beneficiaries.find(b => b.id === values.beneficiaryId).name)}</strong>?</p><p>Reference: ${esc(values.reference)}</p><p class="small muted">This is a simulated transfer. No real money moves.</p>`, 'Confirm transfer', () => action('transfer.send', values)), 0);
        });
        if (type === 'statement') {
          const cell = value => '"' + String(value).replace(/"/g, '""').replace(/^[=+\-@\t\r]/, "' $&") + '"';
          download('vortex-business-statement.csv', ['Date,Description,Reference,Amount USD', ...s().ledger.map(t => [t.createdAt, t.description, t.reference].map(cell).join(',') + ',' + (t.amountCents / 100).toFixed(2))].join('\r\n'), 'text/csv');
        }
        if (type === 'book') {
          const trip = trips.find(t => t.id === id);
          modal('Confirm your business trip', `<p><strong>${trip.from} → ${trip.to}</strong> · ${date(trip.date)} · ${trip.departure}</p><p>${trip.airline} · ${trip.travellers} traveller(s) · <strong>${usd(trip.totalCents)}</strong></p>${input('traveller', 'Lead traveller name', `maxlength="100" value="${esc(auth.user?.name || '')}"`)}<p class="small muted">The total is deducted from your demo business balance. Cancellation returns a full simulated refund.</p>`, 'Confirm booking', values => action('travel.book', { ...trip, tripId: trip.id, ...values }));
        }
        if (type === 'cancel-trip') modal('Cancel this booking?', '<p>Your reservation will be cancelled and the full fare returned to your demo business balance.</p>', 'Cancel booking', () => action('travel.cancel', { id }));
        if (type === 'itinerary') {
          const b = s().bookings.find(x => x.id === id);
          download(`${b.id}-itinerary.txt`, `VORTEX BUSINESS · SIMULATED ITINERARY\n${b.id}\n${b.from} → ${b.to}\n${b.date} · ${b.departure} → ${b.arrival}\n${b.airline}\nLead traveller: ${b.traveller}\nTravellers: ${b.travellers}\nTotal: ${usd(b.totalCents)}\nStatus: ${b.status}\nNot valid for travel.`);
        }
        if (type === 'enroll') { busy = true; await action('course.enroll', { id }); }
        if (type === 'lesson') {
          const lesson = Number(button.dataset.lesson), c = workspace.courses.find(c => c.id === id);
          modal(c.lessons[lesson].title, `<p class="biz-lesson-text">${esc(c.lessons[lesson].body)}</p><small>Lesson ${lesson + 1} of ${c.lessons.length} · ${esc(c.title)}</small>`, 'Mark lesson complete', () => action('lesson.complete', { id, lesson }));
        }
        if (type === 'quiz') {
          const course = workspace.courses.find(c => c.id === id);
          modal('Knowledge check', `<fieldset class="biz-quiz"><legend>${course.question}</legend>${course.options.map((answer, i) => `<label><input type="radio" name="answer" value="${i}" required> ${answer}</label>`).join('')}</fieldset>`, 'Submit assessment', values => action('quiz.submit', { id, answer: Number(values.answer) }));
        }
        if (type === 'certificate') {
          const course = workspace.courses.find(c => c.id === id), progress = s().learning[id];
          if (progress?.passed) download(`${progress.certificate}.txt`, `VORTEX ACADEMY\nCertificate of completion\n\n${s().company.contact}\n${s().company.name}\n\nCompleted: ${course.title}\nCertificate: ${progress.certificate}\n\nDemo learning certificate. Not an accredited qualification.`);
        }
      } catch (error) { if (isCurrent()) toast(error.message, 'error'); }
      finally { busy = false; }
    };
  }
  draw();
}
