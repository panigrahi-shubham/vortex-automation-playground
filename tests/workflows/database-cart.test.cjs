const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const { once } = require('node:events');
require('dotenv').config();

test('persistent cart enforces ownership, stock limits and concurrent increments', { skip: !process.env.DATABASE_URL }, async () => {
  const { prisma } = require('../../dist/db/client');
  const { tokenHash } = require('../../dist/auth/passwords');
  const app = require('../../src/app');
  const users = [], products = [], tokens = [];
  let server;
  try {
    for (let i = 0; i < 2; i++) {
      const marker = randomUUID();
      const user = await prisma.user.create({ data: { username: marker, email: `${marker}@example.test`, name: 'Cart fixture', passwordHash: 'unused-test-fixture' } });
      users.push(user.id);
      const token = randomBytes(32).toString('hex'); tokens.push(token);
      await prisma.session.create({ data: { userId: user.id, tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + 60_000) } });
    }
    const product = await prisma.product.create({ data: { sku: randomUUID(), name: 'Cart fixture', description: 'Temporary', category: 'Books', price: 0.1, stock: 8 } }); products.push(product.id);
    server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}/api/v2/cart`;
    const request = (method, suffix = '', body, token = tokens[0]) => fetch(base + suffix, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const wishlist = (method, body, token = tokens[0], suffix = '') => fetch(base.replace(/\/cart$/, '/wishlist') + suffix, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    assert.equal((await wishlist('GET', undefined, '')).status, 401);
    assert.equal((await wishlist('POST', { productId: product.id })).status, 200);
    assert.equal((await wishlist('POST', { productId: product.id })).status, 200);
    assert.equal((await (await wishlist('GET')).json()).length, 1);
    assert.equal((await (await wishlist('GET', undefined, tokens[1])).json()).length, 0);
    assert.equal((await wishlist('DELETE', undefined, tokens[1], `/${product.id}`)).status, 404);
    assert.equal((await wishlist('DELETE', undefined, tokens[0], `/${product.id}`)).status, 200);
    assert.equal((await wishlist('POST', { productId: -1 })).status, 422);
    assert.equal((await request('GET', '', undefined, '')).status, 401);
    assert.equal((await request('POST', '', { productId: product.id, qty: -1 })).status, 422);
    assert.equal((await request('POST', '', { productId: product.id, qty: 9 })).status, 409);
    const results = await Promise.all([request('POST', '', { productId: product.id, qty: 1 }), request('POST', '', { productId: product.id, qty: 2 })]);
    results.forEach(r => assert.equal(r.status, 200));
    let cart = await (await request('GET')).json();
    assert.equal(cart.items.length, 1); assert.equal(cart.count, 3); assert.equal(cart.subtotal, 0.3);
    const line = cart.items[0].lineId;
    assert.equal((await request('PATCH', `/${line}`, { qty: 4 }, tokens[1])).status, 404);
    assert.equal((await request('DELETE', `/${line}`, undefined, tokens[1])).status, 404);
    assert.equal((await (await request('GET', '', undefined, tokens[1])).json()).count, 0);
    assert.equal((await request('PATCH', `/${line}`, { qty: 5 })).status, 200);
    assert.equal((await prisma.cartLine.findUnique({ where: { id: line } })).quantity, 5);
    assert.equal((await prisma.product.findUnique({ where: { id: product.id } })).stock, 8);
    await prisma.product.update({ where: { id: product.id }, data: { stock: 1 } });
    cart = await (await request('GET')).json(); assert.equal(cart.items[0].available, false);
    assert.equal((await request('PATCH', `/${line}`, { qty: 2 })).status, 409);
    assert.equal((await request('DELETE', `/${line}`)).status, 200);
    assert.equal((await request('DELETE', `/${line}`)).status, 404);
    assert.equal((await (await request('DELETE')).json()).count, 0);
  } finally {
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await prisma.product.deleteMany({ where: { id: { in: products } } });
    await prisma.$disconnect();
  }
});

