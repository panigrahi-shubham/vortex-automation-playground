import { $, esc, setTitle, store } from '../../core.js';
import cssScenarios from './css-scenarios.js';
import accordion from './accordion.js';
import tabs from './tabs.js';
import keyboard from './keyboard.js';
import dialogs from './dialogs.js';
import toasts from './toasts.js';
import { removeTestIds } from './support.js';

const exercises = [...cssScenarios.filter(card => card.steps), accordion, tabs, keyboard, dialogs, toasts];
const progressKey = id => 'vortex.marathon.level1.' + id;

export function renderMarathon(el, query, signal) {
  const completed = new Set(exercises.filter(card => store.get(progressKey(card.id)) === 'done').map(card => card.id));
  const challenge = query.get('challenge') === '1';
  const labUrl = '/lab' + (query.size ? '?' + query : '');
  setTitle('Level 1 Playwright marathon');
  el.innerHTML = `<div class="page-head qa-page-head"><div><h1>Level 1 Playwright marathon</h1>
    <p>Follow the steps in order. Finished exercises are saved in this browser.</p></div>
    <a class="btn secondary sm" href="${esc(labUrl)}">Back to UI Lab</a></div>
    <div class="qa-marathon-layout">
      <aside class="card qa-marathon-plan" aria-label="Exercise plan">
        <h2>Your exercises</h2><p class="qa-marathon-count"></p>
        <progress aria-label="Marathon progress" max="${exercises.length}"></progress>
        <ol>${exercises.map((card, index) => `<li><button type="button" data-index="${index}">
          <span class="qa-marathon-number" aria-hidden="true">${index + 1}</span>${esc(card.title)}<span class="qa-marathon-mark"></span>
          </button></li>`).join('')}</ol>
      </aside>
      <section class="card qa-marathon-work" aria-labelledby="qa-exercise-title"></section>
    </div>`;
  const work = $('.qa-marathon-work', el);
  const choices = [...el.querySelectorAll('.qa-marathon-plan button')];
  let attempt;

  function updatePlan(active) {
    $('progress', el).value = completed.size;
    $('.qa-marathon-count', el).textContent = `${completed.size} of ${exercises.length} complete`;
    for (const [index, button] of choices.entries()) {
      if (index === active) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
      const done = completed.has(exercises[index].id);
      $('.qa-marathon-mark', button).textContent = done ? '✓' : '';
      button.setAttribute('aria-label', exercises[index].title + (done ? ', completed' : ''));
    }
  }

  function show(index, focus) {
    attempt?.abort();
    updatePlan(index);
    if (index < 0) {
      work.innerHTML = `<h2 tabindex="-1" id="qa-exercise-title">Marathon complete</h2>
        <p>You finished all seven browser exercises. Choose any exercise to practise it again.</p>
        <a class="btn secondary" href="${esc(labUrl)}">Explore the UI Lab</a>`;
    } else {
      const card = exercises[index];
      attempt = new AbortController();
      let step = 0;
      work.innerHTML = `<p class="qa-marathon-count">Exercise ${index + 1} of ${exercises.length}</p>
        <h2 id="qa-exercise-title" tabindex="-1">${esc(card.title)}</h2>
        <ol class="qa-marathon-steps" aria-label="Exercise steps">${card.steps.map(([, label]) =>
          `<li>${esc(label)}</li>`).join('')}</ol>
        <div class="qa-marathon-sandbox"></div>
        <div class="qa-marathon-footer"><p role="status" class="small"></p>
          <div class="row"><button type="button" class="btn sm" data-next hidden></button>
          <button type="button" class="btn secondary sm" data-retry>Retry exercise</button></div></div>`;
      const steps = [...work.querySelectorAll('.qa-marathon-steps li')];
      const feedback = $('.qa-marathon-footer [role=status]', work);
      const next = $('[data-next]', work);
      steps[0].setAttribute('aria-current', 'step');
      const sandbox = $('.qa-marathon-sandbox', work);
      sandbox.innerHTML = card.body;
      card.mount(sandbox, {
        signal: AbortSignal.any([signal, attempt.signal]),
        checkpoint(key) {
          if (card.steps[step]?.[0] !== key) return;
          steps[step].removeAttribute('aria-current');
          steps[step].classList.add('qa-step-done');
          step++;
          if (step < steps.length) {
            steps[step].setAttribute('aria-current', 'step');
            feedback.textContent = `Step ${step} complete. Next: ${card.steps[step][1]}`;
            return;
          }
          completed.add(card.id);
          store.set(progressKey(card.id), 'done');
          updatePlan(index);
          feedback.textContent = 'Exercise complete.';
          next.textContent = completed.size === exercises.length ? 'View results' : 'Next exercise';
          next.hidden = false;
        },
      });
      if (challenge) removeTestIds(sandbox);
      $('[data-retry]', work).onclick = () => show(index, true);
      next.onclick = () => show(exercises.findIndex(item => !completed.has(item.id)), true);
    }
    if (focus) $('#qa-exercise-title', work).focus();
  }

  for (const [index, button] of choices.entries()) button.onclick = () => show(index, true);
  show(exercises.findIndex(card => !completed.has(card.id)), false);
}
