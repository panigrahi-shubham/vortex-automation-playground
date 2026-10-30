const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const { once } = require('node:events');
require('dotenv').config();

test('wishlist is session scoped, idempotent and hides deleted products', { skip: !process.env.DATABASE_URL }, async () => {
  const { prisma: db } = require('../../dist/db/client');
  const { tokenHash } = require('../../dist/auth/passwords');
  const app = require('../../src/app');
  let user, other, product, server;
  try {
    const marker = randomUUID(), token = randomBytes(32).toString('hex');
    user = await db.user.create({ data: { username: marker, email: `${marker}@example.test`, name: 'Wishlist fixture', passwordHash: 'unused', sessions: { create: { tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + 120000) } } } });
    other = await db.user.create({ data: { username: randomUUID(), email: `${randomUUID()}@example.test`, name: 'Other fixture', passwordHash: 'unused' } });
    product = await db.product.create({ data: { sku: randomUUID(), name: 'Wishlist fixture', description: 'Temporary', category: 'Books', price: 12.5, stock: 2, rating: 4.5, reviewCount: 2 } });
    server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}/api/v2`;
    const request = (path, method = 'GET', body, authenticated = true) => fetch(base + path, { method, headers: { ...(authenticated ? { Authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

    assert.equal((await request('/wishlist', 'GET', undefined, false)).status, 401);
    assert.deepEqual(await (await request('/wishlist')).json(), []);
    assert.equal((await request('/wishlist', 'POST', { productId: -1 })).status, 422);
    assert.equal((await request('/wishlist', 'POST', { productId: 2147483647 })).status, 404);
    assert.equal((await request('/wishlist', 'POST', { productId: product.id })).status, 200);
    assert.equal((await request('/wishlist', 'POST', { productId: product.id })).status, 200);
    const list = await (await request('/wishlist')).json();
    assert.equal(list.length, 1); assert.equal(list[0].id, product.id); assert.equal(list[0].price, 12.5); assert.equal(Number(list[0].rating), 4.5);
    assert.equal(await db.wishlistEntry.count({ where: { userId: user.id } }), 1);
    assert.equal(await db.wishlistEntry.count({ where: { userId: other.id } }), 0);

    await db.product.update({ where: { id: product.id }, data: { deletedAt: new Date() } });
    assert.deepEqual(await (await request('/wishlist')).json(), []);
    assert.equal((await request('/wishlist', 'POST', { productId: product.id })).status, 404);
    await db.product.update({ where: { id: product.id }, data: { deletedAt: null } });
    assert.equal((await request(`/wishlist/${product.id}`, 'DELETE')).status, 200);
    assert.equal((await request(`/wishlist/${product.id}`, 'DELETE')).status, 404);
  } finally {
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    if (user) await db.user.delete({ where: { id: user.id } });
    if (other) await db.user.delete({ where: { id: other.id } });
    if (product) await db.product.delete({ where: { id: product.id } });
    await db.$disconnect();
  }
});
