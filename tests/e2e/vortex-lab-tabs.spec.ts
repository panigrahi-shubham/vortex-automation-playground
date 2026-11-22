import { test, expect } from '../support/fixtures';

test.use({ authAs: 'guest' });

test('switch tab panels with the keyboard', async ({ page }) => {
  await page.goto('/lab/tabs');
  const delivery = page.getByRole('tab', { name: 'Delivery' });
  const returns = page.getByRole('tab', { name: 'Returns' });
  await expect(delivery).toHaveAttribute('aria-selected', 'true');
  await delivery.press('ArrowRight');
  await expect(returns).toBeFocused();
  await expect(returns).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tabpanel')).toHaveText('Returns are accepted within 30 days.');
});
