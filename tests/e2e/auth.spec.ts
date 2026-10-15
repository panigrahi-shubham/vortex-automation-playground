import { test, expect } from '../support/fixtures';
import { PASSWORD, STRONG_PASSWORD, USERS, uniqueName } from '../support/test-data';

test.describe('Sign in', () => {
  test.use({ authAs: 'guest' });

  test('standard user signs in and lands on the shop', async ({ page, loginPage }) => {
    await loginPage.goto();
    await loginPage.login(USERS.standard, PASSWORD);
    await expect(page).toHaveURL('/shop');
    await expect(loginPage.toast('Welcome back')).toBeVisible();
    await loginPage.userMenu.click();
    await expect(loginPage.signedInAs).toHaveText(USERS.standard);
  });

  test('can sign in with email instead of username', async ({ page, loginPage }) => {
    await loginPage.goto();
    await loginPage.login(`${USERS.standard}@shoplab.test`, PASSWORD);
    await expect(page).toHaveURL('/shop');
  });

  test('shows required-field errors without calling the API', async ({ page, loginPage }) => {
    let called = false;
    page.on('request', r => { if (r.url().endsWith('/api/login')) called = true; });
    await loginPage.goto();
    await loginPage.submit.click();
    await expect(page.getByTestId('username-error')).toHaveText('Username is required');
    await expect(page.getByTestId('password-error')).toHaveText('Password is required');
    await expect(loginPage.username).toHaveAttribute('aria-invalid', 'true');
    expect(called).toBe(false);
  });

  test('wrong password shows a generic error and clears the password', async ({ loginPage }) => {
    await loginPage.goto();
    await loginPage.login(USERS.standard, 'nope');
    await expect(loginPage.error).toHaveText('Invalid username or password');
    await expect(loginPage.password).toHaveValue('');
  });

  test('locked user is rejected with 423', async ({ page, loginPage }) => {
    await loginPage.goto();
    const [res] = await Promise.all([page.waitForResponse('**/api/login'), loginPage.login(USERS.locked, PASSWORD)]);
    expect(res.status()).toBe(423);
    await expect(loginPage.error).toHaveText('This account is locked');
  });

  test('five wrong passwords lock the account', async ({ loginPage, user }) => {
    await loginPage.goto();
    for (let i = 0; i < 4; i++) {
      await loginPage.login(user.username, `wrong-${i}`);
      await expect(loginPage.error).toHaveText('Invalid username or password');
    }
    await loginPage.login(user.username, 'wrong-5');
    await expect(loginPage.error).toContainText('Too many failed attempts');
    await loginPage.login(user.username, user.password); // even the right password is refused now
    await expect(loginPage.error).toHaveText('This account is locked');
  });

  test('slow user: button shows a busy state until the 3 s login finishes', async ({ page, loginPage }) => {
    await loginPage.goto();
    await loginPage.login(USERS.slow, PASSWORD);
    const busy = page.getByRole('button', { name: 'Signing in…' });
    await expect(busy).toBeDisabled();
    await expect(page).toHaveURL('/shop', { timeout: 10_000 });
  });

  test('password visibility toggle', async ({ loginPage, page }) => {
    await loginPage.goto();
    await loginPage.password.fill('peekaboo');
    const toggle = page.getByTestId('password-toggle');
    await toggle.click();
    await expect(loginPage.password).toHaveAttribute('type', 'text');
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  });

  test('protected page redirects to login and back after sign-in (returnTo)', async ({ page, loginPage, user }) => {
    await page.goto('/orders');
    await expect(page).toHaveURL(/\/login\?returnTo=%2Forders/);
    await expect(loginPage.notice).toHaveText('Please sign in to continue.');
    await loginPage.login(user.username, user.password);
    await expect(page).toHaveURL('/orders');
  });

  test.describe('two-factor', () => {
    test('two-factor login reads the OTP from the test inbox', async ({ page, loginPage, guestApi }) => {
      await loginPage.goto();
      const [loginRes] = await Promise.all([page.waitForResponse('**/api/login'), loginPage.login(USERS.mfa, PASSWORD)]);
      const { mfaToken } = await loginRes.json();
      await expect(page).toHaveURL('/login/verify');
      await expect(page.getByTestId('otp-sent-to')).toHaveText('m***@shoplab.test');
      // each mail carries `ref` = the mfaToken, so we pick our own code even when other tests log in too
      const mails = await (await guestApi.get('/test/mailbox', { to: 'mfa_user@shoplab.test' })).json();
      const code = mails.find((m: { ref: string }) => m.ref === mfaToken).code;
      // OTP boxes auto-advance — typing the whole code into the first box fills all six
      await page.getByLabel('Digit 1').pressSequentially(code);
      await page.getByRole('button', { name: 'Verify and sign in' }).click();
      await expect(page).toHaveURL('/shop');
      await expect(page.getByTestId('user-name')).toHaveText('Mfa User');
    });

    test('wrong OTP shows remaining attempts', async ({ page, loginPage }) => {
      await loginPage.goto();
      await loginPage.login(USERS.mfa, PASSWORD);
      await page.getByLabel('Digit 1').pressSequentially('000000');
      await page.getByRole('button', { name: 'Verify and sign in' }).click();
      await expect(page.getByTestId('otp-error')).toHaveText('Incorrect code. 2 attempt(s) left.');
    });
  });
});

