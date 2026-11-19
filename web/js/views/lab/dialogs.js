import { $ } from '../../core.js';

export default {
  id: 'dialogs',
  title: 'Native dialogs',
  tag: "page.on('dialog')",
  level: 1,
  task: "Accept the alert, dismiss the confirmation, then submit your name. Verify the result after each dialog.",
  body: `<div class="row"><button class="btn secondary sm" id="d-alert" data-testid="btn-alert">Alert</button><button class="btn secondary sm" id="d-confirm" data-testid="btn-confirm">Confirm</button><button class="btn secondary sm" id="d-prompt" data-testid="btn-prompt">Prompt</button></div><div class="out" data-testid="dialog-result" id="d-out">No dialog yet</div>`,
  mount(el) {
    const on = (selector, event, handler) => $(selector, el).addEventListener(event, handler);
    on('#d-alert', 'click', () => { alert('Hello from VORTEX!'); $('#d-out', el).textContent = 'Alert dismissed'; });
    on('#d-confirm', 'click', () => { $('#d-out', el).textContent = confirm('Delete all test data?') ? 'Confirmed: OK' : 'Confirmed: Cancel'; });
    on('#d-prompt', 'click', () => { const v = prompt('What is your name?', 'Tester'); $('#d-out', el).textContent = v === null ? 'Prompt cancelled' : `Hello, ${v}!`; });
  },
};
