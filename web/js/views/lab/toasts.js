import { later } from './support.js';

export default {
  id: 'toasts',
  title: 'Auto dismiss toast',
  tag: 'toBeVisible() · toBeHidden()',
  level: 1,
  task: 'Show a toast. Verify it appears and dismisses itself after three seconds.',
  steps: [
    ['show', 'Show the saved-item toast.'],
    ['dismiss', 'Wait for the toast to dismiss itself.'],
  ],
  body: `<button type="button" class="btn secondary sm" data-testid="vortex-toast-trigger">Show toast</button>
    <div class="out" role="status" data-testid="vortex-toast-message" hidden>Practice item saved</div>`,
  mount(el, { signal, checkpoint }) {
    const message = el.querySelector('[role=status]');
    let timer;
    el.querySelector('button').onclick = () => {
      message.hidden = false;
      checkpoint?.('show');
      clearTimeout(timer);
      timer = later(signal, () => {
        message.hidden = true;
        checkpoint?.('dismiss');
      }, 3000);
    };
  },
};
