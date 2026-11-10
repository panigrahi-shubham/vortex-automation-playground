import { $ } from '../../core.js';

export default {
  id: 'a11y',
  title: 'Accessibility audit target',
  tag: '@axe-core/playwright',
  level: 3,
  task: "Run an accessibility scan. In default mode, verify the unnamed control, missing alt text, and contrast issues are reported.",
  body: `<p class="small muted">These elements are broken on purpose — an axe scan should flag them.</p><div class="row"><img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect width='40' height='40' fill='%23ccc'/%3E%3C/svg%3E" data-testid="img-no-alt"><button class="btn secondary sm" data-testid="icon-only-button"><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="2"/></svg></button><input data-testid="unlabelled-input" style="max-width:140px"><span style="color:#bbb;background:#ccc;padding:2px 6px" data-testid="low-contrast">Low contrast</span></div>`,
  mount(el, { challenge }) {
    if (!challenge) return;
    $('p', el).textContent = 'These controls have accessible names in challenge mode.';
    $('img', el).alt = 'Grey square';
    $('button', el).setAttribute('aria-label', 'Close sample');
    $('input', el).setAttribute('aria-label', 'Audit sample input');
    const contrast = $('span', el);
    contrast.style.color = '#111';
  },
};
