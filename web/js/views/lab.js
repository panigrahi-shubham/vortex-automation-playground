import { $, esc, setTitle } from '../core.js';
import { levels, validLevel, levelOptions } from '../practice-levels.js';
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
import cssScenarios from './lab/css-scenarios.js';
import { removeTestIds } from './lab/support.js';

const cards = [...cssScenarios, dialogs, windows, frames, shadow, dnd, mouse, signature, controls, waits, infinite, files, keyboard, clipboard, geo, clock, network, dynamicIds, table, visual, a11y];

export async function render(el, { params = [], query = new URLSearchParams(), isCurrent = () => true } = {}) {
  const cardId = params[0];
  const selected = cards.filter(card => !cardId || card.id === cardId);
  if (cardId && !selected.length) {
    const { default: widgets } = await import('./lab/widgets.js');
    if (!isCurrent()) return;
    selected.push(...widgets.filter(card => card.id === cardId));
  }
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
  const filters = new URLSearchParams(query);
  const backLink = '/lab' + (filters.size ? `?${filters}` : '');
  el.innerHTML = `<div class="page-head qa-page-head"><div><h1>UI Lab</h1><p>Practice browser testing with procurement forms, shipment layouts and interactive components.</p></div>
    ${cardId ? `<a class="btn secondary sm" href="${esc(backLink)}">Back to all cards</a>` : '<a class="btn secondary sm" href="/docs">API practice →</a>'}</div>
    <div class="row qa-filters vortex-lab-options" role="group" aria-label="Lab options">
      ${cardId ? '' : `<label for="vortex-lab-difficulty">Difficulty</label>
      <select id="vortex-lab-difficulty">${levelOptions()}</select>
      <label class="check"><input type="checkbox" id="qa-css-only"> CSS examples only</label>`}
      <label class="check"><input type="checkbox" id="vortex-lab-challenge" ${challenge ? 'checked' : ''}> Challenge mode</label>
    </div>
    ${cardId ? '<div class="lab-grid qa-single"></div>' : Object.entries(levels).map(([level, { name, description }]) => `<section class="qa-level" data-level="${level}" aria-labelledby="qa-ui-level-${level}">
      <div class="qa-level-head"><h2 id="qa-ui-level-${level}">Level ${level} · ${name}</h2><p>${description}</p></div>
      <div class="lab-grid"></div></section>`).join('')}`;
  const difficulty = $('#vortex-lab-difficulty', el);
  const cssOnly = $('#qa-css-only', el);
  const sections = [];
  const levelSections = new Map([...el.querySelectorAll('.qa-level')].map(section => [section.dataset.level, section]));
  if (difficulty) difficulty.value = validLevel(query.get('level'));
  if (cssOnly) cssOnly.checked = query.get('topic') === 'css';
  const filter = () => {
    for (const { section, card } of sections) {
      section.hidden = Boolean(cssOnly?.checked && !card.selector);
    }
    for (const [level, section] of levelSections) section.hidden = Boolean(difficulty.value && level !== difficulty.value);
  };
  const rememberFilters = () => {
    const url = new URL(location.href);
    if (difficulty.value) url.searchParams.set('level', difficulty.value); else url.searchParams.delete('level');
    if (cssOnly.checked) url.searchParams.set('topic', 'css'); else url.searchParams.delete('topic');
    history.replaceState(history.state, '', url);
    for (const { section, card } of sections) {
      const link = $('.vortex-lab-actions a', section);
      if (link) link.href = `/lab/${card.id}${url.search}`;
    }
    filter();
  };
  function addCards(definitions) {
    for (const card of definitions) {
      const grid = cardId ? $('.lab-grid', el) : $('.lab-grid', levelSections.get(String(card.level)));
      const section = mountCard(grid, card, { challenge, standalone: Boolean(cardId), challengeQuery, signal: page.signal });
      sections.push({ section, card });
    }
    if (difficulty) rememberFilters();
  }
  if (difficulty) {
    difficulty.addEventListener('change', rememberFilters);
    cssOnly.addEventListener('change', rememberFilters);
  }
  addCards(selected);
  if (!cardId) {
    import('./lab/widgets.js').then(({ default: widgets }) => {
      if (!page.signal.aborted) addCards(widgets);
    }).catch(() => {
      if (!page.signal.aborted) el.insertAdjacentHTML('beforeend', '<p role="alert">The additional lab cards could not be loaded. Reload to try again.</p>');
    });
  }

  $('#vortex-lab-challenge', el).addEventListener('change', async event => {
    const url = new URL(location.href);
    if (event.target.checked) url.searchParams.set('challenge', '1');
    else url.searchParams.delete('challenge');
    history.replaceState(history.state, '', url);
    page.abort();
    await render(el, { params, query: url.searchParams, isCurrent });
    if (isCurrent()) $('#vortex-lab-challenge', el)?.focus({ preventScroll: true });
  });
}

function mountCard(grid, card, { challenge, standalone, challengeQuery, signal }) {
  const section = document.createElement('section');
  section.className = 'card';
  if (!challenge) section.dataset.testid = card.testId || `lab-${card.id}`;
  section.setAttribute('aria-labelledby', `h-${card.id}`);
  section.innerHTML = `<h2 id="h-${card.id}"><span class="vortex-lab-title">${card.title}</span>${challenge ? '' : `<span class="tag">${card.tag}</span>`}</h2>
    <p class="small muted"><strong>Level ${card.level} · ${levels[card.level].name}</strong> · ${esc(card.task)}</p>
    <div class="vortex-lab-body"></div>
    <div class="row vortex-lab-actions">
      ${standalone ? '' : `<a class="btn link sm" href="/lab/${card.id}${challengeQuery}">Open card</a>`}
      <button type="button" class="btn link sm">Reset</button>
    </div>`;
  if (!challenge && card.selector) section.insertAdjacentHTML('beforeend', `<details class="qa-selector"><summary>CSS locator example</summary><code>${esc(card.selector)}</code></details>`);
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

