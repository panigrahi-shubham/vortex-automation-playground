import { consume, throttleKey } from './throttle';
import { Prisma, PrismaClient, User } from '@prisma/client';
import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { hashPassword, verifyPassword, tokenHash } from './passwords';
import { requireSession } from './database-sessions';

import { publicProfile as profile, validPassword } from './profile';
import { transaction } from '../db/transaction';
// Equalize password hashing work for unknown accounts without a database write.
const dummyHash = hashPassword(randomBytes(32).toString('hex'));

export function authRoutes(db: PrismaClient) {
  const router = Router();
  const auth = requireSession(db);
  router.post('/register', async (req, res, next) => {
    try {
      const b = req.body || {};
      const username = typeof b.username === 'string' ? b.username.toLowerCase() : '';
      const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : '';
      const name = typeof b.name === 'string' ? b.name.trim() : '';
      const fields: Record<string, string> = {};
      if (!/^[a-z0-9_]{3,20}$/.test(username)) fields.username = 'Username must be 3-20 letters, numbers or _';
      if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) fields.email = 'Enter a valid email address';
      if (name.length < 2 || name.length > 100) fields.name = 'Full name must be 2-100 characters';
      if (!validPassword(b.password)) fields.password = 'Use 8-128 characters with upper, lower case and a number';
      if (b.password !== b.confirmPassword) fields.confirmPassword = 'Passwords do not match';
      if (b.acceptTerms !== true) fields.acceptTerms = 'You must accept the terms';
      if (Object.keys(fields).length) { res.status(422).json({ error: 'Validation failed', fields }); return; }
      const user = await db.user.create({ data: { username, email, name, passwordHash: await hashPassword(b.password) } });
      res.status(201).json(profile(user));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') { res.status(409).json({ error: 'Account already exists' }); return; }
      next(error);
    }
  });
  router.post('/login', async (req, res, next) => {
    try {
      const { username, password, remember } = req.body || {};
      if (typeof username !== 'string' || !username || username.length > 254 || typeof password !== 'string' || !password || password.length > 128) { res.status(422).json({ error: 'Username and password are required' }); return; }
      const key = username.trim().toLowerCase();
      const user = await db.user.findFirst({ where: { OR: [{ username: key }, { email: key }] } });
      const bucket = await consume(db, 'login', user?.id ?? key, 8, 600);
      if (!bucket.allowed) { res.set('Retry-After', String(bucket.retryAfter)).status(429).json({ error: 'Too many sign-in attempts. Try again later.' }); return; }
      const matches = await verifyPassword(password, user?.passwordHash ?? await dummyHash);
      if (!user || !matches) { res.status(401).json({ error: 'Invalid username or password' }); return; }
      if (user.locked) { res.status(423).json({ error: 'This account is locked' }); return; }
      const token = randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + (remember === true ? 7 * 86400 : 3600) * 1000);
      const issued = await transaction(db, async tx => {
        await tx.$queryRaw`SELECT id FROM orvilo."User" WHERE id = ${user.id} FOR UPDATE`;
        const current = await tx.user.findUnique({ where: { id: user.id }, include: { mfa: true } });
        if (!current || current.locked || current.passwordHash !== user.passwordHash) return false;
        if (current.mfa?.enabled) {
          const mfaToken = randomBytes(32).toString('hex');
          await tx.mfaLogin.create({ data: { tokenHash: tokenHash(mfaToken), userId: user.id, passwordHash: user.passwordHash, remember: remember === true, expiresAt: new Date(Date.now() + 300000) } });
          return { mfaRequired: true, mfaToken, sentTo: 'your authenticator app' };
        }
        await tx.session.create({ data: { userId: user.id, tokenHash: tokenHash(token), expiresAt } });
        return true;
      });
      if (!issued) { res.status(401).json({ error: 'Please sign in again' }); return; }
      await db.rateLimit.deleteMany({ where: { key: throttleKey('login', user.id) } });
      if (typeof issued === 'object') { res.set('Cache-Control', 'no-store').json(issued); return; }
      res.set('Cache-Control', 'no-store').json({ token, expiresAt, user: profile(user) });
    } catch (error) { next(error); }
  });
  router.get('/me', auth, (_req, res) => { res.set('Cache-Control', 'no-store').json(profile(res.locals.user)); });
  router.post('/logout', auth, async (_req, res, next) => {
    try {
      await db.session.deleteMany({ where: { tokenHash: res.locals.tokenHash } });
      res.json({ ok: true });
    } catch (error) { next(error); }
  });
  return router;
}



