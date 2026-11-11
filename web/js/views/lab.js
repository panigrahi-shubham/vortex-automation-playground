import { $, esc, setTitle } from '../core.js';
import dialogs from './lab/dialogs.js';
import windows from './lab/windows.js';
import frames from './lab/frames.js';
import shadow from './lab/shadow.js';
import dnd from './lab/dnd.js';
import mouse from './lab/mouse.js';
import signature from './lab/signature.js';
import controls from './lab/controls.js';
import waits from './lab/waits.js';
import infinite from './lab/infinite.js';
import files from './lab/files.js';
import keyboard from './lab/keyboard.js';
import clipboard from './lab/clipboard.js';
import geo from './lab/geo.js';
import clock from './lab/clock.js';
import network from './lab/network.js';
import dynamicIds from './lab/dynamic-ids.js';
import table from './lab/table.js';
import visual from './lab/visual.js';
import a11y from './lab/a11y.js';
import datePicker from './lab/date-picker.js';
import modal from './lab/modal.js';
import tabs from './lab/tabs.js';
import accordion from './lab/accordion.js';
import stepper from './lab/stepper.js';
import slider from './lab/slider.js';
import sortable from './lab/sortable.js';
import editableTable from './lab/editable-table.js';
import virtualList from './lab/virtual-list.js';
import toasts from './lab/toasts.js';
import otp from './lab/otp.js';
import storage from './lab/storage.js';
import crossOrigin from './lab/cross-origin.js';
import locatorTraps from './lab/locator-traps.js';
import race from './lab/race.js';
import rerender from './lab/rerender.js';
import animation from './lab/animation.js';
import { removeTestIds } from './lab/support.js';

const cards = [dialogs, windows, frames, shadow, dnd, mouse, signature, controls, waits, infinite, files, keyboard, clipboard, geo, clock, network, dynamicIds, table, visual, a11y];
const newCards = [datePicker, modal, tabs, accordion, stepper, slider, sortable, editableTable, virtualList, toasts, otp, storage, crossOrigin, locatorTraps, race, rerender, animation];
cards.push(...newCards.map(card => ({ ...card, testId: 'vortex-lab-' + card.id })));
const levels = { 1: 'Beginner', 2: 'Intermediate', 3: 'Advanced' };

export function render(el, { params = [], query = new URLSearchParams() } = {}) {
  const cardId = params[0];
  const selected = cards.filter(card => !cardId || card.id === cardId);
  if (!selected.length) {
    setTitle('Lab card not found');
    el.innerHTML = '<div class="empty" role="alert"><h1>Lab card not found</h1><a href="/lab">Back to UI Lab</a></div>';
    return;
  }

  const challenge = query.get('challenge') === '1';
  const challengeQuery = challenge ? '?challenge=1' : '';
  const page = new AbortController();
  const close = () => page.abort();
  for (const event of ['route', 'popstate']) {
    window.addEventListener(event, close, { once: true, signal: page.signal });
  }

  setTitle('UI Lab');
  el.innerHTML = `<div class="page-head"><div><h1>UI Lab</h1><p class="muted" style="margin:0">Every awkward thing a real app throws at your tests, in one place. Each card is independent.</p></div>
    ${cardId ? `<a class="btn secondary sm" href="/lab${challengeQuery}">Back to all cards</a>` : '<a class="btn secondary sm" href="/docs">API &amp; test data →</a>'}</div>
    <div class="row vortex-lab-options" role="group" aria-label="Lab options">
      ${cardId ? '' : `<label for="vortex-lab-difficulty">Difficulty</label>
      <select id="vortex-lab-difficulty"><option value="">All levels</option>${Object.entries(levels).map(([level, name]) => `<option value="${level}">${level} · ${name}</option>`).join('')}</select>`}
      <label class="check"><input type="checkbox" id="vortex-lab-challenge" ${challenge ? 'checked' : ''}> Challenge mode</label>
    </div>
    <div class="lab-grid"></div>`;
  const grid = $('.lab-grid', el);
  const sections = selected.map(card => mountCard(grid, card, { challenge, standalone: Boolean(cardId), challengeQuery, signal: page.signal }));

  const difficulty = $('#vortex-lab-difficulty', el);
  if (difficulty) {
    difficulty.value = levels[query.get('level')] ? query.get('level') : '';
    const filter = () => {
      sections.forEach((section, i) => {
        section.hidden = Boolean(difficulty.value && difficulty.value !== String(selected[i].level));
      });
    };
    filter();
    difficulty.addEventListener('change', filter);
  }

  $('#vortex-lab-challenge', el).addEventListener('change', event => {
    const url = new URL(location.href);
    if (event.target.checked) url.searchParams.set('challenge', '1');
    else url.searchParams.delete('challenge');
    if (difficulty?.value) url.searchParams.set('level', difficulty.value);
    else url.searchParams.delete('level');
    history.replaceState(history.state, '', url);
    page.abort();
    render(el, { params, query: url.searchParams });
    $('#vortex-lab-challenge', el).focus({ preventScroll: true });
  });
}

function mountCard(grid, card, { challenge, standalone, challengeQuery, signal }) {
  const section = document.createElement('section');
  section.className = 'card';
  if (!challenge) section.dataset.testid = card.testId || `lab-${card.id}`;
  section.setAttribute('aria-labelledby', `h-${card.id}`);
  section.innerHTML = `<h2 id="h-${card.id}"><span class="vortex-lab-title">${card.title}</span>${challenge ? '' : `<span class="tag">${card.tag}</span>`}</h2>
    <p class="small muted"><strong>Level ${card.level} · ${levels[card.level]}</strong> · ${esc(card.task)}</p>
    <div class="vortex-lab-body"></div>
    <div class="row vortex-lab-actions">
      ${standalone ? '' : `<a class="btn link sm" href="/lab/${card.id}${challengeQuery}">Open card</a>`}
      <button type="button" class="btn link sm">Reset</button>
    </div>`;
  grid.append(section);

  const body = $('.vortex-lab-body', section);
  const reset = $('.vortex-lab-actions button', section);
  const name = $('.vortex-lab-title', section).textContent;
  reset.setAttribute('aria-label', `Reset ${name}`);
  const open = $('.vortex-lab-actions a', section);
  if (open) open.setAttribute('aria-label', `Open ${name}`);

  let instance;
  function mount() {
    instance?.abort();
    instance = new AbortController();
    body.innerHTML = typeof card.body === 'function' ? card.body(challenge) : card.body;
    card.mount?.(body, { challenge, signal: AbortSignal.any([signal, instance.signal]) });
    if (challenge) removeTestIds(body);
  }
  reset.addEventListener('click', () => {
    card.reset?.();
    mount();
  });
  mount();
  return section;
}

