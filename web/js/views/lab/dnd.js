import { $, $$ } from '../../core.js';

export default {
  id: 'dnd',
  title: 'Drag and drop',
  tag: 'locator.dragTo()',
  level: 2,
  task: "Move all three To do tasks to Done. Verify To do shows 0 and Done shows 3.",
  body: `<div class="kanban" data-testid="kanban">${[['todo', 'To do', ['Write test plan', 'Automate login', 'Fix flaky test']], ['doing', 'Doing', ['Review PR']], ['done', 'Done', []]].map(([id, t, items]) => `<div class="col" data-col="${id}" data-testid="col-${id}" aria-label="${t}"><h3>${t} (<span data-count>${items.length}</span>)</h3>${items.map(i => `<div class="item" draggable="true" data-testid="task" id="task-${i.replace(/\W+/g, '-').toLowerCase()}">${i}</div>`).join('')}</div>`).join('')}</div><div class="out" data-testid="dnd-result" id="dnd-out">Drag a task to another column</div>`,
  mount(el, { challenge }) {
    const columns = $$('.kanban .col', el);
    let dragging = null;
    const move = (task, column) => {
      column.append(task);
      columns.forEach(c => ($('[data-count]', c).textContent = $$('.item', c).length));
      $('#dnd-out', el).textContent = `Moved “${task.textContent}” to ${column.getAttribute('aria-label')}`;
    };
    for (const task of $$('[draggable=true]', el)) {
      task.addEventListener('dragstart', e => {
        dragging = task;
        e.dataTransfer.setData('text/plain', task.id);
        e.dataTransfer.effectAllowed = 'move';
      });
      task.addEventListener('dragend', () => { dragging = null; });
      if (challenge) {
        task.tabIndex = 0;
        task.setAttribute('role', 'button');
        task.addEventListener('keydown', e => {
          const direction = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
          if (!direction) return;
          e.preventDefault();
          const next = columns[columns.indexOf(task.parentElement) + direction];
          if (next) { move(task, next); task.focus(); }
        });
      }
    }
    columns.forEach(col => {
      if (challenge) col.setAttribute('role', 'group');
      col.addEventListener('dragover', e => { e.preventDefault(); col.classList.add('over'); });
      col.addEventListener('dragleave', () => col.classList.remove('over'));
      col.addEventListener('drop', e => {
        e.preventDefault(); col.classList.remove('over');
        const t = dragging || document.getElementById(e.dataTransfer.getData('text/plain'));
        if (!t) return;
        move(t, col);
        dragging = null;
      });
    });
  },
};
