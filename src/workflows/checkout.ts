import { variantAvailable } from '../modules/catalog/variants';
import { priceCart } from '../modules/cart/pricing';
import { Prisma, PrismaClient } from '@prisma/client';
import { transaction } from '../db/transaction';
import { enqueue } from '../events/outbox';
import { WorkflowError } from './errors';

export function checkout(db: PrismaClient, userId: string, key: string, body: unknown) {
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(key)) throw new WorkflowError(422, 'Idempotency-Key must be 8-100 letters, numbers, underscores or hyphens');
  const input = body as { address?: Record<string, unknown>; testPayment?: unknown; acceptTerms?: unknown } | null;
  const address: Record<string, string> = {};
  for (const field of ['name', 'line1', 'city', 'postalCode', 'country']) {
    const value = input?.address?.[field];
    if (typeof value !== 'string' || !value.trim() || value.length > 200) throw new WorkflowError(422, `Invalid address ${field}`);
    address[field] = value.trim();
  }
  for (const field of ['line2', 'state', 'phone']) {
    const value = input?.address?.[field];
    if (value === undefined || value === null) continue;
    if (typeof value !== 'string' || value.length > 200) throw new WorkflowError(422, `Invalid address ${field}`);
    if (value.trim()) address[field] = value.trim();
  }
  if (input?.acceptTerms !== true) throw new WorkflowError(422, 'You must accept the terms');
  // This is an explicit simulator. No real payment credentials are accepted.
  if (!['approved', 'declined'].includes(String(input?.testPayment))) throw new WorkflowError(422, 'Select approved or declined testPayment');
  return transaction(db, async tx => {
    await tx.$queryRaw`SELECT id FROM orvilo."User" WHERE id = ${userId} FOR UPDATE`;
    const previous = await tx.order.findUnique({ where: { userId_idempotencyKey: { userId, idempotencyKey: key } }, include: { lines: true } });
    if (previous) return { order: previous, replayed: true };
    if (input?.testPayment === 'declined') throw new WorkflowError(402, 'Simulated payment declined');
    const cart = await tx.cart.findUnique({ where: { userId }, include: { lines: { include: { product: true }, orderBy: { productId: 'asc' } } } });
    if (!cart?.lines.length) throw new WorkflowError(400, 'Cart is empty');

    let total = new Prisma.Decimal(0);
    for (const line of cart.lines) {
      if (!variantAvailable(line.product.variants, line.variant)) throw new WorkflowError(409, 'Selected product options are no longer available');
      const result = await tx.product.updateMany({ where: { id: line.productId, deletedAt: null, stock: { gte: line.quantity } }, data: { stock: { decrement: line.quantity } } });
      if (!result.count) throw new WorkflowError(409, 'Product unavailable or insufficient stock');
      total = total.add(line.product.price.mul(line.quantity));
    }
    const pricing = priceCart(total, true, cart.coupon, cart.shipping);
    if (pricing.couponError) throw new WorkflowError(409, pricing.couponError);
    const order = await tx.order.create({ data: {
      userId, idempotencyKey: key, total: pricing.total, pricing, address, paymentLast4: 'TEST',
      lines: { create: cart.lines.map(line => ({ productId: line.productId, name: line.product.name, sku: line.product.sku, quantity: line.quantity, unitPrice: line.product.price, variant: line.variant })) }
    }, include: { lines: true } });
    await tx.cartLine.deleteMany({ where: { cartId: cart.id } });
    await tx.cart.update({ where: { id: cart.id }, data: { coupon: null, shipping: 'standard' } });
    await enqueue(tx, 'order.placed', order.id, { orderId: order.id, userId, paymentMode: 'simulated' });
    return { order, replayed: false };
  });
}


