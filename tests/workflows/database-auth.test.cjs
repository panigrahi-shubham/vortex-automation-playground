const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { once } = require('node:events');
require('dotenv').config();

test('persistent authentication hashes secrets and rejects revoked, expired and locked sessions', { skip: !process.env.DATABASE_URL }, async () => {
  const { prisma } = require('../../dist/db/client');
  const { tokenHash } = require('../../dist/auth/passwords');
  const app = require('../../src/app');
  const username = `test_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
  const password = `Test9${randomUUID()}`;
  let server, userId;
  try {
    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}/api/v2`;
    const request = (route, body, token) => fetch(base + route, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    const data = { username, password, confirmPassword: password, email: `${username}@example.test`, name: 'Integration User', acceptTerms: true, role: 'admin' };
    assert.equal((await request('/register', { ...data, password: 42 })).status, 422);
    const registered = await request('/register', data);
    assert.equal(registered.status, 201);
    const profile = await registered.json();
    userId = profile.id;
    assert.equal(profile.role, 'customer');
    assert.equal(profile.passwordHash, undefined);
    const stored = await prisma.user.findUnique({ where: { id: userId } });
    assert.notEqual(stored.passwordHash, password);
    assert.match(stored.passwordHash, /^scrypt\$/);
    assert.equal((await request('/register', data)).status, 409);
    assert.equal((await request('/login', { username, password: 'wrong' })).status, 401);
    const login = async () => {
      const response = await request('/login', { username: data.email.toUpperCase(), password });
      assert.equal(response.status, 200);
      return response.json();
    };
    const first = await login();
    assert.equal((await request('/me', undefined, first.token)).status, 200);
    const session = await prisma.session.findUnique({ where: { tokenHash: tokenHash(first.token) } });
    assert.ok(session);
    assert.notEqual(session.tokenHash, first.token);
    assert.equal((await request('/logout', {}, first.token)).status, 200);
    assert.equal((await request('/me', undefined, first.token)).status, 401);
    const second = await login();
    await prisma.session.update({ where: { tokenHash: tokenHash(second.token) }, data: { expiresAt: new Date(0) } });
    assert.equal((await request('/me', undefined, second.token)).status, 401);
    const third = await login();
    await prisma.user.update({ where: { id: userId }, data: { locked: true } });
    assert.equal((await request('/me', undefined, third.token)).status, 423);
    assert.equal((await request('/login', { username, password })).status, 423);
  } finally {
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    if (userId) await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  }
});
