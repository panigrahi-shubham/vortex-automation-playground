require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const express = require('express');
const path = require('path');
const { productionLocked } = require('./test-hooks/guard');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '200kb' }));

// SHOPLAB_STORAGE=legacy lets the original suite run against memory even when DATABASE_URL is present.
const production = productionLocked();
const legacyRequested = process.env.SHOPLAB_STORAGE === 'legacy';
const hasDatabase = !!process.env.DATABASE_URL;
// A public production release must run on PostgreSQL; never serve the seeded memory demo instead.
const configError = !production ? null : legacyRequested ? 'Legacy memory storage is not permitted in production' : !hasDatabase ? 'DATABASE_URL is required in production' : null;
const storage = configError ? 'unavailable' : legacyRequested || !hasDatabase ? 'memory' : 'postgres';

app.get('/api/health', (_req, res) => res.json({ ok: true, uptime: Math.round(process.uptime()), version: '2.0.0' }));

if (configError) {
  app.use('/api', (_req, res) => res.status(503).json({ error: 'Service configuration is incomplete' }));
} else {
  app.get('/api/config', (_req, res) => { res.set('Cache-Control', 'no-store').json({ storage, recoveryAvailable: storage === 'postgres' && require('../dist/auth/recovery-routes').recoveryAvailable() }); });

  if (storage === 'postgres') {
    app.use('/api/v2', require('../dist/modules/catalog/metadata').metadataRoutes());
    const { catalogRoutes } = require('../dist/modules/catalog/routes');
    const { prisma } = require('../dist/db/client');
    app.use('/api/v2', require('../dist/auth/routes').authRoutes(prisma));
    app.use('/api/v2', require('../dist/auth/account-routes').accountRoutes(prisma));
    app.use('/api/v2', require('../dist/auth/avatar-routes').avatarRoutes(prisma));
    app.use('/api/v2', require('../dist/modules/admin/routes').adminRoutes(prisma));
    app.use('/api/v2', require('../dist/auth/recovery-routes').recoveryRoutes(prisma));
    app.use('/api/v2', require('../dist/auth/mfa-routes').mfaRoutes(prisma));
    app.use('/api/v2', catalogRoutes(prisma));
    app.use('/api/v2', require('../dist/modules/reviews/routes').reviewRoutes(prisma));
    app.use('/api/v2', require('../dist/modules/wishlist/routes').wishlistRoutes(prisma));
    app.use('/api/v2', require('../dist/modules/cart/routes').cartRoutes(prisma));
    app.use('/api/v2', require('../dist/modules/orders/routes').orderRoutes(prisma));
    app.use('/api/v2', (_req, res) => res.status(404).json({ error: 'Not found' }));
  }

  // The legacy in-memory API is a development/reference surface; production exposes only /api/v2.
  if (production) app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));
  else app.use('/api', require('../server/api'));
}

const pub = path.join(__dirname, '../web');
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
  if (err.type === 'encoding.unsupported') return res.status(415).json({ error: 'Compressed request bodies are not supported' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Payload too large' });
  res.status(500).json({ error: 'Internal server error' });
});

// SPA fallback: every other GET renders the app shell (history-API routing)
app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(pub, 'index.html')));


module.exports = app;










