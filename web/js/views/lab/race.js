import { later } from './support.js';

export default {
  id: 'race',
  title: 'Request race',
  tag: 'waitForResponse() · toHaveText()',
  level: 3,
  task: 'Run the requests with instability off and then on. The older request is slower and can overwrite the latest result.',
  body: `<label class="check"><input type="checkbox" data-testid="vortex-race-toggle"> Allow stale responses</label>
    <button type="button" class="btn secondary sm" data-testid="vortex-race-run">Run two requests</button><p role="status">Ready</p>`,
  mount(el, { signal }) {
    const toggle = el.querySelector('input');
    const run = el.querySelector('button');
    const status = el.querySelector('[role=status]');
    run.onclick = () => {
      run.disabled = true;
      toggle.disabled = true;
      const unstable = toggle.checked;
      let remaining = 2;
      status.textContent = 'Loading';
      function finish() {
        if (--remaining > 0) return;
        run.disabled = false;
        toggle.disabled = false;
      }
      for (const [id, name, delay] of [['older', 'Older request', 650], ['latest', 'Latest request', 0]]) {
        fetch('/api/health?vortex-race=' + id, { signal, cache: 'no-store' })
          .then(response => {
            if (!response.ok) throw new Error('Request failed');
            if (signal.aborted) return;
            later(signal, () => {
              if (id === 'latest' || unstable) status.textContent = name;
              finish();
            }, delay);
          })
          .catch(() => {
            if (signal.aborted) return;
            status.textContent = 'Request failed';
            finish();
          });
      }
    };
  },
};
