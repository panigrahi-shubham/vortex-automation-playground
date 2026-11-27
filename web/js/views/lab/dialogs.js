import { $ } from '../../core.js';

export default {
  id: 'dialogs',
  title: 'Native dialogs',
  tag: "page.on('dialog')",
  level: 1,
  task: "Accept the alert, dismiss the confirmation, then submit your name. Verify the result after each dialog.",
  steps: [
    ['alert', 'Open the alert and accept it.'],
    ['cancel', 'Open the confirmation and choose Cancel.'],
    ['name', 'Open the prompt, enter Asha and accept.'],
  ],
  body: `<div class="row"><button class="btn secondary sm" id="d-alert" data-testid="btn-alert">Alert</button><button class="btn secondary sm" id="d-confirm" data-testid="btn-confirm">Confirm</button><button class="btn secondary sm" id="d-prompt" data-testid="btn-prompt">Prompt</button></div><div class="out" data-testid="dialog-result" id="d-out">No dialog yet</div>`,
  mount(el, { checkpoint }) {
    const output = $('#d-out', el);
    $('#d-alert', el).onclick = () => {
      alert('Hello from VORTEX!');
      output.textContent = 'Alert dismissed';
      checkpoint?.('alert');
    };
    $('#d-confirm', el).onclick = () => {
      const accepted = confirm('Delete all test data?');
      output.textContent = accepted ? 'Confirmed: OK' : 'Confirmed: Cancel';
      if (!accepted) checkpoint?.('cancel');
    };
    $('#d-prompt', el).onclick = () => {
      const name = prompt('What is your name?', 'Tester');
      output.textContent = name === null ? 'Prompt cancelled' : `Hello, ${name}!`;
      if (name === 'Asha') checkpoint?.('name');
    };
  },
};
