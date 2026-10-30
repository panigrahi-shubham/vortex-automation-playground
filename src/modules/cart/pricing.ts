import { Prisma } from '@prisma/client';

// Demo-store pricing rules, matching the existing playground (not tax advice).
export const shippingMethods = { standard: { price: 5.99, freeOver: 100 }, express: { price: 14.99, freeOver: null }, nextday: { price: 24.99, freeOver: null } } as const;
export const couponCodes = ['SAVE10', 'FLAT50', 'FREESHIP', 'EXPIRED20'];
const round = (value: Prisma.Decimal) => value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
export function priceCart(subtotal: Prisma.Decimal, hasItems: boolean, coupon: string | null, method: string) {
  if (!Object.hasOwn(shippingMethods, method)) throw new Error('Invalid shipping method');
  let discount = new Prisma.Decimal(0), couponError: string | null = null;
  if (coupon === 'SAVE10') discount = round(subtotal.mul('0.10'));
  else if (coupon === 'FLAT50') {
    if (subtotal.gte(200)) discount = new Prisma.Decimal(50);
    else couponError = `Add $${new Prisma.Decimal(200).sub(subtotal).toFixed(2)} more to use FLAT50`;
  } else if (coupon === 'EXPIRED20') couponError = 'This coupon has expired';
  else if (coupon && coupon !== 'FREESHIP') couponError = 'Invalid coupon code';
  const discounted = subtotal.sub(discount);
  const chosen = shippingMethods[method as keyof typeof shippingMethods];
  const shipping = new Prisma.Decimal(!hasItems || coupon === 'FREESHIP' || (chosen.freeOver !== null && discounted.gte(chosen.freeOver)) ? 0 : chosen.price);
  const tax = round(discounted.mul('0.08'));
  return { subtotal: Number(subtotal), discount: Number(discount), coupon, couponError, shippingMethod: method, shipping: Number(shipping), tax: Number(tax), total: Number(round(discounted.add(shipping).add(tax))) };
}
