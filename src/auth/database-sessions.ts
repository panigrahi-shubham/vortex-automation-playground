import { PrismaClient } from '@prisma/client';
import { RequestHandler } from 'express';
import { tokenHash } from './passwords';

export function requireSession(db: PrismaClient): RequestHandler {
  return async (req, res, next) => {
    try {
      const authorization = req.get('authorization') || '';
      const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
      if (!/^[a-f0-9]{64}$/.test(token)) { res.status(401).json({ error: 'Unauthorized' }); return; }
      const hash = tokenHash(token);
      const session = await db.session.findUnique({ where: { tokenHash: hash }, include: { user: true } });
      if (!session || session.expiresAt <= new Date()) { res.status(401).json({ error: 'Session expired', code: 'SESSION_EXPIRED' }); return; }
      if (session.user.locked) { res.status(423).json({ error: 'This account is locked' }); return; }
      res.locals.user = session.user;
      res.locals.tokenHash = hash;
      next();
    } catch (error) { next(error); }
  };
}
