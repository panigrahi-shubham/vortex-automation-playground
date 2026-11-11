import { test, expect } from '../support/fixtures';

test.use({ authAs: 'guest' });

test('keep values when navigating a multi-step form', async ({ page }) => {
  await page.goto('/lab/stepper');
  const next = page.getByRole('button', { name: 'Next' });
  const back = page.getByRole('button', { name: 'Back', exact: true });
  await expect(next).toBeDisabled();
  await page.getByLabel('Recipient').fill('Priya');
  await next.click();
  await page.getByLabel('Delivery method').selectOption('Express');
  await back.click();
  await expect(page.getByLabel('Recipient')).toHaveValue('Priya');
  await next.click();
  await next.click();
  await expect(page.getByTestId('vortex-lab-stepper').getByRole('status')).toHaveText('Priya · Express');
});
