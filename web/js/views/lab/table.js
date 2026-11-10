import { $, $$ } from '../../core.js';
import { testId } from './support.js';

export default {
  id: 'table',
  title: 'Web table',
  tag: 'locator.filter() · nth()',
  level: 2,
  task: "Filter employees to QA, then clear the filter and sort by salary. Verify the row count and salary order.",
  body: `<input type="search" id="tbl-filter" placeholder="Filter employees…" aria-label="Filter employees" data-testid="table-filter" style="margin-bottom:8px"><div class="table-wrap"><table data-testid="employees-table"><thead><tr>${[['name', 'Name'], ['dept', 'Department'], ['city', 'City'], ['salary', 'Salary']].map(([k, l]) => `<th data-k="${k}" class="${k === 'salary' ? 'num' : ''}"><button class="sort">${l}</button></th>`).join('')}</tr></thead><tbody id="tbl-body"></tbody></table></div><div class="spread small" style="margin-top:8px"><button class="btn link sm" id="tbl-prev" data-testid="table-prev">‹ Prev</button><span id="tbl-info" data-testid="table-info"></span><button class="btn link sm" id="tbl-next" data-testid="table-next">Next ›</button></div>`,
  mount(el, { challenge }) {
    const on = (selector, event, handler) => $(selector, el).addEventListener(event, handler);
    const FIRST = ['Asha', 'Ravi', 'Meera', 'John', 'Priya', 'Arjun', 'Sara', 'Vikram', 'Neha', 'Tom', 'Divya', 'Kiran', 'Lena', 'Omar', 'Fatima', 'Raj', 'Anita', 'Chris', 'Pooja', 'Sam', 'Isha', 'Dev', 'Maya', 'Leo', 'Zara'];
    const DEPTS = ['QA', 'Dev', 'DevOps', 'Product', 'Support'], CITIES2 = ['Hyderabad', 'Pune', 'Ranchi', 'London', 'Austin'];
    const emps = FIRST.map((f, i) => ({ name: `${f} ${String.fromCharCode(65 + (i * 7) % 26)}.`, dept: DEPTS[i % 5], city: CITIES2[(i * 3) % 5], salary: 40000 + ((i * 7919) % 60) * 1000 }));
    let tf = '', ts = { k: 'name', d: 1 }, tp = 1;
    const drawTable = () => {
      const rows = emps.filter(e => !tf || Object.values(e).join(' ').toLowerCase().includes(tf)).sort((a, b) => (typeof a[ts.k] === 'number' ? a[ts.k] - b[ts.k] : a[ts.k].localeCompare(b[ts.k])) * ts.d);
      const pages = Math.max(1, Math.ceil(rows.length / 5)); tp = Math.min(tp, pages);
      $('#tbl-body', el).innerHTML = rows.slice((tp - 1) * 5, tp * 5).map(e => `<tr${testId(challenge, 'employee-row')}><td>${e.name}</td><td>${e.dept}</td><td>${e.city}</td><td class="num">$${e.salary.toLocaleString('en-US')}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">No matches</td></tr>';
      $('#tbl-info', el).textContent = `Page ${tp} of ${pages} · ${rows.length} rows`;
      $('#tbl-prev', el).disabled = tp <= 1; $('#tbl-next', el).disabled = tp >= pages;
      $$('[data-k]', el).forEach(th => th.setAttribute('aria-sort', th.dataset.k === ts.k ? (ts.d === 1 ? 'ascending' : 'descending') : 'none'));
    };
    $$('[data-k] button', el).forEach(b => b.addEventListener('click', () => { const k = b.parentElement.dataset.k; ts = { k, d: ts.k === k ? -ts.d : 1 }; drawTable(); }));
    on('#tbl-filter', 'input', e => { tf = e.target.value.toLowerCase(); tp = 1; drawTable(); });
    on('#tbl-prev', 'click', () => { tp--; drawTable(); });
    on('#tbl-next', 'click', () => { tp++; drawTable(); });
    drawTable();
  },
};
