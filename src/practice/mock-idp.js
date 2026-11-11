const express = require('express');
const { createHmac, randomBytes, timingSafeEqual } = require('node:crypto');

const cookieName = 'vortex_sso_grant';
const localKey = randomBytes(32);
const demo = { username: 'vortex_demo', password: 'VortexDemo24!', name: 'Vortex Demo Customer' };

function readCookie(req) {
  return (req.headers.cookie || '').split(';').map(value => value.trim())
    .find(value => value.startsWith(cookieName + '='))?.slice(cookieName.length + 1);
}

function html(title, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title} · Vortex QA</title><link rel="stylesheet" href="/css/app.css"></head><body><main class="wrap">
    <h1>${title}</h1><p>Simulated identity provider for Vortex QA.</p>${body}<p><a href="/lab/sso">Back to the SSO exercise</a></p></main></body></html>`;
}

function mockIdp({ database, production }) {
  const router = express.Router();
  const key = process.env.ORVILO_MFA_KEY || (production ? null : localKey);
  const cookies = { httpOnly: true, sameSite: 'lax', secure: production, path: '/mock-idp' };
  const sign = value => createHmac('sha256', key).update('vortex/mock-idp/' + value).digest('hex');

  function mint(kind, nonce, ttl) {
    const value = [kind, nonce, Date.now() + ttl].join('.');
    return value + '.' + sign(value);
  }

  function verify(value, kind) {
    if (typeof value !== 'string' || !/^[a-z]+\.[a-f0-9]{24}\.\d{13}\.[a-f0-9]{64}$/.test(value)) return null;
    const [purpose, nonce, expiry, signature] = value.split('.');
    if (purpose !== kind || Number(expiry) <= Date.now()) return null;
    const expected = sign([purpose, nonce, expiry].join('.'));
    return timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex')) ? nonce : null;
  }

  function login(error = '') {
    return html('Simulated sign in', `${error ? '<p role="alert">Use the documented demo account.</p>' : ''}
      <p>Demo username <code>${demo.username}</code>. Demo password <code>${demo.password}</code>.</p>
      <form method="post" action="/mock-idp/login">
        <label for="vortex-sso-user">Demo username</label><input id="vortex-sso-user" name="username" required>
        <label for="vortex-sso-password">Demo password</label><input id="vortex-sso-password" name="password" type="password" required>
        <button class="btn" type="submit">Sign in to demo provider</button>
      </form>`);
  }

  router.use((_req, res, next) => {
    res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
    if (!key) return res.status(503).send(html('Simulated sign in', '<p>The identity provider needs its server key.</p>'));
    next();
  });
  router.use(express.urlencoded({ extended: false, limit: '8kb' }));

  router.get('/', (_req, res) => res.send(login()));
  router.post('/login', (req, res) => {
    if (req.body?.username !== demo.username || req.body?.password !== demo.password) return res.status(401).send(login('invalid'));
    const grant = mint('consent', randomBytes(12).toString('hex'), 5 * 60000);
    res.cookie(cookieName, grant, { ...cookies, maxAge: 5 * 60000 });
    res.send(html('Simulated consent', `<p>Allow Vortex QA to sign in a new practice customer?</p>
      <form method="post" action="/mock-idp/consent">
        <input type="hidden" name="grant" value="${grant}">
        <button type="submit" class="btn" name="decision" value="allow">Allow practice sign in</button>
        <button type="submit" class="btn secondary" name="decision" value="deny">Cancel</button>
      </form>`));
  });

  router.post('/consent', (req, res) => {
    const grant = readCookie(req);
    const nonce = verify(grant, 'consent');
    if (!nonce || grant !== req.body?.grant) return res.status(403).send(html('Consent expired', '<a href="/mock-idp">Start again</a>'));
    if (req.body.decision !== 'allow') {
      res.clearCookie(cookieName, cookies);
      return res.redirect(303, '/lab/sso');
    }
    res.redirect(303, '/mock-idp/callback?code=' + mint('code', nonce, 60000));
  });

  router.get('/callback', (_req, res) => res.send(html('Finishing practice sign in',
    '<p id="vortex-sso-status" role="status">Exchanging the authorization code…</p><script type="module" src="/js/vortex-sso-callback.js"></script>')));

  router.post('/exchange', async (req, res, next) => {
    const nonce = verify(req.body?.code, 'code');
    if (!nonce || nonce !== verify(readCookie(req), 'consent')) return res.status(401).json({ error: 'Invalid or expired authorization code' });

    // A unique demo username binds account creation to one authorization code.
    const username = 'vortex_' + nonce.slice(0, 13);
    const profile = { username, email: username + '@example.test', name: demo.name, role: 'customer' };
    const password = randomBytes(24).toString('hex');
    try {
      let result;
      if (database) {
        const { hashPassword, tokenHash } = require('../../dist/auth/passwords');
        const { publicProfile } = require('../../dist/auth/profile');
        const passwordHash = await hashPassword(password);
        const token = randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 3600000);
        result = await database.$transaction(async tx => {
          const user = await tx.user.create({ data: { ...profile, passwordHash } });
          await tx.session.create({ data: { tokenHash: tokenHash(token), userId: user.id, expiresAt } });
          return { token, expiresAt, user: publicProfile(user) };
        });
      } else {
        const { db } = require('../../server/store');
        const { issueSession } = require('../auth/sessions');
        if (db.users[username]) return res.status(409).json({ error: 'Authorization code already used' });
        const user = { ...profile, phone: '', avatar: null, createdAt: new Date().toISOString() };
        db.users[username] = { ...user, password, locked: false, failedAttempts: 0 };
        result = { ...issueSession(username, false), user };
      }
      res.clearCookie(cookieName, cookies);
      res.json(result);
    } catch (error) {
      if (error.code === 'P2002') return res.status(409).json({ error: 'Authorization code already used' });
      next(error);
    }
  });

  return router;
}

module.exports = { mockIdp };
