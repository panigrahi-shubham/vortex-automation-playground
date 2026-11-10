import { $, $$, api } from '../../core.js';

export default {
  id: 'network',
  title: 'Network',
  tag: 'page.route() · waitForResponse()',
  level: 3,
  task: "Load a valid product, then call the broken endpoint. Verify a product appears first and an error appears second.",
  body: `<div class="row"><button class="btn secondary sm" data-net="/deal" data-testid="net-deal">Get deal of the day</button><button class="btn secondary sm" data-net="/products/7" data-testid="net-product">Load product #7</button><button class="btn secondary sm" data-net="/products/abc" data-testid="net-broken">Call a broken endpoint</button></div><div class="out" data-testid="network-result" id="net-out">—</div>`,
  mount(el) {
    $$('[data-net]', el).forEach(b => b.addEventListener('click', async () => {
      const out = $('#net-out', el), t0 = performance.now();
      out.textContent = 'Loading…';
      try {
        const d = await api(b.dataset.net);
        const ms = Math.round(performance.now() - t0);
        out.textContent = d.product ? `Deal: ${d.product.name} — ${d.percentOff}% off (${ms} ms)` : `Product: ${d.name} — $${d.price.toFixed(2)} (${ms} ms)`;
      } catch (err) { out.textContent = `Error ${err.status}: ${err.message}`; }
    }));
  },
};
