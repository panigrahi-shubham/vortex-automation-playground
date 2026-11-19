import { $ } from '../../core.js';
import { later, testId } from './support.js';

export default {
  id: 'infinite',
  title: 'Infinite scroll',
  tag: 'mouse.wheel() · scrollIntoViewIfNeeded()',
  level: 2,
  task: "Scroll through the list until all 100 items load. Verify the end message appears.",
  body: `<div class="scroll-box" id="inf-box" data-testid="infinite-list" tabindex="0" aria-label="Infinite list"><ul id="inf-list"></ul><div id="inf-sentinel" class="small muted" style="padding:8px;text-align:center" data-testid="infinite-loading">Loading more…</div></div><div class="out" data-testid="infinite-count" id="inf-count">Loaded 0 of 100</div>`,
  mount(el, { challenge, signal }) {
    const box = $('#inf-box', el), list = $('#inf-list', el), sentinel = $('#inf-sentinel', el);
    if (challenge) box.setAttribute('role', 'region');
    let loaded = 0, loading = false;
    const more = () => {
      if (signal.aborted || loading || loaded >= 100) return;
      loading = true;
      later(signal, () => {
        list.insertAdjacentHTML('beforeend', Array.from({ length: 20 }, (_, i) => `<li${testId(challenge, 'infinite-item')}>Item ${loaded + i + 1}</li>`).join(''));
        loaded += 20; loading = false;
        $('#inf-count', el).textContent = `Loaded ${loaded} of 100`;
        if (loaded >= 100) { sentinel.textContent = 'You reached the end 🎉'; if (!challenge) sentinel.dataset.testid = 'infinite-end'; io.disconnect(); }
      }, 400);
    };
    const io = new IntersectionObserver(es => es.forEach(x => x.isIntersecting && more()), { root: box });
    io.observe(sentinel);
    signal.addEventListener('abort', () => io.disconnect(), { once: true });
  },
};
