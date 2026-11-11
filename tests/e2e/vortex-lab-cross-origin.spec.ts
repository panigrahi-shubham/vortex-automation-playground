import { test, expect } from '../support/fixtures';

test.use({ authAs: 'guest' });

test('receive a message from a different origin', async ({ page }) => {
  await page.goto('/lab/cross-origin');
  const frame = page.getByTitle('Cross-origin practice frame');
  const source = new URL((await frame.getAttribute('src'))!);
  expect(source.origin).not.toBe(new URL(page.url()).origin);
  await frame.contentFrame().getByLabel('Frame message').fill('Hello from port 3101');
  await frame.contentFrame().getByRole('button', { name: 'Send to parent' }).click();
  await expect(page.getByTestId('vortex-lab-cross-origin').getByRole('status')).toHaveText('Frame says: Hello from port 3101');
});
