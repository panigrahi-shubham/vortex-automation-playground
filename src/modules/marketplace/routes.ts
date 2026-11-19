import express, { type RequestHandler } from 'express';
import { Prisma, type PrismaClient, type User } from '@prisma/client';
import { requireSession } from '../../auth/database-sessions';
import { transaction } from '../../db/transaction';
import { z, identifier } from '../../http/validation';
import { WorkflowError } from '../../workflows/errors';
import { marketplaceFiles } from './files';
import { marketplaceHandler } from './http';

const categories = ['Electronics', 'Industrial supplies', 'Office supplies', 'Packaging', 'Textiles'] as const;
const statuses = z.enum(['DRAFT', 'PUBLISHED', 'INACTIVE']);
const pageSize = 10;
const quantity = z.number().int().min(1).max(1_000_000);
const price = z.string().regex(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/).refine(value => Number(value) > 0, 'Enter a positive price with up to two decimal places');
const listingFields = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().min(1).max(2000),
  category: z.enum(categories),
  unitPrice: price,
  minimumQuantity: quantity,
  photoId: identifier.nullable().optional()
});
const listingQuery = z.object({
  q: z.string().trim().max(120).default(''),
  category: z.enum(categories).optional(),
  status: statuses.optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1)
});
const enquiryFields = z.object({ quantity, message: z.string().trim().min(1).max(2000), requestId: z.uuid().optional() });
const replyFields = z.object({
  quoteQuantity: quantity,
  quoteUnitPrice: price,
  deliveryDays: z.number().int().min(1).max(365)
});
const listingDetails = { seller: { select: { name: true } } } satisfies Prisma.VortexListingInclude;
const enquiryDetails = {
  listing: { select: { seller: { select: { name: true } } } },
  buyer: { select: { name: true } }
} satisfies Prisma.VortexEnquiryInclude;

function listingView({ seller, sellerId: _sellerId, unitPrice, ...row }: Prisma.VortexListingGetPayload<{ include: typeof listingDetails }>) {
  return {
    ...row,
    unitPrice: unitPrice.toFixed(2),
    supplier: seller.name,
    photoUrl: row.photoId && row.status === 'PUBLISHED' ? '/api/v2/marketplace/catalog/' + row.id + '/photo' : null
  };
}

function enquiryView({ listing, buyer, buyerId: _buyerId, requestId: _requestId, quoteUnitPrice, ...enquiry }: Prisma.VortexEnquiryGetPayload<{ include: typeof enquiryDetails }>) {
  return {
    ...enquiry,
    status: enquiry.repliedAt ? 'REPLIED' : 'NEW',
    quoteUnitPrice: quoteUnitPrice?.toFixed(2) ?? null,
    buyer: buyer.name,
    supplier: listing.seller.name
  };
}

function role(expected: 'seller' | 'customer'): RequestHandler {
  return (_req, res, next) => {
    if ((res.locals.user as User).role !== expected) { res.status(403).json({ error: expected === 'seller' ? 'Seller account required' : 'Buyer account required' }); return; }
    next();
  };
}

