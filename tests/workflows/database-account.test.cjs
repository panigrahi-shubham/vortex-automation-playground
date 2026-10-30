const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { once } = require('node:events');
require('dotenv').config();

test('account changes validate fields, protect email and revoke other sessions', { skip: !process.env.DATABASE_URL }, async () => {
  const { prisma: db } = require('../../dist/db/client');
  const app = require('../../src/app');
  let server, userId;
  try {
    server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}/api/v2`;
    const username = `account_${randomUUID().replaceAll('-', '').slice(0, 10)}`;
    const password = `Secret9${randomUUID()}`, newPassword = `Updated9${randomUUID()}`;
    const request = (path, method = 'GET', body, token) => fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const registration = await request('/register', 'POST', { username, email: `${username}@example.test`, name: 'Account User', password, confirmPassword: password, acceptTerms: true });
    assert.equal(registration.status, 201); userId = (await registration.json()).id;
    const login = async pwd => {
      const response = await request('/login', 'POST', { username, password: pwd });
      assert.equal(response.status, 200); return (await response.json()).token;
    };
    const first = await login(password), second = await login(password);
    const profile = { name: 'Updated User', email: `${username}@example.test`, phone: '9876543210', role: 'admin', username: 'hijacked' };
    assert.equal((await request('/me', 'PUT', profile)).status, 401);
    assert.equal((await request('/me', 'PUT', { ...profile, phone: 'abc' }, first)).status, 422);
    let result = await request('/me', 'PUT', profile, first); assert.equal(result.status, 200);
    const me = await result.json(); assert.equal(me.name, profile.name); assert.equal(me.phone, profile.phone); assert.equal(me.role, 'customer'); assert.equal(me.username, username);
    const changedEmail = { ...profile, email: `${username}-new@example.test` };
    assert.equal((await request('/me', 'PUT', changedEmail, first)).status, 403);
    assert.equal((await request('/me', 'PUT', { ...changedEmail, currentPassword: password }, first)).status, 200);
    const settings = { orderEmails: false, marketingEmails: true, theme: 'dark', reducedMotion: true };
    assert.equal((await request('/me/settings', 'PUT', { ...settings, theme: '__proto__' }, first)).status, 422);
    assert.equal((await request('/me/settings', 'PUT', settings, first)).status, 200);
    assert.deepEqual(await (await request('/me/settings', 'GET', undefined, second)).json(), settings);
    assert.equal((await request('/me/password', 'PUT', { currentPassword: 'wrong', newPassword }, first)).status, 403);
    assert.equal((await request('/me/password', 'PUT', { currentPassword: password, newPassword }, first)).status, 200);
    assert.equal((await request('/me', 'GET', undefined, first)).status, 200);
    assert.equal((await request('/me', 'GET', undefined, second)).status, 401);
    assert.equal((await request('/login', 'POST', { username, password })).status, 401);
    await login(newPassword);
  } finally {
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    if (userId) await db.user.delete({ where: { id: userId } });
    await db.$disconnect();
  }
});
