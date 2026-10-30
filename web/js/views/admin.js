import { $, $$, api, esc, money, toast, isAdmin, requireAuth, setTitle, fmtDate, openModal, confirmDialog, field, showErrors, clearErrors, formAlert, busy, getMeta, isDatabaseMode } from '../core.js';

export async function render(el, { params, isCurrent }) {
  if (!requireAuth()) return;
  setTitle('Admin');
  if (!isAdmin()) {
    el.innerHTML = `<div class="empty" data-testid="access-denied"><div class="big">🔒</div><h1>Access denied</h1><p>You need an admin account to view this page (HTTP 403).</p><a class="btn" href="/shop">Back to the shop</a></div>`;
    return;
  }
  const tab = params[0] || 'dashboard';
  el.innerHTML = `<div class="page-head"><h1>Admin console</h1><span class="badge info">Admin</span></div>
    <nav role="tablist" aria-label="Admin sections">${[['dashboard', 'Dashboard', '/admin'], ['products', 'Products', '/admin/products'], ['orders', 'Orders', '/admin/orders'], ['users', 'Users', '/admin/users']]
      .map(([id, l, href]) => `<a role="tab" href="${href}" aria-selected="${tab === id}" data-testid="admin-tab-${id}">${l}</a>`).join('')}</nav>
    <div id="admin-body"></div>`;
  const body = $('#admin-body', el);
  await ({ dashboard, products, orders, users })[tab](body, isCurrent);
}

