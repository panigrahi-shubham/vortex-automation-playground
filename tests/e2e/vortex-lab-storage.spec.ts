import { test, expect } from '../support/fixtures';

test.use({ authAs: 'guest' });

test('keep an offer across reload and reset storage', async ({ page }) => {
  await page.goto('/lab/storage');
  const status = page.getByTestId('vortex-lab-storage').getByRole('status');
  await page.getByRole('button', { name: 'Set member cookie' }).click();
  await expect(status).toHaveText('Set both the cookie and offer preference');
  await page.getByRole('button', { name: 'Save offer preference' }).click();
  await page.reload();
  await expect(status).toHaveText('Member offer available');
  await page.getByRole('button', { name: 'Reset Cookies and local storage' }).click();
  await expect(status).toHaveText('Set both the cookie and offer preference');
});
