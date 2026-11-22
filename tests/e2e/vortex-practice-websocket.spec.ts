import { test, expect } from '../support/fixtures';

test.use({ authAs: 'guest' });

test('receives a price tick and an echo over WebSocket', async ({ page }) => {
  await page.goto('/lab/websocket');
  const price = page.getByTestId('vortex-socket-price');
  const [socket] = await Promise.all([
    page.waitForEvent('websocket'),
    page.getByRole('button', { name: 'Connect', exact: true }).click(),
  ]);
  expect(new URL(socket.url()).pathname).toBe('/vortex-lab/socket');
  await expect(page.getByTestId('vortex-socket-status')).toHaveText('Connected');
  await expect(price).toHaveText(/^\$\d+\.\d{2}$/);
  const firstPrice = await price.innerText();
  await expect(price).not.toHaveText(firstPrice);
  await page.getByLabel('Chat message').fill('Socket practice');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByTestId('vortex-socket-echo')).toHaveText('Echo: Socket practice');
  await page.getByRole('button', { name: 'Reset WebSocket ticker and echo chat' }).click();
  await expect(page.getByTestId('vortex-socket-status')).toHaveText('Disconnected');
});
