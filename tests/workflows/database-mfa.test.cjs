const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { generateSync } = require('otplib');
const { once } = require('node:events');
require('dotenv').config();

test('MFA encrypts secrets, gates sessions, rejects replay and consumes backup codes once', { skip: !process.env.DATABASE_URL }, async () => {
  const { prisma: db } = require('../../dist/db/client');
  const { throttleKey } = require('../../dist/auth/throttle');
  const app = require('../../src/app');
  const username = `mfa_${randomUUID().replaceAll('-', '').slice(0,12)}`, password = 'SecretMfa123';
  let userId, server;
  try {
    server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}/api/v2`;
    const request = (path, body, token) => fetch(base + path, { method: body === undefined ? 'GET' : path === '/me/password' ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const registration = await request('/register', { username, email: `${username}@example.test`, name:'MFA fixture', password, confirmPassword:password, acceptTerms:true });
    userId = (await registration.json()).id;
    const login = () => request('/login', { username, password });
    const ownerToken = (await (await login()).json()).token;
    assert.equal((await request('/me/mfa/enroll', { password: 'wrong' }, ownerToken)).status, 403);
    const enrollment = await (await request('/me/mfa/enroll', { password }, ownerToken)).json();
    assert.ok(enrollment.secret); assert.match(enrollment.uri, /^otpauth:\/\//);
    const stored = await db.mfaCredential.findUnique({ where: { userId } }); assert.notEqual(stored.secret, enrollment.secret);
    const enrollmentCode = generateSync({ secret: enrollment.secret });
    const enabled = await request('/me/mfa/enable', { password, code: enrollmentCode }, ownerToken);
    assert.equal(enabled.status, 200); const { backupCodes } = await enabled.json(); assert.equal(backupCodes.length, 8);
    const challenge = await (await login()).json(); assert.equal(challenge.mfaRequired, true); assert.equal(challenge.token, undefined);
    assert.equal(await db.session.count({ where: { userId } }), 1);
    const replay = await request('/login/mfa', { mfaToken:challenge.mfaToken, code:enrollmentCode }); assert.equal(replay.status, 422);
    const success = await request('/login/mfa', { mfaToken:challenge.mfaToken, code:generateSync({ secret:enrollment.secret, epoch:Math.floor(Date.now()/1000)+30 }) }); assert.equal(success.status, 200);
    const signedIn = (await success.json()).token; assert.ok(signedIn);
    assert.equal((await request('/login/mfa', { mfaToken:challenge.mfaToken, code:backupCodes[0] })).status, 401);
    const second = await (await login()).json();
    const concurrent = await Promise.all([request('/login/mfa', { mfaToken:second.mfaToken, code:backupCodes[0] }), request('/login/mfa', { mfaToken:second.mfaToken, code:backupCodes[0] })]);
    assert.equal(concurrent.filter(r=>r.status===200).length,1);
    const third = await (await login()).json(); assert.equal((await request('/login/mfa', { mfaToken:third.mfaToken, code:backupCodes[0] })).status,422);
    await db.mfaLogin.updateMany({ where: { userId }, data: { expiresAt:new Date(0) } });
    assert.equal((await request('/login/mfa', { mfaToken:third.mfaToken, code:backupCodes[2] })).status,422);
    assert.equal((await request('/me/mfa/disable', { password, code:backupCodes[1] }, ownerToken)).status,200);
    assert.equal(await db.mfaBackupCode.count({ where:{userId} }),0);
    assert.equal((await request('/me', undefined, signedIn)).status,401);
    assert.ok((await (await login()).json()).token);
  } finally {
    if(server){ server.closeAllConnections(); await new Promise(resolve=>server.close(resolve)); }
    if(userId) await db.user.delete({where:{id:userId}});
    await db.rateLimit.deleteMany({where:{key:{in:['login','mfa-login','mfa-manage'].map(s=>throttleKey(s,userId||''))}}});
    await db.$disconnect();
  }
});

