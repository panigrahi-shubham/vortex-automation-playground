import { $ } from '../../core.js';

const catalog = {
  id: 'css-catalog-states',
  title: 'Supplier catalog availability',
  tag: 'Attribute selectors · :disabled',
  level: 1,
  task: 'Filter to in-stock items. Check that only available listings remain, then request a quote for Desk lamp.',
  selector: '.qa-listing[data-stock="available"] > button:not(:disabled)',
  body: `<p class="small">Procurement is sourcing replacement office supplies.</p>
    <label class="check"><input type="checkbox" name="available"> Show in-stock items only</label>
    <ul class="qa-listings">
      <li class="qa-listing" data-stock="available"><div><strong>Desk lamp</strong><span>In stock · 24 units</span></div><button class="btn secondary sm" type="button" aria-label="Request quote for Desk lamp">Request quote</button></li>
      <li class="qa-listing" data-stock="unavailable"><div><strong>Monitor arm</strong><span>Out of stock</span></div><button class="btn secondary sm" type="button" disabled aria-label="Request quote for Monitor arm">Request quote</button></li>
      <li class="qa-listing" data-stock="available"><div><strong>USB-C dock</strong><span>In stock · 12 units</span></div><button class="btn secondary sm" type="button" aria-label="Request quote for USB-C dock">Request quote</button></li>
    </ul><p role="status" class="small">3 listings shown</p>`,
  mount(el) {
    const list = $('.qa-listings', el);
    const status = $('[role=status]', el);
    $('input', el).onchange = event => {
      const row = $('[data-stock=unavailable]', list);
      row.hidden = event.target.checked;
      status.textContent = event.target.checked ? '2 listings shown' : '3 listings shown';
    };
    list.onclick = event => {
      const button = event.target.closest('button');
      if (button && !button.disabled) status.textContent = `Quote requested for ${$('strong', button.closest('li')).textContent}`;
    };
  }
};

const form = {
  id: 'css-invoice-form',
  title: 'Invoice contact form',
  tag: ':focus-visible · :user-invalid · adjacent sibling',
  level: 1,
  task: 'Tab to the billing email, submit an invalid address, then correct it and save.',
  selector: 'input:user-invalid + .qa-field-error',
  body: `<form class="qa-invoice">
      <label for="qa-billing-email">Billing email</label>
      <input id="qa-billing-email" name="email" type="email" autocomplete="email" placeholder="billing@example.com" required>
      <p class="qa-field-error small" id="qa-billing-error">Enter a valid billing email.</p>
      <button type="submit" class="btn sm">Save billing contact</button>
      <p role="status" class="small"></p>
    </form>`,
  mount(el) {
    const status = $('[role=status]', el);
    const email = $('input', el);
    email.oninvalid = () => email.setAttribute('aria-describedby', 'qa-billing-error');
    email.oninput = () => {
      if (email.validity.valid) email.removeAttribute('aria-describedby');
      status.textContent = '';
    };
    $('form', el).onsubmit = event => {
      event.preventDefault();
      status.textContent = 'Billing contact saved';
    };
  }
};

const shipping = {
  id: 'css-shipment-layout',
  title: 'Responsive shipment summary',
  tag: 'Container queries · grid · overflow',
  level: 2,
  task: 'Compare narrow and wide previews. Verify the summary stacks below the items on narrow screens and that long references wrap.',
  selector: '.qa-shipment-preview[data-size="wide"] .qa-shipment-grid',
  body: `<div class="row" role="group" aria-label="Shipment preview width">
      <button type="button" class="btn secondary sm" data-size="narrow" aria-pressed="true">Narrow preview</button>
      <button type="button" class="btn secondary sm" data-size="wide" aria-pressed="false">Wide preview</button>
    </div>
    <div class="qa-shipment-scroll" tabindex="0" role="region" aria-label="Shipment preview"><section class="qa-shipment-preview" data-size="narrow">
      <div class="qa-shipment-grid">
        <div><h3>Pack shipment</h3><p>12 × desk lamps</p><small>Warehouse reference <strong class="qa-reference">BLR-FULFILMENT-WAREHOUSE-LONGREFERENCE1042</strong></small></div>
        <aside><h3>Delivery summary</h3><p>Next business day</p><strong>$24.00</strong></aside>
      </div>
    </section></div>`,
  mount(el) {
    $('[role=group]', el).onclick = event => {
      const button = event.target.closest('button');
      if (!button) return;
      $('.qa-shipment-preview', el).dataset.size = button.dataset.size;
      for (const option of el.querySelectorAll('button')) option.setAttribute('aria-pressed', String(option === button));
    };
  }
};

