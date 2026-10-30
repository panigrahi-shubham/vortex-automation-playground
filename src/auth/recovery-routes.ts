import { PrismaClient } from '@prisma/client';
import { Router } from 'express';
import { randomInt, timingSafeEqual } from 'node:crypto';
import { tokenHash, hashPassword } from './passwords';
import { validPassword } from './profile';
import { transaction } from '../db/transaction';
import { consume, throttleKey } from './throttle';

export const recoveryAvailable = () => process.env.NODE_ENV !== 'production' && process.env.VERCEL_ENV !== 'production' && !!process.env.ORVILO_TEST_KEY;
export function recoveryRoutes(db: PrismaClient) {
  const router = Router();
  router.post('/password/forgot', async (req, res, next) => {
    if (!recoveryAvailable()) { res.status(503).json({ error: 'Password recovery delivery is not configured' }); return; }
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { res.status(422).json({ error: 'Enter a valid email address' }); return; }
    try {
      const bucket = await consume(db, 'forgot', email, 5, 600);
      if (!bucket.allowed) { res.set('Retry-After', String(bucket.retryAfter)).status(429).json({ error: 'Too many requests. Try again later.' }); return; }
      const user = await db.user.findUnique({ where: { email } });
      if (user && !user.locked) {
        const code = String(randomInt(100000, 1000000)), expiresAt = new Date(Date.now() + 600000);
        await transaction(db, async tx => {
          await tx.$queryRaw`SELECT id FROM orvilo."User" WHERE id = ${user.id} FOR UPDATE`;
          const current = await tx.user.findUniqueOrThrow({ where: { id: user.id } });
          if (current.email !== email || current.locked) return;
          await tx.recoveryChallenge.upsert({ where: { userId: user.id }, create: { userId: user.id, codeHash: tokenHash(code), expiresAt }, update: { codeHash: tokenHash(code), expiresAt, attempts: 0 } });
          await tx.testMail.deleteMany({ where: { userId: user.id } });
          await tx.testMail.create({ data: { userId: user.id, to: email, subject: 'Reset your Orvilo password', code, expiresAt } });
        });
      }
      res.json({ message: 'If this account exists, a reset code has been sent to the protected test inbox.' });
    } catch (error) { next(error); }
  });
  router.post('/password/reset', async (req, res, next) => {
    if (!recoveryAvailable()) { res.status(503).json({ error: 'Password recovery delivery is not configured' }); return; }
    const { code, password } = req.body || {};
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!email || email.length > 254 || typeof code !== 'string' || !/^\d{6}$/.test(code) || !validPassword(password)) { res.status(422).json({ error: 'Enter a valid email, six-digit code and strong new password' }); return; }
    try {
      const bucket = await consume(db, 'reset', email, 10, 600);
      if (!bucket.allowed) { res.set('Retry-After', String(bucket.retryAfter)).status(429).json({ error: 'Too many requests. Try again later.' }); return; }
      const encoded = await hashPassword(password);
      const user = await db.user.findUnique({ where: { email } });
      const changed = user && await transaction(db, async tx => {
        await tx.$queryRaw`SELECT id FROM orvilo."User" WHERE id = ${user.id} FOR UPDATE`;
        const current = await tx.user.findUniqueOrThrow({ where: { id: user.id } });
        const challenge = await tx.recoveryChallenge.findUnique({ where: { userId: user.id } });
        if (!challenge || current.locked || current.email !== email || challenge.expiresAt <= new Date() || challenge.attempts >= 5) return false;
        if (challenge.codeHash !== tokenHash(code)) { await tx.recoveryChallenge.update({ where: { userId: user.id }, data: { attempts: { increment: 1 } } }); return false; }
        await tx.user.update({ where: { id: user.id }, data: { passwordHash: encoded } });
        await tx.mfaLogin.deleteMany({ where: { userId: user.id } });
        await tx.session.deleteMany({ where: { userId: user.id } });
        await tx.recoveryChallenge.delete({ where: { userId: user.id } });
        await tx.testMail.deleteMany({ where: { userId: user.id } });
        await tx.rateLimit.deleteMany({ where: { key: throttleKey('login', user.id) } });
        return true;
      });
      if (!changed) { res.status(422).json({ error: 'Invalid or expired reset code' }); return; }
      res.json({ ok: true });
    } catch (error) { next(error); }
  });
  router.get('/test/mailbox', async (req, res, next) => {
    if (!recoveryAvailable()) { res.status(404).json({ error: 'Not found' }); return; }
    const supplied = tokenHash(req.get('X-Orvilo-Test-Key') || ''), expected = tokenHash(process.env.ORVILO_TEST_KEY!);
    if (!timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) { res.status(403).json({ error: 'Test key required' }); return; }
    if (typeof req.query.to !== 'string' || !req.query.to || req.query.to.length > 254) { res.status(422).json({ error: 'Recipient required' }); return; }
    try { res.set('Cache-Control', 'no-store').json(await db.testMail.findMany({ where: { to: req.query.to.trim().toLowerCase(), expiresAt: { gt: new Date() } }, orderBy: { createdAt: 'desc' }, take: 20, select: { id: true, to: true, subject: true, code: true, createdAt: true } })); }
    catch (error) { next(error); }
  });
  return router;
}

