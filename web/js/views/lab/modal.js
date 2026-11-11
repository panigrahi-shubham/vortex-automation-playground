export default {
  id: 'modal',
  title: 'Modal overlay',
  tag: 'getByRole() · press()',
  level: 2,
  task: 'Open the dialog, cycle through its controls, then dismiss it with Escape and by clicking the backdrop.',
  body: `<button type="button" class="btn secondary sm" data-testid="vortex-modal-open">Open confirmation</button>
    <dialog class="vortex-lab-dialog card" aria-labelledby="vortex-modal-heading" data-testid="vortex-modal">
      <h3 id="vortex-modal-heading">Confirm change</h3>
      <p>Save this practice change?</p>
      <div class="row"><button type="button" class="btn secondary sm" autofocus>Cancel</button>
      <button type="button" class="btn sm">Confirm</button></div>
    </dialog><p role="status">Waiting for a choice</p>`,
  mount(el, { signal }) {
    const trigger = el.querySelector('button');
    const dialog = el.querySelector('dialog');
    const status = el.querySelector('[role=status]');
    const [cancel, confirm] = dialog.querySelectorAll('button');
    trigger.onclick = () => dialog.showModal();
    cancel.onclick = () => dialog.close('Cancelled');
    confirm.onclick = () => dialog.close('Confirmed');
    dialog.oncancel = event => {
      event.preventDefault();
      dialog.close('Dismissed');
    };
    dialog.onclick = event => {
      if (event.target !== dialog) return;
      const box = dialog.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) {
        dialog.close('Dismissed');
      }
    };
    dialog.onkeydown = event => {
      if (event.key !== 'Tab') return;
      if (event.shiftKey && document.activeElement === cancel) {
        event.preventDefault();
        confirm.focus();
      } else if (!event.shiftKey && document.activeElement === confirm) {
        event.preventDefault();
        cancel.focus();
      }
    };
    dialog.onclose = () => {
      if (signal.aborted) return;
      status.textContent = dialog.returnValue;
      trigger.focus();
    };
  },
};
