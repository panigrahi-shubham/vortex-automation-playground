import { $ } from '../../core.js';

export default {
  id: 'windows',
  title: 'Tabs &amp; popups',
  tag: "context.waitForEvent('page')",
  level: 2,
  task: "Open the Terms tab, then send a message from the popup. Verify the original tab displays it.",
  body: `<div class="row"><a class="btn secondary sm" href="/terms" target="_blank" rel="noopener" data-testid="open-new-tab">Open terms in new tab</a><button class="btn secondary sm" id="w-popup" data-testid="open-popup">Open popup window</button></div><div class="out" data-testid="popup-message" id="w-out">Waiting for a message from the popup…</div>`,
  mount(el, { challenge, signal }) {
    const on = (selector, event, handler) => $(selector, el).addEventListener(event, handler);
    let popup;
    on('#w-popup', 'click', () => {
      popup = window.open(challenge ? '/lab/popup?challenge=1' : '/lab/popup', 'shoplab-popup', 'width=520,height=420');
    });
    window.addEventListener('message', e => {
      if (e.origin !== location.origin || e.source !== popup || e.data?.type !== 'popup-message') return;
      $('#w-out', el).textContent = `Popup says: ${e.data.text}`;
    }, { signal });
    signal.addEventListener('abort', () => popup?.close(), { once: true });
  },
};
