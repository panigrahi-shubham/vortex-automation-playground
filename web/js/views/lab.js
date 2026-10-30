import { $, $$, api, esc, setTitle, toast } from '../core.js';

/* One card per tricky automation topic. The small grey tag names the Playwright API it practises. */
const card = (id, title, tag, body) => `<section class="card" data-testid="lab-${id}" aria-labelledby="h-${id}"><h2 id="h-${id}">${title}<span class="tag">${tag}</span></h2>${body}</section>`;
const rand = () => Math.random().toString(36).slice(2, 8);

defineElements();

export function render(el) {
  setTitle('UI Lab');
  el.innerHTML = `<div class="page-head"><div><h1>UI Lab</h1><p class="muted" style="margin:0">Every awkward thing a real app throws at your tests, in one place. Each card is independent.</p></div>
    <a class="btn secondary sm" href="/docs">API &amp; test data →</a></div>
    <div class="lab-grid">
    ${card('dialogs', 'Native dialogs', "page.on('dialog')", `<div class="row"><button class="btn secondary sm" id="d-alert" data-testid="btn-alert">Alert</button><button class="btn secondary sm" id="d-confirm" data-testid="btn-confirm">Confirm</button><button class="btn secondary sm" id="d-prompt" data-testid="btn-prompt">Prompt</button></div><div class="out" data-testid="dialog-result" id="d-out">No dialog yet</div>`)}
    ${card('windows', 'Tabs &amp; popups', "context.waitForEvent('page')", `<div class="row"><a class="btn secondary sm" href="/terms" target="_blank" rel="noopener" data-testid="open-new-tab">Open terms in new tab</a><button class="btn secondary sm" id="w-popup" data-testid="open-popup">Open popup window</button></div><div class="out" data-testid="popup-message" id="w-out">Waiting for a message from the popup…</div>`)}
    ${card('frames', 'Nested iframes', 'frameLocator()', `<iframe src="/lab/frame-outer" title="Outer frame" data-testid="outer-frame" style="width:100%;height:240px;border:1px solid var(--line);border-radius:8px"></iframe>`)}
    ${card('shadow', 'Shadow DOM', 'locators pierce open roots', `<p class="small muted">Open shadow root (with a nested one inside):</p><lab-rating data-testid="shadow-host"></lab-rating><p class="small muted" style="margin-top:12px">Closed shadow root (locators can't reach inside — test it through its public API instead):</p><lab-secret data-testid="closed-shadow-host"></lab-secret>`)}
    ${card('dnd', 'Drag and drop', 'locator.dragTo()', `<div class="kanban" data-testid="kanban">${[['todo', 'To do', ['Write test plan', 'Automate login', 'Fix flaky test']], ['doing', 'Doing', ['Review PR']], ['done', 'Done', []]].map(([id, t, items]) => `<div class="col" data-col="${id}" data-testid="col-${id}" aria-label="${t}"><h3>${t} (<span data-count>${items.length}</span>)</h3>${items.map(i => `<div class="item" draggable="true" data-testid="task" id="task-${i.replace(/\W+/g, '-').toLowerCase()}">${i}</div>`).join('')}</div>`).join('')}</div><div class="out" data-testid="dnd-result" id="dnd-out">Drag a task to another column</div>`)}
    ${card('mouse', 'Mouse: hover, double &amp; right click', 'hover() · dblclick() · click({button})', `<div class="row" style="margin-bottom:10px">
        <div class="hover-box"><button class="btn secondary sm" data-testid="hover-trigger" aria-haspopup="true">Hover me ▾</button><div class="menu" role="menu" data-testid="hover-menu"><button role="menuitem" data-hm="Profile">Profile</button><button role="menuitem" data-hm="Settings">Settings</button></div></div>
        <span class="tooltip-wrap"><button class="btn secondary sm" data-testid="tooltip-trigger" aria-describedby="tt">ⓘ Info</button><span class="tooltip" role="tooltip" id="tt" data-testid="tooltip">Tooltips only exist on hover</span></span></div>
      <p class="small" style="margin:0 0 6px">Double-click to edit: <span id="dbl" data-testid="dblclick-target" style="border-bottom:1px dashed var(--muted);cursor:text">VORTEX rocks</span></p>
      <div id="ctx-area" data-testid="context-area" class="dropzone" style="padding:12px">Right-click here</div>
      <div class="out" data-testid="mouse-result" id="m-out">—</div>`)}
    ${card('signature', 'Canvas signature', 'mouse.move() · mouse.down()', `<canvas class="sign" id="sig" width="600" height="140" data-testid="signature-pad" aria-label="Signature pad"></canvas><div class="spread" style="margin-top:6px"><span class="small" data-testid="signature-status" id="sig-status">Not signed</span><button class="btn link sm" id="sig-clear" data-testid="signature-clear">Clear</button></div>`)}
    ${card('controls', 'Form controls', 'fill · check · selectOption · setInputFiles', `
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
      <button class="btn sm" id="controls-submit" data-testid="controls-submit">Show values</button><pre class="out" data-testid="controls-result" id="controls-out" style="white-space:pre-wrap"></pre>`)}
    ${card('waits', 'Waiting &amp; dynamic content', 'auto-waiting · toBeVisible · toBeHidden', `
      <div class="row" style="margin-bottom:8px"><button class="btn secondary sm" id="w-load" data-testid="load-data">Load data (1–3 s)</button><span id="w-spin" hidden data-testid="wait-spinner" class="spinner" role="status" aria-label="Loading data"></span><span id="w-res" data-testid="wait-result"></span></div>
      <div class="row" style="margin-bottom:8px"><button class="btn secondary sm" id="w-enable" data-testid="delayed-button" disabled>Enabled in <span>5</span> s</button><span id="w-enabled-out" data-testid="delayed-result"></span></div>
      <div class="row" style="margin-bottom:8px"><button class="btn secondary sm" id="w-flash" data-testid="show-temp">Show temporary message</button><span id="w-temp" class="badge info" hidden data-testid="temp-message">I vanish in 3 seconds</span></div>
      <div class="row"><button class="btn secondary sm" id="w-prog" data-testid="start-progress">Start upload</button><div class="progress" style="flex:1" role="progressbar" aria-label="Upload progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" data-testid="progress"><div></div></div><span id="w-prog-out" data-testid="progress-text">0%</span></div>`)}
    ${card('infinite', 'Infinite scroll', 'mouse.wheel() · scrollIntoViewIfNeeded()', `<div class="scroll-box" id="inf-box" data-testid="infinite-list" tabindex="0" aria-label="Infinite list"><ul id="inf-list"></ul><div id="inf-sentinel" class="small muted" style="padding:8px;text-align:center" data-testid="infinite-loading">Loading more…</div></div><div class="out" data-testid="infinite-count" id="inf-count">Loaded 0 of 100</div>`)}
    ${card('files', 'Upload &amp; download', 'setInputFiles · waitForEvent(\'download\')', `
      <div class="field"><label for="files">Choose files (multiple)</label><input type="file" id="files" multiple data-testid="file-input"></div>
      <div class="dropzone" id="file-drop" data-testid="file-dropzone">…or drop files here</div>
      <ul class="small" id="file-list" data-testid="file-list" style="margin:8px 0"></ul>
      <div class="row"><button class="btn secondary sm" id="dl-csv" data-testid="download-csv">⬇ products.csv</button><button class="btn secondary sm" id="dl-json" data-testid="download-json">⬇ report.json</button></div>`)}
    ${card('keyboard', 'Keyboard', 'keyboard.press() · press(\'Control+K\')', `<div class="field"><label for="keys">Press any key combination here</label><input id="keys" data-testid="key-input" placeholder="Try Shift+Tab, Control+A, ArrowDown…"></div><div class="out" data-testid="key-result" id="key-out">—</div><p class="small muted" style="margin:8px 0 0">Global shortcut: <kbd>Ctrl</kbd>+<kbd>K</kbd> opens the search palette anywhere.</p>`)}
    ${card('clipboard', 'Clipboard', "grantPermissions(['clipboard-read','clipboard-write'])", `<div class="row"><code class="badge" data-testid="copy-source">SAVE10</code><button class="btn secondary sm" id="copy" data-testid="copy-button">Copy coupon</button><button class="btn secondary sm" id="paste" data-testid="paste-button">Paste from clipboard</button></div><div class="out" data-testid="clipboard-result" id="clip-out">—</div>`)}
    ${card('geo', 'Geolocation', 'context.setGeolocation()', `<button class="btn secondary sm" id="geo" data-testid="find-store">📍 Find my nearest store</button><div class="out" data-testid="geo-result" id="geo-out">Location not requested</div>`)}
    ${card('clock', 'Time', 'page.clock.install() · fastForward()', `<p>Now: <strong class="mono" id="clock-now" data-testid="clock-now">--:--:--</strong></p><div class="row"><button class="btn secondary sm" id="timer" data-testid="start-timer">Start 10-minute timer</button><strong class="mono" id="timer-out" data-testid="timer-remaining">10:00</strong></div><div class="out" id="timer-status" data-testid="timer-status">Timer idle</div>`)}
    ${card('network', 'Network', 'page.route() · waitForResponse()', `<div class="row"><button class="btn secondary sm" data-net="/deal" data-testid="net-deal">Get deal of the day</button><button class="btn secondary sm" data-net="/products/7" data-testid="net-product">Load product #7</button><button class="btn secondary sm" data-net="/products/abc" data-testid="net-broken">Call a broken endpoint</button></div><div class="out" data-testid="network-result" id="net-out">—</div>`)}
    ${card('dynamic-ids', 'Unstable IDs &amp; classes', 'getByRole over CSS', `<div class="row" id="dyn" data-testid="dynamic-buttons"></div><div class="spread" style="margin-top:8px"><div class="out" style="flex:1;margin:0" data-testid="dynamic-result" id="dyn-out">—</div><button class="btn link sm" id="dyn-rerender" data-testid="rerender">Re-render</button></div>`)}
    ${card('table', 'Web table', 'locator.filter() · nth()', `<input type="search" id="tbl-filter" placeholder="Filter employees…" aria-label="Filter employees" data-testid="table-filter" style="margin-bottom:8px"><div class="table-wrap"><table data-testid="employees-table"><thead><tr>${[['name', 'Name'], ['dept', 'Department'], ['city', 'City'], ['salary', 'Salary']].map(([k, l]) => `<th data-k="${k}" class="${k === 'salary' ? 'num' : ''}"><button class="sort">${l}</button></th>`).join('')}</tr></thead><tbody id="tbl-body"></tbody></table></div><div class="spread small" style="margin-top:8px"><button class="btn link sm" id="tbl-prev" data-testid="table-prev">‹ Prev</button><span id="tbl-info" data-testid="table-info"></span><button class="btn link sm" id="tbl-next" data-testid="table-next">Next ›</button></div>`)}
    ${card('visual', 'Visual snapshot target', 'expect(locator).toHaveScreenshot()', `<div id="vis" data-testid="visual-target" style="border:1px solid var(--line);border-radius:10px;padding:16px;background:var(--surface-2)"><strong>Order #1042</strong><p class="small muted" style="margin:4px 0 10px">3 items · Express delivery</p><div class="spread"><span class="badge ok">Delivered</span><span class="price">$128.40</span></div></div><label class="check" style="margin-top:10px"><input type="checkbox" id="vis-break" data-testid="visual-break"> Introduce a 2px layout shift (makes the snapshot fail)</label>`)}
    ${card('a11y', 'Accessibility audit target', '@axe-core/playwright', `<p class="small muted">These elements are broken on purpose — an axe scan should flag them.</p><div class="row"><img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect width='40' height='40' fill='%23ccc'/%3E%3C/svg%3E" data-testid="img-no-alt"><button class="btn secondary sm" data-testid="icon-only-button"><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="2"/></svg></button><input data-testid="unlabelled-input" style="max-width:140px"><span style="color:#bbb;background:#ccc;padding:2px 6px" data-testid="low-contrast">Low contrast</span></div>`)}
    </div>`;
  wire(el);
}

function wire(el) {
  const on = (sel, ev, fn) => $(sel, el).addEventListener(ev, fn);
  const every = (ms, fn) => { const t = setInterval(() => { if (!$('[data-testid=lab-clock]')) return clearInterval(t); fn(); }, ms); return t; };

  /* dialogs */
  on('#d-alert', 'click', () => { alert('Hello from VORTEX!'); $('#d-out', el).textContent = 'Alert dismissed'; });
  on('#d-confirm', 'click', () => { $('#d-out', el).textContent = confirm('Delete all test data?') ? 'Confirmed: OK' : 'Confirmed: Cancel'; });
  on('#d-prompt', 'click', () => { const v = prompt('What is your name?', 'Tester'); $('#d-out', el).textContent = v === null ? 'Prompt cancelled' : `Hello, ${v}!`; });

  /* popup */
  on('#w-popup', 'click', () => window.open('/lab/popup', 'shoplab-popup', 'width=520,height=420'));
  const onMsg = e => {
    if (e.origin !== location.origin || !e.data || e.data.type !== 'popup-message') return;
    const out = $('#w-out', el); if (!out) return window.removeEventListener('message', onMsg);
    out.textContent = `Popup says: ${e.data.text}`;
  };
  window.addEventListener('message', onMsg);

  /* drag and drop */
  let dragging = null;
  $$('[data-testid=task]', el).forEach(t => t.addEventListener('dragstart', e => { dragging = t; e.dataTransfer.setData('text/plain', t.id); e.dataTransfer.effectAllowed = 'move'; }));
  $$('.kanban .col', el).forEach(col => {
    col.addEventListener('dragover', e => { e.preventDefault(); col.classList.add('over'); });
    col.addEventListener('dragleave', () => col.classList.remove('over'));
    col.addEventListener('drop', e => {
      e.preventDefault(); col.classList.remove('over');
      const t = dragging || document.getElementById(e.dataTransfer.getData('text/plain'));
      if (!t) return;
      col.append(t); dragging = null;
      $$('.kanban .col', el).forEach(c => ($('[data-count]', c).textContent = $$('.item', c).length));
      $('#dnd-out', el).textContent = `Moved “${t.textContent}” to ${col.getAttribute('aria-label')}`;
    });
  });

  /* mouse */
  $$('[data-hm]', el).forEach(b => b.addEventListener('click', () => { $('#m-out', el).textContent = `Hover menu: ${b.dataset.hm}`; b.blur(); }));
  on('#dbl', 'dblclick', e => {
    const span = e.currentTarget, input = document.createElement('input');
    input.value = span.textContent; input.setAttribute('aria-label', 'Edit text'); input.dataset.testid = 'dblclick-input'; input.style.maxWidth = '200px';
    span.replaceWith(input); input.focus(); input.select();
    const save = () => { span.textContent = input.value; input.replaceWith(span); $('#m-out', el).textContent = `Saved: ${span.textContent}`; };
    input.addEventListener('keydown', k => { if (k.key === 'Enter') save(); });
    input.addEventListener('blur', save, { once: true });
  });
  on('#ctx-area', 'contextmenu', e => {
    e.preventDefault();
    $$('.ctx').forEach(m => m.remove());
    const m = document.createElement('div');
    m.className = 'menu ctx'; m.setAttribute('role', 'menu'); m.dataset.testid = 'context-menu';
    m.style.left = `${e.clientX}px`; m.style.top = `${e.clientY}px`;
    m.innerHTML = ['Copy', 'Rename', 'Delete'].map(a => `<button role="menuitem" data-a="${a}">${a}</button>`).join('');
    document.body.append(m);
    m.onclick = ev => { const b = ev.target.closest('[data-a]'); if (b) { $('#m-out', el).textContent = `Context action: ${b.dataset.a}`; m.remove(); } };
    setTimeout(() => document.addEventListener('click', () => m.remove(), { once: true }));
  });

  /* signature canvas */
  const cv = $('#sig', el), ctx = cv.getContext('2d');
  let drawing = false, dist = 0, last = null;
  const pt = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * cv.width / r.width, (e.clientY - r.top) * cv.height / r.height]; };
  cv.addEventListener('pointerdown', e => { drawing = true; last = pt(e); });
  cv.addEventListener('pointermove', e => {
    if (!drawing) return;
    const p = pt(e);
    ctx.strokeStyle = getComputedStyle(document.body).color; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(...last); ctx.lineTo(...p); ctx.stroke();
    dist += Math.hypot(p[0] - last[0], p[1] - last[1]); last = p;
    if (dist > 50) $('#sig-status', el).textContent = 'Signed ✓';
  });
  window.addEventListener('pointerup', () => (drawing = false));
  on('#sig-clear', 'click', () => { ctx.clearRect(0, 0, cv.width, cv.height); dist = 0; $('#sig-status', el).textContent = 'Not signed'; });

  /* form controls */
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
      toppings: tps.filter(t => t.checked).map(t => t.value), city: city.value, richText: $('[data-testid=rich-text]', el).innerText.trim()
    };
    $('#controls-out', el).textContent = JSON.stringify(v, null, 1);
  });

  /* waits */
  on('#w-load', 'click', () => {
    const spin = $('#w-spin', el), res = $('#w-res', el);
    spin.hidden = false; res.textContent = '';
    setTimeout(() => { spin.hidden = true; res.textContent = 'Data loaded ✓'; }, 1000 + Math.random() * 2000);
  });
  let n = 5;
  const enBtn = $('#w-enable', el);
  const en = setInterval(() => {
    n--; if (!document.body.contains(enBtn)) return clearInterval(en);
    if (n <= 0) { clearInterval(en); enBtn.disabled = false; enBtn.textContent = "I'm ready — click me"; } else $('span', enBtn).textContent = n;
  }, 1000);
  enBtn.addEventListener('click', () => ($('#w-enabled-out', el).textContent = 'Clicked after waiting ✓'));
  on('#w-flash', 'click', () => { const t = $('#w-temp', el); t.hidden = false; setTimeout(() => (t.hidden = true), 3000); });
  on('#w-prog', 'click', e => {
    e.currentTarget.disabled = true;
    let p = 0; const bar = $('[data-testid=progress]', el);
    const t = setInterval(() => {
      p = Math.min(100, p + 5 + Math.floor(Math.random() * 10));
      bar.setAttribute('aria-valuenow', p); $('div', bar).style.width = `${p}%`;
      $('#w-prog-out', el).textContent = p === 100 ? 'Complete!' : `${p}%`;
      if (p === 100) clearInterval(t);
    }, 250);
  });

  /* infinite scroll */
  const box = $('#inf-box', el), list = $('#inf-list', el), sentinel = $('#inf-sentinel', el);
  let loaded = 0, loading = false;
  const more = () => {
    if (loading || loaded >= 100) return;
    loading = true;
    setTimeout(() => {
      list.insertAdjacentHTML('beforeend', Array.from({ length: 20 }, (_, i) => `<li data-testid="infinite-item">Item ${loaded + i + 1}</li>`).join(''));
      loaded += 20; loading = false;
      $('#inf-count', el).textContent = `Loaded ${loaded} of 100`;
      if (loaded >= 100) { sentinel.textContent = 'You reached the end 🎉'; sentinel.dataset.testid = 'infinite-end'; io.disconnect(); }
    }, 400);
  };
  const io = new IntersectionObserver(es => es.forEach(x => x.isIntersecting && more()), { root: box });
  io.observe(sentinel);

  /* files */
  const showFiles = files => ($('#file-list', el).innerHTML = [...files].map(f => `<li data-testid="uploaded-file">${esc(f.name)} — ${f.size} bytes</li>`).join('') || '<li>No files</li>');
  on('#files', 'change', e => showFiles(e.target.files));
  const fd = $('#file-drop', el);
  ['dragenter', 'dragover'].forEach(ev => fd.addEventListener(ev, e => { e.preventDefault(); fd.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => fd.addEventListener(ev, e => { e.preventDefault(); fd.classList.remove('over'); }));
  fd.addEventListener('drop', e => showFiles(e.dataTransfer.files));
  const download = (name, type, text) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); };
  on('#dl-csv', 'click', async () => { const r = await api('/products?limit=50'); download('products.csv', 'text/csv', ['id,name,category,price,stock', ...r.items.map(p => `${p.id},"${p.name}",${p.category},${p.price},${p.stock}`)].join('\n')); });
  on('#dl-json', 'click', () => download('report.json', 'application/json', JSON.stringify({ suite: 'VORTEX', passed: 42, failed: 0, generatedAt: new Date().toISOString() }, null, 2)));

  /* keyboard */
  on('#keys', 'keydown', e => {
    const combo = [e.ctrlKey && 'Control', e.metaKey && 'Meta', e.altKey && 'Alt', e.shiftKey && e.key !== 'Shift' && 'Shift', e.key].filter(Boolean).join('+');
    $('#key-out', el).textContent = `Pressed: ${combo}`;
  });

  /* clipboard */
  on('#copy', 'click', async () => { try { await navigator.clipboard.writeText('SAVE10'); $('#clip-out', el).textContent = 'Copied SAVE10 to clipboard'; } catch (e) { $('#clip-out', el).textContent = `Copy failed: ${e.name}`; } });
  on('#paste', 'click', async () => { try { $('#clip-out', el).textContent = `Clipboard contains: ${await navigator.clipboard.readText()}`; } catch (e) { $('#clip-out', el).textContent = `Paste failed: ${e.name}`; } });

  /* geolocation */
  const STORES = [['Hyderabad (Ameerpet)', 17.4375, 78.4483], ['Bengaluru', 12.9716, 77.5946], ['Mumbai', 19.076, 72.8777], ['Ranchi', 23.3441, 85.3096], ['London', 51.5072, -0.1276], ['New York', 40.7128, -74.006]];
  const km = (a, b, c, d) => { const r = x => x * Math.PI / 180; const h = Math.sin(r(c - a) / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(r(d - b) / 2) ** 2; return 12742 * Math.asin(Math.sqrt(h)); };
  on('#geo', 'click', () => {
    const out = $('#geo-out', el); out.textContent = 'Locating…';
    if (!navigator.geolocation) return (out.textContent = 'Geolocation not supported');
    navigator.geolocation.getCurrentPosition(p => {
      const { latitude: la, longitude: lo } = p.coords;
      const [name, , , d] = STORES.map(s => [...s, km(la, lo, s[1], s[2])]).sort((a, b) => a[3] - b[3])[0];
      out.textContent = `Nearest store: ${name} (${Math.round(d)} km) · you are at ${la.toFixed(4)}, ${lo.toFixed(4)}`;
    }, err => (out.textContent = `Location error: ${err.code === 1 ? 'permission denied' : err.message}`), { timeout: 5000 });
  });

  /* clock + timer */
  const pad = x => String(x).padStart(2, '0');
  const tick = () => { const d = new Date(); $('#clock-now', el) && ($('#clock-now', el).textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`); };
  tick(); every(1000, tick);
  let endAt = null;
  on('#timer', 'click', e => { endAt = Date.now() + 10 * 60000; e.currentTarget.disabled = true; $('#timer-status', el).textContent = 'Timer running'; });
  every(250, () => {
    if (!endAt) return;
    const s = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
    $('#timer-out', el).textContent = `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
    if (s === 0) { endAt = null; $('#timer-status', el).textContent = "Time's up!"; toast("Time's up!", 'info'); }
  });

  /* network */
  $$('[data-net]', el).forEach(b => b.addEventListener('click', async () => {
    const out = $('#net-out', el), t0 = performance.now();
    out.textContent = 'Loading…';
    try {
      const d = await api(b.dataset.net);
      const ms = Math.round(performance.now() - t0);
      out.textContent = d.product ? `Deal: ${d.product.name} — ${d.percentOff}% off (${ms} ms)` : `Product: ${d.name} — $${d.price.toFixed(2)} (${ms} ms)`;
    } catch (err) { out.textContent = `Error ${err.status}: ${err.message}`; }
  }));

  /* dynamic ids */
  const dyn = () => {
    $('#dyn', el).innerHTML = ['Save', 'Edit', 'Delete'].map(l => `<button class="btn secondary sm c-${rand()}" id="btn-${rand()}">${l}</button>`).join('');
  };
  dyn();
  on('#dyn', 'click', e => { const b = e.target.closest('button'); if (b) $('#dyn-out', el).textContent = `Clicked ${b.textContent} (id was ${b.id})`; });
  on('#dyn-rerender', 'click', dyn);

  /* web table */
  const FIRST = ['Asha', 'Ravi', 'Meera', 'John', 'Priya', 'Arjun', 'Sara', 'Vikram', 'Neha', 'Tom', 'Divya', 'Kiran', 'Lena', 'Omar', 'Fatima', 'Raj', 'Anita', 'Chris', 'Pooja', 'Sam', 'Isha', 'Dev', 'Maya', 'Leo', 'Zara'];
  const DEPTS = ['QA', 'Dev', 'DevOps', 'Product', 'Support'], CITIES2 = ['Hyderabad', 'Pune', 'Ranchi', 'London', 'Austin'];
  const emps = FIRST.map((f, i) => ({ name: `${f} ${String.fromCharCode(65 + (i * 7) % 26)}.`, dept: DEPTS[i % 5], city: CITIES2[(i * 3) % 5], salary: 40000 + ((i * 7919) % 60) * 1000 }));
  let tf = '', ts = { k: 'name', d: 1 }, tp = 1;
  const drawTable = () => {
    const rows = emps.filter(e => !tf || Object.values(e).join(' ').toLowerCase().includes(tf)).sort((a, b) => (typeof a[ts.k] === 'number' ? a[ts.k] - b[ts.k] : a[ts.k].localeCompare(b[ts.k])) * ts.d);
    const pages = Math.max(1, Math.ceil(rows.length / 5)); tp = Math.min(tp, pages);
    $('#tbl-body', el).innerHTML = rows.slice((tp - 1) * 5, tp * 5).map(e => `<tr data-testid="employee-row"><td>${e.name}</td><td>${e.dept}</td><td>${e.city}</td><td class="num">$${e.salary.toLocaleString('en-US')}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">No matches</td></tr>';
    $('#tbl-info', el).textContent = `Page ${tp} of ${pages} · ${rows.length} rows`;
    $('#tbl-prev', el).disabled = tp <= 1; $('#tbl-next', el).disabled = tp >= pages;
    $$('[data-k]', el).forEach(th => th.setAttribute('aria-sort', th.dataset.k === ts.k ? (ts.d === 1 ? 'ascending' : 'descending') : 'none'));
  };
  $$('[data-k] button', el).forEach(b => b.addEventListener('click', () => { const k = b.parentElement.dataset.k; ts = { k, d: ts.k === k ? -ts.d : 1 }; drawTable(); }));
  on('#tbl-filter', 'input', e => { tf = e.target.value.toLowerCase(); tp = 1; drawTable(); });
  on('#tbl-prev', 'click', () => { tp--; drawTable(); });
  on('#tbl-next', 'click', () => { tp++; drawTable(); });
  drawTable();

  /* visual */
  on('#vis-break', 'change', e => ($('#vis', el).style.marginLeft = e.target.checked ? '2px' : ''));
}

