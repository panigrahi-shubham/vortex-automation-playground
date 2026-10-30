import { PrismaClient } from '@prisma/client';
import { Request, Router } from 'express';
import { randomBytes } from 'node:crypto';
import { requireSession } from './database-sessions';
import { transaction } from '../db/transaction';
import { WorkflowError } from '../workflows/errors';
import { tokenHash, verifyPassword } from './passwords';
import { consume } from './throttle';
import { consumeFactor, encryptSecret, mfaKey, newEnrollment } from './mfa';
import { publicProfile } from './profile';

export function mfaRoutes(db: PrismaClient) {
  const router = Router(), auth = requireSession(db);
  router.get('/me/mfa', auth, async (_req, res, next) => {
    try { const credential = await db.mfaCredential.findUnique({ where: { userId: res.locals.user.id } }); res.set('Cache-Control', 'no-store').json({ enabled: credential?.enabled ?? false }); }
    catch (error) { next(error); }
  });
  for (const action of ['enroll', 'enable', 'disable']) router.post(`/me/mfa/${action}`, auth, async (req, res, next) => {
    try {
      mfaKey();
      const userId: string = res.locals.user.id;
      const bucket = await consume(db, 'mfa-manage', userId, 8, 600);
      if (!bucket.allowed) { res.set('Retry-After', String(bucket.retryAfter)).status(429).json({ error: 'Too many attempts. Try again later.' }); return; }
      const data = await transaction(db, async tx => {
        await tx.$queryRaw`SELECT id FROM orvilo."User" WHERE id = ${userId} FOR UPDATE`;
        const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
        const session = await tx.session.findUnique({ where: { tokenHash: res.locals.tokenHash } });
        if (!session || session.expiresAt <= new Date() || user.locked) throw new WorkflowError(401, 'Session expired');
        if (typeof req.body?.password !== 'string' || req.body.password.length > 128 || !await verifyPassword(req.body.password, user.passwordHash)) throw new WorkflowError(403, 'Current password is incorrect');
        const existing = await tx.mfaCredential.findUnique({ where: { userId } });
        if (action === 'enroll') {
          if (existing?.enabled) throw new WorkflowError(409, 'MFA is already enabled');
          const enrollment = await newEnrollment(user.email);
          const secret = encryptSecret(enrollment.secret, userId), expiresAt = new Date(Date.now() + 600000);
          await tx.mfaCredential.upsert({ where: { userId }, create: { userId, secret, expiresAt }, update: { secret, expiresAt, lastStep: -1 } });
          return enrollment;
        }
        if (!existing || (action === 'enable' ? existing.enabled || existing.expiresAt <= new Date() : !existing.enabled)) throw new WorkflowError(409, 'Start a valid MFA enrollment first');
        if (!await consumeFactor(tx, userId, req.body?.code, action === 'disable')) throw new WorkflowError(422, 'Invalid or already used code. Wait for the next authenticator code.');
        await tx.mfaLogin.deleteMany({ where: { userId } });
        await tx.mfaBackupCode.deleteMany({ where: { userId } });
        await tx.session.deleteMany({ where: { userId, tokenHash: { not: res.locals.tokenHash } } });
        if (action === 'disable') { await tx.mfaCredential.delete({ where: { userId } }); return { enabled: false }; }
        const backupCodes = Array.from({ length: 8 }, () => randomBytes(12).toString('hex'));
        await tx.mfaBackupCode.createMany({ data: backupCodes.map(code => ({ userId, codeHash: tokenHash(code) })) });
        await tx.mfaCredential.update({ where: { userId }, data: { enabled: true } });
        return { enabled: true, backupCodes };
      });
      res.set('Cache-Control', 'no-store').json(data);
    } catch (error) { if (error instanceof WorkflowError) { res.status(error.status).json({ error: error.message }); return; } next(error); }
  });
  router.post('/login/mfa', async (req, res, next) => {
    const { mfaToken, code } = req.body || {};
    if (typeof mfaToken !== 'string' || !/^[a-f0-9]{64}$/.test(mfaToken) || typeof code !== 'string' || code.length > 32) { res.status(422).json({ error: 'Invalid verification request' }); return; }
    try {
      const hash = tokenHash(mfaToken), challenge = await db.mfaLogin.findUnique({ where: { tokenHash: hash } });
      if (!challenge) { res.status(401).json({ error: 'Challenge expired. Sign in again.' }); return; }
      const bucket = await consume(db, 'mfa-login', challenge.userId, 10, 600);
      if (!bucket.allowed) { res.set('Retry-After', String(bucket.retryAfter)).status(429).json({ error: 'Too many attempts. Try again later.' }); return; }
      const result = await transaction(db, async tx => {
        await tx.$queryRaw`SELECT id FROM orvilo."User" WHERE id = ${challenge.userId} FOR UPDATE`;
        const current = await tx.mfaLogin.findUnique({ where: { tokenHash: hash } });
        const user = await tx.user.findUniqueOrThrow({ where: { id: challenge.userId }, include: { mfa: true } });
        if (!current || current.expiresAt <= new Date() || current.attempts >= 5 || user.locked || !user.mfa?.enabled || current.passwordHash !== user.passwordHash) return null;
        if (!await consumeFactor(tx, user.id, code)) { await tx.mfaLogin.update({ where: { tokenHash: hash }, data: { attempts: { increment: 1 } } }); return null; }
        const token = randomBytes(32).toString('hex'), expiresAt = new Date(Date.now() + (current.remember ? 7 * 86400 : 3600) * 1000);
        await tx.session.create({ data: { userId: user.id, tokenHash: tokenHash(token), expiresAt } });
        await tx.mfaLogin.delete({ where: { tokenHash: hash } });
        return { token, expiresAt, user: publicProfile(user) };
      });
      if (!result) { res.status(422).json({ error: 'Invalid, expired or already used code' }); return; }
      res.set('Cache-Control', 'no-store').json(result);
    } catch (error) { if (error instanceof WorkflowError) { res.status(error.status).json({ error: error.message }); return; } next(error); }
  });
  return router;
}
