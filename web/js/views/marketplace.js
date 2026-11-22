import { api, esc, isDatabaseMode, navigate, requireAuth, setTitle, state, toast } from '../core.js';

const base = '/marketplace';
const request = (path, options) => api(base + path, options);
const statusLabel = { DRAFT: 'Draft', PUBLISHED: 'Published', INACTIVE: 'Inactive', NEW: 'New', REPLIED: 'Replied' };
const badge = status => `<span class="vortex-market-badge" data-status="${status}">${statusLabel[status]}</span>`;
const field = (name, label, attrs = '') => `<label>${label}<input name="${name}" ${attrs} required></label>`;
const numeric = (name, label, max, value = '') => field(name, label, `type="number" min="1" max="${max}" step="1" value="${value}"`);
const priceField = (name, label, value = '') => field(name, label, `type="number" min="0.01" max="9999999999.99" step="0.01" value="${esc(value)}"`);
const errorLine = '<p class="vortex-market-error" data-market-error role="alert"></p>';
const jump = (path, label, active) => `<a href="${base}/${path}"${active === path ? ' aria-current="page"' : ''}>${label}</a>`;
const option = (value, label, current) => `<option value="${esc(value)}"${value === current ? ' selected' : ''}>${esc(label)}</option>`;
const categoryOptions = (categories, selected) => categories.map(category => option(category, category, selected)).join('');
const urlWith = (page, params) => `${base}/${page}${params.size ? '?' + params : ''}`;
const errorMessage = error => {
  const detail = Object.values(error.data?.fields || {}).flat()[0];
  return detail ? error.message + ' · ' + detail : error.message;
};

function filters(page, query, categories, statuses = []) {
  return `<form class="vortex-market-filters" data-market-filter>
    ${categories ? `<label>Search products<input name="q" value="${esc(query.get('q'))}" maxlength="120" placeholder="Product or category"></label>
      <label>Category<select name="category"><option value="">All categories</option>${categoryOptions(categories, query.get('category'))}</select></label>` : ''}
    ${statuses.length ? `<label>Status<select name="status"><option value="">All statuses</option>${statuses.map(status => option(status, statusLabel[status], query.get('status'))).join('')}</select></label>` : ''}
    <button type="submit" class="btn secondary">${categories ? 'Search' : 'Filter'}</button>
    <a href="${base}/${page}">Clear</a>
  </form>`;
}

function paging(page, query, result) {
  const pages = Math.max(1, Math.ceil(result.total / result.pageSize));
  if (pages <= 1 && result.page === 1) return '';
  function link(target, label) {
    const params = new URLSearchParams(query);
    params.set('page', target);
    return `<a class="btn secondary sm" href="${esc(urlWith(page, params))}">${label}</a>`;
  }
  return `<nav class="vortex-market-pagination" aria-label="Results pages">
    ${result.page > 1 ? link(Math.min(result.page - 1, pages), 'Previous') : ''}
    <span>Page ${result.page} of ${pages}</span>
    ${result.page < pages ? link(result.page + 1, 'Next') : ''}
  </nav>`;
}

function bindForm(form, action) {
  form.onsubmit = async event => {
    event.preventDefault();
    const submit = form.querySelector('button[type=submit]');
    if (submit.disabled) return;
    const error = form.querySelector('[data-market-error]');
    error.textContent = '';
    submit.disabled = true;
    try { await action(Object.fromEntries(new FormData(form)), submit); }
    catch (failure) { error.textContent = errorMessage(failure); }
    finally { submit.disabled = false; }
  };
}

