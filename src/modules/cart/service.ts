import { variantKey, variantAvailable } from '../catalog/variants';
import { priceCart, couponCodes, shippingMethods } from './pricing';
import { Prisma, PrismaClient } from '@prisma/client';
import { transaction } from '../../db/transaction';

export class CartError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
const validQuantity = (qty: unknown): qty is number => Number.isSafeInteger(qty) && Number(qty) >= 1 && Number(qty) <= 99;

async function view(tx: Prisma.TransactionClient, userId: string) {
  const cart = await tx.cart.findUnique({ where: { userId }, include: { lines: { include: { product: true }, orderBy: { id: 'asc' } } } });
  const quantities = new Map<number, number>();
  for (const line of cart?.lines ?? []) quantities.set(line.productId, (quantities.get(line.productId) ?? 0) + line.quantity);
  const items = (cart?.lines ?? []).map(line => ({
    lineId: line.id, productId: line.productId, name: line.product.name,
    qty: line.quantity, variant: line.variant, price: Number(line.product.price),
    lineTotal: Number(line.product.price.mul(line.quantity)),
    available: line.product.deletedAt === null && line.product.stock >= quantities.get(line.productId)! && variantAvailable(line.product.variants, line.variant)
  }));
  const subtotal = (cart?.lines ?? []).reduce((sum, line) => sum.add(line.product.price.mul(line.quantity)), new Prisma.Decimal(0));
  return { items, ...priceCart(subtotal, items.length > 0, cart?.coupon ?? null, cart?.shipping ?? 'standard'), count: items.reduce((n, i) => n + i.qty, 0) };
}

export function cartService(db: PrismaClient) {
  async function mutate(userId: string, operation: (tx: Prisma.TransactionClient) => Promise<void>) {
    return transaction(db, async tx => {
      // Serialize one user's cart mutations, including its first creation.
      await tx.$queryRaw`SELECT id FROM orvilo."User" WHERE id = ${userId} FOR UPDATE`;
      await operation(tx);
      return view(tx, userId);
    });
  }
  return {
    read: (userId: string) => view(db, userId),
    add(userId: string, productId: unknown, qty: unknown, selection?: unknown) {
      if (!Number.isSafeInteger(productId) || Number(productId) < 1 || Number(productId) > 2147483647) throw new CartError(422, 'Invalid product ID');
      if (!validQuantity(qty)) throw new CartError(422, 'Quantity must be an integer from 1 to 99');
      return mutate(userId, async tx => {
        const product = await tx.product.findFirst({ where: { id: Number(productId), deletedAt: null } });
        if (!product) throw new CartError(404, 'Product not found');
        const variant = variantKey(product.variants, selection);
        const cart = await tx.cart.upsert({ where: { userId }, create: { userId }, update: {} });
        const existing = await tx.cartLine.findUnique({ where: { cartId_productId_variant: { cartId: cart.id, productId: product.id, variant } } });
        const quantity = (existing?.quantity ?? 0) + qty;
        const requested = await tx.cartLine.aggregate({ where: { cartId: cart.id, productId: product.id }, _sum: { quantity: true } });
        if (quantity > 99 || (requested._sum.quantity ?? 0) + qty > product.stock) throw new CartError(409, 'Requested quantity unavailable');
        await tx.cartLine.upsert({
          where: { cartId_productId_variant: { cartId: cart.id, productId: product.id, variant } },
          create: { cartId: cart.id, productId: product.id, quantity, variant }, update: { quantity }
        });
      });
    },
    update(userId: string, lineId: string, qty: unknown) {
      if (!validQuantity(qty)) throw new CartError(422, 'Quantity must be an integer from 1 to 99');
      return mutate(userId, async tx => {
        const line = await tx.cartLine.findFirst({ where: { id: lineId, cart: { userId } }, include: { product: true } });
        if (!line) throw new CartError(404, 'Cart line not found');
        const other = await tx.cartLine.aggregate({ where: { cartId: line.cartId, productId: line.productId, id: { not: line.id } }, _sum: { quantity: true } });
        if (line.product.deletedAt || !variantAvailable(line.product.variants, line.variant) || qty + (other._sum.quantity ?? 0) > line.product.stock) throw new CartError(409, 'Requested quantity unavailable');
        await tx.cartLine.update({ where: { id: line.id }, data: { quantity: qty } });
      });
    },
    remove(userId: string, lineId: string) {
      return mutate(userId, async tx => {
        const result = await tx.cartLine.deleteMany({ where: { id: lineId, cart: { userId } } });
        if (!result.count) throw new CartError(404, 'Cart line not found');
      });
    },
    coupon(userId: string, input: unknown) {
      if (input !== null && typeof input !== 'string') throw new CartError(422, 'Enter a coupon code');
      const code = input === null ? null : (input as string).trim().toUpperCase();
      if (code !== null && !couponCodes.includes(code)) throw new CartError(404, 'Invalid coupon code');
      if (code === 'EXPIRED20') throw new CartError(422, 'This coupon has expired');
      return mutate(userId, async tx => {
        const current = await view(tx, userId);
        if (code === 'FLAT50' && current.subtotal < 200) throw new CartError(422, 'Minimum order of $200 required for FLAT50');
        await tx.cart.upsert({ where: { userId }, create: { userId, coupon: code }, update: { coupon: code } });
      });
    },
    shipping(userId: string, method: unknown) {
      if (typeof method !== 'string' || !Object.hasOwn(shippingMethods, method)) throw new CartError(422, 'Invalid shipping method');
      return mutate(userId, async tx => {
        await tx.cart.upsert({ where: { userId }, create: { userId, shipping: method }, update: { shipping: method } });
      });
    },
    clear(userId: string) {
      return mutate(userId, async tx => {
        await tx.cartLine.deleteMany({ where: { cart: { userId } } });
        await tx.cart.updateMany({ where: { userId }, data: { coupon: null, shipping: 'standard' } });
      });
    }
  };
}


