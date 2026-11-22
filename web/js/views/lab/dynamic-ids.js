import { $ } from '../../core.js';

export default {
  id: 'dynamic-ids',
  title: 'Unstable IDs &amp; classes',
  tag: 'getByRole over CSS',
  level: 2,
  task: "Re-render the buttons, then click Edit by name. Verify Edit still works after its ID changes.",
  body: `<div class="row" id="dyn" data-testid="dynamic-buttons"></div><div class="spread" style="margin-top:8px"><div class="out" style="flex:1;margin:0" data-testid="dynamic-result" id="dyn-out">—</div><button class="btn link sm" id="dyn-rerender" data-testid="rerender">Re-render</button></div>`,
  mount(el) {
    const on = (selector, event, handler) => $(selector, el).addEventListener(event, handler);
    const rand = () => Math.random().toString(36).slice(2, 8);
    const dyn = () => {
      $('#dyn', el).innerHTML = ['Save', 'Edit', 'Delete'].map(l => `<button class="btn secondary sm c-${rand()}" id="btn-${rand()}">${l}</button>`).join('');
    };
    dyn();
    on('#dyn', 'click', e => { const b = e.target.closest('button'); if (b) $('#dyn-out', el).textContent = `Clicked ${b.textContent} (id was ${b.id})`; });
    on('#dyn-rerender', 'click', dyn);
  },
};
