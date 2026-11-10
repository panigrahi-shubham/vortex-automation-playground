import { $, $$ } from '../../core.js';

export default {
  id: 'mouse',
  title: 'Mouse: hover, double &amp; right click',
  tag: 'hover() · dblclick() · click({button})',
  level: 2,
  task: "Choose Settings, edit the text, and rename via the context menu. Verify each result.",
  body: `<div class="row" style="margin-bottom:10px">
        <div class="hover-box"><button class="btn secondary sm" data-testid="hover-trigger" aria-haspopup="true">Hover me ▾</button><div class="menu" role="menu" data-testid="hover-menu"><button role="menuitem" data-hm="Profile">Profile</button><button role="menuitem" data-hm="Settings">Settings</button></div></div>
        <span class="tooltip-wrap"><button class="btn secondary sm" data-testid="tooltip-trigger" aria-describedby="tt">ⓘ Info</button><span class="tooltip" role="tooltip" id="tt" data-testid="tooltip">Tooltips only exist on hover</span></span></div>
      <p class="small" style="margin:0 0 6px">Double-click to edit: <span id="dbl" data-testid="dblclick-target" style="border-bottom:1px dashed var(--muted);cursor:text">VORTEX rocks</span></p>
      <div id="ctx-area" data-testid="context-area" class="dropzone" style="padding:12px">Right-click here</div>
      <div class="out" data-testid="mouse-result" id="m-out">—</div>`,
  mount(el, { challenge, signal }) {
    const on = (selector, event, handler) => $(selector, el).addEventListener(event, handler);
    $$('[data-hm]', el).forEach(b => b.addEventListener('click', () => { $('#m-out', el).textContent = `Hover menu: ${b.dataset.hm}`; b.blur(); }));
    const edit = e => {
      const span = e.currentTarget, input = document.createElement('input');
      input.value = span.textContent; input.setAttribute('aria-label', 'Edit text'); if (!challenge) input.dataset.testid = 'dblclick-input'; input.style.maxWidth = '200px';
      span.replaceWith(input); input.focus(); input.select();
      const save = () => {
        if (signal.aborted || !input.isConnected) return;
        span.textContent = input.value;
        input.replaceWith(span);
        $('#m-out', el).textContent = `Saved: ${span.textContent}`;
      };
      input.addEventListener('keydown', k => { if (k.key === 'Enter') save(); });
      input.addEventListener('blur', save, { once: true });
    };
    on('#dbl', 'dblclick', edit);
    const openMenu = e => {
      e.preventDefault();
      $$('.ctx').forEach(m => m.remove());
      const m = document.createElement('div');
      m.className = 'menu ctx'; m.setAttribute('role', 'menu'); if (!challenge) m.dataset.testid = 'context-menu';
      const box = $('#ctx-area', el).getBoundingClientRect();
      m.style.left = `${e.clientX ?? box.left}px`; m.style.top = `${e.clientY ?? box.bottom}px`;
      m.innerHTML = ['Copy', 'Rename', 'Delete'].map(a => `<button role="menuitem" data-a="${a}">${a}</button>`).join('');
      document.body.append(m);
      m.onclick = ev => { const b = ev.target.closest('[data-a]'); if (b) { $('#m-out', el).textContent = `Context action: ${b.dataset.a}`; m.remove(); } };
      document.addEventListener('click', () => m.remove(), { once: true, signal });
      signal.addEventListener('abort', () => m.remove(), { once: true });
      if (challenge) $('button', m).focus();
    };
    on('#ctx-area', 'contextmenu', openMenu);
    if (challenge) {
      for (const [selector, action] of [['#dbl', edit], ['#ctx-area', openMenu]]) {
        const control = $(selector, el);
        control.setAttribute('role', 'button');
        control.tabIndex = 0;
        control.addEventListener('keydown', event => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            action(event);
          }
        });
      }
    }
  },
};
