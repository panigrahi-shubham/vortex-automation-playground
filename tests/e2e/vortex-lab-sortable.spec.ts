import { test, expect } from '../support/fixtures';

test.use({ authAs: 'guest' });

test('reorder a list by dragging', async ({ page }) => {
  await page.goto('/lab/sortable');
  const tasks = page.getByRole('list', { name: 'Fulfillment tasks' });
  await tasks.getByRole('button', { name: 'Shipping' }).dragTo(tasks.getByRole('button', { name: 'Inventory' }));
  await expect(tasks.getByRole('listitem')).toHaveText(['Shipping', 'Inventory', 'Packing']);
  await expect(page.getByTestId('vortex-lab-sortable').getByRole('status')).toHaveText('Shipping moved to position 1');
});