function listingForm(categories, photos, listing = {}) {
  return `<form class="vortex-market-form" aria-label="${listing.id ? 'Edit listing' : 'Create a listing'}" data-listing-form="${esc(listing.id)}">
    <h2>${listing.id ? 'Edit listing' : 'Create a listing'}</h2>
    ${field('name', 'Product name', `value="${esc(listing.name)}" minlength="2" maxlength="120"`)}
    <label>Description<textarea name="description" maxlength="2000" required>${esc(listing.description)}</textarea></label>
    <div class="vortex-market-fields">
      <label>Category<select name="category" required><option value="">Choose a category</option>${categoryOptions(categories, listing.category)}</select></label>
      ${priceField('unitPrice', 'Unit price (USD)', listing.unitPrice)}
      ${numeric('minimumQuantity', 'Minimum order quantity', 1_000_000, listing.minimumQuantity)}
      <label>Saved photo<select name="photoId"><option value="">No photo</option>${photos.map(photo => option(photo.id, photo.name, listing.photoId)).join('')}</select></label>
    </div>
    ${errorLine}
    <button class="btn" type="submit">${listing.id ? 'Save changes' : 'Save draft'}</button>
  </form>`;
}

async function products(content, query, refresh) {
  const [{ categories }, result, { items: files }] = await Promise.all([
    request('/categories'), request('/listings?' + query), request('/files')
  ]);
  const photos = files.filter(file => file.kind === 'PHOTO');
  content.innerHTML = `<h2>My Products</h2>
    <details class="vortex-market-panel"><summary>New listing</summary>${listingForm(categories, photos)}</details>
    ${filters('products', query, categories, ['DRAFT', 'PUBLISHED', 'INACTIVE'])}
    <div class="vortex-market-grid">${result.items.map(listing => `
      <article class="vortex-market-panel" data-testid="vortex-market-listing">
        ${badge(listing.status)}<h3>${esc(listing.name)}</h3>
        <p>${esc(listing.category)} · USD ${esc(listing.unitPrice)} per unit · MOQ ${listing.minimumQuantity}</p>
        <form data-listing-status="${esc(listing.id)}">
          ${errorLine}<button class="btn secondary sm" type="submit" value="${listing.status === 'PUBLISHED' ? 'INACTIVE' : 'PUBLISHED'}">${listing.status === 'PUBLISHED' ? 'Deactivate' : 'Publish'}</button>
        </form>
        <details><summary>Edit product</summary>${listingForm(categories, photos, listing)}</details>
      </article>`).join('') || '<p>No listings match your filters.</p>'}</div>${paging('products', query, result)}`;
  content.querySelectorAll('[data-listing-form]').forEach(form => bindForm(form, async data => {
    const id = form.dataset.listingForm;
    const body = { ...data, minimumQuantity: Number(data.minimumQuantity), photoId: data.photoId || null };
    await request('/listings' + (id ? '/' + id : ''), { method: id ? 'PATCH' : 'POST', body });
    toast(id ? 'Listing updated' : 'Draft saved', 'success');
    await refresh();
  }));
  content.querySelectorAll('[data-listing-status]').forEach(form => bindForm(form, async (_data, button) => {
    await request('/listings/' + form.dataset.listingStatus + '/status', { method: 'PATCH', body: { status: button.value } });
    toast(button.value === 'PUBLISHED' ? 'Listing published' : 'Listing deactivated', 'success');
    await refresh();
  }));
}

