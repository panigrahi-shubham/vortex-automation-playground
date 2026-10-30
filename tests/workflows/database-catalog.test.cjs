const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { randomUUID } = require('node:crypto');
require('dotenv').config();

test('database catalog reads committed rows and excludes deleted products', { skip: !process.env.DATABASE_URL }, async () => {
  const { prisma } = require('../../dist/db/client');
  const app = require('../../src/app');
  const marker = randomUUID();
  const created = [];
  let server;
  try {
    created.push(await prisma.product.create({ data: { sku: marker, name: `TEST-${marker}`, category: 'Books', description: 'Integration fixture', price: 12.34, stock: 2 } }));
    created.push(await prisma.product.create({ data: { sku: `${marker}-deleted`, name: `TEST-${marker}`, category: 'Books', description: 'Deleted fixture', price: 1, stock: 1, deletedAt: new Date() } }));
    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}/api/v2`;
    const response = await fetch(`${base}/products?q=${marker}`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.total, 1);
    assert.equal(body.items[0].id, created[0].id);
    assert.equal(body.items[0].price, 12.34);
    assert.equal((await fetch(`${base}/products/${created[1].id}`)).status, 404);
    assert.equal((await fetch(`${base}/products?sort=__proto__`)).status, 400);
    assert.equal((await fetch(`${base}/products?page=0`)).status, 400);
    assert.equal((await fetch(`${base}/products/2147483648`)).status, 400);
  } finally {
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    await prisma.product.deleteMany({ where: { id: { in: created.map(p => p.id) } } });
    await prisma.$disconnect();
  }
});
