const { createServer } = require('node:http');

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Practice frame</title></head>
<body><h1>Practice frame</h1><label>Frame message <input id="vortex-frame-input" value="Hello"></label>
<button type="button" id="vortex-frame-send">Send to parent</button><script src="/vortex-frame.js"></script></body></html>`;

const script = `document.querySelector('button').addEventListener('click', () => {
  if (!document.referrer || parent === window) return;
  const opener = new URL(document.referrer);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(opener.hostname)) return;
  parent.postMessage({ type: 'vortex-frame-message', text: document.querySelector('input').value }, opener.origin);
});`;

createServer((req, res) => {
  const responses = {
    '/vortex-frame': ['text/html; charset=utf-8', html],
    '/vortex-frame.js': ['text/javascript; charset=utf-8', script],
  };
  if (req.method !== 'GET' || !Object.hasOwn(responses, req.url)) {
    res.writeHead(404).end();
    return;
  }
  const [type, body] = responses[req.url];
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' }).end(body);
}).listen(3101, '127.0.0.1', () => console.log('Vortex QA practice frame listening on http://127.0.0.1:3101/vortex-frame'));
