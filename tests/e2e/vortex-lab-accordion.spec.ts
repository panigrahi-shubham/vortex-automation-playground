import { test, expect } from '../support/fixtures';

test.use({ authAs: 'guest' });

test('expand one accordion panel at a time', async ({ page }) => {
  await page.goto('/lab/accordion');
  const track = page.getByRole('button', { name: 'How do I track an order?' });
  const returns = page.getByRole('button', { name: 'How do I return an item?' });
  await track.click();
  await expect(page.getByText('Use your order number to check its status.')).toBeVisible();
  await returns.click();
  await expect(track).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByText('Use your order number to check its status.')).toBeHidden();
  await expect(page.getByText('Start a return from the order details.')).toBeVisible();
});