async function catalog(content, query) {
  const [{ categories }, result] = await Promise.all([request('/categories'), request('/catalog?' + query)]);
  content.innerHTML = `<h2>Find suppliers</h2>
    ${filters('catalog', query, categories)}
    <div class="vortex-market-grid" data-testid="vortex-market-results">
      ${result.items.map(listing => `<article class="vortex-market-panel" data-testid="vortex-market-catalog-item">
        ${listing.photoUrl ? `<img loading="lazy" class="vortex-market-photo" src="${esc(listing.photoUrl)}" alt="${esc(listing.name)}">` : ''}
        <p class="vortex-market-category">${esc(listing.category)}</p><h3>${esc(listing.name)}</h3>
        <p>${esc(listing.description)}</p>
        <dl class="vortex-market-facts"><div><dt>Supplier</dt><dd>${esc(listing.supplier)}</dd></div>
          <div><dt>Minimum order quantity</dt><dd>${listing.minimumQuantity}</dd></div>
          <div><dt>Unit price</dt><dd>USD ${esc(listing.unitPrice)}</dd></div></dl>
        <details><summary>Request Quote</summary>
          <form class="vortex-market-form" data-quote-for="${esc(listing.id)}">
            ${field('quantity', 'Quantity', `type="number" min="${listing.minimumQuantity}" max="1000000" step="1"`)}
            <label>Message<textarea name="message" maxlength="2000" required></textarea></label>
            ${errorLine}<button class="btn" type="submit">Send request</button>
          </form>
        </details>
      </article>`).join('') || '<p data-testid="vortex-market-empty">No products match your search.</p>'}
    </div>${paging('catalog', query, result)}`;
  content.querySelectorAll('[data-quote-for]').forEach(form => {
    let pending;
    bindForm(form, async data => {
      const payload = { quantity: Number(data.quantity), message: data.message.trim() };
      if (!pending || pending.signature !== JSON.stringify(payload)) pending = { signature: JSON.stringify(payload), id: crypto.randomUUID() };
      await request('/catalog/' + form.dataset.quoteFor + '/enquiries', { method: 'POST', body: { ...payload, requestId: pending.id } });
      toast('Quote requested', 'success');
      navigate(base + '/enquiries');
    });
  });
}

async function enquiries(content, query, seller, refresh) {
  const result = await request('/enquiries?' + query);
  content.innerHTML = `<h2>${seller ? 'Enquiry Inbox' : 'My Enquiries'}</h2>${filters('enquiries', query, null, ['NEW', 'REPLIED'])}
    <div class="vortex-market-grid">${result.items.map(enquiry => `<article class="vortex-market-panel" data-testid="vortex-market-enquiry">
      ${badge(enquiry.status)}<h3>${esc(enquiry.productName)}</h3>
      <p><strong>${seller ? 'Buyer' : 'Supplier'}</strong> ${esc(seller ? enquiry.buyer : enquiry.supplier)}</p>
      <p>Requested quantity ${enquiry.quantity}</p><p class="vortex-market-message">${esc(enquiry.message)}</p>
      ${enquiry.status === 'REPLIED' ? `<dl class="vortex-market-facts" aria-label="Supplier quote">
        <div><dt>Quoted quantity</dt><dd>${enquiry.quoteQuantity}</dd></div>
        <div><dt>Quoted unit price</dt><dd>USD ${esc(enquiry.quoteUnitPrice)}</dd></div>
        <div><dt>Delivery estimate</dt><dd>${enquiry.deliveryDays} days</dd></div>
      </dl>` : seller ? `<details><summary>Reply with quote</summary>
        <form class="vortex-market-form" data-reply-to="${esc(enquiry.id)}">
          ${numeric('quoteQuantity', 'Quoted quantity', 1_000_000, enquiry.quantity)}
          ${priceField('quoteUnitPrice', 'Quoted unit price (USD)')}
          ${numeric('deliveryDays', 'Delivery estimate (days)', 365)}
          ${errorLine}<button class="btn" type="submit">Send quote</button>
        </form></details>` : '<p>Waiting for the supplier to reply.</p>'}
    </article>`).join('') || '<p>No enquiries match your filters.</p>'}</div>${paging('enquiries', query, result)}`;
  content.querySelectorAll('[data-reply-to]').forEach(form => bindForm(form, async data => {
    const body = { ...data, quoteQuantity: Number(data.quoteQuantity), deliveryDays: Number(data.deliveryDays) };
    await request('/enquiries/' + form.dataset.replyTo + '/reply', { method: 'POST', body });
    toast('Quote sent', 'success');
    await refresh();
  }));
}

