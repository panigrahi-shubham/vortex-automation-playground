import { $, api, esc } from '../../core.js';
import { testId } from './support.js';

export default {
  id: 'files',
  title: 'Upload &amp; download',
  tag: 'setInputFiles · waitForEvent(\'download\')',
  level: 2,
  task: "Upload two files and download products.csv. Verify both filenames and the CSV header.",
  body: `
      <div class="field"><label for="files">Choose files (multiple)</label><input type="file" id="files" multiple data-testid="file-input"></div>
      <div class="dropzone" id="file-drop" data-testid="file-dropzone">…or drop files here</div>
      <ul class="small" id="file-list" data-testid="file-list" style="margin:8px 0"></ul>
      <div class="row"><button class="btn secondary sm" id="dl-csv" data-testid="download-csv">⬇ products.csv</button><button class="btn secondary sm" id="dl-json" data-testid="download-json">⬇ report.json</button></div>`,
  mount(el, { challenge, signal }) {
    const on = (selector, event, handler) => $(selector, el).addEventListener(event, handler);
    const showFiles = files => ($('#file-list', el).innerHTML = [...files].map(f => `<li${testId(challenge, 'uploaded-file')}>${esc(f.name)} — ${f.size} bytes</li>`).join('') || '<li>No files</li>');
    on('#files', 'change', e => showFiles(e.target.files));
    const fd = $('#file-drop', el);
    if (challenge) {
      fd.setAttribute('role', 'region');
      fd.setAttribute('aria-label', 'File drop zone');
    }
    ['dragenter', 'dragover'].forEach(ev => fd.addEventListener(ev, e => { e.preventDefault(); fd.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(ev => fd.addEventListener(ev, e => { e.preventDefault(); fd.classList.remove('over'); }));
    fd.addEventListener('drop', e => showFiles(e.dataTransfer.files));
    const download = (name, type, text) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); };
    on('#dl-csv', 'click', async () => { const r = await api('/products?limit=50'); if (signal.aborted) return; download('products.csv', 'text/csv', ['id,name,category,price,stock', ...r.items.map(p => `${p.id},"${p.name}",${p.category},${p.price},${p.stock}`)].join('\n')); });
    on('#dl-json', 'click', () => download('report.json', 'application/json', JSON.stringify({ suite: 'VORTEX', passed: 42, failed: 0, generatedAt: new Date().toISOString() }, null, 2)));
  },
};
