const names = ['Notebook', 'Headphones', 'Mug'];

export default {
  id: 'editable-table',
  title: 'Editable table',
  tag: 'getByRole() · check()',
  level: 2,
  task: 'Edit the Notebook quantity, select all rows, and archive the selected items.',
  body: `<div class="table-wrap"><table aria-label="Inventory">
    <thead><tr><th scope="col"><input type="checkbox" aria-label="Select all items" data-testid="vortex-inventory-all"></th><th scope="col">Item</th><th scope="col">Quantity</th></tr></thead>
    <tbody>${names.map((name, index) => `<tr data-testid="vortex-inventory-row"><td><input type="checkbox" aria-label="Select ${name}"></td><th scope="row">${name}</th><td><input type="number" aria-label="${name} quantity" min="0" max="999" value="${index + 1}"></td></tr>`).join('')}</tbody>
    </table></div><button type="button" class="btn secondary sm" data-testid="vortex-inventory-archive" disabled>Archive selected</button><p role="status">0 selected</p>`,
  mount(el) {
    const all = el.querySelector('thead input');
    const archive = el.querySelector('button');
    const status = el.querySelector('[role=status]');
    const rows = () => [...el.querySelectorAll('tbody input[type=checkbox]')];
    function refresh() {
      const checks = rows();
      const selected = checks.filter(input => input.checked).length;
      all.checked = selected > 0 && selected === checks.length;
      all.indeterminate = selected > 0 && selected < checks.length;
      all.disabled = checks.length === 0;
      archive.disabled = selected === 0;
      status.textContent = selected + ' selected';
    }
    el.onchange = event => {
      if (event.target === all) rows().forEach(input => { input.checked = all.checked; });
      if (event.target.type === 'checkbox') refresh();
    };
    archive.onclick = () => {
      const selected = rows().filter(input => input.checked);
      selected.forEach(input => input.closest('tr').remove());
      refresh();
      status.textContent = `Archived ${selected.length} items`;
    };
  },
};
