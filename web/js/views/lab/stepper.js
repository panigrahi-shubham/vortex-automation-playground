export default {
  id: 'stepper',
  title: 'Multi-step form',
  tag: 'fill() · toBeDisabled()',
  level: 2,
  task: 'Enter a name, choose delivery, go back once, then verify the review shows both choices.',
  body: `<ol class="row" aria-label="Steps"><li aria-current="step">Details</li><li>Delivery</li><li>Review</li></ol>
    <div data-step="0"><label for="vortex-stepper-name">Recipient</label><input id="vortex-stepper-name" data-testid="vortex-stepper-name" autocomplete="off"></div>
    <div data-step="1" hidden><label for="vortex-stepper-delivery">Delivery method</label>
      <select id="vortex-stepper-delivery" data-testid="vortex-stepper-delivery"><option>Standard</option><option>Express</option></select></div>
    <p data-step="2" role="status" data-testid="vortex-stepper-review" hidden></p>
    <div class="row"><button type="button" class="btn secondary sm" data-back disabled>Back</button>
    <button type="button" class="btn sm" data-next disabled>Next</button></div>`,
  mount(el) {
    const name = el.querySelector('input');
    const delivery = el.querySelector('select');
    const sections = [...el.querySelectorAll('[data-step]')];
    const steps = [...el.querySelectorAll('li')];
    const back = el.querySelector('[data-back]');
    const next = el.querySelector('[data-next]');
    let step = 0;
    function draw() {
      sections.forEach((section, index) => {
        section.hidden = step !== index;
        if (step === index) steps[index].setAttribute('aria-current', 'step');
        else steps[index].removeAttribute('aria-current');
      });
      sections[2].textContent = `${name.value.trim()} · ${delivery.value}`;
      back.disabled = step === 0;
      next.disabled = step === 2 || !name.value.trim();
    }
    name.oninput = draw;
    back.onclick = () => { step--; draw(); };
    next.onclick = () => { step++; draw(); };
  },
};
