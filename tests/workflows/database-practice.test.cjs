const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const { once } = require('node:events');
require('dotenv').config();

test('personal practice contains all eight defects and reset cannot affect another user or shared data',
  { skip: !process.env.DATABASE_URL, timeout: 120000 }, async () => {
  const { prisma: db } = require('../../dist/db/client');
  const { tokenHash } = require('../../dist/auth/passwords');
  const { throttleKey } = require('../../dist/auth/throttle');
  const app = require('../../src/app');
  const users = [], tokens = [], createdProducts = [];
  let server;
  const marker = 'VortexPractice' + randomUUID().replaceAll('-', '');
  try {
    for (let i = 0; i < 2; i++) {
      const username = randomUUID(), token = randomBytes(32).toString('hex');
      users.push(await db.user.create({ data: {
        username, email: username + '@example.test', name: 'Practice Tester ' + i, passwordHash: 'unused fixture',
        sessions: { create: { tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + 120000) } },
      } }));
      tokens.push(token);
    }
    // Allocate enough consecutive IDs to exercise BUG-02 without relying on seeded product IDs.
    for (let i = 0; i < 12; i++) createdProducts.push(await db.product.create({ data: {
      sku: randomUUID(), name: marker + ' Keyboard ' + i, description: 'Disposable practice fixture',
      category: 'Electronics', price: 20 + i, stock: 40,
    } }));
    const wrongTarget = createdProducts.find(p => p.id % 5 === 0 && createdProducts.some(n => n.id === p.id + 1));
    assert.ok(wrongTarget);
    const product = createdProducts[0];
    const original = await db.product.findMany({ where: { id: { in: createdProducts.map(p => p.id) } }, orderBy: { id: 'asc' } });
    server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
    const base = 'http://127.0.0.1:' + server.address().port + '/api/v2';
    async function request(path, { method = 'GET', body, user = 0, key = randomUUID() } = {}) {
      return fetch(base + path, {
        method, headers: { ...(user === null ? {} : { Authorization: 'Bearer ' + tokens[user] }), 'Content-Type': 'application/json', 'Idempotency-Key': key },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    }
    async function ok(path, options = {}) {
      const response = await request(path, options);
      assert.equal(response.status, 200, path + ': ' + await response.clone().text());
      return response.json();
    }
    const settings = (defects, user = 0) => ok('/vortex/practice', { method: 'PUT', user, body: { enabled: true, defects } });
    const clearCart = () => ok('/cart', { method: 'DELETE' });
    const add = (id = product.id) => ok('/cart', { method: 'POST', body: { productId: id, qty: 1 } });
    assert.equal((await request('/vortex/practice', { user: null })).status, 401);
    assert.equal((await request('/vortex/practice', { method: 'PUT', body: { enabled: true, defects: ['BUG-99'] } })).status, 422);
    assert.equal((await request('/vortex/practice', { method: 'PUT', body: { enabled: true, defects: [], userId: users[1].id } })).status, 422);
    await settings([], 1);
    await ok('/cart', { user: 1, method: 'POST', body: { productId: product.id, qty: 2 } });
    const otherBefore = await db.practiceProfile.findUnique({ where: { userId: users[1].id } });

    await settings(['BUG-01']);
    const sorted = await ok('/products?sort=price_asc&limit=50');
    assert.deepEqual(sorted.items.map(p => p.price), [...sorted.items.map(p => p.price)].sort((a, b) => b - a));

    await settings(['BUG-02']); await clearCart();
    const wrongCart = await add(wrongTarget.id);
    assert.equal(wrongCart.items[0].productId, wrongTarget.id + 1);

    await settings(['BUG-03']); await clearCart(); await add();
    const cart = await ok('/cart');
    const checkoutBody = { address: { name: 'Practice Tester', line1: '1 Test Lane', city: 'Pune', postalCode: '411001', country: 'IN' }, acceptTerms: true, testPayment: 'approved' };
    const key = randomUUID();
    const results = await Promise.all([0, 1].map(() => ok('/checkout', { method: 'POST', body: checkoutBody, key })));
    assert.equal(results[0].order.id, results[1].order.id);
    assert.notEqual(results[0].replayed, results[1].replayed);
    assert.equal(results[0].order.total, Math.round((cart.total + cart.tax) * 100) / 100);
    await ok('/orders/' + results[0].order.id + '/cancel', { method: 'POST' });
    await ok('/orders/' + results[0].order.id + '/cancel', { method: 'POST' });
    assert.equal((await ok('/products/' + product.id)).stock, product.stock);
    assert.equal((await request('/orders/' + results[0].order.id, { user: 1 })).status, 404);

    await settings(['BUG-04']);
    assert.equal((await ok('/products?q=' + marker.toLowerCase())).total, 0);
    assert.equal((await ok('/products?q=' + marker)).total, createdProducts.length);

    await settings(['BUG-05']); await clearCart(); await add();
    const discounted = await ok('/cart/coupon', { method: 'POST', body: { code: 'SAVE10' } });
    assert.equal(discounted.discount, Math.round(discounted.subtotal) / 100);

    await settings(['BUG-06']); await clearCart();
    const withLine = await add();
    const line = withLine.items[0].lineId;
    const negative = await ok('/cart/' + line, { method: 'PATCH', body: { qty: -5 } });
    assert.equal(negative.items[0].qty, -5);
    assert.equal((await ok('/cart/' + line, { method: 'PATCH', body: { qty: 999 } })).items[0].qty, 999);
    await clearCart();

    await settings(['BUG-07']);
    const first = await ok('/products?page=1&limit=5'), second = await ok('/products?page=2&limit=5');
    assert.equal(first.items.at(-1).id, second.items[0].id);

    await settings(['BUG-08']);
    const profile = await ok('/me', { method: 'PUT', body: { name: 'Rupesh Kumar', email: users[0].email, phone: '' } });
    assert.equal(profile.name, 'Rupesh Kuma');
    assert.equal((await db.user.findUnique({ where: { id: users[0].id } })).name, users[0].name);
    await ok('/products/' + product.id + '/reviews', { method: 'POST', body: { rating: 5, title: 'Practice review', body: 'A review inside my personal workspace.' } });
    assert.equal(await db.review.count({ where: { userId: users[0].id } }), 0);
    assert.equal((await ok('/products/' + product.id + '/reviews', { user: 1 })).length, 0);

    const beforeReset = await ok('/vortex/practice');
    const resets = await Promise.all([0, 1].map(() => request('/vortex/practice/reset', { method: 'POST', body: { generation: beforeReset.generation } })));
    assert.deepEqual(resets.map(r => r.status).sort(), [200, 409]);
    assert.deepEqual((await ok('/vortex/practice')).defects, []);
    assert.deepEqual((await ok('/cart')).items, []);
    assert.deepEqual(await ok('/orders'), []);
    assert.equal((await ok('/products?q=' + marker.toLowerCase())).total, createdProducts.length);
    assert.equal((await ok('/me', { method: 'PUT', body: { name: 'Rupesh Kumar' } })).name, 'Rupesh Kumar');
    assert.equal((await request('/cart/' + line, { method: 'PATCH', body: { qty: -5 } })).status, 404);
    await add();
    const cleanLine = (await ok('/cart')).items[0].lineId;
    assert.equal((await request('/cart/' + cleanLine, { method: 'PATCH', body: { qty: -5 } })).status, 422);
    const cleanSort = await ok('/products?sort=price_asc&limit=50');
    assert.deepEqual(cleanSort.items.map(p => p.price), [...cleanSort.items.map(p => p.price)].sort((a, b) => a - b));
    const normalCoupon = await ok('/cart/coupon', { method: 'POST', body: { code: 'SAVE10' } });
    assert.equal(normalCoupon.discount, Math.round(normalCoupon.subtotal * 10) / 100);
    assert.deepEqual(await db.practiceProfile.findUnique({ where: { userId: users[1].id } }), otherBefore);
    assert.deepEqual(await db.product.findMany({ where: { id: { in: createdProducts.map(p => p.id) } }, orderBy: { id: 'asc' } }), original);
    assert.equal(await db.order.count({ where: { userId: { in: users.map(u => u.id) } } }), 0);
    assert.equal(await db.cartLine.count({ where: { cart: { userId: users[0].id } } }), 0);
    await ok('/vortex/practice', { method: 'DELETE' });
    assert.equal((await ok('/vortex/practice')).enabled, false);
    await settings([]);
    assert.equal((await request('/vortex/practice/reset', { method: 'POST', body: { generation: beforeReset.generation } })).status, 409);
    assert.deepEqual((await ok('/cart')).items, []);
  } finally {
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    await db.rateLimit.deleteMany({ where: { key: { in: users.map(user => throttleKey('vortex-practice', user.id)) } } });
    await db.user.deleteMany({ where: { id: { in: users.map(user => user.id) } } });
    await db.product.deleteMany({ where: { id: { in: createdProducts.map(p => p.id) } } });
    await db.$disconnect();
  }
});
