import { $, $$, api, esc, money, stars, productImage, toast, state, isAuthed, setTitle, fmtDate, field, showErrors, clearErrors, formAlert, busy, ApiError } from '../core.js';
import { addToCart, toggleWishlist } from './shop.js';

export async function render(el, { params, isCurrent }) {
  const id = params[0];
  let p, reviews;
  try {
    [p, reviews] = await Promise.all([api(`/products/${id}`), api(`/products/${id}/reviews`)]);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      setTitle('Product not found');
      el.innerHTML = `<div class="empty" data-testid="product-not-found"><div class="big">📦</div><h1>Product not found</h1><p>It may have been removed by an admin.</p><a class="btn" href="/shop">Back to the shop</a></div>`;
      return;
    }
    throw err;
  }
  if (!isCurrent()) return;
  setTitle(p.name);
  const maxQty = Math.max(1, Math.min(10, p.stock));
  const wished = state.wishlist.has(p.id);
  el.innerHTML = `
    <nav class="breadcrumbs" aria-label="Breadcrumb" data-testid="breadcrumbs"><ol>
      <li><a href="/shop">Shop</a></li><li><a href="/shop?category=${encodeURIComponent(p.category)}" data-testid="crumb-category">${esc(p.category)}</a></li><li aria-current="page">${esc(p.name)}</li></ol></nav>
    <div class="pdp" data-testid="product-detail" data-product-id="${p.id}">
      <div class="gallery">
        <div class="main" id="main-img" data-testid="main-image">${productImage(p, 0)}</div>
        <div class="thumbs" role="group" aria-label="Product images">${[0, 1, 2].map(i => `<button aria-pressed="${i === 0}" aria-label="Show image ${i + 1}" data-img="${i}" data-testid="thumb-${i + 1}">${productImage(p, i)}</button>`).join('')}</div>
      </div>
      <div>
        <p class="cat muted small" style="text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">${esc(p.category)} · <span class="mono" data-testid="product-sku">${esc(p.sku)}</span></p>
        <h1 data-testid="product-title">${esc(p.name)}</h1>
        <p><a href="#reviews" id="jump-reviews">${stars(p.rating, p.reviewCount)}</a></p>
        <p class="price" style="font-size:26px" data-testid="product-price">${money(p.price)}${p.originalPrice ? `<s>${money(p.originalPrice)}</s> <span class="badge warn">Save ${Math.round((1 - p.price / p.originalPrice) * 100)}%</span>` : ''}</p>
        <p data-testid="stock-status">${p.stock === 0 ? '<span class="stock-out">Out of stock</span>' : p.stock <= 3 ? `<span class="stock-low">Hurry — only ${p.stock} left!</span>` : `<span class="badge ok">In stock</span> <span class="small muted">${p.stock} available</span>`}</p>
        <form id="buy-form" novalidate>
          ${p.variants ? `
            <fieldset class="field" data-field="size" style="border:0;padding:0;margin:0 0 14px"><legend class="label">Size</legend>
              <div class="swatches" role="radiogroup" aria-label="Size">${p.variants.size.map(s => `<input type="radio" name="size" id="size-${esc(s)}" value="${esc(s)}" data-testid="size-${esc(s)}"><label for="size-${esc(s)}">${esc(s)}</label>`).join('')}</div>
              <p class="field-error" data-testid="size-error"></p></fieldset>
            ${field({ name: 'color', label: 'Colour', testid: 'color-select', options: [['', 'Select a colour'], ...p.variants.color] })}` : ''}
          <div class="field"><label for="qty">Quantity</label>
            <div class="qty"><button type="button" data-step="-1" aria-label="Decrease quantity" data-testid="qty-decrease" disabled>−</button><input id="qty" type="number" min="1" max="${maxQty}" value="1" data-testid="qty-input" inputmode="numeric"><button type="button" data-step="1" aria-label="Increase quantity" data-testid="qty-increase" ${maxQty <= 1 ? 'disabled' : ''}>+</button></div>
            <div class="hint">Max ${maxQty} per order</div></div>
          <div class="row">
            <button class="btn" data-testid="add-to-cart" ${p.stock === 0 ? 'disabled' : ''}>${p.stock === 0 ? 'Out of stock' : 'Add to cart'}</button>
            <button type="button" class="btn secondary" id="wish" aria-pressed="${wished}" data-testid="wishlist-toggle">${wished ? '♥ Saved' : '♡ Save to wishlist'}</button>
          </div>
        </form>
      </div>
    </div>
    <section style="margin-top:36px" id="reviews">
      <div role="tablist" aria-label="Product information">
        <button role="tab" id="tab-desc" aria-controls="panel-desc" aria-selected="true" data-testid="tab-description">Description</button>
        <button role="tab" id="tab-specs" aria-controls="panel-specs" aria-selected="false" tabindex="-1" data-testid="tab-specs">Specifications</button>
        <button role="tab" id="tab-reviews" aria-controls="panel-reviews" aria-selected="false" tabindex="-1" data-testid="tab-reviews">Reviews (<span data-testid="review-total">${reviews.length}</span>)</button>
      </div>
      <div role="tabpanel" id="panel-desc" aria-labelledby="tab-desc" data-testid="panel-description"><p>${esc(p.description)}</p></div>
      <div role="tabpanel" id="panel-specs" aria-labelledby="tab-specs" hidden data-testid="panel-specs"><div class="table-wrap"><table style="max-width:520px"><tbody>
        <tr><th scope="row">SKU</th><td>${esc(p.sku)}</td></tr><tr><th scope="row">Category</th><td>${esc(p.category)}</td></tr>
        <tr><th scope="row">Stock</th><td>${p.stock}</td></tr><tr><th scope="row">Listed</th><td>${fmtDate(p.createdAt)}</td></tr>
        ${p.variants ? `<tr><th scope="row">Sizes</th><td>${p.variants.size.join(', ')}</td></tr><tr><th scope="row">Colours</th><td>${p.variants.color.join(', ')}</td></tr>` : ''}
      </tbody></table></div></div>
      <div role="tabpanel" id="panel-reviews" aria-labelledby="tab-reviews" hidden data-testid="panel-reviews">
        <div class="grid-2" style="align-items:start">
          <div id="review-list" data-testid="review-list"></div>
          <div class="card" id="review-box"></div>
        </div>
      </div>
    </section>`;

  // gallery
  $$('[data-img]', el).forEach(b => (b.onclick = () => {
    $$('[data-img]', el).forEach(x => x.setAttribute('aria-pressed', 'false')); b.setAttribute('aria-pressed', 'true');
    $('#main-img', el).innerHTML = productImage(p, +b.dataset.img);
  }));
  // qty stepper
  const qty = $('#qty', el), dec = $('[data-step="-1"]', el), inc = $('[data-step="1"]', el);
  const setQty = v => { const n = Math.min(maxQty, Math.max(1, Math.floor(+v) || 1)); qty.value = n; dec.disabled = n <= 1; inc.disabled = n >= maxQty; };
  dec.onclick = () => setQty(+qty.value - 1); inc.onclick = () => setQty(+qty.value + 1); qty.onchange = () => setQty(qty.value);
  // buy
  const form = $('#buy-form', el);
  form.onsubmit = async e => {
    e.preventDefault(); clearErrors(form);
    const extra = { qty: +qty.value };
    if (p.variants) {
      const size = (form.querySelector('[name=size]:checked') || {}).value, color = form.color.value;
      const f = {};
      if (!size) f.size = 'Please select a size';
      if (!color) f.color = 'Please select a colour';
      if (Object.keys(f).length) return showErrors(form, f);
      extra.variant = { size, color };
    }
    try { await addToCart(p.id, p.name, $('[data-testid=add-to-cart]', form), extra); }
    catch (err) { if (err.fields) showErrors(form, err.fields); }
  };
  $('#wish', el).onclick = async e => {
    const b = e.currentTarget;
    await toggleWishlist(p.id, p.name);
    const on = state.wishlist.has(p.id);
    b.setAttribute('aria-pressed', String(on)); b.textContent = on ? '♥ Saved' : '♡ Save to wishlist';
  };
  // tabs (click + arrow keys)
  const tabs = $$('[role=tab]', el);
  const select = t => {
    tabs.forEach(x => { const on = x === t; x.setAttribute('aria-selected', String(on)); x.tabIndex = on ? 0 : -1; $(`#${x.getAttribute('aria-controls')}`, el).hidden = !on; });
    t.focus();
  };
  tabs.forEach((t, i) => {
    t.onclick = () => select(t);
    t.onkeydown = e => { if (e.key === 'ArrowRight') select(tabs[(i + 1) % tabs.length]); if (e.key === 'ArrowLeft') select(tabs[(i + tabs.length - 1) % tabs.length]); };
  });
  $('#jump-reviews', el).onclick = e => { e.preventDefault(); select($('#tab-reviews', el)); $('#reviews', el).scrollIntoView(); };

  // reviews
  const drawReviews = () => {
    $('#review-list', el).innerHTML = reviews.length ? reviews.map(r => `<article class="review" data-testid="review"><div class="spread"><strong data-testid="review-title">${esc(r.title)}</strong>${stars(r.rating)}</div>
      <p style="margin:4px 0">${esc(r.body)}</p><p class="small muted" style="margin:0">by <span data-testid="review-author">${esc(r.username)}</span> · ${fmtDate(r.createdAt)}</p></article>`).join('')
      : '<p class="muted" data-testid="no-reviews">No reviews yet. Be the first!</p>';
    $('[data-testid=review-total]', el).textContent = reviews.length;
  };
  drawReviews();
  const box = $('#review-box', el);
  if (!isAuthed()) {
    box.innerHTML = `<p style="margin:0"><a href="/login?returnTo=${encodeURIComponent(location.pathname)}" data-testid="review-login">Sign in</a> to write a review.</p>`;
  } else {
    box.innerHTML = `<h3>Write a review</h3><form id="review-form" novalidate data-testid="review-form">
      <div data-form-alert hidden role="alert" data-testid="review-error"></div>
      <fieldset class="field" data-field="rating" style="border:0;padding:0;margin:0 0 12px"><legend class="label">Your rating</legend>
        <div class="star-input">${[5, 4, 3, 2, 1].map(n => `<input type="radio" name="rating" id="star-${n}" value="${n}" data-testid="star-${n}"><label for="star-${n}" aria-label="${n} star${n > 1 ? 's' : ''}">★</label>`).join('')}</div>
        <p class="field-error" data-testid="rating-error"></p></fieldset>
      ${field({ name: 'title', label: 'Title', testid: 'review-title-input', attrs: 'maxlength="60"' })}
      ${field({ name: 'body', label: 'Review', type: 'textarea', testid: 'review-body', attrs: 'rows="4" maxlength="500"', hint: '<span data-testid="review-chars">0</span>/500 characters (min 10)' })}
      <button class="btn" data-testid="submit-review">Submit review</button></form>`;
    const rf = $('#review-form', el);
    rf.body.oninput = () => ($('[data-testid=review-chars]', el).textContent = rf.body.value.length);
    rf.onsubmit = async e => {
      e.preventDefault(); clearErrors(rf);
      const rating = +((rf.querySelector('[name=rating]:checked') || {}).value || 0);
      await busy($('[data-testid=submit-review]', rf), async () => {
        try {
          const r = await api(`/products/${p.id}/reviews`, { method: 'POST', body: { rating, title: rf.title.value, body: rf.body.value } });
          reviews.unshift(r); drawReviews(); rf.reset(); $('[data-testid=review-chars]', el).textContent = '0';
          toast('Thanks! Your review was posted.');
        } catch (err) { if (err.fields) showErrors(rf, err.fields); formAlert(rf, err.message); }
      }, 'Posting…');
    };
  }
}