const quotes = {
  id: 'css-quote-review',
  title: 'Quote comparison',
  tag: ':has() · :checked · CSS custom properties',
  level: 2,
  task: 'Select one supplier at a time. Verify the selected row is highlighted, totals update, and the review action becomes available.',
  selector: '.qa-quote:has(input:checked)',
  body: `<fieldset class="qa-quote-options"><legend>Choose a supplier for 10 desk lamps</legend>
      <label class="qa-quote"><input type="radio" name="supplier" value="Northstar Office" data-total="245"><span><strong>Northstar Office</strong><small>3 business days · $24.50 per unit</small></span></label>
      <label class="qa-quote"><input type="radio" name="supplier" value="Meridian Supplies" data-total="210"><span><strong>Meridian Supplies</strong><small>5 business days · $21.00 per unit</small></span></label>
    </fieldset>
    <button type="button" class="btn sm" disabled>Review selected quote</button>
    <p role="status" class="small">Choose a supplier to see the total.</p>`,
  mount(el) {
    const review = $('button', el);
    const status = $('[role=status]', el);
    const selected = () => $('input:checked', el);
    $('fieldset', el).onchange = () => {
      review.disabled = false;
      status.textContent = `Quote total: $${Number(selected().dataset.total).toFixed(2)}`;
    };
    review.onclick = () => { status.textContent = `Reviewing ${selected().value} · $${Number(selected().dataset.total).toFixed(2)}`; };
  }
};

const queue = {
  id: 'css-fulfilment-queue',
  title: 'Fulfilment queue',
  tag: 'Sticky headers · :nth-child() · scoped CSS',
  level: 3,
  task: 'Scroll the queue and confirm its header remains visible. Filter to delayed orders and verify the result count.',
  selector: '.qa-queue tbody tr:not([hidden])[data-status="delayed"]',
  body: `<label class="check"><input type="checkbox"> Delayed orders only</label>
    <div class="qa-queue" tabindex="0" role="region" aria-label="Scrollable fulfilment queue">
      <table aria-label="Fulfilment queue"><thead><tr><th scope="col">Order</th><th scope="col">Destination</th><th scope="col">Status</th></tr></thead>
      <tbody>${Array.from({ length: 12 }, (_, index) => {
        const delayed = index % 4 === 2;
        return `<tr data-status="${delayed ? 'delayed' : 'ready'}"><th scope="row">PO-${1042 + index}</th><td>${['Bengaluru', 'Mumbai', 'Delhi'][index % 3]}</td><td>${delayed ? 'Delayed' : 'Ready'}</td></tr>`;
      }).join('')}</tbody></table>
    </div><p role="status" class="small">12 orders shown</p>`,
  mount(el) {
    $('input', el).onchange = event => {
      for (const row of el.querySelectorAll('[data-status=ready]')) row.hidden = event.target.checked;
      $('[role=status]', el).textContent = event.target.checked ? '3 delayed orders shown' : '12 orders shown';
    };
  }
};

const motion = {
  id: 'css-order-notice',
  title: 'Order status notification',
  tag: 'Transitions · prefers-reduced-motion',
  level: 3,
  task: 'Mark the order packed with motion enabled and reduced. Verify the same status is announced and the reduced-motion transition is removed.',
  selector: '.qa-notice[data-packed="true"] .qa-progress-fill',
  body: `<div class="qa-notice" data-packed="false"><strong>Order PO-1042</strong>
    <div class="qa-progress-track" aria-hidden="true"><span class="qa-progress-fill"></span></div>
    <p role="status" class="small">Preparing shipment</p>
    <button type="button" class="btn secondary sm">Mark order packed</button></div>`,
  mount(el) {
    const notice = $('.qa-notice', el);
    $('button', el).onclick = event => {
      const packed = notice.dataset.packed === 'true';
      notice.dataset.packed = String(!packed);
      $('[role=status]', el).textContent = packed ? 'Preparing shipment' : 'Packed · ready for pickup';
      event.target.textContent = packed ? 'Mark order packed' : 'Return to preparing';
    };
  }
};

export default [catalog, form, shipping, quotes, queue, motion];
