import { test, expect } from '../support/fixtures';

test.use({ authAs: 'guest' });

test('replace DOM rows as a virtual list scrolls', async ({ page }) => {
  await page.goto('/lab/virtual-list');
  const viewport = page.getByRole('region', { name: 'Virtual results' });
  const rows = viewport.getByRole('listitem');
  await expect(rows.first()).toHaveText('Result 1');
  await expect(rows).toHaveCount(6);
  await viewport.evaluate(element => { element.scrollTop = 3200; });
  await expect(rows.first()).toHaveText('Result 101');
  await expect(rows).toHaveCount(6);
  await expect(viewport.getByText('Result 1', { exact: true })).toHaveCount(0);
});
