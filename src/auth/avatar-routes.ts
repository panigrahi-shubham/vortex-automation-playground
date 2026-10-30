import express, { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { requireSession } from './database-sessions';
import { transaction } from '../db/transaction';
import { consume } from './throttle';

const formats: Record<string, string> = { 'image/png':'png', 'image/jpeg':'jpeg', 'image/webp':'webp', 'image/gif':'gif' };
export function avatarRoutes(db: PrismaClient) {
  const router = Router(), auth = requireSession(db);
  router.post('/me/avatar', auth, async (req, res, next) => {
    try {
      const limit = await consume(db, 'avatar', res.locals.user.id, 20, 600);
      if (!limit.allowed) { res.set('Retry-After', String(limit.retryAfter)).status(429).json({ error: 'Too many uploads. Try again later.' }); return; }
      next();
    } catch (error) { next(error); }
  }, express.raw({ type: Object.keys(formats), limit: '1mb', inflate: false }), async (req, res, next) => {
    const mime = (req.get('content-type') || '').split(';')[0].toLowerCase();
    if (!Object.hasOwn(formats, mime) || !Buffer.isBuffer(req.body) || !req.body.length) { res.status(415).json({ error: 'Upload a PNG, JPEG, GIF or WebP image' }); return; }
    let data: Buffer;
    try {
      const image = sharp(req.body, { limitInputPixels: 16_000_000, animated: false });
      const metadata = await image.metadata();
      if (metadata.format !== formats[mime]) throw new Error('Format mismatch');
      data = await image.rotate().resize(256,256,{ fit:'cover', withoutEnlargement:true }).webp({ quality:82 }).toBuffer();
    } catch { res.status(415).json({ error: 'Invalid image, mismatched file type, or image exceeds 16 megapixels' }); return; }
    try {
      const id = randomUUID(), userId: string = res.locals.user.id;
      const avatar = `/api/v2/avatars/${id}`;
      await transaction(db, async tx => {
        await tx.$queryRaw`SELECT id FROM orvilo."User" WHERE id = ${userId} FOR UPDATE`;
        const bytes = new Uint8Array(data);
        await tx.avatar.upsert({ where: { userId }, create: { id, userId, data: bytes }, update: { id, data: bytes } });
        await tx.user.update({ where: { id:userId }, data: { avatar } });
      });
      res.set('Cache-Control','no-store').json({ avatar });
    } catch (error) { next(error); }
  });
  router.delete('/me/avatar', auth, async (_req, res, next) => {
    try {
      await transaction(db, async tx => {
        const userId: string = res.locals.user.id;
        await tx.$queryRaw`SELECT id FROM orvilo."User" WHERE id = ${userId} FOR UPDATE`;
        await tx.user.update({ where: { id:userId }, data: { avatar:null } });
        await tx.avatar.deleteMany({ where: { userId } });
      });
      res.json({ ok:true });
    } catch (error) { next(error); }
  });
  // Profile photos are public through opaque, random URLs; no user directory is exposed.
  router.get('/avatars/:id', async (req, res, next) => {
    res.set({ 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff' });
    if (!/^[a-f0-9-]{36}$/.test(String(req.params.id))) { res.status(404).end(); return; }
    try {
      const avatar = await db.avatar.findUnique({ where: { id:String(req.params.id) } });
      if (!avatar) { res.status(404).end(); return; }
      res.type('image/webp').send(Buffer.from(avatar.data));
    } catch (error) { next(error); }
  });
  return router;
}
