import { $ } from '../../core.js';

export default {
  id: 'visual',
  title: 'Visual snapshot target',
  tag: 'expect(locator).toHaveScreenshot()',
  level: 3,
  task: "Take a baseline screenshot, then enable the two pixel shift. Verify the image differs from the baseline.",
  body: `<div id="vis" data-testid="visual-target" style="border:1px solid var(--line);border-radius:10px;padding:16px;background:var(--surface-2)"><strong>Order #1042</strong><p class="small muted" style="margin:4px 0 10px">3 items · Express delivery</p><div class="spread"><span class="badge ok">Delivered</span><span class="price">$128.40</span></div></div><label class="check" style="margin-top:10px"><input type="checkbox" id="vis-break" data-testid="visual-break"> Introduce a 2px layout shift (makes the snapshot fail)</label>`,
  mount(el) {
    const on = (selector, event, handler) => $(selector, el).addEventListener(event, handler);
    on('#vis-break', 'change', e => ($('#vis', el).style.marginLeft = e.target.checked ? '2px' : ''));
  },
};
