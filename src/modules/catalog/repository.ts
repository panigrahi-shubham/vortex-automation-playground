import { Prisma } from '@prisma/client';

export function catalogRepository(tx: Prisma.TransactionClient) {
  return {
    find(id: number) { return tx.product.findFirst({ where: { id, deletedAt: null } }); },
    async reserve(id: number, quantity: number) {
      if (!Number.isSafeInteger(quantity) || quantity < 1) throw new Error('Invalid quantity');
      const result = await tx.product.updateMany({
        where: { id, deletedAt: null, stock: { gte: quantity } },
        data: { stock: { decrement: quantity } }
      });
      if (result.count !== 1) throw new Error('Product unavailable or insufficient stock');
    },
    restore(id: number, quantity: number) {
      if (!Number.isSafeInteger(quantity) || quantity < 1) throw new Error('Invalid quantity');
      return tx.product.update({ where: { id }, data: { stock: { increment: quantity } } });
    }
  };
}
