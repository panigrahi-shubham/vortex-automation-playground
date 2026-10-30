import { randomUUID } from 'node:crypto';
import { OutboxEvent, PrismaClient } from '@prisma/client';

export type Subscriber = (event: OutboxEvent) => Promise<void>;

// At-least-once delivery. Subscribers must deduplicate using event.id.
// A lease lets another worker retry after a crash. Handlers exceeding the lease
// may run concurrently and must be idempotent for that reason too.
export async function dispatch(client: PrismaClient, subscribers: Record<string, Subscriber>, limit = 25) {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new Error('Invalid batch size');
  const now = new Date();
  const events = await client.outboxEvent.findMany({
    where: { deliveredAt: null, availableAt: { lte: now }, OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }] },
    orderBy: { createdAt: 'asc' }, take: limit
  });
  let delivered = 0;
  for (const event of events) {
    const leaseToken = randomUUID();
    const claim = await client.outboxEvent.updateMany({
      where: { id: event.id, deliveredAt: null, OR: [{ leaseUntil: null }, { leaseUntil: { lte: new Date() } }] },
      data: { leaseToken, leaseUntil: new Date(Date.now() + 60_000), attempts: { increment: 1 } }
    });
    if (!claim.count) continue;
    try {
      const subscriber = subscribers[event.type];
      if (!subscriber) throw new Error(`No subscriber for ${event.type}`);
      await subscriber(event);
      const result = await client.outboxEvent.updateMany({ where: { id: event.id, leaseToken }, data: { deliveredAt: new Date(), leaseToken: null, leaseUntil: null, lastError: null } });
      delivered += result.count;
    } catch (error) {
      await client.outboxEvent.updateMany({ where: { id: event.id, leaseToken }, data: {
        leaseToken: null, leaseUntil: null,
        availableAt: new Date(Date.now() + Math.min(3_600_000, 1000 * 2 ** Math.min(event.attempts, 12))),
        lastError: error instanceof Error ? error.message.slice(0, 1000) : 'Subscriber failed'
      } });
    }
  }
  return delivered;
}
