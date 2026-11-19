import { test, expect } from '../support/fixtures';

test.use({ authAs: 'guest' });

test('scope locators for duplicate names', async ({ page }) => {
  await page.goto('/lab/locator-traps');
  const email = page.getByRole('textbox', { name: 'Email' });
  await expect(email).toHaveCount(2);
  await expect(email.fill('shipping@example.test', { timeout: 1500 })).rejects.toThrow(/strict mode violation/);
  await page.getByRole('group', { name: 'Shipping contact' }).getByRole('textbox', { name: 'Email' }).fill('shipping@example.test');
  const mug = page.getByRole('row').filter({ has: page.getByRole('rowheader', { name: 'Mug' }) });
  await mug.getByRole('button', { name: 'Remove' }).click();
  await expect(page.getByTestId('vortex-lab-locator-traps').getByRole('status')).toHaveText('Removed Mug');
  await expect(page.getByRole('rowheader', { name: 'Notebook' })).toBeVisible();
});
