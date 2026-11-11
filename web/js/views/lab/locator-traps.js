export default {
  id: 'locator-traps',
  title: 'Locator traps',
  tag: 'getByRole() · filter()',
  level: 2,
  task: 'Find the second Email field and remove the Mug. Scope each locator to its named section or row.',
  body: `<fieldset><legend>Billing contact</legend><label>Email <input type="email" data-testid="vortex-trap-billing"></label></fieldset>
    <fieldset><legend>Shipping contact</legend><label>Email <input type="email" data-testid="vortex-trap-shipping"></label></fieldset>
    <table aria-label="Practice cart"><thead><tr><th scope="col">Item</th><th scope="col">Action</th></tr></thead>
    <tbody><tr><th scope="row">Notebook</th><td><button type="button" class="btn link sm" data-testid="vortex-trap-notebook">Remove</button></td></tr>
    <tr><th scope="row">Mug</th><td><button type="button" class="btn link sm" data-testid="vortex-trap-mug">Remove</button></td></tr></tbody></table>
    <p role="status"></p>`,
  mount(el) {
    el.querySelector('tbody').onclick = event => {
      const button = event.target.closest('button');
      if (!button) return;
      const row = button.closest('tr');
      el.querySelector('[role=status]').textContent = 'Removed ' + row.querySelector('th').textContent;
      row.remove();
    };
  },
};
