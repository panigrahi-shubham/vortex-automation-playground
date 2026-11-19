import { test, expect } from '../support/fixtures';

test.use({ authAs: 'guest' });

test('advance focus across OTP fields', async ({ page }) => {
  await page.goto('/lab/otp');
  const first = page.getByRole('textbox', { name: 'Digit 1' });
  await first.pressSequentially('2');
  await expect(page.getByRole('textbox', { name: 'Digit 2' })).toBeFocused();
  await page.keyboard.type('46810');
  await expect(page.getByTestId('vortex-lab-otp').getByRole('status')).toHaveText('Code accepted');
});
