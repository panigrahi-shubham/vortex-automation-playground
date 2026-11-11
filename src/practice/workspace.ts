import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { priceCart, couponCodes, shippingMethods } from '../modules/cart/pricing';
import { variantKey, variantAvailable } from '../modules/catalog/variants';
import { WorkflowError } from '../workflows/errors';
import { z } from '../http/validation';

export const defectIds = [
  'BUG-01',
  'BUG-02',
  'BUG-03',
  'BUG-04',
  'BUG-05',
  'BUG-06',
  'BUG-07',
  'BUG-08',
] as const;
export type Defect = (typeof defectIds)[number];
export type PracticeProduct = {
  id: number;
  sku: string;
  name: string;
  description: string;
  category: string;
  price: number;
  stock: number;
  rating: number;
  reviewCount: number;
  variants: Prisma.JsonValue | null;
  createdAt: string;
};
type Line = { id: string; productId: number; quantity: number; variant: string };
type PracticeOrder = {
  id: string;
  idempotencyKey: string;
  lines: Array<Line & { name: string; sku: string; unitPrice: number }>;
  pricing: ReturnType<typeof priceCart>;
  total: number;
  address: Record<string, string>;
  paymentLast4: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};
type Review = {
  id: string;
  productId: number;
  username: string;
  rating: number;
  title: string;
  body: string;
  createdAt: string;
};
export type Workspace = {
  products: PracticeProduct[];
  lines: Line[];
  wishlist: number[];
  orders: PracticeOrder[];
  reviews: Review[];
  name: string;
  coupon: string | null;
  shipping: string;
};
type Input = {
  path: string;
  method: string;
  query: Record<string, unknown>;
  body: unknown;
  key: string;
  username: string;
};

export async function snapshot(tx: Prisma.TransactionClient, name: string): Promise<Workspace> {
  const products = await tx.product.findMany({
    where: { deletedAt: null },
    orderBy: { id: 'asc' },
    take: 1001,
  });
  if (products.length > 1000)
    throw new WorkflowError(409, 'Practice supports a catalog of up to 1000 products');
  return {
    products: products.map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      description: p.description,
      category: p.category,
      price: Number(p.price),
      stock: p.stock,
      rating: 0,
      reviewCount: 0,
      variants: p.variants,
      createdAt: p.createdAt.toISOString(),
    })),
    lines: [],
    wishlist: [],
    orders: [],
    reviews: [],
    name,
    coupon: null,
    shipping: 'standard',
  };
}

function parsed<T>(schema: z.ZodType<T>, value: unknown, status = 422): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new WorkflowError(status, 'Validation failed');
  return result.data;
}
const quantity = z.number().int().min(1).max(99);
const productNumber = z.number().int().positive().max(2147483647);
const stringQuery = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
  sort: z.string().optional(),
  page: z.coerce.number().int().min(1).max(1000000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  inStock: z.enum(['true', 'false', '']).optional(),
});
export function cartView(work: Workspace, defects: string[]) {
  const counts = new Map<number, number>();
  for (const line of work.lines)
    counts.set(line.productId, (counts.get(line.productId) || 0) + line.quantity);
  const items = work.lines.map((line) => {
    const product = work.products.find((p) => p.id === line.productId)!;
    return {
      lineId: line.id,
      productId: product.id,
      name: product.name,
      qty: line.quantity,
      variant: line.variant,
      price: product.price,
      lineTotal: Number(new Prisma.Decimal(product.price).mul(line.quantity)),
      available: product.stock >= counts.get(product.id)! && variantAvailable(product.variants, line.variant),
    };
  });
  const subtotal = items.reduce((sum, item) => sum.add(item.lineTotal), new Prisma.Decimal(0));
  const pricing = priceCart(subtotal, !!items.length, work.coupon, work.shipping);
  if (work.coupon === 'SAVE10' && defects.includes('BUG-05')) {
    const discount = Number(subtotal.mul('0.01').toDecimalPlaces(2));
    const adjusted = priceCart(subtotal.sub(discount), !!items.length, null, work.shipping);
    Object.assign(pricing, adjusted, { subtotal: Number(subtotal), discount, coupon: work.coupon });
  }
  return { items, ...pricing, count: items.reduce((sum, line) => sum + line.qty, 0) };
}

