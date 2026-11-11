export default {
  id: 'accordion',
  title: 'Accordion',
  tag: 'getByRole() · toBeHidden()',
  level: 1,
  task: 'Open both answers in turn and verify that opening one closes the other.',
  body: `<div class="vortex-accordion">
    <h3><button type="button" class="btn secondary sm" aria-expanded="false" aria-controls="vortex-accordion-track" data-testid="vortex-accordion-track">How do I track an order?</button></h3>
    <p id="vortex-accordion-track" hidden>Use your order number to check its status.</p>
    <h3><button type="button" class="btn secondary sm" aria-expanded="false" aria-controls="vortex-accordion-return" data-testid="vortex-accordion-return">How do I return an item?</button></h3>
    <p id="vortex-accordion-return" hidden>Start a return from the order details.</p></div>`,
  mount(el) {
    const buttons = [...el.querySelectorAll('button')];
    for (const button of buttons) {
      button.onclick = () => {
        const open = button.getAttribute('aria-expanded') === 'false';
        for (const other of buttons) {
          const expanded = open && button === other;
          other.setAttribute('aria-expanded', String(expanded));
          el.querySelector('#' + other.getAttribute('aria-controls')).hidden = !expanded;
        }
      };
    }
  },
};
