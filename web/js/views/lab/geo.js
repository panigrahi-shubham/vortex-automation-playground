import { $ } from '../../core.js';

export default {
  id: 'geo',
  title: 'Geolocation',
  tag: 'context.setGeolocation()',
  level: 2,
  task: "Set your location near Ranchi and request the nearest store. Verify Ranchi appears in the result.",
  body: `<button class="btn secondary sm" id="geo" data-testid="find-store">📍 Find my nearest store</button><div class="out" data-testid="geo-result" id="geo-out">Location not requested</div>`,
  mount(el) {
    const on = (selector, event, handler) => $(selector, el).addEventListener(event, handler);
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
  },
};
