import { $, setTitle } from '../core.js';

export async function render(el, { isCurrent = () => true } = {}) {
  setTitle('3D Studio');
  el.innerHTML = `<div class="page-head"><div><p class="vortex-eyebrow">INTERACTIVE OBJECTS</p><h1>3D Studio</h1></div><a href="/shop" class="btn secondary">Back to the collection ↗</a></div>
    <section class="vortex-studio" data-testid="vortex-studio" aria-label="Interactive ceramic mug">
      <div class="vortex-studio-stage" data-testid="vortex-studio-stage">
        <img src="/assets/products/vortex-product-17.webp" alt="A ceramic mug in a warm studio setting" width="480" height="480">
        <span class="vortex-studio-label" data-testid="vortex-studio-hint">Load the preview to explore in 3D</span>
      </div>
      <div class="vortex-studio-panel">
        <p class="vortex-eyebrow">MATERIAL STUDY</p><h2>A different<br>point of view.</h2>
        <p>Turn a simple ceramic mug into a hands-on experience. Explore the shape, find your finish, and look a little closer.</p>
        <button class="btn" data-testid="vortex-studio-load">Load 3D preview</button>
        <fieldset style="border:0;padding:0;margin-top:24px" disabled data-testid="vortex-studio-controls"><legend>Choose a finish</legend>
          <div class="vortex-studio-colors">
            <button type="button" data-color="forest" aria-label="Forest finish" aria-pressed="true"></button>
            <button type="button" data-color="clay" aria-label="Clay finish" aria-pressed="false"></button>
            <button type="button" data-color="cream" aria-label="Cream finish" aria-pressed="false"></button>
          </div>
          <label for="vortex-rotation">Rotate the mug</label><input id="vortex-rotation" type="range" min="0" max="360" value="25" data-testid="vortex-studio-rotation">
          <div class="row"><button class="btn secondary sm" type="button" data-testid="vortex-studio-reset">Reset view</button><label class="check"><input type="checkbox" data-testid="vortex-studio-spin"> Auto-rotate</label></div>
        </fieldset>
        <p class="vortex-studio-status" role="status" data-testid="vortex-studio-status">The photo is ready. Load 3D when you want to explore.</p>
      </div>
    </section>`;
  const load = $('[data-testid=vortex-studio-load]', el);
  const status = $('[data-testid=vortex-studio-status]', el);
  load.onclick = async () => {
    load.disabled = true;
    status.textContent = 'Preparing the 3D preview…';
    try {
      const { mountMug } = await import('../three-viewer.js');
      if (!isCurrent()) return;
      mountMug(el);
      load.hidden = true;
    } catch {
      if (!isCurrent()) return;
      status.textContent =
        'The 3D preview is unavailable in this browser. You can still explore the product photo.';
      load.textContent = 'Try 3D again';
      load.disabled = false;
    }
  };
}
