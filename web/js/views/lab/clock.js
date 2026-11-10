import { $, toast } from '../../core.js';
import { repeat } from './support.js';

export default {
  id: 'clock',
  title: 'Time',
  tag: 'page.clock.install() · fastForward()',
  level: 3,
  task: "Start the timer and advance the clock by ten minutes. Verify the time is up.",
  body: `<p>Now: <strong class="mono" id="clock-now" data-testid="clock-now">--:--:--</strong></p><div class="row"><button class="btn secondary sm" id="timer" data-testid="start-timer">Start 10-minute timer</button><strong class="mono" id="timer-out" data-testid="timer-remaining">10:00</strong></div><div class="out" id="timer-status" data-testid="timer-status">Timer idle</div>`,
  mount(el, { signal }) {
    const on = (selector, event, handler) => $(selector, el).addEventListener(event, handler);
    const pad = x => String(x).padStart(2, '0');
    const tick = () => { const d = new Date(); $('#clock-now', el) && ($('#clock-now', el).textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`); };
    tick(); repeat(signal, tick, 1000);
    let endAt = null;
    on('#timer', 'click', e => { endAt = Date.now() + 10 * 60000; e.currentTarget.disabled = true; $('#timer-status', el).textContent = 'Timer running'; });
    repeat(signal, () => {
      if (!endAt) return;
      const s = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
      $('#timer-out', el).textContent = `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
      if (s === 0) { endAt = null; $('#timer-status', el).textContent = "Time's up!"; toast("Time's up!", 'info'); }
    }, 250);
  },
};
