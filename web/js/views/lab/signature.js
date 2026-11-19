import { $ } from '../../core.js';

export default {
  id: 'signature',
  title: 'Canvas signature',
  tag: 'mouse.move() · mouse.down()',
  level: 2,
  task: "Draw a signature until the status reads Signed, then clear it and verify Not signed.",
  body: `<canvas class="sign" id="sig" width="600" height="140" data-testid="signature-pad" aria-label="Signature pad"></canvas><div class="spread" style="margin-top:6px"><span class="small" data-testid="signature-status" id="sig-status">Not signed</span><button class="btn link sm" id="sig-clear" data-testid="signature-clear">Clear</button></div>`,
  mount(el, { signal }) {
    const on = (selector, event, handler) => $(selector, el).addEventListener(event, handler);
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
    window.addEventListener('pointerup', () => (drawing = false), { signal });
    on('#sig-clear', 'click', () => { ctx.clearRect(0, 0, cv.width, cv.height); dist = 0; $('#sig-status', el).textContent = 'Not signed'; });
  },
};
