import { expect, test, type APIRequestContext } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

const { accounts, fixtures, resetMarketplace, seedMarketplace, testOtp } = require('../../scripts/vortex-marketplace-fixtures.cjs');
const { createPrismaClient } = require('../../server/database.cjs');
const { tokenHash } = require('../../dist/auth/passwords.js');
const base = '/api/v2/marketplace';
const db = createPrismaClient();
const headers = (token: string) => ({ Authorization: 'Bearer ' + token });

async function account(request: APIRequestContext, role: 'seller' | 'buyer' | 'other') {
  const username = accounts[role].username;
  const begin = await request.post('/api/v2/login', { data: { username, password: fixtures.password } });
  expect(begin.status()).toBe(200);
  const { mfaToken } = await begin.json();
  const invalid = await request.post('/api/v2/login/mfa', { data: { mfaToken, code: 'bad' } });
  expect(invalid.status()).toBe(422);
  const verify = await request.post('/api/v2/login/mfa', { data: { mfaToken, code: await testOtp(fixtures.otpSecret) } });
  expect(verify.status()).toBe(200);
  return (await verify.json()).token as string;
}

test.beforeAll(async () => {
  await resetMarketplace(db);
  await seedMarketplace(db);
});
test.afterAll(async () => {
  try { await resetMarketplace(db); }
  finally { await db.$disconnect(); }
});