test.describe('Session', () => {
  test('sign out clears the session', async ({ page, app }) => {
    await page.goto('/shop');
    await app.signOut();
    await expect(app.toast('You have been signed out')).toBeVisible();
    await page.goto('/cart');
    await expect(page).toHaveURL(/\/login/);
  });

  test('an expired session sends you to login with a notice (mocked 401)', async ({ page }) => {
    await page.route('**/api/cart', route => route.fulfill({ status: 401, json: { error: 'Session expired', code: 'SESSION_EXPIRED' } }));
    await page.goto('/cart');
    await expect(page).toHaveURL(/\/login\?returnTo=%2Fcart&reason=expired/);
    await expect(page.getByTestId('login-notice')).toHaveText('Your session has expired. Please sign in again.');
  });

  test('token is stored in localStorage after UI login', async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] }, baseURL });
    const page = await ctx.newPage();
    await page.goto('/login');
    await expect(page.getByTestId('cookie-banner')).toBeVisible(); // fresh browser → banner shows
    await page.getByTestId('cookie-accept').click();
    await page.getByText('Test accounts').click(); // expand the <details> disclosure
    await page.getByTestId('fill-standard_user').click();
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL('/shop');
    const token = await page.evaluate(() => localStorage.getItem('shoplab.token'));
    expect(token).toMatch(/^[0-9a-f-]{36}$/);
    await ctx.close();
  });
});

test.describe('Register & password reset', () => {
  test.use({ authAs: 'guest' });

  test('register: validation errors, then success', async ({ page }) => {
    await page.goto('/register');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByTestId('reg-username-error')).toContainText('3-20');
    await expect(page.getByTestId('reg-email-error')).toHaveText('Enter a valid email address');
    await expect(page.getByTestId('reg-terms-error')).toHaveText('You must accept the terms');

    const name = uniqueName('reg');
    await page.getByLabel('Full name').fill('New Tester');
    await page.getByLabel('Username').fill(name);
    await page.getByLabel('Email').fill(`${name}@shoplab.test`);
    await page.getByLabel('Password', { exact: true }).fill('weak');
    await expect(page.getByTestId('password-strength')).toHaveText('Too weak');
    await page.getByLabel('Password', { exact: true }).fill(STRONG_PASSWORD);
    await expect(page.getByTestId('password-strength')).toHaveText('Strong');
    await page.getByLabel('Confirm password').fill(STRONG_PASSWORD);
    await page.getByRole('checkbox', { name: /I agree to the/ }).check();
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL('/shop');
    await expect(page.getByTestId('user-name')).toHaveText('New Tester');
  });

  test('register: duplicate username is rejected', async ({ page, user }) => {
    await page.goto('/register');
    await page.getByLabel('Full name').fill('Dupe');
    await page.getByLabel('Username').fill(user.username);
    await page.getByLabel('Email').fill(`other_${Date.now()}@shoplab.test`);
    await page.getByLabel('Password', { exact: true }).fill(STRONG_PASSWORD);
    await page.getByLabel('Confirm password').fill(STRONG_PASSWORD);
    await page.getByRole('checkbox', { name: /I agree to the/ }).check();
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByTestId('reg-username-error')).toHaveText('Username is already taken');
  });

  test('terms link opens in a new tab', async ({ page, context }) => {
    await page.goto('/register');
    const [terms] = await Promise.all([context.waitForEvent('page'), page.getByRole('link', { name: /terms of service/ }).click()]);
    await expect(terms).toHaveURL('/terms');
    await expect(terms.getByRole('heading', { level: 1 })).toHaveText('Terms of Service');
  });

  test('forgot password → code from inbox → sign in with the new password', async ({ page, user, guestApi, loginPage }) => {
    await page.goto('/login');
    await page.getByRole('link', { name: 'Forgot password?' }).click();
    await page.getByLabel('Email').fill(user.email);
    await page.getByRole('button', { name: 'Send reset code' }).click();
    await expect(page.getByTestId('forgot-sent')).toContainText('If an account exists');
    const mail = await guestApi.latestMail(user.email, 'Reset your ShopLab password');
    await page.getByLabel('6-digit code').fill(mail.code!);
    await page.getByLabel('New password').fill('Brand-New-Pass1');
    await page.getByRole('button', { name: 'Update password' }).click();
    await expect(loginPage.notice).toHaveText('Password updated. Sign in with your new password.');
    await loginPage.login(user.username, 'Brand-New-Pass1');
    await expect(page).toHaveURL('/shop');
  });

  test('forgot password with a wrong code', async ({ page, user }) => {
    await page.goto(`/forgot-password?email=${encodeURIComponent(user.email)}`);
    await page.getByRole('button', { name: 'Send reset code' }).click();
    await page.getByLabel('6-digit code').fill('000000');
    await page.getByLabel('New password').fill('Brand-New-Pass1');
    await page.getByRole('button', { name: 'Update password' }).click();
    await expect(page.getByTestId('reset-code-error')).toHaveText('Invalid or expired reset code');
  });
});

test('API-created users can log in through the UI (seed via API, verify via UI)', async ({ browser, guestApi, baseURL }) => {
  const u = await guestApi.createUser({ name: 'Seeded Person' });
  const ctx = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [{ origin: new URL(baseURL!).origin, localStorage: [{ name: 'shoplab.cookies', value: 'accepted' }] }] } });
  const page = await ctx.newPage();
  await page.goto('/login');
  await page.getByLabel('Username or email').fill(u.email);
  await page.getByLabel('Password', { exact: true }).fill(u.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByTestId('user-name')).toHaveText('Seeded Person');
  await ctx.close();
});
