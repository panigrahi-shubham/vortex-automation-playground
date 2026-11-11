import { test, expect } from '../support/fixtures';

test.use({ authAs: 'guest' });

test('compare stable and stale request results', async ({ page }) => {
  await page.goto('/lab/race');
  const run = page.getByRole('button', { name: 'Run two requests' });
  const toggle = page.getByRole('checkbox', { name: 'Allow stale responses' });
  await expect(toggle).not.toBeChecked();
  await run.click();
  await expect(run).toBeEnabled();
  await expect(page.getByTestId('vortex-lab-race').getByRole('status')).toHaveText('Latest request');
  await toggle.check();
  const responses = ['older', 'latest'].map(id => page.waitForResponse(response => response.url().endsWith('vortex-race=' + id)));
  await run.click();
  expect((await Promise.all(responses)).every(response => response.ok())).toBe(true);
  await expect(run).toBeEnabled();
  await expect(page.getByTestId('vortex-lab-race').getByRole('status')).toHaveText('Older request');
});
