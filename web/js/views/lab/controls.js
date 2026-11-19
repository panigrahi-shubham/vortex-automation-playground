import { $, $$ } from '../../core.js';

export default {
  id: 'controls',
  title: 'Form controls',
  tag: 'fill · check · selectOption · setInputFiles',
  level: 2,
  task: "Set the volume to 75, select Jamshedpur, and submit. Verify both values in the result.",
  body: `
      <div class="field"><label for="range">Volume: <output id="range-out" data-testid="range-value">30</output></label><input type="range" id="range" min="0" max="100" value="30" data-testid="range"></div>
      <div class="grid-2"><div class="field"><label for="date">Delivery date</label><input type="date" id="date" data-testid="date-input" min="2026-01-01" max="2027-12-31"></div>
      <div class="field"><label for="time">Time slot</label><input type="time" id="time" data-testid="time-input"></div></div>
      <div class="grid-2"><div class="field"><label for="color">Brand colour</label><input type="color" id="color" value="#0f766e" data-testid="color-input"></div>
      <div class="field"><label for="multi">Skills (multi-select)</label><select id="multi" multiple size="3" data-testid="multi-select"><option>Playwright</option><option>Selenium</option><option>Cypress</option><option>Postman</option><option>JMeter</option></select></div></div>
      <fieldset style="border:0;padding:0;margin:0 0 12px"><legend class="label">Experience</legend><div class="row">${['0-2 yrs', '3-5 yrs', '6+ yrs'].map((x, i) => `<label class="check"><input type="radio" name="exp" value="${x}" data-testid="exp-${i}"> ${x}</label>`).join('')}</div></fieldset>
      <fieldset style="border:0;padding:0;margin:0 0 12px"><legend class="label">Toppings (tri-state)</legend>
        <label class="check"><input type="checkbox" id="tp-all" data-testid="toppings-all"> All toppings</label>
        <div style="padding-left:24px">${['Cheese', 'Olives', 'Peppers'].map(t => `<label class="check"><input type="checkbox" class="tp" value="${t}" data-testid="topping-${t.toLowerCase()}"> ${t}</label>`).join('')}</div></fieldset>
      <div class="field combo"><label for="city" id="city-label">City (autocomplete)</label><input id="city" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="city-list" autocomplete="off" data-testid="city-combobox"><ul id="city-list" role="listbox" aria-labelledby="city-label" hidden data-testid="city-options"></ul></div>
      <div class="field"><span class="label" id="ce-label">Rich text (contenteditable)</span><div contenteditable="true" role="textbox" aria-multiline="true" aria-labelledby="ce-label" data-testid="rich-text" style="border:1px solid var(--line);border-radius:8px;padding:8px;min-height:44px"></div></div>
      <button class="btn sm" id="controls-submit" data-testid="controls-submit">Show values</button><pre class="out" data-testid="controls-result" id="controls-out" style="white-space:pre-wrap"></pre>`,
  mount(el) {
    const on = (selector, event, handler) => $(selector, el).addEventListener(event, handler);
    on('#range', 'input', e => ($('#range-out', el).textContent = e.target.value));
    const all = $('#tp-all', el), tps = $$('.tp', el);
    const syncTp = () => { const n = tps.filter(t => t.checked).length; all.checked = n === tps.length; all.indeterminate = n > 0 && n < tps.length; };
    all.addEventListener('change', () => { tps.forEach(t => (t.checked = all.checked)); syncTp(); });
    tps.forEach(t => t.addEventListener('change', syncTp));
    const CITIES = ['Hyderabad', 'Bengaluru', 'Chennai', 'Mumbai', 'Pune', 'Delhi', 'Kolkata', 'Jamshedpur', 'Ranchi', 'Ahmedabad', 'Austin', 'Boston', 'Chicago', 'London', 'Manchester', 'New York', 'San Francisco', 'Seattle'];
    const city = $('#city', el), cl = $('#city-list', el);
    let opts = [], sel = -1;
    const drawCities = () => {
      cl.hidden = !opts.length; city.setAttribute('aria-expanded', String(!!opts.length));
      cl.innerHTML = opts.map((c, i) => `<li role="option" id="city-${i}" aria-selected="${i === sel}">${c}</li>`).join('');
      sel > -1 ? city.setAttribute('aria-activedescendant', `city-${sel}`) : city.removeAttribute('aria-activedescendant');
    };
    const pick = c => { city.value = c; opts = []; sel = -1; drawCities(); };
    city.addEventListener('input', () => { const q = city.value.toLowerCase(); opts = q ? CITIES.filter(c => c.toLowerCase().includes(q)).slice(0, 6) : []; sel = -1; drawCities(); });
    city.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown' && opts.length) { sel = (sel + 1) % opts.length; drawCities(); e.preventDefault(); }
      if (e.key === 'ArrowUp' && opts.length) { sel = (sel - 1 + opts.length) % opts.length; drawCities(); e.preventDefault(); }
      if (e.key === 'Enter' && sel > -1) { pick(opts[sel]); e.preventDefault(); }
      if (e.key === 'Escape') { opts = []; drawCities(); }
    });
    cl.addEventListener('mousedown', e => { const li = e.target.closest('li'); if (li) { e.preventDefault(); pick(li.textContent); } });
    on('#controls-submit', 'click', () => {
      const v = {
        volume: +$('#range', el).value, date: $('#date', el).value, time: $('#time', el).value, color: $('#color', el).value,
        skills: [...$('#multi', el).selectedOptions].map(o => o.value), experience: ($('[name=exp]:checked', el) || {}).value || null,
        toppings: tps.filter(t => t.checked).map(t => t.value), city: city.value, richText: $('[contenteditable]', el).innerText.trim()
      };
      $('#controls-out', el).textContent = JSON.stringify(v, null, 1);
    });
  },
};
