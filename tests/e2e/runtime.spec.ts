import { test, expect } from '../support/fixtures';

test.use({ authAs: 'guest' });

for (const failure of ['503', 'invalid', 'network']) {
  test(`configuration ${failure} blocks fallback requests and can recover`, async ({ page }) => {
    let fail = true;
    const legacyCalls: string[] = [];
    page.on('request', request => {
      if (/\/api\/(?!config(?:\?|$)|v2\/)/.test(new URL(request.url()).pathname)) legacyCalls.push(request.url());
    });
    await page.route('**/api/config', async route => {
      if (!fail) return route.continue();
      if (failure === 'network') return route.abort();
      await route.fulfill({ status: failure === '503' ? 503 : 200, contentType: 'application/json', body: JSON.stringify(failure === '503' ? { error: 'Internal detail must stay hidden' } : { storage: 'unknown' }) });
    });
    await page.goto('/shop');
    await expect(page.getByTestId('service-unavailable')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-storage', 'unavailable');
    await expect(page.locator('body')).not.toContainText('Internal detail must stay hidden');
    expect(legacyCalls).toEqual([]);
    fail = false;
    await page.getByTestId('retry-service').click();
    await expect(page.getByTestId('product-card').first()).toBeVisible();
  });
}
