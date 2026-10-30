const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { once } = require('node:events');
require('dotenv').config();

test('durable login limits and protected, expiring, single-use recovery', { skip: !process.env.DATABASE_URL }, async () => {
  const { prisma: db } = require('../../dist/db/client');
  const { throttleKey } = require('../../dist/auth/throttle');
  const app = require('../../src/app');
  process.env.ORVILO_TEST_KEY ||= randomUUID();
  const username = `reset_${randomUUID().replaceAll('-', '').slice(0, 12)}`, email = `${username}@example.test`, unknown = `${username}-absent@example.test`;
  const password = 'InitialSecret123', replacement = 'UpdatedSecret456';
  let server, userId;
  const previousEnvironment = process.env.VERCEL_ENV;
  try {
    server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}/api/v2`;
    const request = (path, body, headers = {}) => fetch(base + path, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const registration = await request('/register', { username, email, name: 'Recovery fixture', password, confirmPassword: password, acceptTerms: true });
    assert.equal(registration.status, 201); userId = (await registration.json()).id;
    const login = await request('/login', { username, password }); const token = (await login.json()).token;
    for (let i = 0; i < 8; i++) assert.equal((await request('/login', { username: i % 2 ? email : username, password: 'wrong' })).status, 401);
    const limited = await request('/login', { username, password }); assert.equal(limited.status, 429); assert.ok(Number(limited.headers.get('retry-after')) > 0);
    const known = await request('/password/forgot', { email }), absent = await request('/password/forgot', { email: unknown });
    assert.deepEqual(await known.json(), await absent.json());
    const inbox = async () => {
      const result = await request(`/test/mailbox?to=${encodeURIComponent(email)}`, undefined, { 'X-Orvilo-Test-Key': process.env.ORVILO_TEST_KEY });
      assert.equal(result.status, 200); return (await result.json())[0].code;
    };
    assert.equal((await request(`/test/mailbox?to=${email}`)).status, 403);
    const first = await inbox();
    const wrong = first === '111111' ? '222222' : '111111';
    for (let i = 0; i < 5; i++) assert.equal((await request('/password/reset', { email, code: wrong, password: replacement })).status, 422);
    assert.equal((await db.recoveryChallenge.findUnique({ where: { userId } })).attempts, 5);
    assert.equal((await request('/password/reset', { email, code: first, password: replacement })).status, 422);
    await request('/password/forgot', { email }); const second = await inbox();
    await db.recoveryChallenge.update({ where: { userId }, data: { expiresAt: new Date(0) } });
    assert.equal((await request('/password/reset', { email, code: second, password: replacement })).status, 422);
    await request('/password/forgot', { email }); const third = await inbox();
    const reset = await Promise.all([request('/password/reset', { email, code: third, password: replacement }), request('/password/reset', { email, code: third, password: replacement })]);
    assert.deepEqual(reset.map(r => r.status).sort(), [200, 422]);
    assert.equal((await request('/me', undefined, { Authorization: `Bearer ${token}` })).status, 401);
    assert.equal((await request('/login', { username, password })).status, 401);
    assert.equal((await request('/login', { username, password: replacement })).status, 200);
    assert.equal(await db.recoveryChallenge.count({ where: { userId } }), 0);
    process.env.VERCEL_ENV = 'production';
    assert.equal((await request(`/test/mailbox?to=${email}`, undefined, { 'X-Orvilo-Test-Key': process.env.ORVILO_TEST_KEY })).status, 404);
    assert.equal((await request('/password/forgot', { email })).status, 503);
  } finally {
    if (previousEnvironment === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = previousEnvironment;
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    if (userId) await db.user.delete({ where: { id: userId } });
    await db.rateLimit.deleteMany({ where: { key: { in: [throttleKey('login', userId || ''), ...[email, unknown].flatMap(e => ['forgot','reset'].map(s => throttleKey(s,e)))] } } });
    await db.$disconnect();
  }
});
