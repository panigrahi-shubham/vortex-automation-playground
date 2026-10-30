import { Router, Request, RequestHandler } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireSession } from '../../auth/database-sessions';
import { transaction } from '../../db/transaction';
import { WorkflowError } from '../../workflows/errors';

export function wishlistRoutes(db: PrismaClient) {
  const router = Router();
  const handle = (operation: (req: Request, userId: string) => Promise<unknown>): RequestHandler => async (req, res, next) => {
    try { res.json(await operation(req, res.locals.user.id)); }
    catch (error) {
      if (error instanceof WorkflowError) { res.status(error.status).json({ error: error.message }); return; }
      next(error);
    }
  };
  router.use('/wishlist', requireSession(db));
  router.get('/wishlist', handle(async (_req, userId) => {
    const entries = await db.wishlistEntry.findMany({ where: { userId, product: { deletedAt: null } }, include: { product: true }, orderBy: [{ createdAt: 'desc' }, { productId: 'asc' }] });
    return entries.map(({ product: { deletedAt, ...p } }) => ({ ...p, price: Number(p.price) }));
  }));
  router.post('/wishlist', handle(async (req, userId) => {
    const productId = req.body?.productId;
    if (!Number.isSafeInteger(productId) || productId < 1 || productId > 2147483647) throw new WorkflowError(422, 'Invalid product ID');
    return transaction(db, async tx => {
      await tx.$queryRaw`SELECT id FROM orvilo."User" WHERE id = ${userId} FOR UPDATE`;
      if (!await tx.product.findFirst({ where: { id: productId, deletedAt: null } })) throw new WorkflowError(404, 'Product not found');
      await tx.wishlistEntry.upsert({ where: { userId_productId: { userId, productId } }, create: { userId, productId }, update: {} });
      return { productIds: (await tx.wishlistEntry.findMany({ where: { userId, product: { deletedAt: null } }, select: { productId: true } })).map(e => e.productId) };
    });
  }));
  router.delete('/wishlist/:productId', handle(async (req, userId) => {
    const productId = Number(req.params.productId);
    if (!/^\d+$/.test(String(req.params.productId)) || !Number.isSafeInteger(productId) || productId < 1 || productId > 2147483647) throw new WorkflowError(422, 'Invalid product ID');
    const deleted = await db.wishlistEntry.deleteMany({ where: { userId, productId } });
    if (!deleted.count) throw new WorkflowError(404, 'Not in wishlist');
    return { productIds: (await db.wishlistEntry.findMany({ where: { userId, product: { deletedAt: null } }, select: { productId: true } })).map(e => e.productId) };
  }));
  return router;
}