export function marketplaceRoutes(db: PrismaClient) {
  const router = express.Router();
  const auth = requireSession(db), seller = role('seller'), buyer = role('customer');
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.get('/categories', (_req, res) => res.json({ categories }));

  function list(owned: boolean) {
    return marketplaceHandler(async (req, res) => {
      const { q, category, status, page } = listingQuery.parse(req.query);
      const term = q.replace(/[\\%_]/g, '\\$&');
      const where: Prisma.VortexListingWhereInput = {
        ...(owned ? { sellerId: res.locals.user.id, status } : { status: 'PUBLISHED' }),
        category,
        ...(q ? { OR: [{ name: { contains: term, mode: 'insensitive' } }, { category: { contains: term, mode: 'insensitive' } }] } : {})
      };
      const [items, total] = await db.$transaction([
        db.vortexListing.findMany({ where, include: listingDetails, orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }], skip: (page - 1) * pageSize, take: pageSize }),
        db.vortexListing.count({ where })
      ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
      res.json({ items: items.map(listingView), total, page, pageSize });
    });
  }
  router.get('/catalog', list(false));
  router.get('/listings', auth, seller, list(true));
  router.get('/catalog/:id/photo', marketplaceHandler(async (req, res) => {
    const listing = await db.vortexListing.findFirst({
      where: { id: identifier.parse(req.params.id), status: 'PUBLISHED' },
      select: { sellerId: true, photo: { select: { sellerId: true, mime: true, kind: true, content: true } } }
    });
    if (!listing?.photo || listing.photo.kind !== 'PHOTO' || listing.photo.sellerId !== listing.sellerId) { res.status(404).end(); return; }
    res.type(listing.photo.mime).send(Buffer.from(listing.photo.content));
  }));

  function saveListing(editing: boolean) {
    return marketplaceHandler(async (req, res) => {
      const data = listingFields.parse(req.body);
      const sellerId: string = res.locals.user.id;
      const id = editing ? identifier.parse(req.params.id) : undefined;
      const result = await transaction(db, async tx => {
        if (data.photoId && !await tx.vortexFile.findFirst({ where: { id: data.photoId, sellerId, kind: 'PHOTO' }, select: { id: true } })) {
          throw new WorkflowError(422, 'Choose a photo from your own library');
        }
        if (!id) return tx.vortexListing.create({ data: { ...data, sellerId }, include: listingDetails });
        const updated = await tx.vortexListing.updateMany({ where: { id, sellerId }, data });
        if (!updated.count) throw new WorkflowError(404, 'Listing not found');
        return tx.vortexListing.findUniqueOrThrow({ where: { id }, include: listingDetails });
      });
      res.status(editing ? 200 : 201).json(listingView(result));
    });
  }
  router.post('/listings', auth, seller, saveListing(false));
  router.patch('/listings/:id', auth, seller, saveListing(true));
  router.patch('/listings/:id/status', auth, seller, marketplaceHandler(async (req, res) => {
    const id = identifier.parse(req.params.id);
    const { status } = z.object({ status: z.enum(['PUBLISHED', 'INACTIVE']) }).parse(req.body);
    const result = await db.vortexListing.updateMany({ where: { id, sellerId: res.locals.user.id }, data: { status } });
    if (!result.count) throw new WorkflowError(404, 'Listing not found');
    res.json({ id, status });
  }));

  router.post('/catalog/:id/enquiries', auth, buyer, marketplaceHandler(async (req, res) => {
    const listingId = identifier.parse(req.params.id);
    const data = enquiryFields.parse(req.body);
    const buyerId: string = res.locals.user.id;
    const { enquiry, created } = await db.$transaction(async tx => {
      if (data.requestId) {
        // The buyer lock serializes retries even when they arrive at different instances.
        await tx.$queryRaw`SELECT id FROM orvilo."User" WHERE id = ${buyerId} FOR NO KEY UPDATE`;
        const previous = await tx.vortexEnquiry.findUnique({ where: { buyerId_requestId: { buyerId, requestId: data.requestId } }, include: enquiryDetails });
        if (previous) {
          if (previous.listingId !== listingId || previous.quantity !== data.quantity || previous.message !== data.message) {
            throw new WorkflowError(409, 'This request ID is already used for another enquiry');
          }
          return { enquiry: previous, created: false };
        }
      }
      await tx.$queryRaw`SELECT id FROM orvilo."VortexListing" WHERE id = ${listingId} FOR SHARE`;
      const listing = await tx.vortexListing.findFirst({ where: { id: listingId, status: 'PUBLISHED' } });
      if (!listing) throw new WorkflowError(404, 'Published listing not found');
      if (data.quantity < listing.minimumQuantity) throw new WorkflowError(422, 'Quantity is below the minimum order quantity');
      const enquiry = await tx.vortexEnquiry.create({ data: { ...data, listingId, buyerId, productName: listing.name }, include: enquiryDetails });
      return { enquiry, created: true };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
    res.status(created ? 201 : 200).json(enquiryView(enquiry));
  }));
  router.get('/enquiries', auth, marketplaceHandler(async (req, res) => {
    const user: User = res.locals.user;
    if (user.role !== 'seller' && user.role !== 'customer') throw new WorkflowError(403, 'Marketplace account required');
    const { status, page } = z.object({ status: z.enum(['NEW', 'REPLIED']).optional(), page: z.coerce.number().int().min(1).max(10000).default(1) }).parse(req.query);
    const where: Prisma.VortexEnquiryWhereInput = user.role === 'seller' ? { listing: { sellerId: user.id } } : { buyerId: user.id };
    if (status) where.repliedAt = status === 'NEW' ? null : { not: null };
    const [items, total] = await db.$transaction([
      db.vortexEnquiry.findMany({ where, include: enquiryDetails, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip: (page - 1) * pageSize, take: pageSize }),
      db.vortexEnquiry.count({ where })
    ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
    res.json({ items: items.map(enquiryView), total, page, pageSize });
  }));
  router.post('/enquiries/:id/reply', auth, seller, marketplaceHandler(async (req, res) => {
    const id = identifier.parse(req.params.id);
    const data = replyFields.parse(req.body);
    const sellerId: string = res.locals.user.id;
    const result = await transaction(db, async tx => {
      const where = { id, listing: { sellerId } };
      const updated = await tx.vortexEnquiry.updateMany({ where: { ...where, repliedAt: null }, data: { ...data, repliedAt: new Date() } });
      if (!updated.count) {
        if (!await tx.vortexEnquiry.findFirst({ where, select: { id: true } })) throw new WorkflowError(404, 'Enquiry not found');
        throw new WorkflowError(409, 'A quote has already been sent');
      }
      return tx.vortexEnquiry.findUniqueOrThrow({ where: { id }, include: enquiryDetails });
    });
    res.json(enquiryView(result));
  }));

  router.use('/files', auth, seller, marketplaceFiles(db));
  return router;
}
