import { $, $$, api, esc, money, productImage, toast, state, requireAuth, setTitle, setCartCount, refreshCounts, confirmDialog, getMeta, navigate, isDatabaseMode } from '../core.js';
import { t } from '../locale.js';
import { productCard, bindCardActions } from './shop.js';

/* ================= CART ================= */
export async function cart(el, { isCurrent }) {
  if (!requireAuth()) return;
  setTitle(t("Cart"));
  const [meta, initial] = await Promise.all([getMeta(), api('/cart')]);
  if (!isCurrent()) return;
  let c = initial;

  const draw = () => {
    setCartCount(c.count);
    if (!c.items.length) {
      el.innerHTML = `<h1>${t("Your cart")}</h1><div class="card empty" data-testid="cart-empty"><div class="big">🛒</div><p><strong>${t("Your cart is empty")}</strong></p><p>${t("Find something you like in the shop.")}</p><a class="btn" href="/shop" data-testid="continue-shopping">${t("Continue shopping")}</a></div>`;
      return;
    }
    el.innerHTML = `
      <div class="page-head"><h1>${t("Your cart")} <span class="muted" style="font-size:16px;font-weight:500" data-testid="cart-count-label">(${t(c.count === 1 ? '{count} item' : '{count} items', { count: c.count })})</span></h1>
        <button class="btn link" id="clear-cart" data-testid="clear-cart">${t("Clear cart")}</button></div>
      <div class="cart-layout">
        <section class="card" aria-label="${t("Cart items")}" data-testid="cart-items">
          ${c.items.map(i => `<div class="cart-item" data-testid="cart-item" data-line-id="${esc(i.lineId)}" data-product-id="${i.productId}">
            <a class="img" href="/product/${i.productId}" tabindex="-1" aria-hidden="true">${productImage({ id: i.productId, name: i.name, category: i.category, sku: '' })}</a>
            <div>
              <a href="/product/${i.productId}" data-testid="cart-item-name"><strong>${esc(i.name)}</strong></a>
              ${i.variant ? `<div class="small muted" data-testid="cart-item-variant">${t("Size")} ${esc(i.variant.size)} · ${esc(i.variant.color)}</div>` : ''}
              <div class="small muted"><span data-testid="cart-item-price">${money(i.price)}</span> ${t("each")}</div>
              <div class="row" style="margin-top:8px">
                <div class="qty"><button type="button" data-dec aria-label="${t("Decrease quantity of {name}", { name: esc(i.name) })}" data-testid="qty-decrease" ${i.qty <= 1 ? 'disabled' : ''}>−</button><input type="number" min="1" max="10" value="${i.qty}" aria-label="${t("Quantity of {name}", { name: esc(i.name) })}" data-testid="qty-input"><button type="button" data-inc aria-label="${t("Increase quantity of {name}", { name: esc(i.name) })}" data-testid="qty-increase" ${i.qty >= 10 ? 'disabled' : ''}>+</button></div>
                <button class="btn link sm" data-remove aria-label="${t("Remove {name}", { name: esc(i.name) })}" data-testid="remove-item">${t("Remove")}</button>
                <button class="btn link sm" data-save aria-label="${t("Move {name} to wishlist", { name: esc(i.name) })}" data-testid="move-to-wishlist">${t("Save for later")}</button>
              </div>
            </div>
            <strong class="price" data-testid="line-total">${money(i.lineTotal)}</strong>
          </div>`).join('')}
        </section>
        <aside class="card summary" aria-label="${t("Order summary")}" data-testid="order-summary">
          <h2>${t("Order summary")}</h2>
          ${c.coupon ? `<div class="alert success spread" data-testid="coupon-applied"><span><strong>${esc(c.coupon)}</strong> — ${esc(c.couponLabel)}</span><button class="btn link sm" id="remove-coupon" data-testid="remove-coupon">${t("Remove")}</button></div>` : `
          <form id="coupon-form" class="field" novalidate><label for="coupon">${t("Coupon code")}</label>
            <div class="input-group"><input id="coupon" name="code" placeholder="${t("e.g. SAVE10")}" data-testid="coupon-input" autocomplete="off"><button class="btn secondary" data-testid="apply-coupon">${t("Apply")}</button></div>
            <p class="field-error" data-testid="coupon-error" role="alert"></p></form>`}
          ${c.couponError ? `<div class="alert warn small" data-testid="coupon-warning">${esc(c.couponError)}</div>` : ''}
          <fieldset style="border:0;padding:0;margin:0 0 14px"><legend class="label">${t("Shipping")}</legend>
            ${meta.shipping.map(s => `<label class="check" style="justify-content:space-between;margin-bottom:6px"><span><input type="radio" name="shipping" value="${s.id}" ${c.shippingMethod === s.id ? 'checked' : ''} data-testid="shipping-${s.id}"> ${esc(t(s.label))}</span><span class="small muted">${money(s.price)}${s.freeOver ? `<br>${t("free over {amount}", { amount: money(s.freeOver).replace(/\.00$/, '') })}` : ''}</span></label>`).join('')}
          </fieldset>
          <dl>
            <dt>${t("Subtotal")}</dt><dd data-testid="subtotal">${money(c.subtotal)}</dd>
            ${c.discount ? `<dt class="discount">${t("Discount")}</dt><dd class="discount" data-testid="discount">−${money(c.discount)}</dd>` : ''}
            <dt>${t("Shipping")}</dt><dd data-testid="shipping">${c.shipping ? money(c.shipping) : t("Free")}</dd>
            <dt>${t("Tax (8%)")}</dt><dd data-testid="tax">${money(c.tax)}</dd>
            <dt class="total">${t("Total")}</dt><dd class="total" data-testid="total">${money(c.total)}</dd>
          </dl>
          <a class="btn block" href="/checkout/address" data-testid="checkout-btn">${t("Proceed to checkout")}</a>
          <p class="small muted" style="text-align:center;margin:10px 0 0"><a href="/shop">${t("Continue shopping")}</a></p>
        </aside>
      </div>`;
    bind();
  };

  const update = async (fn, ok) => {
    try { c = await fn(); if (ok) toast(ok); } catch (err) { toast(err.message, 'error'); try { c = await api('/cart'); } catch { /* keep */ } }
    if (isCurrent()) draw();
  };
  const bind = () => {
    $$('[data-testid=cart-item]', el).forEach(row => {
      const lid = row.dataset.lineId, name = $('[data-testid=cart-item-name]', row).textContent.trim();
      const input = $('[data-testid=qty-input]', row);
      const setQty = q => update(() => api(`/cart/${encodeURIComponent(lid)}`, { method: 'PATCH', body: { qty: q } }));
      $('[data-dec]', row).onclick = () => setQty(+input.value - 1);
      $('[data-inc]', row).onclick = () => setQty(+input.value + 1);
      input.onchange = () => setQty(Math.floor(+input.value));
      $('[data-remove]', row).onclick = () => update(() => api(`/cart/${encodeURIComponent(lid)}`, { method: 'DELETE' }), t("Removed {name}", { name }));
      const save = $('[data-save]', row);
      if (save) save.onclick = () => update(async () => {
        const pid = +row.dataset.productId;
        if (!state.wishlist.has(pid)) await api('/wishlist', { method: 'POST', body: { productId: pid } });
        const r = await api(`/cart/${encodeURIComponent(lid)}`, { method: 'DELETE' });
        refreshCounts();
        return r;
      }, `Moved ${name} to wishlist`);
    });
    const cf = $('#coupon-form', el);
    if (cf) cf.onsubmit = async e => {
      e.preventDefault();
      const code = cf.code.value.trim();
      const err = $('[data-testid=coupon-error]', cf);
      if (!code) { err.textContent = 'Enter a coupon code'; cf.code.setAttribute('aria-invalid', 'true'); return; }
      try { c = await api('/cart/coupon', { method: 'POST', body: { code } }); toast(`Coupon ${c.coupon} applied`); draw(); }
      catch (e2) { err.textContent = e2.message; cf.code.setAttribute('aria-invalid', 'true'); }
    };
    const rc = $('#remove-coupon', el);
    if (rc) rc.onclick = () => update(() => api('/cart/coupon', { method: 'DELETE' }), 'Coupon removed');
    $$('[name=shipping]', el).forEach(r => (r.onchange = () => update(() => api('/cart/shipping', { method: 'PUT', body: { method: r.value } }))));
    $('#clear-cart', el).onclick = async () => {
      if (await confirmDialog({ title: 'Clear your cart?', message: 'All items will be removed. This cannot be undone.', confirmText: t("Clear cart"), danger: true }))
        update(() => api('/cart', { method: 'DELETE' }), t("Cart cleared"));
    };
  };
  draw();
}

