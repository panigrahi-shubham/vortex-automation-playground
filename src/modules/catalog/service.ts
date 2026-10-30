import { Prisma, PrismaClient } from '@prisma/client';
import { transaction } from '../../db/transaction';
import { enqueue } from '../../events/outbox';

export function deleteProduct(client: PrismaClient, id: number) {
  if (!Number.isSafeInteger(id) || id < 1) throw new Error('Invalid product ID');
  return transaction(client, tx => deleteProductIn(tx, id));
}
export async function deleteProductIn(tx: Prisma.TransactionClient, id: number) {
    const result = await tx.product.updateMany({ where: { id, deletedAt: null }, data: { deletedAt: new Date() } });
    if (!result.count) return false;
    await tx.cartLine.deleteMany({ where: { productId: id } });
    await tx.wishlistEntry.deleteMany({ where: { productId: id } });
    await enqueue(tx, 'product.deleted', String(id), { productId: id });
    return true;
}
