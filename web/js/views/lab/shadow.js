import { $ } from '../../core.js';

function defineElements() {
  if (customElements.get('lab-rating')) return;
  class LabChip extends HTMLElement {
    constructor() { super(); this.attachShadow({ mode: 'open' }).innerHTML = `<style>span{display:inline-block;padding:2px 8px;border-radius:99px;background:#ccfbf1;color:#0f766e;font:600 12px system-ui}</style><span part="chip" data-testid="shadow-chip"><slot></slot></span>`; }
  }
  class LabRating extends HTMLElement {
    constructor() {
      super();
      const root = this.attachShadow({ mode: 'open' });
      root.innerHTML = `<style>button{font-size:22px;background:none;border:0;cursor:pointer;color:#d6d3d1;padding:0 2px}button[aria-pressed=true]{color:#f59e0b}p{margin:6px 0 0;font:13px system-ui}</style>
        <div role="group" aria-label="Rate VORTEX">${[1, 2, 3, 4, 5].map(n => `<button aria-label="${n} star${n > 1 ? 's' : ''}" aria-pressed="false" data-n="${n}" data-testid="shadow-star-${n}">★</button>`).join('')}</div>
        <p><span data-testid="shadow-rating-text">Not rated</span> <lab-chip>shadow-in-shadow</lab-chip></p>`;
      root.addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return;
        const n = +b.dataset.n;
        root.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(+x.dataset.n <= n)));
        root.querySelector('p > span').textContent = `You rated ${n}/5`;
        this.setAttribute('value', n);
      });
    }
  }
  class LabSecret extends HTMLElement {
    #root;

    constructor() {
      super();
      const root = this.#root = this.attachShadow({ mode: 'closed' });
      root.innerHTML = `<button style="font:inherit;padding:6px 10px;border-radius:8px;border:1px solid #ccc;cursor:pointer">Reveal secret</button> <span></span>`;
      root.querySelector('button').onclick = () => this.showSecret();
    }
    useExternalControl() {
      this.#root.querySelector('button').hidden = true;
    }

    showSecret() {
      this.#root.querySelector('span').textContent = 'The secret is 42';
      this.reveal();
    }

    reveal() { this.setAttribute('revealed', 'true'); }
  }
  customElements.define('lab-chip', LabChip);
  customElements.define('lab-rating', LabRating);
  customElements.define('lab-secret', LabSecret);
}

defineElements();

export default {
  id: 'shadow',
  title: 'Shadow DOM',
  tag: 'locators pierce open roots',
  level: 3,
  task: "Rate the store and reveal the closed shadow secret. Verify the rating text and revealed state.",
  body: `<p class="small muted">Open shadow root (with a nested one inside):</p><lab-rating data-testid="shadow-host"></lab-rating><p class="small muted" style="margin-top:12px">Closed shadow root (locators can't reach inside — test it through its public API instead):</p><lab-secret data-testid="closed-shadow-host"></lab-secret>`,
  mount(el, { challenge }) {
    if (!challenge) return;
    const host = $('lab-secret', el);
    host.useExternalControl();
    const reveal = document.createElement('button');
    reveal.className = 'btn secondary sm';
    reveal.textContent = 'Reveal closed shadow secret';
    reveal.addEventListener('click', () => host.showSecret());
    host.before(reveal);
  },
};
