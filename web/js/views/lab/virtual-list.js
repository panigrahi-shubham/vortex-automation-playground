const total = 500;
const rowHeight = 32;

export default {
  id: 'virtual-list',
  title: 'Virtualized list',
  tag: 'scrollIntoView() · toHaveCount()',
  level: 3,
  task: 'Scroll to later results. Verify that visible rows replace the earlier rows in the DOM.',
  body: `<div class="vortex-virtual-list" tabindex="0" role="region" aria-label="Virtual results" data-testid="vortex-virtual-list">
    <div class="vortex-virtual-spacer"><ul aria-label="Visible results"></ul></div></div>
    <p role="status" data-testid="vortex-virtual-range"></p>`,
  mount(el, { signal }) {
    const viewport = el.querySelector('[role=region]');
    const spacer = viewport.firstElementChild;
    const list = spacer.firstElementChild;
    const status = el.querySelector('[role=status]');
    spacer.style.height = total * rowHeight + 'px';
    function draw() {
      const start = Math.floor(viewport.scrollTop / rowHeight);
      const end = Math.min(total, Math.ceil((viewport.scrollTop + viewport.clientHeight) / rowHeight));
      list.style.top = start * rowHeight + 'px';
      list.innerHTML = Array.from({ length: end - start }, (_, index) => {
        const row = start + index + 1;
        return `<li aria-posinset="${row}" aria-setsize="${total}">Result ${row}</li>`;
      }).join('');
      status.textContent = `Showing ${start + 1}–${end} of ${total}`;
    }
    viewport.onscroll = draw;
    const observer = new ResizeObserver(draw);
    observer.observe(viewport);
    signal.addEventListener('abort', () => observer.disconnect(), { once: true });
    draw();
  },
};
