export default {
  id: 'animation',
  title: 'Moving button',
  tag: 'toBeVisible() · click()',
  level: 3,
  task: 'Enable movement and start the round. The button moves for one second. Click it and verify the result.',
  body: `<label class="check"><input type="checkbox" data-testid="vortex-animation-toggle"> Move the target</label>
    <button type="button" class="btn secondary sm" data-testid="vortex-animation-start">Start round</button>
    <div class="vortex-animation-track"><button type="button" class="btn sm" data-testid="vortex-animation-target" hidden>Catch me</button></div>
    <p role="status">Ready</p>`,
  mount(el) {
    const toggle = el.querySelector('input');
    const [start, target] = el.querySelectorAll('button');
    const status = el.querySelector('[role=status]');
    start.onclick = () => {
      target.hidden = false;
      target.classList.remove('vortex-target-moving');
      if (toggle.checked) {
        void target.offsetWidth;
        target.classList.add('vortex-target-moving');
      }
      status.textContent = toggle.checked ? 'Target is moving' : 'Target is still';
    };
    target.onanimationend = () => {
      if (status.textContent === 'Target is moving') status.textContent = 'Target stopped';
    };
    target.onclick = () => { status.textContent = 'Target clicked'; };
  },
};
