import { Prisma } from '@prisma/client';

// Call with the same transaction that performs the domain mutation.
export function enqueue(tx: Prisma.TransactionClient, type: string, aggregateId: string, payload: Prisma.InputJsonValue) {
  return tx.outboxEvent.create({ data: { type, aggregateId, payload } });
}
