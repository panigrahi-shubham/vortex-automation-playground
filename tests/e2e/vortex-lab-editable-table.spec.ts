import { test, expect } from '../support/fixtures';

test.use({ authAs: 'guest' });

test('edit a cell and archive selected rows', async ({ page }) => {
  await page.goto('/lab/editable-table');
  const quantity = page.getByRole('spinbutton', { name: 'Notebook quantity' });
  await quantity.fill('12');
  await expect(quantity).toHaveValue('12');
  await page.getByRole('checkbox', { name: 'Select all items' }).check();
  await expect(page.getByTestId('vortex-lab-editable-table').getByRole('status')).toHaveText('3 selected');
  await page.getByRole('button', { name: 'Archive selected' }).click();
  await expect(page.getByTestId('vortex-inventory-row')).toHaveCount(0);
  await expect(page.getByTestId('vortex-lab-editable-table').getByRole('status')).toHaveText('Archived 3 items');
});
