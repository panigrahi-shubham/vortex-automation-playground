const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const { once } = require('node:events');
require('dotenv').config();

test('checkout rolls back shortages, deduplicates retries and cancellation restores stock once', { skip: !process.env.DATABASE_URL }, async () => {
  const { prisma: db } = require('../../dist/db/client');
  const { tokenHash } = require('../../dist/auth/passwords');
  const app = require('../../src/app');
  const users = [], products = [], tokens = [];
  let server;
  try {
    for (let i = 0; i < 2; i++) {
      const marker = randomUUID(), token = randomBytes(32).toString('hex'); tokens.push(token);
      const u = await db.user.create({ data: { username: marker, email: `${marker}@example.test`, name: 'Order fixture', passwordHash: 'unused', sessions: { create: { tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + 120000) } } } }); users.push(u.id);
    }
    for (const stock of [5, 1]) products.push(await db.product.create({ data: { sku: randomUUID(), name: 'Order fixture', description: 'Temporary', category: 'Books', price: 2.5, stock } }));
    const cart = await db.cart.create({ data: { userId: users[0], lines: { create: products.map(p => ({ productId: p.id, quantity: 2 })) } } });
    server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}/api/v2`;
    const request = (path, body, token = tokens[0], key = randomUUID()) => fetch(base + path, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'Idempotency-Key': key }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const payload = { address: { name: 'Test User', line1: '1 Test Road', city: 'Mumbai', postalCode: '400001', country: 'IN' }, testPayment: 'approved', acceptTerms: true };
    assert.equal((await request('/checkout', { ...payload, testPayment: 'declined' })).status, 402);
    assert.equal((await request('/checkout', payload)).status, 409);
    assert.equal((await db.product.findUnique({ where: { id: products[0].id } })).stock, 5);
    assert.equal(await db.order.count({ where: { userId: users[0] } }), 0);
    assert.equal(await db.cartLine.count({ where: { cartId: cart.id } }), 2);
    await db.product.update({ where: { id: products[1].id }, data: { stock: 5 } });
    assert.equal((await request('/cart/coupon', { code: 'FLAT50' })).status, 422);
    assert.equal((await request('/cart/coupon', { code: 'EXPIRED20' })).status, 422);
    assert.equal((await request('/cart/coupon', { code: 'save10' })).status, 200);
    const shippingResponse = await fetch(base + '/cart/shipping', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens[0]}` }, body: JSON.stringify({ method: 'express' }) });
    assert.equal(shippingResponse.status, 200);
    assert.equal((await shippingResponse.json()).total, 24.71);
    const key = randomUUID();
    const responses = await Promise.all([request('/checkout', payload, tokens[0], key), request('/checkout', payload, tokens[0], key)]);
    responses.forEach(r => assert.equal(r.status, 200));
    const [a,b] = await Promise.all(responses.map(r => r.json()));
    assert.equal(a.order.id, b.order.id); assert.equal(a.order.total, 24.71); assert.equal(a.order.pricing.tax, 0.72); assert.equal(a.order.pricing.shipping, 14.99); assert.equal(a.order.pricing.discount, 1);
    assert.equal(Number(a.replayed) + Number(b.replayed), 1);
    assert.equal(await db.cartLine.count({ where: { cartId: cart.id } }), 0);
    assert.equal((await db.product.findUnique({ where: { id: products[0].id } })).stock, 3);
    assert.equal(await db.outboxEvent.count({ where: { aggregateId: a.order.id, type: 'order.placed' } }), 1);
    assert.equal((await request(`/orders/${a.order.id}`, undefined, tokens[1])).status, 404);
    assert.equal((await request(`/orders/${a.order.id}/cancel`, {}, tokens[1])).status, 404);
    const cancelled = await Promise.all([request(`/orders/${a.order.id}/cancel`, {}), request(`/orders/${a.order.id}/cancel`, {})]);
    cancelled.forEach(r => assert.equal(r.status, 200));
    assert.equal((await db.product.findUnique({ where: { id: products[0].id } })).stock, 5);
    assert.equal(await db.outboxEvent.count({ where: { aggregateId: a.order.id, type: 'order.cancelled' } }), 1);
  } finally {
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    const orders = await db.order.findMany({ where: { userId: { in: users } }, select: { id: true } });
    await db.outboxEvent.deleteMany({ where: { aggregateId: { in: orders.map(o => o.id) } } });
    await db.order.deleteMany({ where: { userId: { in: users } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.product.deleteMany({ where: { id: { in: products.map(p => p.id) } } });
    await db.$disconnect();
  }
});


