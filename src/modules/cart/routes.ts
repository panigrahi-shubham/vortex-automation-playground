import { validateV2, z, productId, variant, text, identifier } from '../../http/validation';
import { WorkflowError } from '../../workflows/errors';
import { Router, Request, RequestHandler } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireSession } from '../../auth/database-sessions';
import { rateLimit } from '../../auth/throttle';
import { shippingMethods } from './pricing';
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
  router.use('/cart', requireSession(db), rateLimit(db, 'vortex-cart', (_req, res) => res.locals.user.id, 120, 60));
  router.get('/cart', validateV2(), handle((_req, id) => service.read(id)));
  router.post('/cart', validateV2({ body: z.object({ productId, qty: z.number().int().nullish(), variant: variant.nullish() }) }), handle((req, id) => {

    return service.add(id, req.body?.productId, req.body?.qty ?? 1, req.body?.variant);
  }));
  router.post('/cart/coupon', validateV2({ body: z.object({ code: text.nullable() }) }), handle((req, id) => service.coupon(id, req.body?.code)));
  router.delete('/cart/coupon', validateV2(), handle((_req, id) => service.coupon(id, null)));
  router.put('/cart/shipping', validateV2({ body: z.object({ method: z.enum(Object.keys(shippingMethods)) }) }, { message: 'Invalid shipping method' }), handle((req, id) => service.shipping(id, req.body?.method)));
  router.patch('/cart/:lineId', validateV2({ params: z.object({ lineId: identifier }), body: z.object({ qty: z.number().int() }) }), handle((req, id) => service.update(id, String(req.params.lineId), req.body?.qty)));
  router.delete('/cart/:lineId', validateV2({ params: z.object({ lineId: identifier }) }), handle((req, id) => service.remove(id, String(req.params.lineId))));
  router.delete('/cart', validateV2(), handle((_req, id) => service.clear(id)));
  return router;
}



