import { $, $$, api, esc, money, toast, state, requireAuth, setTitle, setCartCount, navigate, field, showErrors, clearErrors, busy, getMeta, openModal, isDatabaseMode } from '../core.js';
import { t } from '../locale.js';

const STEPS = [['address', 'Address'], ['delivery', 'Delivery'], ['payment', 'Payment'], ['review', 'Review']];
const KEY = 'shoplab.checkout';
const draft = {
  get() { try { return JSON.parse(sessionStorage.getItem(KEY)) || {}; } catch { return {}; } },
  set(v) { try { sessionStorage.setItem(KEY, JSON.stringify({ ...draft.get(), ...v })); } catch { /* ignore */ } },
  clear() { try { sessionStorage.removeItem(KEY); } catch { /* ignore */ } }
};
// Card details are deliberately kept in memory only (never in storage) — reload the review step and you'll be sent back to Payment.
let payment = null;

const luhn = n => { let s = 0, d = false; for (let i = n.length - 1; i >= 0; i--) { let x = +n[i]; if (d) { x *= 2; if (x > 9) x -= 9; } s += x; d = !d; } return s % 10 === 0; };
export const cardBrand = n => /^4/.test(n) ? 'Visa' : /^(5[1-5]|2[2-7])/.test(n) ? 'Mastercard' : /^3[47]/.test(n) ? 'Amex' : n ? 'Card' : '';
const ZIP = { IN: /^\d{6}$/, US: /^\d{5}$/, UK: /^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/i };

function validateAddress(a, meta) {
  const f = {};
  const c = meta.countries.find(x => x.code === a.country);
  if (!a.fullName || a.fullName.trim().length < 2) f.fullName = t("Full name is required");
  if (!/^\d{10}$/.test(a.phone || '')) f.phone = t("Phone must be 10 digits");
  if (!a.line1 || !a.line1.trim()) f.line1 = t("Address is required");
  if (!a.city || !a.city.trim()) f.city = t("City is required");
  if (!c) f.country = t("Select a country");
  else if (!c.states.includes(a.state)) f.state = t("Select a state");
  if (c && !ZIP[c.code].test(a.zip || '')) f.zip = t("Postal code must be {format}", { format: c.zipHint });
  return f;
}
function validatePayment(p) {
  const f = {};
  const n = (p.cardNumber || '').replace(/\s+/g, '');
  if (!/^\d{13,19}$/.test(n) || !luhn(n)) f.cardNumber = t("Enter a valid card number");
  const m = /^(\d{2})\s*\/\s*(\d{2})$/.exec(p.expiry || '');
  if (!m || +m[1] < 1 || +m[1] > 12) f.expiry = t("Use MM/YY");
  else if (new Date(2000 + +m[2], +m[1], 1) <= new Date()) f.expiry = t("Card has expired");
  if (!/^\d{3,4}$/.test(p.cvv || '')) f.cvv = t("CVV must be 3 or 4 digits");
  if (!p.cardName || !p.cardName.trim()) f.cardName = t("Name on card is required");
  return f;
}

function shell(step, cart) {
  const idx = STEPS.findIndex(s => s[0] === step);
  return `<h1>${t("Checkout")}</h1>
    <ol class="stepper" aria-label="${t("Checkout progress")}" data-testid="checkout-steps">${STEPS.map(([id, label], i) =>
      `<li data-testid="step-${id}" ${i === idx ? 'aria-current="step"' : ''} data-state="${i < idx ? 'done' : i === idx ? 'current' : 'todo'}">${t(label)}</li>`).join('')}</ol>
    <div class="cart-layout">
      <section class="card" id="step-body" aria-label="${t(STEPS[idx][1])}"></section>
      <aside class="card summary" data-testid="checkout-summary" aria-label="${t("Order summary")}">
        <h2>${t("Summary")}</h2>
        <ul style="list-style:none;padding:0;margin:0 0 12px" class="small">${cart.items.map(i => `<li class="spread" style="padding:4px 0"><span>${esc(i.name)} × ${i.qty}</span><span>${money(i.lineTotal)}</span></li>`).join('')}</ul>
        <dl><dt>${t("Subtotal")}</dt><dd data-testid="summary-subtotal">${money(cart.subtotal)}</dd>
          ${cart.discount ? `<dt class="discount">${t("Discount")} (${esc(cart.coupon)})</dt><dd class="discount" data-testid="summary-discount">−${money(cart.discount)}</dd>` : ''}
          <dt>${t("Shipping")}</dt><dd data-testid="summary-shipping">${cart.shipping ? money(cart.shipping) : t("Free")}</dd>
          <dt>${t("Tax")}</dt><dd data-testid="summary-tax">${money(cart.tax)}</dd>
          <dt class="total">${t("Total")}</dt><dd class="total" data-testid="summary-total">${money(cart.total)}</dd></dl>
      </aside>
    </div>`;
}

