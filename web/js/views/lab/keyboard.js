import { $ } from '../../core.js';

export default {
  id: 'keyboard',
  title: 'Keyboard',
  tag: 'keyboard.press() · press(\'Control+K\')',
  level: 1,
  task: "Press Control+A and then Shift+ArrowDown. Verify both combinations appear in the result.",
  body: `<div class="field"><label for="keys">Press any key combination here</label><input id="keys" data-testid="key-input" placeholder="Try Shift+Tab, Control+A, ArrowDown…"></div><div class="out" data-testid="key-result" id="key-out">—</div><p class="small muted" style="margin:8px 0 0">Global shortcut: <kbd>Ctrl</kbd>+<kbd>K</kbd> opens the search palette anywhere.</p>`,
  mount(el) {
    const on = (selector, event, handler) => $(selector, el).addEventListener(event, handler);
    on('#keys', 'keydown', e => {
      const combo = [e.ctrlKey && 'Control', e.metaKey && 'Meta', e.altKey && 'Alt', e.shiftKey && e.key !== 'Shift' && 'Shift', e.key].filter(Boolean).join('+');
      $('#key-out', el).textContent = `Pressed: ${combo}`;
    });
  },
};
