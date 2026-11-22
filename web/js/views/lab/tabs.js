export default {
  id: 'tabs',
  title: 'Tabs',
  tag: 'getByRole() · toHaveAttribute()',
  level: 1,
  task: 'Use the arrow keys to switch tabs. Verify that only the selected panel is visible.',
  body: `<div class="row" role="tablist" aria-label="Delivery details">
    <button type="button" class="btn secondary sm" role="tab" id="vortex-tab-delivery" aria-controls="vortex-panel-delivery" aria-selected="true" data-testid="vortex-tab-delivery">Delivery</button>
    <button type="button" class="btn secondary sm" role="tab" id="vortex-tab-returns" aria-controls="vortex-panel-returns" aria-selected="false" tabindex="-1" data-testid="vortex-tab-returns">Returns</button></div>
    <p id="vortex-panel-delivery" role="tabpanel" aria-labelledby="vortex-tab-delivery" tabindex="0">Standard delivery takes three days.</p>
    <p id="vortex-panel-returns" role="tabpanel" aria-labelledby="vortex-tab-returns" tabindex="0" hidden>Returns are accepted within 30 days.</p>`,
  mount(el) {
    const tabs = [...el.querySelectorAll('[role=tab]')];
    function select(current) {
      for (const tab of tabs) {
        const selected = tab === current;
        tab.setAttribute('aria-selected', String(selected));
        tab.tabIndex = selected ? 0 : -1;
        el.querySelector('#' + tab.getAttribute('aria-controls')).hidden = !selected;
      }
      current.focus();
    }
    for (const [index, tab] of tabs.entries()) {
      tab.onclick = () => select(tab);
      tab.onkeydown = event => {
        const target = {
          ArrowLeft: tabs[(index + tabs.length - 1) % tabs.length],
          ArrowRight: tabs[(index + 1) % tabs.length],
          Home: tabs[0],
          End: tabs.at(-1),
        }[event.key];
        if (!target) return;
        event.preventDefault();
        select(target);
      };
    }
  },
};
