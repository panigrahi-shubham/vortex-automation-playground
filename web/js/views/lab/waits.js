import { $ } from '../../core.js';
import { later, repeat } from './support.js';

export default {
  id: 'waits',
  title: 'Waiting &amp; dynamic content',
  tag: 'auto-waiting · toBeVisible · toBeHidden',
  level: 2,
  task: "Load data, wait for the delayed button, and start an upload. Verify the upload reaches 100%.",
  body: `
      <div class="row" style="margin-bottom:8px"><button class="btn secondary sm" id="w-load" data-testid="load-data">Load data (1–3 s)</button><span id="w-spin" hidden data-testid="wait-spinner" class="spinner" role="status" aria-label="Loading data"></span><span id="w-res" data-testid="wait-result"></span></div>
      <div class="row" style="margin-bottom:8px"><button class="btn secondary sm" id="w-enable" data-testid="delayed-button" disabled>Enabled in <span>5</span> s</button><span id="w-enabled-out" data-testid="delayed-result"></span></div>
      <div class="row" style="margin-bottom:8px"><button class="btn secondary sm" id="w-flash" data-testid="show-temp">Show temporary message</button><span id="w-temp" class="badge info" hidden data-testid="temp-message">I vanish in 3 seconds</span></div>
      <div class="row"><button class="btn secondary sm" id="w-prog" data-testid="start-progress">Start upload</button><div class="progress" style="flex:1" role="progressbar" aria-label="Upload progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" data-testid="progress"><div></div></div><span id="w-prog-out" data-testid="progress-text">0%</span></div>`,
  mount(el, { signal }) {
    const on = (selector, event, handler) => $(selector, el).addEventListener(event, handler);
    on('#w-load', 'click', () => {
      const spin = $('#w-spin', el), res = $('#w-res', el);
      spin.hidden = false; res.textContent = '';
      later(signal, () => { spin.hidden = true; res.textContent = 'Data loaded ✓'; }, 1000 + Math.random() * 2000);
    });
    let n = 5;
    const enBtn = $('#w-enable', el);
    const en = repeat(signal, () => {
      n--; if (!document.body.contains(enBtn)) return clearInterval(en);
      if (n <= 0) { clearInterval(en); enBtn.disabled = false; enBtn.textContent = "I'm ready — click me"; } else $('span', enBtn).textContent = n;
    }, 1000);
    enBtn.addEventListener('click', () => ($('#w-enabled-out', el).textContent = 'Clicked after waiting ✓'));
    on('#w-flash', 'click', () => { const t = $('#w-temp', el); t.hidden = false; later(signal, () => (t.hidden = true), 3000); });
    on('#w-prog', 'click', e => {
      e.currentTarget.disabled = true;
      let p = 0; const bar = $('[role=progressbar]', el);
      const t = repeat(signal, () => {
        p = Math.min(100, p + 5 + Math.floor(Math.random() * 10));
        bar.setAttribute('aria-valuenow', p); $('div', bar).style.width = `${p}%`;
        $('#w-prog-out', el).textContent = p === 100 ? 'Complete!' : `${p}%`;
        if (p === 100) clearInterval(t);
      }, 250);
    });
  },
};
