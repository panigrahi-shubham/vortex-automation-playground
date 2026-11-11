import { test, expect } from '../support/fixtures';

test.use({ authAs: 'guest' });

test('trap focus and dismiss a modal', async ({ page }) => {
  await page.goto('/lab/modal');
  const open = page.getByRole('button', { name: 'Open confirmation' });
  await open.click();
  const dialog = page.getByRole('dialog', { name: 'Confirm change' });
  const cancel = dialog.getByRole('button', { name: 'Cancel' });
  const confirm = dialog.getByRole('button', { name: 'Confirm' });
  await expect(cancel).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(confirm).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(cancel).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(open).toBeFocused();
  await open.click();
  await page.mouse.click(5, 5);
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId('vortex-lab-modal').getByRole('status')).toHaveText('Dismissed');
});
