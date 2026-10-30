import { WorkflowError } from './errors';
import { Prisma, PrismaClient } from '@prisma/client';
import { transaction } from '../db/transaction';
import { catalogRepository } from '../modules/catalog/repository';
import { enqueue } from '../events/outbox';

export function cancelOrder(client: PrismaClient, userId: string, orderId: string) {
  return transaction(client, tx => cancelOrderIn(tx, userId, orderId));
}
export async function cancelOrderIn(tx: Prisma.TransactionClient, userId: string, orderId: string) {
    const order = await tx.order.findFirst({ where: { id: orderId, userId }, include: { lines: true } });
    if (!order) throw new WorkflowError(404, 'Order not found');
    if (order.status === 'Cancelled') return order;
    if (!['Placed', 'Processing'].includes(order.status)) throw new WorkflowError(409, 'Order cannot be cancelled');
    const products = catalogRepository(tx);
    for (const line of order.lines) await products.restore(line.productId, line.quantity);
    const cancelled = await tx.order.update({ where: { id: orderId }, data: { status: 'Cancelled' }, include: { lines: true } });
    await enqueue(tx, 'order.cancelled', orderId, { orderId, userId });
    return cancelled;
}

