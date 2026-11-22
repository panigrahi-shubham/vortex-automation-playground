import { test, expect } from '../support/fixtures';

test.use({ authAs: 'guest' });

test('show and auto dismiss a toast', async ({ page }) => {
  await page.goto('/lab/toasts');
  await page.getByRole('button', { name: 'Show toast' }).click();
  const message = page.getByTestId('vortex-toast-message');
  await expect(message).toBeVisible();
  await expect(message).toHaveText('Practice item saved');
  await expect(message).toBeHidden();
});
