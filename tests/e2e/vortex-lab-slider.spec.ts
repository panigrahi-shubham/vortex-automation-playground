import { test, expect } from '../support/fixtures';

test.use({ authAs: 'guest' });

test('drag a slider to a numeric value', async ({ page }) => {
  await page.goto('/lab/slider');
  const slider = page.getByRole('slider', { name: 'Discount' });
  const box = (await slider.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.1, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.75, box.y + box.height / 2);
  await page.mouse.up();
  await expect(slider).toHaveAttribute('aria-valuenow', '75');
  await expect(page.getByTestId('vortex-lab-slider').getByRole('status')).toHaveText('75%');
});
