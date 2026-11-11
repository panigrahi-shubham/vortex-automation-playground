import {
  $,
  $$,
  api,
  isDatabaseMode,
  isAuthed,
  setTitle,
  navigate,
  toast,
  refreshCounts,
  setAuth,
  state,
} from '../core.js';

const defects = [
  ['BUG-01', 'Reversed price sorting', 'Ascending price results arrive in descending order.'],
  ['BUG-02', 'Wrong item in cart', 'A product ID divisible by five adds the next catalog item.'],
  ['BUG-03', 'Tax counted twice', 'The order total includes a second tax charge.'],
  ['BUG-04', 'Case-sensitive search', 'Lowercase search can miss a product with uppercase letters.'],
  ['BUG-05', 'Coupon calculation', 'SAVE10 discounts one percent.'],
  ['BUG-06', 'Quantity validation', 'The cart accepts negative and excessive quantities.'],
  ['BUG-07', 'Overlapping pages', 'The next page repeats the previous page’s final product.'],
  ['BUG-08', 'Truncated display name', 'Saving your practice name drops its final character.'],
];

export async function render(el, { isCurrent = () => true } = {}) {
  setTitle('Practice workspace');
  if (!isDatabaseMode()) {
    el.innerHTML =
      '<section class="card"><h1>Practice workspace</h1><p>Your personal workspace is available with the PostgreSQL store. In local memory mode, use the existing chaos controls and seeded bug exercises.</p><a class="btn" href="/lab">Explore the UI Lab →</a></section>';
    return;
  }
  if (!isAuthed()) {
    navigate('/login?returnTo=%2Fpractice');
    return;
  }
  const profile = await api('/vortex/practice');
  if (!isCurrent()) return;
  el.innerHTML = `<div class="page-head"><div><p class="vortex-eyebrow">YOUR OWN SPACE TO EXPERIMENT</p><h1>Practice workspace</h1></div><a class="btn secondary" href="/shop">Explore the store ↗</a></div>
    <p class="muted">Choose a defect, reproduce it in the store, and write an assertion that catches it. Your catalog, cart, orders, reviews, and practice name belong to this workspace.</p>
    <form data-testid="vortex-practice-form">
      <div class="vortex-workspace-controls"><label class="check"><input type="checkbox" name="enabled" ${profile.enabled ? 'checked' : ''} data-testid="vortex-practice-enabled"> Use my personal practice workspace</label></div>
      <div class="vortex-practice-grid">${defects.map(([id, title, detail]) => `<label class="vortex-defect-choice"><input type="checkbox" name="defect" value="${id}" data-testid="vortex-defect-${id}" ${profile.defects.includes(id) ? 'checked' : ''}><span><strong>${id} · ${title}</strong>${detail}</span></label>`).join('')}</div>
      <div class="vortex-workspace-controls"><button class="btn" data-testid="vortex-practice-save">Save practice settings</button><button class="btn secondary" type="button" data-testid="vortex-practice-reset">Reset my workspace</button><button class="btn link" type="button" data-testid="vortex-practice-exit">Leave and clear practice</button></div>
      <p class="muted small" role="status" data-testid="vortex-practice-status">Workspace generation ${profile.generation} · ${profile.enabled ? 'Practice is active' : 'Practice is off'}</p>
    </form>`;
  const form = $('[data-testid=vortex-practice-form]', el);
  let busy = false;
  async function change(path, method, body) {
    if (busy) return;
    busy = true;
    $$('button', form).forEach((b) => {
      b.disabled = true;
    });
    try {
      await api(path, { method, body });
      const me = await api('/me');
      setAuth(state.token, me);
      await refreshPracticeBanner();
      await refreshCounts();
      toast('Practice workspace updated');
      if (isCurrent()) await render(el, { isCurrent });
    } catch (error) {
      if (isCurrent())
        $('[data-testid=vortex-practice-status]', form).textContent =
          error.message + ' Refresh the page before trying again.';
    } finally {
      busy = false;
      $$('button', form).forEach((b) => {
        b.disabled = false;
      });
    }
  }
  form.onsubmit = (e) => {
    e.preventDefault();
    change('/vortex/practice', 'PUT', {
      enabled: form.enabled.checked,
      defects: $$('[name=defect]:checked', form).map((input) => input.value),
    });
  };
  $('[data-testid=vortex-practice-reset]', form).onclick = () => {
    if (confirm('Reset your personal practice catalog, cart, orders, reviews, and defects?'))
      change('/vortex/practice/reset', 'POST', { generation: profile.generation });
  };
  $('[data-testid=vortex-practice-exit]', form).onclick = () => {
    if (confirm('Leave practice and clear your personal workspace?')) change('/vortex/practice', 'DELETE');
  };
}

export async function refreshPracticeBanner() {
  const banner = $('#vortex-practice-banner');
  if (!banner) return;
  banner.hidden = true;
  if (!isDatabaseMode() || !isAuthed()) return;
  try {
    banner.hidden = !(await api('/vortex/practice', { quiet: true })).enabled;
  } catch {
    banner.hidden = true;
  }
}
