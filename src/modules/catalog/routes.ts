import { Router } from 'express';
import { Prisma, PrismaClient } from '@prisma/client';

// Staged database API: do not mix database catalog IDs with the legacy cart.
export function catalogRoutes(db: PrismaClient) {
  const router = Router();
  router.get('/categories', async (_req, res, next) => {
    try {
      const groups = await db.product.groupBy({
        by: ['category'],
        where: { deletedAt: null },
        _count: { _all: true },
        orderBy: { category: 'asc' }
      });
      res.json(groups.map(group => ({ name: group.category, count: group._count._all })));
    } catch (error) { next(error); }
  });
  router.get('/deal', async (_req, res, next) => {
    try {
      const products = await db.product.findMany({ where: { deletedAt: null, stock: { gt: 0 } } });
      if (!products.length) { res.status(404).json({ error: 'No deal available' }); return; }
      const { deletedAt, ...product } = products[Math.floor(Math.random() * products.length)];
      res.json({
        product: { ...product, price: Number(product.price), rating: Number(product.rating) },
        percentOff: 5 + Math.floor(Math.random() * 6) * 5,
        endsAt: new Date(Date.now() + 3600e3).toISOString()
      });
    } catch (error) { next(error); }
  });
  router.get('/products', async (req, res, next) => {
    try {
      const page = Number(req.query.page ?? 1);
      const limit = Number(req.query.limit ?? 12);
      if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > 50 || !Number.isSafeInteger((page - 1) * limit)) {
        res.status(400).json({ error: 'Invalid pagination' }); return;
      }
      if ((req.query.q !== undefined && typeof req.query.q !== 'string') || (req.query.category !== undefined && typeof req.query.category !== 'string')) {
        res.status(400).json({ error: 'Invalid filters' }); return;
      }
      const parsePrice = (value: unknown): number | undefined => {
        if (value === undefined || value === '') return undefined;
        const n = Number(value);
        return Number.isFinite(n) && n >= 0 ? n : NaN;
      };
      const minPrice = parsePrice(req.query.minPrice);
      const maxPrice = parsePrice(req.query.maxPrice);
      if (Number.isNaN(minPrice) || Number.isNaN(maxPrice)) { res.status(400).json({ error: 'Invalid price filter' }); return; }
      const minRating = req.query.minRating === undefined || req.query.minRating === '' ? undefined : Number(req.query.minRating);
      if (minRating !== undefined && (!Number.isFinite(minRating) || minRating < 0 || minRating > 5)) { res.status(400).json({ error: 'Invalid rating filter' }); return; }
      const sort = String(req.query.sort ?? '');
      const sorts: Record<string, Prisma.ProductOrderByWithRelationInput[]> = {
        '': [{ id: 'asc' }], rating: [{ rating: 'desc' }, { id: 'asc' }], newest: [{ id: 'desc' }],
        price_asc: [{ price: 'asc' }, { id: 'asc' }], price_desc: [{ price: 'desc' }, { id: 'asc' }],
        name_asc: [{ name: 'asc' }, { id: 'asc' }], name_desc: [{ name: 'desc' }, { id: 'asc' }]
      };
      if (!Object.hasOwn(sorts, sort)) { res.status(400).json({ error: 'Invalid sort' }); return; }
      const where: Prisma.ProductWhereInput = {
        deletedAt: null,
        ...(minRating !== undefined ? { rating: { gte: minRating } } : {}),
        ...(req.query.q ? { name: { contains: String(req.query.q).trim(), mode: 'insensitive' } } : {}),
        ...(req.query.category ? { category: { in: String(req.query.category).split(',').filter(Boolean) } } : {}),
        ...(minPrice !== undefined || maxPrice !== undefined ? {
          price: {
            ...(minPrice !== undefined ? { gte: new Prisma.Decimal(minPrice) } : {}),
            ...(maxPrice !== undefined ? { lte: new Prisma.Decimal(maxPrice) } : {})
          }
        } : {}),
        ...(req.query.inStock === 'true' ? { stock: { gt: 0 } } : {})
      };
      const [total, products] = await db.$transaction([
        db.product.count({ where }),
        db.product.findMany({ where, orderBy: sorts[sort], skip: (page - 1) * limit, take: limit })
      ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
      res.set('X-Total-Count', String(total));
      res.json({ total, page, pages: Math.max(1, Math.ceil(total / limit)), limit,
        items: products.map(({ deletedAt, ...p }) => ({ ...p, price: Number(p.price), rating: Number(p.rating) })) });
    } catch (error) { next(error); }
  });
  router.get('/products/:id', async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!/^\d+$/.test(req.params.id) || !Number.isSafeInteger(id) || id < 1 || id > 2147483647) { res.status(400).json({ error: 'Invalid product ID' }); return; }
      const product = await db.product.findFirst({ where: { id, deletedAt: null } });
      if (!product) { res.status(404).json({ error: 'Product not found' }); return; }
      const { deletedAt, ...data } = product;
      res.json({ ...data, price: Number(product.price), rating: Number(product.rating) });
    } catch (error) { next(error); }
  });
  return router;
}

