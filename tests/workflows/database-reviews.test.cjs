const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const { once } = require('node:events');
require('dotenv').config();

test('reviews enforce uniqueness, validation and update ratings after account deletion', { skip: !process.env.DATABASE_URL }, async () => {
  const { prisma: db } = require('../../dist/db/client');
  const { tokenHash } = require('../../dist/auth/passwords');
  const app = require('../../src/app');
  const users = [], tokens = [];
  let product, server;
  try {
    for (let i = 0; i < 2; i++) {
      const marker = randomUUID(), token = randomBytes(32).toString('hex'); tokens.push(token);
      const u = await db.user.create({ data: { username: marker, email: `${marker}@example.test`, name: 'Review fixture', passwordHash: 'unused', sessions: { create: { tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + 120000) } } } }); users.push(u.id);
    }
    product = await db.product.create({ data: { sku: randomUUID(), name: randomUUID(), category: 'Books', description: 'Review fixture', price: 1, stock: 1 } });
    server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}/api/v2`;
    const submit = (rating, token = tokens[0], extra = {}) => fetch(`${base}/products/${product.id}/reviews`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ rating, title: 'Good item', body: 'Useful product for testing.', ...extra }) });
    assert.equal((await submit(5, '')).status, 401);
    assert.equal((await submit(6)).status, 422);
    assert.equal((await submit(4, tokens[0], { title: {} })).status, 422);
    const result = await Promise.all([submit(5), submit(5)]);
    assert.deepEqual(result.map(r => r.status).sort(), [200, 409]);
    assert.equal((await submit(2, tokens[1])).status, 200);
    const detail = await (await fetch(`${base}/products/${product.id}`)).json();
    assert.equal(detail.rating, 3.5); assert.equal(detail.reviewCount, 2);
    const reviews = await (await fetch(`${base}/products/${product.id}/reviews`)).json();
    assert.equal(reviews.length, 2); assert.equal(reviews[0].userId, undefined); assert.ok(reviews[0].username);
    const list = await (await fetch(`${base}/products?q=${product.name}&minRating=4&sort=rating`)).json();
    assert.equal(list.total, 0);
    await db.user.delete({ where: { id: users[1] } }); users.pop();
    const remaining = await db.product.findUnique({ where: { id: product.id } });
    assert.equal(Number(remaining.rating), 5); assert.equal(remaining.reviewCount, 1);
    await db.product.update({ where: { id: product.id }, data: { deletedAt: new Date() } });
    assert.equal((await fetch(`${base}/products/${product.id}/reviews`)).status, 404);
  } finally {
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    await db.user.deleteMany({ where: { id: { in: users } } });
    if (product) await db.product.delete({ where: { id: product.id } });
    await db.$disconnect();
  }
});
