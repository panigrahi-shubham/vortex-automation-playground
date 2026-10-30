import { PrismaClient, Prisma } from '@prisma/client';
import { Router, Request, RequestHandler } from 'express';
import { requireSession } from '../../auth/database-sessions';
import { checkout } from '../../workflows/checkout';
import { cancelOrder } from '../../workflows/cancel-order';
import { WorkflowError } from '../../workflows/errors';

type Order = Prisma.OrderGetPayload<{ include: { lines: true } }>;
const serialize = (order: Order) => ({ ...order, total: Number(order.total), paymentMode: 'simulated', lines: order.lines.map(line => ({ ...line, unitPrice: Number(line.unitPrice) })) });

export function orderRoutes(db: PrismaClient) {
  const router = Router();
  const handle = (fn: (req: Request, userId: string) => Promise<unknown>): RequestHandler => async (req, res, next) => {
    try { res.json(await fn(req, res.locals.user.id)); }
    catch (error) {
      if (error instanceof WorkflowError) { res.status(error.status).json({ error: error.message }); return; }
      next(error);
    }
  };
  router.post('/checkout', requireSession(db), handle(async (req, id) => {
    const result = await checkout(db, id, req.get('Idempotency-Key') || '', req.body);
    return { order: serialize(result.order), replayed: result.replayed };
  }));
  router.use('/orders', requireSession(db));
  router.get('/orders', handle(async (req, id) => {
    const page = Number(req.query.page ?? 1);
    if (!Number.isSafeInteger(page) || page < 1 || page > 1000000) throw new WorkflowError(400, 'Invalid page');
    return (await db.order.findMany({ where: { userId: id }, include: { lines: true }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 25, skip: (page - 1) * 25 })).map(serialize);
  }));
  router.get('/orders/:id', handle(async (req, id) => {
    const order = await db.order.findFirst({ where: { id: String(req.params.id), userId: id }, include: { lines: true } });
    if (!order) throw new WorkflowError(404, 'Order not found');
    return serialize(order);
  }));
  router.post('/orders/:id/cancel', handle(async (req, id) => serialize(await cancelOrder(db, id, String(req.params.id)))));
  router.get('/orders/:id/invoice', async (req, res, next) => {
    try {
      const order = await db.order.findFirst({ where: { id: String(req.params.id), userId: res.locals.user.id }, include: { lines: true } });
      if (!order) { res.status(404).json({ error: 'Order not found' }); return; }
      const pricing = (order.pricing ?? {}) as { subtotal?: number; discount?: number; shipping?: number; tax?: number };
      const address = (order.address ?? {}) as Record<string, unknown>;
      const fixed = (value: unknown) => Number(value ?? 0).toFixed(2);
      const cell = (value: string) => `"${(/^[\s]*[=+\-@]/.test(value) ? "'" : '') + value.replaceAll('"', '""')}"`;
      const variantLabel = (value: string) => {
        if (!value) return '';
        try { const v = JSON.parse(value); return `${v.size} / ${v.color}`; } catch { return value; }
      };
      const csv = [
        'ORVILO INVOICE', '-'.repeat(40),
        `Order:    ${order.id}`,
        `Date:     ${order.createdAt.toISOString()}`,
        cell(`Customer: ${String(address.name ?? '')}`),
        `Status:   ${order.status}`, '',
        'Item,Qty,Price,Line total',
        ...order.lines.map(line => `${cell(line.name + (line.variant ? ` (${variantLabel(line.variant)})` : ''))},${line.quantity},${fixed(line.unitPrice)},${fixed(Number(line.unitPrice) * line.quantity)}`),
        '', `Subtotal,,,${fixed(pricing.subtotal)}`, `Discount,,,-${fixed(pricing.discount)}`,
        `Shipping,,,${fixed(pricing.shipping)}`, `Tax,,,${fixed(pricing.tax)}`, `TOTAL,,,${fixed(order.total)}`
      ];
      res.set('Content-Type', 'text/csv; charset=utf-8');
      res.set('Content-Disposition', `attachment; filename="invoice-${order.id}.csv"`);
      res.send(csv.join('\n'));
    } catch (error) { next(error); }
  });
  return router;
}
