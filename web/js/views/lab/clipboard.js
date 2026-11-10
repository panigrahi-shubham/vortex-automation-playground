import { $ } from '../../core.js';

export default {
  id: 'clipboard',
  title: 'Clipboard',
  tag: "grantPermissions(['clipboard-read','clipboard-write'])",
  level: 2,
  task: "Copy the coupon and paste it back. Verify the result contains SAVE10.",
  body: `<div class="row"><code class="badge" data-testid="copy-source">SAVE10</code><button class="btn secondary sm" id="copy" data-testid="copy-button">Copy coupon</button><button class="btn secondary sm" id="paste" data-testid="paste-button">Paste from clipboard</button></div><div class="out" data-testid="clipboard-result" id="clip-out">—</div>`,
  mount(el) {
    const on = (selector, event, handler) => $(selector, el).addEventListener(event, handler);
    on('#copy', 'click', async () => { try { await navigator.clipboard.writeText('SAVE10'); $('#clip-out', el).textContent = 'Copied SAVE10 to clipboard'; } catch (e) { $('#clip-out', el).textContent = `Copy failed: ${e.name}`; } });
    on('#paste', 'click', async () => { try { $('#clip-out', el).textContent = `Clipboard contains: ${await navigator.clipboard.readText()}`; } catch (e) { $('#clip-out', el).textContent = `Paste failed: ${e.name}`; } });
  },
};
