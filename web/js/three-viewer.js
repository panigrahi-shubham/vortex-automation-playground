import * as THREE from '/js/vendor/three/three.module.js';
import { $, $$ } from './core.js';

export function mountMug(root) {
  const stage = $('[data-testid=vortex-studio-stage]', root);
  const controls = $('[data-testid=vortex-studio-controls]', root);
  const status = $('[data-testid=vortex-studio-status]', root);
  const rotation = $('[data-testid=vortex-studio-rotation]', root);
  const spin = $('[data-testid=vortex-studio-spin]', root);
  const lifetime = new AbortController();
  const { signal } = lifetime;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0xe8e6dc);
  renderer.domElement.setAttribute('aria-label', 'Interactive 3D ceramic mug');
  renderer.domElement.setAttribute('role', 'img');
  renderer.domElement.dataset.testid = 'vortex-studio-canvas';
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, .1, 100);
  camera.position.set(3.8, 2.8, 5.5);
  camera.lookAt(0, .7, 0);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x65735c, 3));
  const light = new THREE.DirectionalLight(0xfff4e3, 4);
  light.position.set(4, 6, 4); scene.add(light);
  const rimLight = new THREE.DirectionalLight(0xffffff, 2);
  rimLight.position.set(-4, 3, -2); scene.add(rimLight);
  const material = new THREE.MeshStandardMaterial({ color: 0x275e47, roughness: .28, metalness: .05, side: THREE.DoubleSide });
  const profile = [[.01,.02],[.78,.02],[.84,.08],[.88,.2],[.98,1.55],[.99,1.65],[.98,1.72],[.91,1.72],[.9,1.65],[.82,.2],[.75,.14],[.01,.14]].map(([x,y]) => new THREE.Vector2(x,y));
  const geometry = new THREE.LatheGeometry(profile, 64);
  const handleGeometry = new THREE.TorusGeometry(.52, .12, 16, 48);
  const mug = new THREE.Group();
  mug.add(new THREE.Mesh(geometry, material));
  const handle = new THREE.Mesh(handleGeometry, material);
  handle.position.set(1.04, .97, 0); mug.add(handle); scene.add(mug);
  const shadowGeometry = new THREE.CircleGeometry(1.25, 64);
  const shadowMaterial = new THREE.MeshBasicMaterial({ color: 0x8c9686, transparent: true, opacity: .2 });
  const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = -.02; scene.add(shadow);
  let destroyed = false;
  let pointerX = null;
  const draw = () => {
    if (destroyed) return;
    mug.rotation.y = Number(rotation.value) * Math.PI / 180;
    renderer.render(scene, camera);
  };
  const resize = () => {
    const { width, height } = stage.getBoundingClientRect();
    if (!width || !height) return;
    camera.aspect = width / height; camera.updateProjectionMatrix();
    renderer.setSize(width, height); draw();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(stage);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const animate = () => {
    if (destroyed || !root.isConnected) { dispose(); return; }
    if (!document.hidden && !reducedMotion.matches && document.documentElement.dataset.reducedMotion !== 'true') {
      rotation.value = (Number(rotation.value) + .25) % 360;
      draw();
    }
  };
  spin.addEventListener('change', () => {
    renderer.setAnimationLoop(spin.checked ? animate : null);
  }, { signal });
  rotation.addEventListener('input', draw, { signal });
  const colors = { forest: 0x275e47, clay: 0xc58268, cream: 0xe6dfcd };
  $$('[data-color]', root).forEach(button => button.addEventListener('click', () => {
    material.color.setHex(colors[button.dataset.color]);
    $$('[data-color]', root).forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    status.textContent = button.getAttribute('aria-label') + ' selected. Drag the mug or use the rotation slider.';
    draw();
  }, { signal }));
  $('[data-testid=vortex-studio-reset]', root).addEventListener('click', () => {
    rotation.value = '25'; spin.checked = false; renderer.setAnimationLoop(null);
    $('[data-color=forest]', root).click(); draw();
  }, { signal });
  renderer.domElement.addEventListener('pointerdown', event => {
    pointerX = event.clientX; renderer.domElement.setPointerCapture(event.pointerId);
  }, { signal });
  renderer.domElement.addEventListener('pointermove', event => {
    if (pointerX === null) return;
    rotation.value = (Number(rotation.value) + event.clientX - pointerX + 360) % 360;
    pointerX = event.clientX; draw();
  }, { signal });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    renderer.domElement.addEventListener(name, () => { pointerX = null; }, { signal });
  }
  renderer.domElement.addEventListener('webglcontextlost', event => {
    event.preventDefault(); dispose();
    status.textContent = 'The 3D preview stopped. Refresh this page to try again.';
  }, { signal });
  function dispose() {
    if (destroyed) return;
    destroyed = true; lifetime.abort(); observer.disconnect(); renderer.setAnimationLoop(null);
    geometry.dispose(); handleGeometry.dispose(); material.dispose(); shadowGeometry.dispose(); shadowMaterial.dispose();
    renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    controls.disabled = true;
    $('img', stage).hidden = false;
  }
  for (const event of ['route', 'popstate', 'pagehide']) window.addEventListener(event, dispose, { once: true, signal });
  stage.append(renderer.domElement);
  $('img', stage).hidden = true;
  controls.disabled = false;
  $('[data-testid=vortex-studio-hint]', root).textContent = 'Drag to rotate · Keyboard controls available';
  status.textContent = 'Forest finish selected. Drag the mug or use the rotation slider.';
  resize();
}
