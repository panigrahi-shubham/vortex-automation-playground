const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { randomUUID } = require('node:crypto');
require('dotenv').config();

test('PostgreSQL business sessions isolate durable workspaces and commit concurrent payments once', { skip: !process.env.DATABASE_URL }, async () => {
  const { prisma } = require('../../dist/db/client');
  const app = require('../../src/app');
  const users = [];
  let server;
  try {
    server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}/api/v2`;
    const request = async (route, token, body) => {
      const response = await fetch(base + route, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
      return { status: response.status, data: await response.json() };
    };
    async function account() {
      const username = `biz_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
      const password = `Test9${randomUUID()}`;
      const registered = await request('/register', null, { username, password, confirmPassword: password, name: 'Business Owner', email: `${username}@example.test`, acceptTerms: true });
      assert.equal(registered.status, 201); users.push(registered.data.id);
      const login = await request('/login', null, { username, password }); assert.equal(login.status, 200);
      return login.data.token;
    }
    assert.equal((await request('/business')).status, 401);
    const token = await account();
    const initial = await request('/business', token); assert.equal(initial.status, 200); assert.equal(initial.data.version, 0);
    const setup = await request('/business/actions', token, { type: 'company.save', payload: { name: 'Persistent Business', contact: 'Business Owner', industry: 'Technology' }, version: 0, requestId: randomUUID() });
    assert.equal(setup.status, 200);
    const payment = { type: 'transfer.send', payload: { beneficiaryId: 'supplier', amount: '125.50', reference: 'Concurrent fixture' }, version: setup.data.version, requestId: randomUUID() };
    const duplicate = await Promise.all([request('/business/actions', token, payment), request('/business/actions', token, payment)]);
    assert.deepEqual(duplicate.map(r => r.status), [200, 200]);
    for (const result of duplicate) { assert.equal(result.data.state.balanceCents, 2487450); assert.equal(result.data.state.ledger.length, 2); }
    const reused = await request('/business/actions', token, { ...payment, payload: { ...payment.payload, amount: '500' } });
    assert.equal(reused.status, 409); assert.equal(reused.data.code, 'REQUEST_REUSED');
    const different = await Promise.all([1, 2].map(() => request('/business/actions', token, { ...payment, version: duplicate[0].data.version, requestId: randomUUID() })));
    assert.deepEqual(different.map(r => r.status).sort(), [200, 409]);
    const { createPrismaClient } = require('../../server/database.cjs');
    const fresh = createPrismaClient();
    try {
      const saved = await fresh.businessWorkspace.findUnique({ where: { userId: users[0] } });
      assert.equal(saved.state.company.name, 'Persistent Business'); assert.equal(saved.state.balanceCents, 2474900);
    } finally { await fresh.$disconnect(); }
    const otherToken = await account();
    const other = await request('/business', otherToken); assert.equal(other.data.state.company, null); assert.equal(other.data.state.balanceCents, 2500000);
    await prisma.user.update({ where: { id: users[0] }, data: { locked: true } });
    assert.equal((await request('/business', token)).status, 423);
    await prisma.user.delete({ where: { id: users[0] } });
    assert.equal(await prisma.businessWorkspace.findUnique({ where: { userId: users[0] } }), null);
  } finally {
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    await prisma.user.deleteMany({ where: { id: { in: users } } }); await prisma.$disconnect();
  }
});
