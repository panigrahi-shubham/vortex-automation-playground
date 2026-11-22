const isoDate = (year, month, day) => new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
const monthName = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric', timeZone: 'UTC' });

export default {
  id: 'date-picker',
  title: 'Date range picker',
  tag: 'getByRole() · toHaveText()',
  level: 2,
  task: 'Pick a start date in November and an end date in December. Verify the displayed range.',
  body: `<button type="button" class="btn secondary sm" aria-expanded="false" aria-controls="vortex-date-popup" data-testid="vortex-date-open">Choose dates</button>
    <div id="vortex-date-popup" class="vortex-calendar" role="group" aria-label="Calendar" hidden>
      <div class="spread"><button type="button" class="btn link sm" aria-label="Previous month" data-month="-1">‹</button>
      <strong data-testid="vortex-date-month" aria-live="polite"></strong>
      <button type="button" class="btn link sm" aria-label="Next month" data-month="1">›</button></div>
      <div class="vortex-calendar-days"></div>
    </div>
    <p role="status" data-testid="vortex-date-range">No dates selected</p>`,
  mount(el) {
    let month = new Date(Date.UTC(2026, 10, 1));
    let dates = [];
    const trigger = el.querySelector('button');
    const popup = el.querySelector('#vortex-date-popup');
    const days = el.querySelector('.vortex-calendar-days');
    const summary = el.querySelector('[role=status]');
    function draw() {
      const year = month.getUTCFullYear();
      const index = month.getUTCMonth();
      const count = new Date(Date.UTC(year, index + 1, 0)).getUTCDate();
      el.querySelector('strong').textContent = monthName.format(month);
      const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      days.innerHTML = weekdays.map(day => `<span class="small muted">${day}</span>`).join('')
        + '<span aria-hidden="true"></span>'.repeat(month.getUTCDay())
        + Array.from({ length: count }, (_, i) => {
          const date = isoDate(year, index, i + 1);
          const selected = dates.length === 2 ? date >= dates[0] && date <= dates[1] : dates[0] === date;
          return `<button type="button" class="btn secondary sm" data-date="${date}" aria-label="${date}" aria-pressed="${selected}">${i + 1}</button>`;
        }).join('');
    }
    function open(value) {
      popup.hidden = !value;
      trigger.setAttribute('aria-expanded', String(value));
      if (!value) trigger.focus();
    }
    trigger.onclick = () => open(popup.hidden);
    el.onkeydown = event => {
      if (!popup.hidden && event.key === 'Escape') open(false);
    };
    popup.onclick = event => {
      const button = event.target.closest('button');
      if (button?.dataset.month) {
        month.setUTCMonth(month.getUTCMonth() + Number(button.dataset.month));
        draw();
      }
      if (!button?.dataset.date) return;
      const date = button.dataset.date;
      dates = dates.length === 1 ? [dates[0], date].sort() : [date];
      summary.textContent = dates.length === 2 ? dates.join(' to ') : `Start date: ${date}`;
      draw();
      if (dates.length === 2) open(false);
      else days.querySelector(`[data-date="${date}"]`).focus();
    };
    draw();
  },
};