test('marketplace API keeps published inventory, file ownership and enquiries consistent across roles', async ({ request }) => {
  const seller = headers(await account(request, 'seller'));
  const buyerToken = await account(request, 'buyer');
  const buyer = headers(buyerToken);
  const other = headers(await account(request, 'other'));
  const listing = { name: 'Workshop bolts', description: 'Zinc-plated fasteners', category: 'Industrial supplies', unitPrice: '2.50', minimumQuantity: 10 };
  const draft = await request.post(base + '/listings', { headers: seller, data: listing });
  expect(draft.status()).toBe(201);
  const { id } = await draft.json();
  const catalogue = base + '/catalog?q=workshop';
  const nativeCatalogue = base + '/native/catalog?q=workshop';
  const nativeCategories = base + '/native/categories';
  const appKey = { 'X-Vortex-Api-Key': 'vortex_pk_ci_stockpilot' };
  const quotePath = base + '/catalog/' + id + '/enquiries';
  const own = base + '/listings/' + id;
  expect((await request.post(base + '/listings', { headers: buyer, data: listing })).status()).toBe(403);
  expect((await request.patch(own, { headers: other, data: listing })).status()).toBe(404);
  expect(await (await request.get(catalogue)).json()).toMatchObject({ items: [], total: 0 });
  expect((await request.get(nativeCatalogue)).status()).toBe(401);
  expect((await request.get(nativeCategories, { headers: { 'X-Vortex-Api-Key': 'unknown' } })).status()).toBe(401);
  const categories = await request.get(nativeCategories, { headers: appKey });
  expect(categories.status()).toBe(200);
  expect((await categories.json()).categories).toContain('Industrial supplies');
  expect(await (await request.get(nativeCatalogue, { headers: appKey })).json()).toMatchObject({ items: [], total: 0 });
  expect((await request.post(quotePath, { headers: buyer, data: { quantity: 12, message: 'Need delivery' } })).status()).toBe(404);
  expect((await request.patch(own, { headers: seller, data: { ...listing, description: 'Bulk zinc-plated fasteners' } })).status()).toBe(200);
  expect((await request.patch(own + '/status', { headers: seller, data: { status: 'PUBLISHED' } })).status()).toBe(200);
  expect(await (await request.get(catalogue + '&category=Industrial+supplies')).json()).toMatchObject({
    items: [{ id, supplier: 'Northline Supply', minimumQuantity: 10, unitPrice: '2.50', description: 'Bulk zinc-plated fasteners' }]
  });
  expect(await (await request.get(nativeCatalogue + '&category=Industrial+supplies&page=1', { headers: appKey })).json()).toMatchObject({
    items: [{ id, supplier: 'Northline Supply' }], total: 1, page: 1
  });
  expect((await request.get(base + '/enquiries', { headers: appKey })).status()).toBe(401);
  expect((await request.post(quotePath, { headers: appKey, data: { quantity: 12, message: 'Need delivery' } })).status()).toBe(401);
  expect(await (await request.get(base + '/catalog?q=%25')).json()).toMatchObject({ items: [] });
  expect((await request.post(quotePath, { headers: buyer, data: { quantity: 9, message: 'Need delivery' } })).status()).toBe(422);
  expect((await request.post(quotePath, { headers: buyer, data: { quantity: 12, message: '   ' } })).status()).toBe(422);
  const data = { quantity: 12, message: 'Need delivery', requestId: randomUUID() };
  const requests = await Promise.all([
    request.post(quotePath, { headers: buyer, data }),
    request.post(quotePath, { headers: buyer, data })
  ]);
  expect(requests.map(response => response.status()).sort()).toEqual([200, 201]);
  const enquiry = await requests[0].json();
  expect(await requests[1].json()).toMatchObject({ id: enquiry.id, status: 'NEW' });
  const reply = base + '/enquiries/' + enquiry.id + '/reply';
  const quote = { quoteQuantity: 12, quoteUnitPrice: '2.25', deliveryDays: 4 };
  expect(await (await request.get(base + '/enquiries?status=NEW', { headers: seller })).json()).toMatchObject({ items: [{ id: enquiry.id, status: 'NEW' }], total: 1 });
  expect(await (await request.get(base + '/enquiries', { headers: other })).json()).toMatchObject({ items: [] });
  expect((await request.post(reply, { headers: other, data: quote })).status()).toBe(404);
  expect((await request.post(reply, { headers: buyer, data: quote })).status()).toBe(403);
  expect((await request.post(reply, { headers: seller, data: quote })).status()).toBe(200);
  expect((await request.post(reply, { headers: seller, data: quote })).status()).toBe(409);
  expect((await request.patch(own + '/status', { headers: seller, data: { status: 'INACTIVE' } })).status()).toBe(200);
  expect(await (await request.get(catalogue)).json()).toMatchObject({ items: [] });
  expect(await (await request.get(nativeCatalogue, { headers: appKey })).json()).toMatchObject({ items: [] });
  expect(await (await request.get(base + '/enquiries?status=REPLIED', { headers: buyer })).json()).toMatchObject({ items: [{ id: enquiry.id, status: 'REPLIED', ...quote }] });
  await db.session.update({ where: { tokenHash: tokenHash(buyerToken) }, data: { expiresAt: new Date(1) } });
  const expired = await request.get(base + '/enquiries', { headers: buyer });
  expect(expired.status()).toBe(401);
  expect(await expired.json()).toMatchObject({ code: 'SESSION_EXPIRED' });

  const uploadPath = base + '/files';
  const upload = (name: string, bytes: Buffer, auth = seller) => request.post(uploadPath + '?' + new URLSearchParams({ name }), {
    headers: { ...auth, 'Content-Type': 'application/octet-stream' }, data: bytes
  });
  const csv = Buffer.from('item,quantity\nbolts,12\n');
  const spreadsheet = await upload('workshop.csv', csv);
  const pdf = await upload('quote.pdf', Buffer.from('%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n'));
  const workbook = await upload('workshop.xlsx', await readFile(join(__dirname, 'fixtures', 'workshop.xlsx')));
  const photo = await upload('rack.png', await sharp({ create: { width: 16, height: 16, channels: 3, background: 'white' } }).png().toBuffer());
  expect([spreadsheet.status(), pdf.status(), workbook.status(), photo.status()]).toEqual([201, 201, 201, 201]);
  expect((await upload('blocked.svg', Buffer.from('<svg/>'))).status()).toBe(415);
  expect((await upload('broken.xlsx', Buffer.from('x'))).status()).toBe(415);
  expect((await upload('wrong.png', csv)).status()).toBe(415);
  expect((await upload('oversize.csv', Buffer.alloc(2 * 1024 * 1024 + 1, 'x'))).status()).toBe(413);
  expect(await (await request.get(uploadPath, { headers: seller })).json()).toMatchObject({ counts: { PHOTO: 1, PDF: 1, SPREADSHEET: 2 } });
  const previewPath = uploadPath + '/' + (await workbook.json()).id + '/workbook-preview';
  const preview = await request.get(previewPath, { headers: seller });
  expect(preview.status()).toBe(200);
  expect((await preview.json()).sheet).toContain('Workshop quantity');
  expect((await request.get(previewPath, { headers: other })).status()).toBe(404);
  const path = uploadPath + '/' + (await spreadsheet.json()).id;
  const download = await request.get(path + '/content', { headers: seller });
  expect(download.headers()['content-disposition']).toContain('attachment');
  expect(await download.body()).toEqual(csv);
  expect((await request.get(path + '/content', { headers: other })).status()).toBe(404);
  expect((await request.delete(path, { headers: other })).status()).toBe(404);
  expect((await request.delete(path, { headers: seller })).status()).toBe(204);
  expect(await (await request.get(uploadPath, { headers: seller })).json()).toMatchObject({ counts: { PHOTO: 1, PDF: 1, SPREADSHEET: 1 } });
});