export async function wizard(el, { params, isCurrent }) {
  if (!requireAuth()) return;
  const step = params[0];
  if (!step) return navigate('/checkout/address', { replace: true });
  const [meta, cart] = await Promise.all([getMeta(), api('/cart')]);
  if (!isCurrent()) return;
  if (!cart.items.length) { toast(t("Your cart is empty"), 'info'); return navigate('/cart', { replace: true }); }
  const d = draft.get();
  // step guards
  if (step !== 'address' && Object.keys(validateAddress(d.address || {}, meta)).length) return navigate('/checkout/address', { replace: true });
  if (step === 'review' && !payment) { toast(t("Please re-enter your payment details"), 'info'); return navigate('/checkout/payment', { replace: true }); }
  setTitle(`${t('Checkout')} — ${t(STEPS.find(s => s[0] === step)[1])}`);
  el.innerHTML = shell(step, cart);
  const body = $('#step-body', el);
  ({ address, delivery, payment: paymentStep, review })[step](body, { meta, cart, d, el, isCurrent });
}

/* ---------- step 1: address ---------- */
function address(body, { meta, d }) {
  const a = d.address || { fullName: state.user ? state.user.name : '', country: '' };
  const country = meta.countries.find(c => c.code === a.country);
  body.innerHTML = `<h2>${t("Shipping address")}</h2>
    <form id="address-form" novalidate data-testid="address-form">
      <div class="grid-2">
        ${field({ name: 'fullName', label: t("Full name"), value: a.fullName, testid: 'fullName', attrs: 'autocomplete="name"' })}
        ${field({ name: 'phone', label: t("Phone"), type: 'tel', value: a.phone, testid: 'phone', hint: t("10 digits, no spaces"), attrs: 'autocomplete="tel" inputmode="numeric" maxlength="10"' })}
      </div>
      ${field({ name: 'line1', label: t("Address line 1"), value: a.line1, testid: 'line1', attrs: 'autocomplete="address-line1"' })}
      ${field({ name: 'line2', label: t("Address line 2 (optional)"), value: a.line2, testid: 'line2', attrs: 'autocomplete="address-line2"' })}
      <div class="grid-2">
        ${field({ name: 'city', label: t("City"), value: a.city, testid: 'city', attrs: 'autocomplete="address-level2"' })}
        ${field({ name: 'country', label: t("Country"), value: a.country, testid: 'country', options: [['', t("Select a country")], ...meta.countries.map(c => [c.code, t(c.name)])] })}
        ${field({ name: 'state', label: t("State / region"), value: a.state, testid: 'state', options: [['', country ? t("Select a state") : t("Select a country first")], ...(country ? country.states : [])], attrs: country ? '' : 'disabled' })}
        ${field({ name: 'zip', label: t("Postal code"), value: a.zip, testid: 'zip', hint: `<span id="zip-hint">${country ? esc(country.zipHint) : t("Depends on country")}</span>`, attrs: 'autocomplete="postal-code"' })}
      </div>
      <div class="spread" style="margin-top:8px"><a href="/cart" data-testid="back-to-cart">${t("← Back to cart")}</a><button class="btn" data-testid="continue-delivery">${t("Continue to delivery")}</button></div>
    </form>`;
  const form = $('#address-form', body);
  // dependent dropdown: states depend on country
  form.country.onchange = () => {
    const c = meta.countries.find(x => x.code === form.country.value);
    form.state.innerHTML = `<option value="">${c ? t("Select a state") : t("Select a country first")}</option>` + (c ? c.states.map(s => `<option>${esc(s)}</option>`).join('') : '');
    form.state.disabled = !c;
    $('#zip-hint', body).textContent = c ? c.zipHint : t("Depends on country");
  };
  form.onsubmit = e => {
    e.preventDefault(); clearErrors(form);
    const v = Object.fromEntries(['fullName', 'phone', 'line1', 'line2', 'city', 'country', 'state', 'zip'].map(k => [k, (form[k].value || '').trim()]));
    const f = validateAddress(v, meta);
    if (Object.keys(f).length) return showErrors(form, f);
    draft.set({ address: v });
    navigate('/checkout/delivery');
  };
}

