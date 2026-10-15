const express = require('express');
const path = require('path');
const api = require('./server/api');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '200kb' }));
app.use('/api', api);

const pub = path.join(__dirname, 'public');
app.use(express.static(pub, { index: false }));

// Lab helper pages (served as real documents so popups / new tabs / iframes have their own URLs)
app.get('/lab/popup', (req, res) => res.sendFile(path.join(pub, 'pages', 'popup.html')));
app.get('/lab/frame-outer', (req, res) => res.sendFile(path.join(pub, 'pages', 'frame-outer.html')));
app.get('/lab/frame-inner', (req, res) => res.sendFile(path.join(pub, 'pages', 'frame-inner.html')));
app.get('/terms', (req, res) => res.sendFile(path.join(pub, 'pages', 'terms.html')));
app.get('/bank/3ds', (req, res) => res.sendFile(path.join(pub, 'pages', 'bank-3ds.html')));

// JSON errors for /api even when body parsing fails before the router runs
// eslint-disable-next-line no-unused-vars
app.use('/api', (err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Malformed JSON body' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Payload too large' });
  res.status(500).json({ error: 'Internal server error' });
});

// SPA fallback: every other GET renders the app shell (history-API routing)
app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(pub, 'index.html')));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`ShopLab v2 running on http://localhost:${port}`));
