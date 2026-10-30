import { WorkflowError } from '../../workflows/errors';
import { Router, Request, RequestHandler } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireSession } from '../../auth/database-sessions';
import { CartError, cartService } from './service';

export function cartRoutes(db: PrismaClient) {
  const router = Router();
  const service = cartService(db);
  const handle = (fn: (req: Request, userId: string) => unknown): RequestHandler => async (req, res, next) => {
    try { res.json(await fn(req, res.locals.user.id)); }
    catch (error) {
      if (error instanceof CartError || error instanceof WorkflowError) { res.status(error.status).json({ error: error.message }); return; }
      next(error);
    }
  };
  router.use('/cart', requireSession(db));
  router.get('/cart', handle((_req, id) => service.read(id)));
  router.post('/cart', handle((req, id) => {

    return service.add(id, req.body?.productId, req.body?.qty ?? 1, req.body?.variant);
  }));
  router.post('/cart/coupon', handle((req, id) => service.coupon(id, req.body?.code)));
  router.delete('/cart/coupon', handle((_req, id) => service.coupon(id, null)));
  router.put('/cart/shipping', handle((req, id) => service.shipping(id, req.body?.method)));
  router.patch('/cart/:lineId', handle((req, id) => service.update(id, String(req.params.lineId), req.body?.qty)));
  router.delete('/cart/:lineId', handle((req, id) => service.remove(id, String(req.params.lineId))));
  router.delete('/cart', handle((_req, id) => service.clear(id)));
  return router;
}



