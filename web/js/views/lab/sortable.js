export default {
  id: 'sortable',
  title: 'Sortable list',
  tag: 'dragTo() · toHaveText()',
  level: 2,
  task: 'Move Shipping ahead of Inventory. Verify the list order changed.',
  body: `<ol class="vortex-sortable" aria-label="Fulfillment tasks">
    <li><button type="button" class="btn secondary sm" draggable="true" data-testid="vortex-sort-inventory">Inventory</button></li>
    <li><button type="button" class="btn secondary sm" draggable="true" data-testid="vortex-sort-packing">Packing</button></li>
    <li><button type="button" class="btn secondary sm" draggable="true" data-testid="vortex-sort-shipping">Shipping</button></li>
    </ol><p class="small muted">Drag tasks or focus a task and press an arrow key.</p><p role="status"></p>`,
  mount(el) {
    const list = el.querySelector('ol');
    const status = el.querySelector('[role=status]');
    let dragged;
    function move(row, target) {
      if (!target || target === row) return;
      const rows = [...list.children];
      if (rows.indexOf(target) < rows.indexOf(row)) target.before(row);
      else target.after(row);
      status.textContent = `${row.textContent.trim()} moved to position ${[...list.children].indexOf(row) + 1}`;
    }
    list.ondragstart = event => {
      dragged = event.target.closest('li');
      event.dataTransfer.setData('text/plain', dragged.textContent.trim());
    };
    list.ondragover = event => event.preventDefault();
    list.ondrop = event => {
      event.preventDefault();
      if (dragged) move(dragged, event.target.closest('li'));
      dragged = undefined;
    };
    list.ondragend = () => { dragged = undefined; };
    list.onkeydown = event => {
      const row = event.target.closest('li');
      const target = event.key === 'ArrowUp' ? row.previousElementSibling : event.key === 'ArrowDown' ? row.nextElementSibling : null;
      if (!target) return;
      event.preventDefault();
      move(row, target);
      row.querySelector('button').focus();
    };
  },
};
