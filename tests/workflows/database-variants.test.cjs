const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const { once } = require('node:events');
require('dotenv').config();

test('variant lines share stock, reject removed options and survive checkout', { skip: !process.env.DATABASE_URL }, async () => {
  const { prisma: db } = require('../../dist/db/client');
  const { tokenHash } = require('../../dist/auth/passwords');
  const app = require('../../src/app');
  let user, product, server;
  const options = { size: ['M', 'L'], color: ['Black', 'Navy'] };
  const first = { size: 'M', color: 'Black' }, second = { size: 'L', color: 'Navy' };
  try {
    const marker = randomUUID(), token = randomBytes(32).toString('hex');
    user = await db.user.create({ data: { username: marker, email: `${marker}@example.test`, name: 'Variant fixture', passwordHash: 'unused', sessions: { create: { tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + 120000) } } } });
    product = await db.product.create({ data: { sku: marker, name: '=Variant "fixture"', description: 'Temporary', category: 'Fashion', stock: 3, price: 2, variants: options } });
    server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}/api/v2`;
    const request = (path, body, method = 'POST', key = randomUUID()) => fetch(base + path, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Idempotency-Key': key }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const add = variant => request('/cart', { productId: product.id, qty: 1, variant });
    assert.equal((await add(undefined)).status, 422);
    assert.equal((await add({ size: 'XL', color: 'Black' })).status, 422);
    assert.equal((await add(first)).status, 200);
    assert.equal((await add(second)).status, 200);
    const cart = await (await add({ color: 'Black', size: 'M' })).json();
    assert.equal(cart.items.length, 2); assert.equal(cart.count, 3);
    const firstLine = cart.items.find(line => JSON.parse(line.variant).size === 'M');
    assert.equal(firstLine.qty, 2);
    assert.equal((await add(second)).status, 409);
    assert.equal((await request(`/cart/${firstLine.lineId}`, { qty: 3 }, 'PATCH')).status, 409);
    const payload = { address: { name: 'Variant User', line1: '1 Road', city: 'Mumbai', country: 'IN', postalCode: '400001' }, acceptTerms: true, testPayment: 'approved' };
    await db.product.update({ where: { id: product.id }, data: { variants: { size: ['L'], color: options.color } } });
    assert.equal((await request('/checkout', payload)).status, 409);
    assert.equal((await db.product.findUnique({ where: { id: product.id } })).stock, 3);
    await db.product.update({ where: { id: product.id }, data: { variants: options } });
    const response = await request('/checkout', payload); assert.equal(response.status, 200);
    const { order } = await response.json();
    assert.equal(order.lines.length, 2);
    const invoice = await (await request(`/orders/${order.id}/invoice`, undefined, 'GET')).text();
    assert.ok(invoice.includes(`"'=Variant ""fixture"" (M / Black)"`));
    assert.deepEqual(JSON.parse(order.lines.find(line => line.quantity === 2).variant), first);
    assert.equal((await db.product.findUnique({ where: { id: product.id } })).stock, 0);
    assert.equal((await request(`/orders/${order.id}/cancel`, {})).status, 200);
    assert.equal((await db.product.findUnique({ where: { id: product.id } })).stock, 3);
  } finally {
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    if (user) {
      const orders = await db.order.findMany({ where: { userId: user.id }, select: { id: true } });
      await db.outboxEvent.deleteMany({ where: { aggregateId: { in: orders.map(o => o.id) } } });
      await db.order.deleteMany({ where: { userId: user.id } });
      await db.user.delete({ where: { id: user.id } });
    }
    if (product) await db.product.delete({ where: { id: product.id } });
    await db.$disconnect();
  }
});

