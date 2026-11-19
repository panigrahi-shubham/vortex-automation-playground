import { test, expect } from '../support/fixtures';

test.use({ authAs: 'guest' });

test('select a date range across months', async ({ page }) => {
  await page.goto('/lab/date-picker');
  await page.getByRole('button', { name: 'Choose dates' }).click();
  await page.getByRole('button', { name: '2026-11-28' }).click();
  await page.getByRole('button', { name: 'Next month' }).click();
  await expect(page.getByTestId('vortex-date-month')).toHaveText('December 2026');
  await page.getByRole('button', { name: '2026-12-03' }).click();
  await expect(page.getByTestId('vortex-lab-date-picker').getByRole('status')).toHaveText('2026-11-28 to 2026-12-03');
  await expect(page.getByRole('group', { name: 'Calendar' })).toBeHidden();
});
