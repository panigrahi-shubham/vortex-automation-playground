import { Prisma, PrismaClient } from '@prisma/client';

// Only database operations belong in this callback: retries must not repeat
// payments or email. Write an outbox event for external work instead.
export async function transaction<T>(client: PrismaClient, operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await client.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 10_000,
        timeout: 15_000
      });
    } catch (error) {
      // Prisma 7's pg adapter nests the PostgreSQL SQLSTATE under the driver
      // cause for raw-query failures; Prisma 6 exposed it directly as meta.code.
      const driver = error instanceof Prisma.PrismaClientKnownRequestError
        ? error.meta?.driverAdapterError as { cause?: { originalCode?: string } } | undefined
        : undefined;
      const sqlState = error instanceof Prisma.PrismaClientKnownRequestError
        ? String(error.meta?.code ?? driver?.cause?.originalCode ?? '') : '';
      // The adapter can also reject BEGIN/COMMIT before Prisma wraps the error.
      const directConflict = error instanceof Error && error.name === 'DriverAdapterError' &&
        (error.cause as { kind?: string } | undefined)?.kind === 'TransactionWriteConflict';
      const retryable = directConflict || (error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2034' || (error.code === 'P2010' && ['40001', '40P01'].includes(sqlState))));
      if (!retryable || attempt >= 9) throw error;
      const backoff = Math.min(1000, 50 * 2 ** attempt);
      await new Promise(resolve => setTimeout(resolve, backoff + Math.random() * backoff));
    }
  }
}
