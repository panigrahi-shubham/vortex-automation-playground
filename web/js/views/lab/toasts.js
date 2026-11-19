import { later } from './support.js';

export default {
  id: 'toasts',
  title: 'Auto dismiss toast',
  tag: 'toBeVisible() · toBeHidden()',
  level: 1,
  task: 'Show a toast. Verify it appears and dismisses itself after three seconds.',
  body: `<button type="button" class="btn secondary sm" data-testid="vortex-toast-trigger">Show toast</button>
    <div class="out" role="status" data-testid="vortex-toast-message" hidden>Practice item saved</div>`,
  mount(el, { signal }) {
    const message = el.querySelector('[role=status]');
    let timer;
    el.querySelector('button').onclick = () => {
      message.hidden = false;
      clearTimeout(timer);
      timer = later(signal, () => { message.hidden = true; }, 3000);
    };
  },
};
