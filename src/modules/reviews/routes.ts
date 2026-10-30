import { Prisma, PrismaClient } from '@prisma/client';
import { Router, Request, RequestHandler } from 'express';
import { requireSession } from '../../auth/database-sessions';
import { transaction } from '../../db/transaction';
import { WorkflowError } from '../../workflows/errors';

export function reviewRoutes(db: PrismaClient) {
  const router = Router();
  const handle = (operation: (req: Request, userId?: string) => Promise<unknown>): RequestHandler => async (req, res, next) => {
    try { res.json(await operation(req, res.locals.user?.id)); }
    catch (error) {
      if (error instanceof WorkflowError) { res.status(error.status).json({ error: error.message }); return; }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') { res.status(409).json({ error: 'You have already reviewed this product' }); return; }
      next(error);
    }
  };
  const id = (req: Request) => {
    const value = Number(req.params.id);
    if (!/^\d+$/.test(String(req.params.id)) || !Number.isSafeInteger(value) || value < 1 || value > 2147483647) throw new WorkflowError(400, 'Invalid product ID');
    return value;
  };
  router.get('/products/:id/reviews', handle(async req => {
    const productId = id(req), page = Number(req.query.page ?? 1);
    if (!Number.isSafeInteger(page) || page < 1 || page > 1000000) throw new WorkflowError(400, 'Invalid page');
    if (!await db.product.findFirst({ where: { id: productId, deletedAt: null } })) throw new WorkflowError(404, 'Product not found');
    return (await db.review.findMany({ where: { productId }, include: { user: { select: { username: true } } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 50, skip: (page - 1) * 50 }))
      .map(({ user, userId, ...review }) => ({ ...review, username: user.username }));
  }));
  router.post('/products/:id/reviews', requireSession(db), handle(async (req, userId) => {
    const productId = id(req);
    const { rating, title, body } = req.body || {};
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new WorkflowError(422, 'Choose a rating from 1 to 5');
    if (typeof title !== 'string' || title.trim().length < 3 || title.trim().length > 60) throw new WorkflowError(422, 'Title must be 3-60 characters');
    if (typeof body !== 'string' || body.trim().length < 10 || body.trim().length > 500) throw new WorkflowError(422, 'Review must be 10-500 characters');
    return transaction(db, async tx => {
      await tx.$queryRaw`SELECT id FROM orvilo."Product" WHERE id = ${productId} FOR UPDATE`;
      if (!await tx.product.findFirst({ where: { id: productId, deletedAt: null } })) throw new WorkflowError(404, 'Product not found');
      const review = await tx.review.create({ data: { userId: userId!, productId, rating, title: title.trim(), body: body.trim() }, include: { user: { select: { username: true } } } });
      const { user, userId: owner, ...data } = review;
      return { ...data, username: user.username };
    });
  }));
  return router;
}
