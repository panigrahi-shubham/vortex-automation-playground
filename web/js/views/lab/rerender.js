import { later, testId } from './support.js';

export default {
  id: 'rerender',
  title: 'Element replacement',
  tag: 'locator() · toHaveText()',
  level: 3,
  task: 'Reveal the action with replacement enabled. The button is recreated after it appears. Locate it by name and click the replacement.',
  body: `<label class="check"><input type="checkbox" data-testid="vortex-rerender-toggle"> Replace the visible button</label>
    <button type="button" class="btn secondary sm" data-testid="vortex-rerender-show">Reveal action</button>
    <div class="vortex-rerender-action"></div><p role="status">Ready</p>`,
  mount(el, { challenge, signal }) {
    const toggle = el.querySelector('input');
    const trigger = el.querySelector('button');
    const host = el.querySelector('.vortex-rerender-action');
    const status = el.querySelector('[role=status]');
    let timer;
    function draw(version) {
      host.innerHTML = `<button type="button" class="btn sm"${testId(challenge, 'vortex-rerender-action')}>Save item</button>`;
      host.querySelector('button').onclick = () => { status.textContent = 'Saved using ' + version; };
    }
    trigger.onclick = () => {
      clearTimeout(timer);
      draw('the original button');
      status.textContent = 'Original button visible';
      if (toggle.checked) timer = later(signal, () => {
        draw('the replacement button');
        status.textContent = 'Replacement button visible';
      }, 400);
    };
  },
};
