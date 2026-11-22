import { test, expect } from '../support/fixtures';

test.use({ authAs: 'guest' });

test('exchanges a simulated authorization code for a customer session', async ({ page, context }) => {
  await page.goto('/lab/sso');
  await page.getByRole('link', { name: 'Open the simulated identity provider' }).click();
  await expect(page.getByRole('heading', { name: 'Simulated sign in' })).toBeVisible();
  await page.getByLabel('Demo username').fill('vortex_demo');
  await page.getByLabel('Demo password').fill('WrongPassword123');
  await page.getByRole('button', { name: 'Sign in to demo provider' }).click();
  await expect(page.getByRole('alert')).toHaveText('Use the documented demo account.');
  await page.getByLabel('Demo username').fill('vortex_demo');
  await page.getByLabel('Demo password').fill('VortexDemo24!');
  await page.getByRole('button', { name: 'Sign in to demo provider' }).click();
  await expect(page.getByRole('heading', { name: 'Simulated consent' })).toBeVisible();
  const grant = (await context.cookies()).find(cookie => cookie.name === 'vortex_sso_grant')!;
  expect(grant.httpOnly).toBe(true);
  const exchange = page.waitForRequest(request => request.url().endsWith('/mock-idp/exchange'));
  await page.getByRole('button', { name: 'Allow practice sign in' }).click();
  const { code } = (await exchange).postDataJSON();
  await expect(page).toHaveURL('/shop');
  await expect(page.getByTestId('user-name')).toHaveText('Vortex Demo Customer');

  // Restore the original browser binding to prove the server rejects replay too.
  await context.addCookies([grant]);
  const replay = await context.request.post('/mock-idp/exchange', { data: { code } });
  expect(replay.status()).toBe(409);
});