/* ---------- custom elements for shadow DOM practice ---------- */
function defineElements() {
  if (customElements.get('lab-rating')) return;
  class LabChip extends HTMLElement {
    constructor() { super(); this.attachShadow({ mode: 'open' }).innerHTML = `<style>span{display:inline-block;padding:2px 8px;border-radius:99px;background:#ccfbf1;color:#0f766e;font:600 12px system-ui}</style><span part="chip" data-testid="shadow-chip"><slot></slot></span>`; }
  }
  class LabRating extends HTMLElement {
    constructor() {
      super();
      const root = this.attachShadow({ mode: 'open' });
      root.innerHTML = `<style>button{font-size:22px;background:none;border:0;cursor:pointer;color:#d6d3d1;padding:0 2px}button[aria-pressed=true]{color:#f59e0b}p{margin:6px 0 0;font:13px system-ui}</style>
        <div role="group" aria-label="Rate VORTEX">${[1, 2, 3, 4, 5].map(n => `<button aria-label="${n} star${n > 1 ? 's' : ''}" aria-pressed="false" data-n="${n}" data-testid="shadow-star-${n}">★</button>`).join('')}</div>
        <p><span data-testid="shadow-rating-text">Not rated</span> <lab-chip>shadow-in-shadow</lab-chip></p>`;
      root.addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return;
        const n = +b.dataset.n;
        root.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(+x.dataset.n <= n)));
        root.querySelector('[data-testid=shadow-rating-text]').textContent = `You rated ${n}/5`;
        this.setAttribute('value', n);
      });
    }
  }
  class LabSecret extends HTMLElement {
    constructor() {
      super();
      const root = this.attachShadow({ mode: 'closed' });
      root.innerHTML = `<button style="font:inherit;padding:6px 10px;border-radius:8px;border:1px solid #ccc;cursor:pointer">Reveal secret</button> <span></span>`;
      root.querySelector('button').onclick = () => { root.querySelector('span').textContent = 'The secret is 42'; this.setAttribute('revealed', 'true'); };
    }
    reveal() { this.setAttribute('revealed', 'true'); }
  }
  customElements.define('lab-chip', LabChip);
  customElements.define('lab-rating', LabRating);
  customElements.define('lab-secret', LabSecret);
}