/* ---------- step 2: delivery ---------- */
function delivery(body, { meta, cart, d, el, isCurrent }) {
  body.innerHTML = `<h2>${t("Delivery method")}</h2>
    <form id="delivery-form" novalidate>
      <fieldset style="border:0;padding:0;margin:0 0 14px"><legend class="sr-only">${t("Shipping speed")}</legend>
      ${meta.shipping.map(s => {
        const free = s.freeOver && cart.subtotal - cart.discount >= s.freeOver;
        return `<label class="radio-card" data-testid="delivery-${s.id}"><input type="radio" name="method" value="${s.id}" ${cart.shippingMethod === s.id ? 'checked' : ''}>
          <span class="grow"><strong>${esc(t(s.label))}</strong>${s.freeOver ? `<br><span class="small muted">${t("Free on orders over {amount}", { amount: money(s.freeOver).replace(/\.00$/, '') })}</span>` : ''}</span><strong>${free || cart.coupon === 'FREESHIP' ? t("Free") : money(s.price)}</strong></label>`;
      }).join('')}</fieldset>
      ${field({ name: 'notes', label: t("Delivery instructions (optional)"), type: 'textarea', value: d.notes || '', testid: 'delivery-notes', attrs: 'rows="2" maxlength="200"', hint: t("e.g. leave with the security desk") })}
      <div class="spread"><a href="/checkout/address" data-testid="back">${t("← Back")}</a><button class="btn" data-testid="continue-payment">${t("Continue to payment")}</button></div>
    </form>`;
  const form = $('#delivery-form', body);
  $$('[name=method]', form).forEach(r => (r.onchange = async () => {
    try {
      const c = await api('/cart/shipping', { method: 'PUT', body: { method: r.value } });
      if (!isCurrent()) return;
      $('[data-testid=summary-shipping]', el).textContent = c.shipping ? money(c.shipping) : t("Free");
      $('[data-testid=summary-total]', el).textContent = money(c.total);
    } catch (err) { toast(err.message, 'error'); }
  }));
  form.onsubmit = e => { e.preventDefault(); draft.set({ notes: form.notes.value.trim() }); navigate('/checkout/payment'); };
}

/* ---------- step 3: payment ---------- */
const TEST_CARDS = [['4242 4242 4242 4242', 'Success'], ['4000 0027 6000 3184', '3-D Secure challenge'], ['4000 0000 0000 0002', 'Declined'], ['4000 0000 0000 9995', 'Insufficient funds'], ['4000 0000 0000 0069', 'Expired card (bank)']];
function paymentStep(body) {
  const p = payment || {};
  const cards = isDatabaseMode() ? TEST_CARDS.filter(([n]) => n !== '4000 0027 6000 3184') : TEST_CARDS;
  body.innerHTML = `<h2>${t("Payment")}</h2>
    ${isDatabaseMode() ? `<p class="small muted" data-testid="payment-mode-note">${t("Database mode uses a simulated payment gateway: the 4242 card is approved, no real money moves, and 3-D Secure is not available.")}</p>` : ''}
    <details class="alert info test-cards" data-testid="test-cards"><summary style="cursor:pointer"><strong>${t("Test cards")}</strong> — ${t("any future expiry, any 3-digit CVV")}</summary>
      <table><tbody>${cards.map(([n, d]) => `<tr><td class="mono">${n}</td><td>${t(d)}</td><td><button type="button" class="btn link sm" data-card="${n}" data-testid="use-card-${n.replace(/\s/g, '')}">${t("Use")}</button></td></tr>`).join('')}</tbody></table></details>
    <form id="payment-form" novalidate data-testid="payment-form" autocomplete="off">
      <div class="field card-input" data-field="cardNumber"><label for="f-cardNumber">${t("Card number")}</label>
        <div style="position:relative"><input id="f-cardNumber" name="cardNumber" inputmode="numeric" maxlength="23" placeholder="1234 1234 1234 1234" value="${esc(p.cardNumber || '')}" data-testid="cardNumber" aria-describedby="f-cardNumber-error" autocomplete="cc-number"><span class="brand-tag" data-testid="card-brand">${cardBrand((p.cardNumber || '').replace(/\s/g, ''))}</span></div>
        <p class="field-error" id="f-cardNumber-error" data-testid="cardNumber-error"></p></div>
      <div class="grid-2">
        ${field({ name: 'expiry', label: t("Expiry (MM/YY)"), value: p.expiry, testid: 'expiry', attrs: 'placeholder="MM/YY" maxlength="5" inputmode="numeric" autocomplete="cc-exp"' })}
        ${field({ name: 'cvv', label: 'CVV', type: 'password', value: p.cvv, testid: 'cvv', attrs: 'maxlength="4" inputmode="numeric" autocomplete="cc-csc"' })}
      </div>
      ${field({ name: 'cardName', label: t("Name on card"), value: p.cardName || (draft.get().address || {}).fullName || '', testid: 'cardName', attrs: 'autocomplete="cc-name"' })}
      <div class="spread"><a href="/checkout/delivery" data-testid="back">${t("← Back")}</a><button class="btn" data-testid="continue-review">${t("Review order")}</button></div>
    </form>`;
  const form = $('#payment-form', body);
  const fmt = () => {
    const digits = form.cardNumber.value.replace(/\D/g, '').slice(0, 19);
    form.cardNumber.value = digits.replace(/(.{4})/g, '$1 ').trim();
    $('[data-testid=card-brand]', body).textContent = cardBrand(digits);
  };
  form.cardNumber.oninput = fmt;
  form.expiry.oninput = e => {
    let v = form.expiry.value.replace(/[^\d]/g, '').slice(0, 4);
    if (v.length >= 3 || (v.length === 2 && e.inputType !== 'deleteContentBackward')) v = v.slice(0, 2) + '/' + v.slice(2);
    form.expiry.value = v;
  };
  $$('[data-card]', body).forEach(b => (b.onclick = () => { form.cardNumber.value = b.dataset.card; fmt(); form.expiry.focus(); }));
  form.onsubmit = e => {
    e.preventDefault(); clearErrors(form);
    const v = { cardNumber: form.cardNumber.value, expiry: form.expiry.value.trim(), cvv: form.cvv.value.trim(), cardName: form.cardName.value.trim() };
    const f = validatePayment(v);
    if (Object.keys(f).length) return showErrors(form, f);
    payment = v;
    navigate('/checkout/review');
  };
}

