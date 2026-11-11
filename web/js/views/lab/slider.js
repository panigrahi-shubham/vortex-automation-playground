export default {
  id: 'slider',
  title: 'Custom slider',
  tag: 'mouse.move() · toHaveAttribute()',
  level: 2,
  task: 'Drag the slider toward 75 and verify that the visible value and accessible value agree.',
  body: `<div class="vortex-slider" role="slider" tabindex="0" aria-label="Discount" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" data-testid="vortex-slider">
    <span class="vortex-slider-thumb" aria-hidden="true"></span></div><p role="status">0%</p>`,
  mount(el) {
    const slider = el.querySelector('[role=slider]');
    const thumb = slider.firstElementChild;
    const valueLabel = el.querySelector('[role=status]');
    let value = 0;
    function set(next) {
      value = Math.min(100, Math.max(0, Math.round(next)));
      thumb.style.left = value + '%';
      slider.setAttribute('aria-valuenow', String(value));
      valueLabel.textContent = value + '%';
    }
    function move(event) {
      const { left, width } = slider.getBoundingClientRect();
      set((event.clientX - left) * 100 / width);
    }
    slider.onpointerdown = event => {
      slider.setPointerCapture(event.pointerId);
      slider.focus();
      move(event);
    };
    slider.onpointermove = event => {
      if (slider.hasPointerCapture(event.pointerId)) move(event);
    };
    slider.onkeydown = event => {
      const target = { ArrowRight: value + 1, ArrowUp: value + 1, ArrowLeft: value - 1, ArrowDown: value - 1, Home: 0, End: 100 }[event.key];
      if (target === undefined) return;
      event.preventDefault();
      set(target);
    };
  },
};
