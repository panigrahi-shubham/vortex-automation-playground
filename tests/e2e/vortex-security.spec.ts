import { test, expect } from '../support/fixtures';

test.use({ authAs: 'guest' });

test('applies a fresh CSP nonce, blocks inline scripts, and exposes readiness', async ({ page, apiContext }) => {
  const first = await apiContext.get('/lab/dialogs');
  const second = await apiContext.get('/lab/dialogs');
  const policy = first.headers()['content-security-policy'];
  const nonce = /'nonce-([^']+)'/.exec(policy)?.[1];
  expect(nonce).toBeTruthy();
  expect(policy).toContain("'strict-dynamic'");
  expect(policy).toContain("script-src-attr 'none'");
  expect(second.headers()['content-security-policy']).not.toBe(policy);
  expect(await first.text()).toContain('nonce="' + nonce + '"');
  expect(first.headers()['cache-control']).toBe('no-store');
  expect(first.headers()['x-request-id']).toMatch(/^[a-f0-9-]{36}$/);
  expect(second.headers()['x-request-id']).not.toBe(first.headers()['x-request-id']);
  const ready = await apiContext.get('/api/ready');
  expect(ready.status()).toBe(200);
  expect(await ready.json()).toEqual({ ready: true, storage: 'memory' });
  expect((await apiContext.get('/css/app.css')).headers()['cache-control']).toContain('max-age=3600');

  // Insert an untrusted script into the document after the server assigns nonces.
  await page.route('**/lab/dialogs', async route => {
    const response = await route.fetch();
    const html = (await response.text()).replace(
      '</body>',
      '<script>document.body.dataset.vortexBlockedScript = "executed"</script></body>',
    );
    await route.fulfill({ response, body: html });
  });
  const violation = page.waitForEvent('console', message =>
    message.type() === 'error' && message.text().includes('Content Security Policy')
      && message.text().includes('inline script'));
  await page.goto('/lab/dialogs');
  await expect(page.getByRole('button', { name: 'Alert' })).toBeVisible();
  expect((await violation).text()).toContain('script-src');
  await expect(page.locator('body')).not.toHaveAttribute('data-vortex-blocked-script');
});