/* ---------- step 4: review + place order ---------- */
function review(body, { meta, cart, d }) {
  const a = d.address, ship = meta.shipping.find(s => s.id === cart.shippingMethod);
  const country = meta.countries.find(c => c.code === a.country);
  const num = payment.cardNumber.replace(/\s/g, '');
  body.innerHTML = `<h2>${t("Review your order")}</h2>
    <div id="place-alert" role="alert" data-testid="payment-error" hidden></div>
    <div class="review-block" data-testid="review-address"><div class="spread"><strong>${t("Ship to")}</strong><a href="/checkout/address" data-testid="edit-address">${t("Edit")}</a></div>
      <div>${esc(a.fullName)} · ${esc(a.phone)}<br>${esc(a.line1)}${a.line2 ? `, ${esc(a.line2)}` : ''}<br>${esc(a.city)}, ${esc(a.state)} ${esc(a.zip)}<br>${esc(t(country.name))}</div></div>
    <div class="review-block" data-testid="review-delivery"><div class="spread"><strong>${t("Delivery")}</strong><a href="/checkout/delivery" data-testid="edit-delivery">${t("Edit")}</a></div>
      <div>${esc(t(ship.label))}${d.notes ? `<br><span class="small muted">“${esc(d.notes)}”</span>` : ''}</div></div>
    <div class="review-block" data-testid="review-payment"><div class="spread"><strong>${t("Payment")}</strong><a href="/checkout/payment" data-testid="edit-payment">${t("Edit")}</a></div>
      <div>${cardBrand(num)} ${t("ending in")} <strong data-testid="card-last4">${num.slice(-4)}</strong> · ${t("expires")} ${esc(payment.expiry)}</div></div>
    <div class="review-block" data-testid="review-items"><strong>${t("Items")} (${cart.count})</strong>
      ${cart.items.map(i => `<div class="spread small" style="padding:3px 0" data-testid="review-item"><span>${esc(i.name)}${i.variant ? ` (${esc(i.variant.size)}/${esc(i.variant.color)})` : ''} × ${i.qty}</span><span>${money(i.lineTotal)}</span></div>`).join('')}</div>
    <form id="place-form" novalidate style="margin-top:14px">
      <div class="field" data-field="terms"><label class="check"><input type="checkbox" name="terms" data-testid="accept-terms"> ${t("I agree to the")} <a href="/terms" target="_blank" rel="noopener" data-testid="terms-link">${t("terms of sale ↗")}</a></label><p class="field-error" data-testid="terms-error"></p></div>
      <div class="spread"><a href="/checkout/payment" data-testid="back">${t("← Back")}</a><button class="btn" data-testid="place-order">${t("Place order")} · ${money(cart.total)}</button></div>
    </form>`;
  const form = $('#place-form', body), alertBox = $('#place-alert', body), btn = $('[data-testid=place-order]', form);
  const showAlert = html => { alertBox.className = 'alert error'; alertBox.innerHTML = html; alertBox.hidden = false; alertBox.scrollIntoView({ block: 'nearest' }); };
  const done = order => { draft.clear(); payment = null; setCartCount(0); navigate(`/checkout/complete/${order.id}`, { replace: true }); };
  form.onsubmit = async e => {
    e.preventDefault(); clearErrors(form); alertBox.hidden = true;
    if (!form.terms.checked) return showErrors(form, { terms: t("You must accept the terms of sale") });
    await busy(btn, async () => {
      try {
        const r = await api('/checkout', { method: 'POST', body: { address: a, payment: { ...payment, cardNumber: num }, acceptTerms: form.terms.checked } });
        if (r.status === 'requires_action') {
          const order = await threeDS(r.challengeId, cart.total);
          return done(order);
        }
        done(r);
      } catch (err) {
        if (err.status === 422 && err.fields) {
          const addr = Object.keys(err.fields).some(k => ['fullName', 'phone', 'line1', 'city', 'country', 'state', 'zip'].includes(k));
          showAlert(`<strong>${t("Please fix the following:")}</strong><ul style="margin:6px 0 0">${Object.values(err.fields).map(m => `<li>${esc(m)}</li>`).join('')}</ul>${addr ? '<a href="/checkout/address">Edit address</a>' : '<a href="/checkout/payment">Edit payment</a>'}`);
        } else if (err.status === 402) {
          showAlert(`<strong>${t("Payment failed:")}</strong> <span data-testid="payment-error-message">${esc(err.message)}</span>. <a href="/checkout/payment" data-testid="update-payment">${t("Use a different card")}</a>`);
        } else showAlert(`<strong>We couldn't place your order.</strong> <span data-testid="payment-error-message">${esc(err.message)}</span>`);
      }
    }, t("Processing payment…"));
  };
}

