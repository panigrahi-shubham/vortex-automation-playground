import { $, $$, api, esc, money, toast, state, requireAuth, setTitle, fmtDate, confirmDialog, navigate, refreshCounts, ApiError } from '../core.js';

const STATUSES = ['Placed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
const badge = s => `<span class="badge status-${s}" data-testid="order-status">${s}</span>`;
function live(isCurrent, fn) {
  const h = e => { if (!isCurrent()) return window.removeEventListener('order-status', h); fn(e.detail); };
  window.addEventListener('order-status', h);
}

/* ================= LIST ================= */
export async function list(el, { query, isCurrent }) {
  if (!requireAuth()) return;
  setTitle('My orders');
  const status = STATUSES.includes(query.get('status')) ? query.get('status') : '';
  const orders = await api(`/orders${status ? `?status=${status}` : ''}`);
  if (!isCurrent()) return;
  el.innerHTML = `<div class="page-head"><h1>My orders</h1><span class="muted" data-testid="orders-count">${orders.length} order${orders.length === 1 ? '' : 's'}</span></div>
    <div class="row" role="group" aria-label="Filter by status" style="margin-bottom:14px" data-testid="status-filters">
      ${['', ...STATUSES].map(s => `<a class="btn sm ${s === status ? '' : 'secondary'}" href="/orders${s ? `?status=${s}` : ''}" aria-current="${s === status ? 'true' : 'false'}" data-testid="filter-${s || 'all'}">${s || 'All'}</a>`).join('')}
    </div>
    ${orders.length ? `<div class="card table-wrap"><table data-testid="orders-table"><caption class="sr-only">Your orders</caption>
      <thead><tr><th scope="col">Order</th><th scope="col">Placed</th><th scope="col" class="num">Items</th><th scope="col" class="num">Total</th><th scope="col">Status</th></tr></thead>
      <tbody>${orders.map(o => `<tr data-testid="order-row" data-order-id="${esc(o.id)}"><td><a href="/orders/${esc(o.id)}" data-testid="order-link">${esc(o.id)}</a></td><td>${fmtDate(o.createdAt)}</td>
        <td class="num">${o.items.reduce((s, i) => s + i.qty, 0)}</td><td class="num" data-testid="order-row-total">${money(o.total)}</td><td>${badge(o.status)}</td></tr>`).join('')}</tbody></table></div>`
    : `<div class="card empty" data-testid="orders-empty"><div class="big">📦</div><p><strong>${status ? `No ${status.toLowerCase()} orders` : 'No orders yet'}</strong></p><a class="btn" href="/shop">Start shopping</a></div>`}`;
  live(isCurrent, d => {
    const row = $(`[data-order-id="${d.orderId}"]`, el);
    if (row) $('[data-testid=order-status]', row).outerHTML = badge(d.status);
  });
}

/* ================= DETAIL ================= */
export async function detail(el, { params, isCurrent }) {
  if (!requireAuth()) return;
  let o;
  try { o = await api(`/orders/${encodeURIComponent(params[0])}`); }
  catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      el.innerHTML = `<div class="empty" data-testid="order-not-found"><div class="big">🔎</div><h1>Order not found</h1><p>We couldn't find <code>${esc(params[0])}</code> in your account.</p><a class="btn" href="/orders">Back to orders</a></div>`;
      return;
    }
    throw err;
  }
  if (!isCurrent()) return;
  setTitle(`Order ${o.id}`);
  const draw = () => {
    const flow = o.status === 'Cancelled' ? ['Placed', 'Cancelled'] : ['Placed', 'Processing', 'Shipped', 'Delivered'];
    const at = s => (o.history.slice().reverse().find(h => h.status === s) || {}).at;
    const cancellable = ['Placed', 'Processing'].includes(o.status);
    el.innerHTML = `<nav class="breadcrumbs" aria-label="Breadcrumb"><ol><li><a href="/orders">My orders</a></li><li aria-current="page">${esc(o.id)}</li></ol></nav>
      <div class="page-head"><div><h1 data-testid="order-heading">Order ${esc(o.id)}</h1><p class="muted small" style="margin:0">Placed ${fmtDate(o.createdAt)}</p></div>
        <div class="row">${badge(o.status)}
          <a class="btn secondary sm" href="/api/orders/${encodeURIComponent(o.id)}/invoice?token=${encodeURIComponent(state.token)}" download data-testid="download-invoice">⬇ Invoice</a>
          <button class="btn secondary sm" id="buy-again" data-testid="buy-again">Buy again</button>
          ${cancellable ? '<button class="btn danger sm" id="cancel" data-testid="cancel-order">Cancel order</button>' : ''}</div></div>
      <div class="cart-layout">
        <div class="stack">
          <section class="card" aria-label="Items"><h2>Items</h2><div class="table-wrap"><table data-testid="order-items"><thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Price</th><th class="num">Total</th></tr></thead>
            <tbody>${o.items.map(i => `<tr data-testid="order-item"><td><a href="/product/${i.productId}">${esc(i.name)}</a>${i.variant ? `<div class="small muted">${esc(i.variant.size)} / ${esc(i.variant.color)}</div>` : ''}</td><td class="num">${i.qty}</td><td class="num">${money(i.price)}</td><td class="num">${money(i.lineTotal)}</td></tr>`).join('')}</tbody></table></div></section>
          <section class="card grid-2" aria-label="Shipping and payment">
            <div data-testid="order-address"><h3>Ship to</h3>${esc(o.address.fullName)}<br>${esc(o.address.line1)}${o.address.line2 ? `, ${esc(o.address.line2)}` : ''}<br>${esc(o.address.city)}, ${esc(o.address.state)} ${esc(o.address.zip)}<br>${esc(o.address.country)} · ${esc(o.address.phone)}</div>
            <div data-testid="order-payment"><h3>Payment</h3>${esc(o.payment.brand)} ending in ${esc(o.payment.last4)}<h3 style="margin-top:14px">Delivery</h3>${esc(o.shippingMethod)}</div>
          </section>
        </div>
        <div class="stack">
          <section class="card" aria-label="Tracking"><h2>Tracking</h2><ol class="timeline" data-testid="order-timeline">${flow.map(s => `<li class="${at(s) ? '' : 'pending'}" data-testid="timeline-${s.toLowerCase()}" data-done="${!!at(s)}"><strong>${s}</strong><div class="small muted">${at(s) ? fmtDate(at(s)) : 'Pending'}</div></li>`).join('')}</ol></section>
          <section class="card summary" aria-label="Totals"><dl>
            <dt>Subtotal</dt><dd data-testid="order-subtotal">${money(o.subtotal)}</dd>
            ${o.discount ? `<dt class="discount">Discount${o.coupon ? ` (${esc(o.coupon)})` : ''}</dt><dd class="discount" data-testid="order-discount">−${money(o.discount)}</dd>` : ''}
            <dt>Shipping</dt><dd data-testid="order-shipping">${o.shipping ? money(o.shipping) : 'Free'}</dd>
            <dt>Tax</dt><dd data-testid="order-tax">${money(o.tax)}</dd>
            <dt class="total">Total</dt><dd class="total" data-testid="order-total">${money(o.total)}</dd></dl></section>
        </div>
      </div>`;
    const cancel = $('#cancel', el);
    if (cancel) cancel.onclick = async () => {
      if (!await confirmDialog({ title: `Cancel ${o.id}?`, message: 'Your payment will be refunded and items returned to stock.', confirmText: 'Yes, cancel order', cancelText: 'Keep order', danger: true })) return;
      try { o = await api(`/orders/${encodeURIComponent(o.id)}/cancel`, { method: 'POST' }); toast(`Order ${o.id} cancelled`); draw(); }
      catch (err) { toast(err.message, 'error'); }
    };
    $('#buy-again', el).onclick = async () => {
      let added = 0;
      for (const i of o.items) {
        try { await api('/cart', { method: 'POST', body: { productId: i.productId, qty: i.qty, ...(i.variant ? { variant: i.variant } : {}) } }); added++; }
        catch (err) { toast(`${i.name}: ${err.message}`, 'error'); }
      }
      refreshCounts();
      if (added) { toast(`Added ${added} item${added > 1 ? 's' : ''} to your cart`); navigate('/cart'); }
    };
  };
  draw();
  live(isCurrent, async d => { if (d.orderId === o.id) { o = await api(`/orders/${encodeURIComponent(o.id)}`, { quiet: true }); if (isCurrent()) draw(); } });
}
