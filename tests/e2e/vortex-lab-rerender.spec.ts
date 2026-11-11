import { test, expect } from '../support/fixtures';

test.use({ authAs: 'guest' });

test('click a replaced control using a locator', async ({ page }) => {
  await page.goto('/lab/rerender');
  const toggle = page.getByRole('checkbox', { name: 'Replace the visible button' });
  await expect(toggle).not.toBeChecked();
  await toggle.check();
  await page.getByRole('button', { name: 'Reveal action' }).click();
  const save = page.getByRole('button', { name: 'Save item' });
  await expect(save).toBeVisible();
  await expect(page.getByTestId('vortex-lab-rerender').getByRole('status')).toHaveText('Replacement button visible');
  await save.click();
  await expect(page.getByTestId('vortex-lab-rerender').getByRole('status')).toHaveText('Saved using the replacement button');
});