/** 3-D Secure: opens the bank's page in an iframe and waits for it to postMessage the outcome. */
function threeDS(challengeId, total) {
  return new Promise((resolve, reject) => {
    const m = openModal(`<h2 data-modal-title>${t("Verify your payment")}</h2><p class="small muted">${t("Your bank needs to confirm this purchase.")}</p>
      <iframe src="/bank/3ds?challenge=${encodeURIComponent(challengeId)}&amount=${total.toFixed(2)}" title="${t("Bank verification")}" data-testid="three-ds-frame" style="width:100%;height:330px;border:1px solid var(--line);border-radius:10px"></iframe>`,
      { label: t("Verify your payment"), testid: 'three-ds-modal', onClose: () => { window.removeEventListener('message', onMsg); if (!settled) { settled = true; reject(Object.assign(new Error('Payment authentication was cancelled'), { status: 402 })); } } });
    let settled = false;
    function onMsg(e) {
      if (e.origin !== location.origin || !e.data || !String(e.data.type).startsWith('3ds-')) return;
      settled = true;
      window.removeEventListener('message', onMsg);
      m.close();
      if (e.data.type === '3ds-complete') resolve(e.data.order);
      else reject(Object.assign(new Error(e.data.error || 'Payment authentication failed'), { status: 402 }));
    }
    window.addEventListener('message', onMsg);
  });
}

/* ================= COMPLETE ================= */
export async function complete(el, { params, isCurrent }) {
  if (!requireAuth()) return;
  const o = await api(`/orders/${encodeURIComponent(params[0])}`);
  if (!isCurrent()) return;
  setTitle(t("Order confirmed"));
  el.innerHTML = `<div class="card" style="max-width:620px;margin:20px auto;text-align:center" data-testid="order-confirmation">
    <div class="confetti" aria-hidden="true">🎉</div>
    <h1 data-testid="order-success">${t("Thank you for your order!")}</h1>
    <p>${t("Order")} <strong data-testid="order-id">${esc(o.id)}</strong> ${t("has been placed. Total charged:")} <strong data-testid="order-total">${money(o.total)}</strong></p>
    ${isDatabaseMode()
      ? `<p class="muted small">${t("This store is running on the database-backed API. Order status is managed by the server; live status updates are not available in this mode.")}</p>`
      : `<p class="muted small">${t("A confirmation email is waiting in the")} <a href="/mailbox?to=${encodeURIComponent(state.user ? state.user.email : '')}" data-testid="confirmation-inbox">${t("test inbox")}</a>. ${t("Status updates arrive live while you browse.")}</p>`}
    <div class="row" style="justify-content:center;margin-top:16px"><a class="btn" href="/orders/${esc(o.id)}" data-testid="view-order">${t("View order")}</a><a class="btn secondary" href="/shop" data-testid="continue-shopping">${t("Continue shopping")}</a></div>
  </div>`;
}


