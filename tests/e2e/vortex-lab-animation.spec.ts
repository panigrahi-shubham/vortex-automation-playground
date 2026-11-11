import { test, expect } from '../support/fixtures';

test.use({ authAs: 'guest' });

test('click a control after it moves', async ({ page }) => {
  await page.goto('/lab/animation');
  const toggle = page.getByRole('checkbox', { name: 'Move the target' });
  await expect(toggle).not.toBeChecked();
  await toggle.check();
  await page.getByRole('button', { name: 'Start round' }).click();
  await expect(page.getByTestId('vortex-lab-animation').getByRole('status')).toHaveText('Target is moving');
  await page.getByRole('button', { name: 'Catch me' }).click();
  await expect(page.getByTestId('vortex-lab-animation').getByRole('status')).toHaveText('Target clicked');
});
