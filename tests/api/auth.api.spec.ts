import { test, expect, ShopApi } from '../support/fixtures';
import { PASSWORD, STRONG_PASSWORD, USERS, uniqueName } from '../support/test-data';

test.describe('POST /api/login', () => {
  const cases: Array<[string, Record<string, unknown>, number, string]> = [
    ['missing fields', {}, 422, 'Username and password are required'],
    ['unknown user', { username: 'ghost', password: 'x' }, 401, 'Invalid username or password'],
    ['wrong password', { username: USERS.standard, password: 'x' }, 401, 'Invalid username or password'],
    ['locked account', { username: USERS.locked, password: PASSWORD }, 423, 'This account is locked']
  ];
  for (const [name, body, status, error] of cases) {
    test(`${name} → ${status}`, async ({ guestApi }) => {
      const res = await guestApi.post('/login', body);
      expect(res.status()).toBe(status);
      expect(await res.json()).toEqual({ error });
    });
  }

  test('success returns a token, expiry and the public profile (no password!)', async ({ guestApi }) => {
    const body = await ShopApi.ok(await guestApi.post('/login', { username: USERS.standard, password: PASSWORD }));
    expect(body).toMatchObject({ token: expect.stringMatching(/^[0-9a-f-]{36}$/), expiresAt: expect.any(String), user: { username: USERS.standard, role: 'customer' } });
    expect(body.user).not.toHaveProperty('password');
    expect(Date.parse(body.expiresAt)).toBeGreaterThan(Date.now());
  });

  test('"remember me" issues a 7-day session', async ({ guestApi }) => {
    const { expiresAt } = await ShopApi.ok(await guestApi.post('/login', { username: USERS.standard, password: PASSWORD, remember: true }));
    expect(Date.parse(expiresAt) - Date.now()).toBeGreaterThan(6 * 24 * 3600e3);
  });

  test('slow_user takes ~3 s', async ({ guestApi }) => {
    const t0 = Date.now();
    await guestApi.login(USERS.slow, PASSWORD);
    expect(Date.now() - t0).toBeGreaterThanOrEqual(2900);
  });

  test('MFA: login → code by email → session', async ({ guestApi }) => {
    const first = await ShopApi.ok(await guestApi.post('/login', { username: USERS.mfa, password: PASSWORD }));
    expect(first).toMatchObject({ mfaRequired: true, sentTo: 'm***@shoplab.test' });
    expect(first).not.toHaveProperty('token');
    const wrong = await guestApi.post('/login/mfa', { mfaToken: first.mfaToken, code: '000000' });
    expect(wrong.status()).toBe(422);
    expect((await wrong.json()).attemptsLeft).toBe(2);
    // find *our* code: mails carry a `ref` = the mfaToken, so parallel logins don't collide
    const mails = await ShopApi.ok<any[]>(await guestApi.get('/test/mailbox', { to: 'mfa_user@shoplab.test' }));
    const mine = mails.find(m => m.ref === first.mfaToken);
    const ok = await ShopApi.ok(await guestApi.post('/login/mfa', { mfaToken: first.mfaToken, code: mine.code }));
    expect(ok.user.username).toBe(USERS.mfa);
  });

  test('logout invalidates the token', async ({ api }) => {
    expect((await api.get('/me')).status()).toBe(200);
    expect((await api.post('/logout')).status()).toBe(200);
    expect((await api.get('/me')).status()).toBe(401);
  });
});

test.describe('POST /api/register', () => {
  test('field-level validation errors (422)', async ({ guestApi }) => {
    const res = await guestApi.post('/register', { username: 'a', email: 'bad', password: 'short', confirmPassword: 'nope', name: '' });
    expect(res.status()).toBe(422);
    expect((await res.json()).fields).toEqual({
      username: 'Username must be 3-20 letters, numbers or _',
      email: 'Enter a valid email address',
      name: 'Full name is required',
      password: 'Min 8 characters with upper, lower case and a number',
      confirmPassword: 'Passwords do not match',
      acceptTerms: 'You must accept the terms'
    });
  });

  test('duplicate username or email → 409', async ({ guestApi, user }) => {
    const res = await guestApi.post('/register', { username: user.username, email: user.email, name: 'X Y', password: STRONG_PASSWORD, confirmPassword: STRONG_PASSWORD, acceptTerms: true });
    expect(res.status()).toBe(409);
    expect((await res.json()).fields).toMatchObject({ username: 'Username is already taken', email: 'An account with this email already exists' });
  });

  test('201 + a welcome email', async ({ guestApi }) => {
    const username = uniqueName('api');
    const res = await guestApi.post('/register', { username, email: `${username}@shoplab.test`, name: 'Api User', password: STRONG_PASSWORD, confirmPassword: STRONG_PASSWORD, acceptTerms: true });
    expect(res.status()).toBe(201);
    const mail = await guestApi.latestMail(`${username}@shoplab.test`, 'Welcome');
    expect(mail.body).toContain(username);
  });
});

test.describe('password reset', () => {
  test('forgot never reveals whether the email exists', async ({ guestApi }) => {
    const a = await (await guestApi.post('/password/forgot', { email: 'standard_user@shoplab.test' })).json();
    const b = await (await guestApi.post('/password/forgot', { email: 'nobody@nowhere.test' })).json();
    expect(a).toEqual(b);
  });

  test('reset with the emailed code, then the old password stops working', async ({ guestApi, user }) => {
    await guestApi.post('/password/forgot', { email: user.email });
    const { code } = await guestApi.latestMail(user.email, 'Reset');
    expect((await guestApi.post('/password/reset', { email: user.email, code, password: 'weak' })).status()).toBe(422);
    expect((await guestApi.post('/password/reset', { email: user.email, code, password: 'Another-Pass2' })).status()).toBe(200);
    expect((await guestApi.post('/login', { username: user.username, password: user.password })).status()).toBe(401);
    expect((await guestApi.post('/login', { username: user.username, password: 'Another-Pass2' })).status()).toBe(200);
    // a code is single-use
    expect((await guestApi.post('/password/reset', { email: user.email, code, password: 'Third-Pass3' })).status()).toBe(400);
  });
});

test.describe('auth guard', () => {
  for (const [method, path] of [['GET', '/cart'], ['GET', '/orders'], ['POST', '/checkout'], ['GET', '/me'], ['GET', '/wishlist']] as const) {
    test(`${method} ${path} without a token → 401`, async ({ guestApi }) => {
      const res = method === 'GET' ? await guestApi.get(path) : await guestApi.post(path, {});
      expect(res.status()).toBe(401);
    });
  }
  test('garbage token → 401', async ({ guestApi }) => {
    guestApi.token = 'not-a-real-token';
    expect((await guestApi.get('/me')).status()).toBe(401);
  });
});