async function dashboard(body, isCurrent) {
  const [s, orders] = await Promise.all([api('/admin/stats'), api('/admin/orders')]);
  if (!isCurrent()) return;
  body.innerHTML = `<div class="stats">
    ${[['Revenue', money(s.revenue), 'stat-revenue'], ['Orders', s.orders, 'stat-orders'], ['Products', s.products, 'stat-products'], ['Out of stock', s.outOfStock, 'stat-out-of-stock'], ['Users', s.users, 'stat-users']]
      .map(([l, v, t]) => `<div class="card stat"><span class="muted small">${l}</span><span class="v" data-testid="${t}">${v}</span></div>`).join('')}</div>
    <section class="card"><h2>Recent orders</h2>${orders.length ? `<div class="table-wrap"><table><thead><tr><th>Order</th><th>Customer</th><th class="num">Total</th><th>Status</th></tr></thead><tbody>
      ${orders.slice(0, 5).map(o => `<tr><td>${esc(o.id)}</td><td>${esc(o.username)}</td><td class="num">${money(o.total)}</td><td><span class="badge status-${o.status}">${o.status}</span></td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">No orders yet.</p>'}</section>`;
}

/* ---------- products: sortable, filterable, paginated table + CRUD modals ---------- */
async function products(body, isCurrent) {
  const [meta, all] = await Promise.all([getMeta(), api('/admin/products')]);
  if (!isCurrent()) return;
  let rows = all, sort = { key: 'id', dir: 1 }, filter = '', page = 1;
  const PER = 10;
  body.innerHTML = `<div class="toolbar"><input type="search" placeholder="Filter by name, SKU or category" aria-label="Filter products" data-testid="admin-product-search" style="max-width:320px">
      <button class="btn" id="add" data-testid="add-product">+ Add product</button></div>
    <div class="card table-wrap"><table data-testid="admin-products-table"><thead><tr>
      ${[['id', 'ID'], ['name', 'Name'], ['category', 'Category'], ['price', 'Price'], ['stock', 'Stock']].map(([k, l]) => `<th scope="col" data-key="${k}" class="${['price', 'stock', 'id'].includes(k) ? 'num' : ''}"><button class="sort" data-testid="sort-${k}">${l}</button></th>`).join('')}
      <th scope="col"><span class="sr-only">Actions</span></th></tr></thead><tbody></tbody></table></div>
    <nav class="pagination" aria-label="Products pages" data-testid="admin-pagination"></nav>`;
  const tbody = $('tbody', body), pager = $('.pagination', body);
  const draw = () => {
    const f = filter.toLowerCase();
    const list = rows.filter(p => !f || p.name.toLowerCase().includes(f) || p.sku.toLowerCase().includes(f) || p.category.toLowerCase().includes(f))
      .sort((a, b) => (typeof a[sort.key] === 'number' ? a[sort.key] - b[sort.key] : String(a[sort.key]).localeCompare(String(b[sort.key]))) * sort.dir);
    const pages = Math.max(1, Math.ceil(list.length / PER));
    page = Math.min(page, pages);
    $$('th[data-key]', body).forEach(th => th.setAttribute('aria-sort', th.dataset.key === sort.key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'));
    tbody.innerHTML = list.slice((page - 1) * PER, page * PER).map(p => `<tr data-testid="admin-product-row" data-product-id="${p.id}">
      <td class="num">${p.id}</td><td><strong data-testid="cell-name">${esc(p.name)}</strong><div class="small muted mono">${esc(p.sku)}</div></td><td data-testid="cell-category">${esc(p.category)}</td>
      <td class="num" data-testid="cell-price">${money(p.price)}</td><td class="num" data-testid="cell-stock">${p.stock === 0 ? '<span class="badge bad">0</span>' : p.stock}</td>
      <td class="num"><button class="btn link sm" data-edit="${p.id}" aria-label="Edit ${esc(p.name)}" data-testid="edit-product">Edit</button><button class="btn link sm" style="color:var(--bad)" data-del="${p.id}" aria-label="Delete ${esc(p.name)}" data-testid="delete-product">Delete</button></td></tr>`).join('')
      || '<tr><td colspan="6" class="empty" data-testid="admin-no-results">No products match your filter</td></tr>';
    pager.innerHTML = `<button class="btn secondary sm" data-p="${page - 1}" ${page <= 1 ? 'disabled' : ''} data-testid="admin-prev">‹ Prev</button><span class="small muted" data-testid="admin-page-info">Page ${page} of ${pages} · ${list.length} products</span><button class="btn secondary sm" data-p="${page + 1}" ${page >= pages ? 'disabled' : ''} data-testid="admin-next">Next ›</button>`;
  };
  $$('th[data-key] button', body).forEach(b => (b.onclick = () => { const k = b.parentElement.dataset.key; sort = { key: k, dir: sort.key === k ? -sort.dir : 1 }; draw(); }));
  $('[data-testid=admin-product-search]', body).oninput = e => { filter = e.target.value; page = 1; draw(); };
  pager.onclick = e => { const b = e.target.closest('[data-p]'); if (b && !b.disabled) { page = +b.dataset.p; draw(); } };
  const editor = p => {
    const m = openModal(`<h2 data-modal-title>${p ? `Edit ${esc(p.name)}` : 'Add product'}</h2><form id="pform" novalidate data-testid="product-form">
      <div data-form-alert hidden role="alert"></div>
      ${field({ name: 'name', label: 'Name', value: p ? p.name : '', testid: 'product-name-input' })}
      ${field({ name: 'category', label: 'Category', value: p ? p.category : '', testid: 'product-category-select', options: [['', 'Select a category'], ...meta.categories] })}
      <div class="grid-2">${field({ name: 'price', label: 'Price ($)', type: 'number', value: p ? p.price : '', testid: 'product-price-input', attrs: 'step="0.01" min="0"' })}
      ${field({ name: 'stock', label: 'Stock', type: 'number', value: p ? p.stock : '', testid: 'product-stock-input', attrs: 'step="1" min="0"' })}</div>
      ${field({ name: 'description', label: 'Description', type: 'textarea', value: p ? p.description : '', testid: 'product-description-input', attrs: 'rows="3"' })}
      <div class="modal-actions"><button type="button" class="btn secondary" data-testid="product-cancel">Cancel</button><button class="btn" data-testid="product-save">${p ? 'Save changes' : 'Create product'}</button></div></form>`, { label: p ? 'Edit product' : 'Add product', testid: 'product-modal' });
    const form = $('#pform', m.el);
    $('[data-testid=product-cancel]', form).onclick = m.close;
    form.onsubmit = async e => {
      e.preventDefault(); clearErrors(form);
      const b = { name: form.name.value, category: form.category.value, price: form.price.value === '' ? null : +form.price.value, stock: form.stock.value === '' ? null : Number(form.stock.value), description: form.description.value };
      await busy($('[data-testid=product-save]', form), async () => {
        try {
          const saved = await api(p ? `/admin/products/${p.id}` : '/admin/products', { method: p ? 'PUT' : 'POST', body: b });
          rows = p ? rows.map(x => (x.id === saved.id ? saved : x)) : [...rows, saved];
          m.close(); toast(p ? `Saved ${saved.name}` : `Created ${saved.name} (ID ${saved.id})`); draw();
        } catch (err) { if (err.fields) showErrors(form, err.fields); formAlert(form, err.message); }
      }, 'Saving…');
    };
  };
  $('#add', body).onclick = () => editor(null);
  tbody.onclick = async e => {
    const ed = e.target.closest('[data-edit]'), del = e.target.closest('[data-del]');
    if (ed) editor(rows.find(p => p.id === +ed.dataset.edit));
    if (del) {
      const p = rows.find(x => x.id === +del.dataset.del);
      if (!await confirmDialog({ title: `Delete ${p.name}?`, message: 'The product will disappear from the shop immediately.', confirmText: 'Delete', danger: true })) return;
      try { await api(`/admin/products/${p.id}`, { method: 'DELETE' }); rows = rows.filter(x => x.id !== p.id); toast(`Deleted ${p.name}`); draw(); }
      catch (err) { toast(err.message, 'error'); }
    }
  };
  draw();
}

async function orders(body, isCurrent) {
  const list = await api('/admin/orders');
  if (!isCurrent()) return;
  body.innerHTML = list.length ? `<div class="card table-wrap"><table data-testid="admin-orders-table"><thead><tr><th>Order</th><th>Customer</th><th>Placed</th><th class="num">Total</th><th>Status</th></tr></thead><tbody>
    ${list.map(o => `<tr data-testid="admin-order-row" data-order-id="${esc(o.id)}"><td>${esc(o.id)}</td><td>${esc(o.username)}</td><td>${fmtDate(o.createdAt)}</td><td class="num">${money(o.total)}</td>
      <td><select aria-label="Status for ${esc(o.id)}" data-testid="admin-order-status" data-id="${esc(o.id)}" style="width:auto">${['Placed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'].map(s => `<option ${s === o.status ? 'selected' : ''}>${s}</option>`).join('')}</select></td></tr>`).join('')}
    </tbody></table></div>` : '<div class="card empty" data-testid="admin-orders-empty">No orders have been placed yet.</div>';
  $$('[data-testid=admin-order-status]', body).forEach(s => (s.onchange = async () => {
    const order = list.find(o => o.id === s.dataset.id);
    s.disabled = true;
    try { const updated = await api(`/admin/orders/${encodeURIComponent(s.dataset.id)}`, { method: 'PATCH', body: { status: s.value } }); order.status = updated.status; s.value = updated.status; toast(`${s.dataset.id} → ${s.value}`); }
    catch (err) { s.value = order.status; toast(err.message, 'error'); }
    finally { s.disabled = false; }
  }));
}

async function users(body, isCurrent) {
  let list = await api('/admin/users');
  if (!isCurrent()) return;
  const draw = () => {
    body.innerHTML = `<div class="card table-wrap"><table data-testid="admin-users-table"><thead><tr><th>Username</th><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>
      ${list.map(u => `<tr data-testid="admin-user-row" data-username="${esc(u.username)}"><td class="mono">${esc(u.username)}</td><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${esc(u.role)}</td>
        <td>${u.locked ? '<span class="badge bad" data-testid="user-status">Locked</span>' : '<span class="badge ok" data-testid="user-status">Active</span>'}</td>
        <td class="num">${u.role === 'admin' ? '' : `<button class="btn secondary sm" data-user="${esc(u.username)}" data-testid="toggle-lock">${u.locked ? 'Unlock' : 'Lock'}</button>`}</td></tr>`).join('')}</tbody></table></div>`;
    $$('[data-user]', body).forEach(b => (b.onclick = async () => {
      const u = list.find(x => x.username === b.dataset.user);
      try { const r = await api(`/admin/users/${encodeURIComponent(u.username)}`, { method: 'PATCH', body: { locked: !u.locked } }); list = list.map(x => (x.username === r.username ? r : x)); toast(`${r.username} ${r.locked ? 'locked' : 'unlocked'}`); draw(); }
      catch (err) { toast(err.message, 'error'); }
    }));
  };
  draw();
}


