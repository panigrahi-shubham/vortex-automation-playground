import { Prisma, PrismaClient } from '@prisma/client';
import { Router } from 'express';
import { requireSession } from './database-sessions';
import { publicProfile, validPassword } from './profile';
import { hashPassword, verifyPassword } from './passwords';
import { transaction } from '../db/transaction';
import { WorkflowError } from '../workflows/errors';

export function accountRoutes(db: PrismaClient) {
  const router = Router(), auth = requireSession(db);
  router.put('/me', auth, async (req, res, next) => {
    const { name, email, phone, currentPassword } = req.body || {};
    const fields: Record<string, string> = {};
    if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100) fields.name = 'Full name must be 2-100 characters';
    if (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) fields.email = 'Enter a valid email address';
    if (typeof phone !== 'string' || (phone !== '' && !/^\d{10}$/.test(phone))) fields.phone = 'Enter 10 digits or leave blank';
    if (Object.keys(fields).length) { res.status(422).json({ error: 'Validation failed', fields }); return; }
    try {
      const user = await transaction(db, async tx => {
        await tx.$queryRaw`SELECT id FROM orvilo."User" WHERE id = ${res.locals.user.id} FOR UPDATE`;
        const current = await tx.user.findUniqueOrThrow({ where: { id: res.locals.user.id } });
        if (email.trim().toLowerCase() !== current.email && (typeof currentPassword !== 'string' || currentPassword.length > 128 || !await verifyPassword(currentPassword, current.passwordHash))) throw new WorkflowError(403, 'Current password is required to change email');
        if (email.trim().toLowerCase() !== current.email) {
          await tx.recoveryChallenge.deleteMany({ where: { userId: current.id } });
          await tx.testMail.deleteMany({ where: { userId: current.id } });
        }
        return tx.user.update({ where: { id: current.id }, data: { name: name.trim(), email: email.trim().toLowerCase(), phone } });
      });
      res.set('Cache-Control', 'no-store').json(publicProfile(user));
    } catch (error) {
      if (error instanceof WorkflowError) { res.status(error.status).json({ error: error.message }); return; }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') { res.status(409).json({ error: 'Email already in use', fields: { email: 'Email already in use' } }); return; }
      next(error);
    }
  });
  router.put('/me/password', auth, async (req, res, next) => {
    const { currentPassword, newPassword } = req.body || {};
    if (typeof currentPassword !== 'string' || currentPassword.length > 128 || !validPassword(newPassword)) { res.status(422).json({ error: 'Use a current password and a new password of 8-128 characters with upper, lower case and a number' }); return; }
    try {
      const encoded = await hashPassword(newPassword);
      await transaction(db, async tx => {
        await tx.$queryRaw`SELECT id FROM orvilo."User" WHERE id = ${res.locals.user.id} FOR UPDATE`;
        const user = await tx.user.findUniqueOrThrow({ where: { id: res.locals.user.id } });
        const session = await tx.session.findUnique({ where: { tokenHash: res.locals.tokenHash } });
        if (!session || session.expiresAt <= new Date() || user.locked) throw new WorkflowError(401, 'Session expired');
        if (!await verifyPassword(currentPassword, user.passwordHash)) throw new WorkflowError(403, 'Current password is incorrect');
        await tx.user.update({ where: { id: user.id }, data: { passwordHash: encoded } });
        await tx.mfaLogin.deleteMany({ where: { userId: user.id } });
        await tx.recoveryChallenge.deleteMany({ where: { userId: user.id } });
        await tx.testMail.deleteMany({ where: { userId: user.id } });
        await tx.session.deleteMany({ where: { userId: user.id, tokenHash: { not: res.locals.tokenHash } } });
      });
      res.json({ ok: true });
    } catch (error) {
      if (error instanceof WorkflowError) { res.status(error.status).json({ error: error.message }); return; }
      next(error);
    }
  });
  router.get('/me/settings', auth, (_req, res) => { res.set('Cache-Control', 'no-store').json(res.locals.user.settings); });
  router.put('/me/settings', auth, async (req, res, next) => {
    const { orderEmails, marketingEmails, theme, reducedMotion } = req.body || {};
    if (typeof orderEmails !== 'boolean' || typeof marketingEmails !== 'boolean' || typeof reducedMotion !== 'boolean' || !['system', 'light', 'dark'].includes(theme)) { res.status(422).json({ error: 'Invalid settings' }); return; }
    try {
      const user = await db.user.update({ where: { id: res.locals.user.id }, data: { settings: { orderEmails, marketingEmails, theme, reducedMotion } } });
      res.set('Cache-Control', 'no-store').json(user.settings);
    } catch (error) { next(error); }
  });
  return router;
}


