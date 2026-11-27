export default {
  id: 'accordion',
  title: 'Accordion',
  tag: 'getByRole() · toBeHidden()',
  level: 1,
  task: 'Open both answers in turn and verify that opening one closes the other.',
  steps: [
    ['track', 'Open the answer about tracking an order.'],
    ['return', 'Open the answer about returns to close the tracking answer.'],
  ],
  body: `<div class="vortex-accordion">
    <h3><button type="button" class="btn secondary sm" aria-expanded="false" aria-controls="vortex-accordion-track" data-testid="vortex-accordion-track">How do I track an order?</button></h3>
    <p id="vortex-accordion-track" hidden>Use your order number to check its status.</p>
    <h3><button type="button" class="btn secondary sm" aria-expanded="false" aria-controls="vortex-accordion-return" data-testid="vortex-accordion-return">How do I return an item?</button></h3>
    <p id="vortex-accordion-return" hidden>Start a return from the order details.</p></div>`,
  mount(el, { checkpoint }) {
    const buttons = [...el.querySelectorAll('button')];
    for (const button of buttons) {
      button.onclick = () => {
        const open = button.getAttribute('aria-expanded') === 'false';
        const wasTracking = buttons[0].getAttribute('aria-expanded') === 'true';
        for (const other of buttons) {
          const expanded = open && button === other;
          other.setAttribute('aria-expanded', String(expanded));
          el.querySelector('#' + other.getAttribute('aria-controls')).hidden = !expanded;
        }
        if (open && button === buttons[0]) checkpoint?.('track');
        if (open && wasTracking && button === buttons[1]) checkpoint?.('return');
      };
    }
  },
};