export function operate(work: Workspace, defects: string[], input: Input) {
  const { path, method, body, query } = input;
  const broken = (id: Defect) => defects.includes(id);
  const findProduct = (id: number) => {
    const product = work.products.find((p) => p.id === id);
    if (!product) throw new WorkflowError(404, 'Product not found');
    return product;
  };
  if (path === '/categories' && method === 'GET') {
    return [...new Set(work.products.map((p) => p.category))].map((name) => ({
      name,
      count: work.products.filter((p) => p.category === name).length,
    }));
  }
  if (path === '/deal' && method === 'GET') {
    const product = work.products.find((p) => p.stock > 0);
    if (!product) throw new WorkflowError(404, 'No deal available');
    return { product, percentOff: 10, endsAt: new Date(Date.now() + 3600000).toISOString() };
  }
  if (path === '/products' && method === 'GET') {
    const q = parsed(stringQuery, query, 400);
    const term = q.q?.trim() || '';
    let products = work.products.filter(
      (p) =>
        (broken('BUG-04') ? p.name.includes(term) : p.name.toLowerCase().includes(term.toLowerCase())) &&
        (!q.category || q.category.split(',').includes(p.category)) &&
        (q.minPrice === undefined || p.price >= q.minPrice) &&
        (q.maxPrice === undefined || p.price <= q.maxPrice) &&
        (q.minRating === undefined || p.rating >= q.minRating) &&
        (q.inStock !== 'true' || p.stock > 0),
    );
    const sorts: Record<string, (a: PracticeProduct, b: PracticeProduct) => number> = {
      '': (a, b) => a.id - b.id,
      price_asc: (a, b) => a.price - b.price || a.id - b.id,
      price_desc: (a, b) => b.price - a.price || a.id - b.id,
      name_asc: (a, b) => a.name.localeCompare(b.name) || a.id - b.id,
      name_desc: (a, b) => b.name.localeCompare(a.name) || a.id - b.id,
      rating: (a, b) => b.rating - a.rating || a.id - b.id,
      newest: (a, b) => b.id - a.id,
    };
    if (!Object.hasOwn(sorts, q.sort || '')) throw new WorkflowError(400, 'Invalid sort');
    products = products.sort(sorts[q.sort || '']);
    if (q.sort === 'price_asc' && broken('BUG-01')) products.reverse();
    const start = Math.max(0, (q.page - 1) * q.limit - (q.page > 1 && broken('BUG-07') ? 1 : 0));
    return {
      total: products.length,
      page: q.page,
      limit: q.limit,
      pages: Math.max(1, Math.ceil(products.length / q.limit)),
      items: products.slice(start, start + q.limit),
    };
  }
  const productPath = /^\/products\/(\d+)(\/reviews)?$/.exec(path);
  if (productPath) {
    const product = findProduct(Number(productPath[1]));
    if (!productPath[2] && method === 'GET') return product;
    if (productPath[2] && method === 'GET') {
      const page = parsed(z.coerce.number().int().min(1).max(1000000), query.page ?? 1, 400);
      return work.reviews.filter((r) => r.productId === product.id).slice((page - 1) * 10, page * 10);
    }
    if (productPath[2] && method === 'POST') {
      const data = parsed(
        z.strictObject({
          rating: z.number().int().min(1).max(5),
          title: z.string().trim().min(3).max(60),
          body: z.string().trim().min(10).max(500),
        }),
        body,
      );
      if (work.reviews.some((r) => r.productId === product.id))
        throw new WorkflowError(409, 'You already reviewed this product');
      const review = {
        ...data,
        id: randomUUID(),
        productId: product.id,
        username: input.username,
        createdAt: new Date().toISOString(),
      };
      work.reviews.unshift(review);
      product.rating = review.rating;
      product.reviewCount = 1;
      return review;
    }
  }
  if (path === '/wishlist' && method === 'GET') return work.wishlist.map(findProduct);
  if (path === '/wishlist' && method === 'POST') {
    const data = parsed(z.strictObject({ productId: productNumber }), body);
    findProduct(data.productId);
    if (!work.wishlist.includes(data.productId)) work.wishlist.unshift(data.productId);
    return { productIds: work.wishlist };
  }
  if (/^\/wishlist\/\d+$/.test(path) && method === 'DELETE') {
    const id = Number(path.split('/')[2]);
    if (!work.wishlist.includes(id)) throw new WorkflowError(404, 'Not in wishlist');
    work.wishlist = work.wishlist.filter((p) => p !== id);
    return { productIds: work.wishlist };
  }
  if (path === '/cart') {
    if (method === 'GET') return cartView(work, defects);
    if (method === 'DELETE') {
      work.lines = [];
      work.coupon = null;
      work.shipping = 'standard';
      return cartView(work, defects);
    }
    if (method === 'POST') {
      const data = parsed(
        z.strictObject({
          productId: productNumber,
          qty: quantity.nullish(),
          variant: z.unknown().optional(),
        }),
        body,
      );
      const target =
        data.productId % 5 === 0 && broken('BUG-02')
          ? (work.products.find((p) => p.id === data.productId + 1)?.id ?? data.productId)
          : data.productId;
      const product = findProduct(target);
      const variant = variantKey(product.variants, target === data.productId ? data.variant : null);
      const requested = data.qty ?? 1;
      const line = work.lines.find((l) => l.productId === target && l.variant === variant);
      const total = work.lines.filter((l) => l.productId === target).reduce((sum, l) => sum + l.quantity, 0);
      if ((line?.quantity || 0) + requested > 99 || total + requested > product.stock)
        throw new WorkflowError(409, 'Requested quantity unavailable');
      if (line) line.quantity += requested;
      else work.lines.push({ id: randomUUID(), productId: target, quantity: requested, variant });
      return cartView(work, defects);
    }
  }
  if (path === '/cart/coupon') {
    if (method === 'DELETE') {
      work.coupon = null;
      return cartView(work, defects);
    }
    if (method === 'POST') {
      const { code } = parsed(z.strictObject({ code: z.string().nullable() }), body);
      const coupon = code?.trim().toUpperCase() ?? null;
      if (coupon !== null && !couponCodes.includes(coupon))
        throw new WorkflowError(404, 'Invalid coupon code');
      if (coupon === 'EXPIRED20') throw new WorkflowError(422, 'This coupon has expired');
      work.coupon = coupon;
      const cart = cartView(work, defects);
      if (cart.couponError) throw new WorkflowError(422, cart.couponError);
      return cart;
    }
  }
  if (path === '/cart/shipping' && method === 'PUT') {
    const { method: shipping } = parsed(
      z.strictObject({ method: z.enum(Object.keys(shippingMethods)) }),
      body,
    );
    work.shipping = shipping;
    return cartView(work, defects);
  }
  const linePath = /^\/cart\/([\w-]+)$/.exec(path);
  if (linePath) {
    const line = work.lines.find((l) => l.id === linePath[1]);
    if (!line) throw new WorkflowError(404, 'Cart line not found');
    if (method === 'DELETE') work.lines = work.lines.filter((l) => l.id !== line.id);
    else if (method === 'PATCH') {
      const { qty } = parsed(
        z.strictObject({ qty: broken('BUG-06') ? z.number().int().min(-10000).max(10000) : quantity }),
        body,
      );
      if (!broken('BUG-06')) {
        const product = findProduct(line.productId);
        const others = work.lines
          .filter((l) => l.id !== line.id && l.productId === product.id)
          .reduce((sum, l) => sum + l.quantity, 0);
        if (qty + others > product.stock) throw new WorkflowError(409, 'Requested quantity unavailable');
      }
      line.quantity = qty;
    } else throw new WorkflowError(405, 'Method not allowed');
    return cartView(work, defects);
  }
  if (path === '/checkout' && method === 'POST') {
    if (!/^[A-Za-z0-9_-]{8,100}$/.test(input.key))
      throw new WorkflowError(422, 'A valid Idempotency-Key is required');
    const addressField = z.string().trim().min(1).max(200);
    const data = parsed(
      z.strictObject({
        address: z.object({
          name: addressField,
          line1: addressField,
          city: addressField,
          postalCode: addressField,
          country: addressField,
          line2: z.string().max(200).optional(),
          state: z.string().max(200).optional(),
          phone: z.string().max(200).optional(),
        }),
        acceptTerms: z.literal(true),
        testPayment: z.enum(['approved', 'declined']),
      }),
      body,
    );
    const previous = work.orders.find((o) => o.idempotencyKey === input.key);
    if (previous) return { order: previous, replayed: true };
    if (work.orders.length >= 100)
      throw new WorkflowError(409, 'Reset your practice workspace before creating more orders');
    if (data.testPayment === 'declined') throw new WorkflowError(402, 'Simulated payment declined');
    const cart = cartView(work, defects);
    if (!cart.items.length) throw new WorkflowError(400, 'Cart is empty');
    if (cart.couponError) throw new WorkflowError(409, cart.couponError);
    if (cart.items.some((i) => !i.available))
      throw new WorkflowError(409, 'Product unavailable or insufficient stock');
    for (const line of work.lines) findProduct(line.productId).stock -= line.quantity;
    const { items: _items, count: _count, ...pricing } = cart;
    const now = new Date().toISOString();
    const order: PracticeOrder = {
      id: 'vortex-' + randomUUID(),
      idempotencyKey: input.key,
      lines: work.lines.map((l) => ({
        ...l,
        name: findProduct(l.productId).name,
        sku: findProduct(l.productId).sku,
        unitPrice: findProduct(l.productId).price,
      })),
      pricing,
      total: Number(new Prisma.Decimal(cart.total).add(broken('BUG-03') ? cart.tax : 0).toDecimalPlaces(2)),
      address: data.address,
      paymentLast4: 'TEST',
      status: 'Placed',
      createdAt: now,
      updatedAt: now,
    };
    work.orders.unshift(order);
    work.lines = [];
    work.coupon = null;
    work.shipping = 'standard';
    return { order, replayed: false };
  }
  if (path === '/orders' && method === 'GET') {
    const page = parsed(z.coerce.number().int().min(1).max(1000000), query.page ?? 1, 400);
    return work.orders.slice((page - 1) * 25, page * 25);
  }
  const orderPath = /^\/orders\/([\w-]+)(\/cancel|\/invoice)?$/.exec(path);
  if (orderPath) {
    const order = work.orders.find((o) => o.id === orderPath[1]);
    if (!order) throw new WorkflowError(404, 'Order not found');
    if (orderPath[2] === '/cancel' && method === 'POST') {
      if (order.status !== 'Cancelled') {
        for (const line of order.lines) findProduct(line.productId).stock += line.quantity;
        order.status = 'Cancelled';
        order.updatedAt = new Date().toISOString();
      }
      return order;
    }
    if (orderPath[2] === '/invoice' && method === 'GET')
      return { invoice: 'VORTEX practice invoice\n' + order.id + '\nTotal $' + order.total.toFixed(2) };
    if (!orderPath[2] && method === 'GET') return order;
  }
  if (path === '/me' && method === 'PUT') {
    const data = parsed(z.object({ name: z.string().trim().min(2).max(100) }), body);
    work.name = broken('BUG-08') ? data.name.slice(0, -1) : data.name;
    return { name: work.name };
  }
  throw new WorkflowError(405, 'This operation is unavailable in practice mode');
}