/* ================= WISHLIST ================= */
export async function wishlist(el, { isCurrent }) {
  if (!requireAuth()) return;
  setTitle('Wishlist');
  let items = await api('/wishlist');
  if (!isCurrent()) return;
  state.wishlist = new Set(items.map(p => p.id));
  const draw = () => {
    el.innerHTML = `<div class="page-head"><h1>Wishlist <span class="muted" style="font-size:16px;font-weight:500" data-testid="wishlist-total">(${items.length})</span></h1></div>
      ${items.length ? `<div class="products" id="wl-grid" data-testid="wishlist-grid">${items.map(productCard).join('')}</div>`
        : '<div class="card empty" data-testid="wishlist-empty"><div class="big">♡</div><p><strong>Your wishlist is empty</strong></p><p>Tap the heart on any product to save it here.</p><a class="btn" href="/shop">Browse products</a></div>'}`;
    const grid = $('#wl-grid', el);
    if (grid) bindCardActions(grid, id => items.find(p => p.id === id));
  };
  // when an item is un-hearted, drop it from the page
  const onChange = () => {
    if (!isCurrent()) return document.removeEventListener('wishlist-changed', onChange);
    items = items.filter(p => state.wishlist.has(p.id)); draw();
  };
  document.addEventListener('wishlist-changed', onChange);
  draw();
}
export { navigate };