function download(url, name) {
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

function workbookTable({ sheet, strings }) {
  const parser = new DOMParser();
  const raw = text => parser.parseFromString(text, 'application/xml');
  const rows = [...raw(sheet).getElementsByTagNameNS('*', 'row')].slice(0, 20);
  const stringTable = strings ? raw(strings).getElementsByTagNameNS('*', 'si') : [];
  function cellValue(cell) {
    const value = cell.getElementsByTagNameNS('*', 'v')[0]?.textContent || '';
    if (cell.getAttribute('t') === 's') return stringTable[Number(value)]?.textContent || '';
    if (cell.getAttribute('t') === 'inlineStr') return cell.getElementsByTagNameNS('*', 'is')[0]?.textContent || '';
    return value;
  }
  return rows.length ? `<table><caption>Worksheet preview · up to 20 rows and 12 cells per row</caption><tbody>${rows.map(row =>
    '<tr>' + [...row.getElementsByTagNameNS('*', 'c')].slice(0, 12).map(cell => '<td>' + esc(cellValue(cell).slice(0, 200)) + '</td>').join('') + '</tr>'
  ).join('')}</tbody></table>` : '<p>No worksheet rows to preview.</p>';
}

async function preview(content, file) {
  const dialog = document.createElement('dialog');
  dialog.className = 'vortex-market-preview';
  dialog.setAttribute('aria-label', 'File preview');
  let url, body;
  if (file.name.toLowerCase().endsWith('.xlsx')) {
    body = workbookTable(await request('/files/' + file.id + '/workbook-preview'));
  } else {
    const response = await request('/files/' + file.id + '/content', { raw: true });
    const blob = await response.blob();
    if (file.mime === 'text/csv') body = `<pre>${esc(await blob.slice(0, 4096).text())}</pre>`;
    else {
      url = URL.createObjectURL(blob);
      body = file.kind === 'PHOTO' ? `<img src="${esc(url)}" alt="${esc(file.name)}">`
        : `<a class="btn secondary" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Open PDF preview</a>`;
    }
  }
  dialog.innerHTML = `<h2>${esc(file.name)}</h2>${body}<form method="dialog"><button class="btn secondary">Close preview</button></form>`;
  content.append(dialog);
  dialog.addEventListener('close', () => { dialog.remove(); if (url) URL.revokeObjectURL(url); }, { once: true });
  dialog.showModal();
}

async function files(content, refresh) {
  const { items, counts, maxBytes, maxFiles } = await request('/files');
  content.innerHTML = `<h2>Photos &amp; Docs</h2>
    <form class="vortex-market-panel vortex-market-form" data-upload-files>
      <label>Files to upload<input name="files" type="file" multiple required accept=".png,.jpg,.jpeg,.webp,.pdf,.csv,.xlsx"></label>
      <p class="small">Choose photos, PDFs or spreadsheets. Up to ${maxBytes / 1024 / 1024} MB per file and ${maxFiles} files total.</p>
      ${errorLine}<button class="btn" type="submit">Upload files</button>
    </form>
    <p data-testid="vortex-market-file-counts">Photos ${counts.PHOTO} · PDFs ${counts.PDF} · Spreadsheets ${counts.SPREADSHEET}</p>
    <div class="vortex-market-grid">${items.map(file => `<article class="vortex-market-panel" data-testid="vortex-market-file">
      <h3>${esc(file.name)}</h3>
      <p>${file.kind === 'PHOTO' ? 'Photo' : file.kind === 'PDF' ? 'PDF' : 'Spreadsheet'}</p>
      <form class="vortex-market-file-actions" data-file-id="${esc(file.id)}">${errorLine}
        <button class="btn secondary sm" type="submit" value="preview">Preview</button>
        <button class="btn secondary sm" type="submit" value="download">Download</button>
        <button class="btn secondary sm" type="submit" value="delete">Delete</button>
      </form>
    </article>`).join('') || '<p>Your library is empty.</p>'}</div>`;
  bindForm(content.querySelector('[data-upload-files]'), async () => {
    const inputs = content.querySelector('[name=files]').files;
    const rejected = [];
    let uploaded = 0;
    for (const file of inputs) {
      try {
        await request('/files?' + new URLSearchParams({ name: file.name }), { method: 'POST', body: file.slice(0, file.size, 'application/octet-stream') });
        uploaded++;
      } catch (error) {
        if (error.status === 401) throw error;
        rejected.push(file.name + ' · ' + errorMessage(error));
      }
    }
    if (uploaded) { toast(`${uploaded} ${uploaded === 1 ? 'file' : 'files'} uploaded`, 'success'); await refresh(); }
    if (rejected.length) {
      const error = content.querySelector('[data-upload-files] [data-market-error]');
      if (error) error.textContent = rejected.join(' / ');
    }
  });
  content.querySelectorAll('[data-file-id]').forEach(form => {
    form.onsubmit = async event => {
      event.preventDefault();
      const buttons = [...form.querySelectorAll('button')];
      if (buttons.some(button => button.disabled)) return;
      buttons.forEach(button => { button.disabled = true; });
      const error = form.querySelector('[data-market-error]');
      error.textContent = '';
      const file = items.find(item => item.id === form.dataset.fileId);
      try {
        if (event.submitter.value === 'delete') {
          if (!confirm('Delete this file? It will also be removed from any listings using it.')) return;
          await request('/files/' + file.id, { method: 'DELETE' });
          await refresh();
        } else if (event.submitter.value === 'download') {
          const response = await request('/files/' + file.id + '/content', { raw: true });
          const blob = await response.blob();
          const name = file.kind === 'PHOTO' ? file.name.replace(/\.[^.]+$/, '.webp') : file.name;
          download(URL.createObjectURL(blob), name);
        } else await preview(content, file);
      } catch (failure) { error.textContent = errorMessage(failure); }
      finally { buttons.forEach(button => { button.disabled = false; }); }
    };
  });
}

export async function render(el, { params, query, isCurrent }) {
  setTitle('B2B Marketplace');
  if (!isDatabaseMode()) {
    el.innerHTML = '<section class="wrap vortex-market"><h1>B2B Marketplace</h1><p>Start Vortex with PostgreSQL to use the marketplace.</p><a href="/business">Business portal</a></section>';
    return;
  }
  if (!requireAuth()) return;
  if (!['seller', 'customer'].includes(state.user.role)) {
    el.innerHTML = '<section class="wrap vortex-market"><h1>B2B Marketplace</h1><p>Sign in with a buyer or seller account to use the marketplace.</p></section>';
    return;
  }
  const seller = state.user.role === 'seller';
  const page = params[0] || (seller ? 'products' : 'catalog');
  if (seller ? page === 'catalog' : ['products', 'files'].includes(page)) {
    navigate(base, { replace: true });
    return;
  }
  el.innerHTML = `<section class="wrap vortex-market" data-testid="vortex-marketplace">
    <header class="vortex-market-header"><div><h1>B2B Marketplace</h1><p>${esc(state.user.name)} · ${seller ? 'Seller' : 'Buyer'}</p></div><a href="/business">Business portal</a></header>
    <nav class="vortex-market-nav" aria-label="Marketplace">
      ${seller ? jump('products', 'My Products', page) : jump('catalog', 'Find suppliers', page)}
      ${jump('enquiries', seller ? 'Enquiry Inbox' : 'My Enquiries', page)}
      ${seller ? jump('files', 'Photos &amp; Docs', page) : ''}
    </nav><div class="vortex-market-content" data-market-content></div>
  </section>`;
  const content = el.querySelector('[data-market-content]');
  async function refresh() {
    if (!isCurrent()) return;
    if (page === 'products') await products(content, query, refresh);
    else if (page === 'catalog') await catalog(content, query);
    else if (page === 'enquiries') await enquiries(content, query, seller, refresh);
    else await files(content, refresh);
    const filter = content.querySelector('[data-market-filter]');
    if (filter) filter.onsubmit = event => {
      event.preventDefault();
      const values = new URLSearchParams();
      for (const [key, value] of new FormData(filter)) if (value.trim()) values.set(key, value.trim());
      navigate(urlWith(page, values));
    };
  }
  await refresh();
}
