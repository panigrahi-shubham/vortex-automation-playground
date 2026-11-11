import { test, expect, ShopApi } from '../support/fixtures';

/** Network control: mock, patch, abort, slow down and inspect traffic. */
test.use({ authAs: 'guest' });

test('mock the product list with a fixed payload', async ({ page, shopPage }) => {
  await page.route('**/api/products?*', route => route.fulfill({
    json: { total: 1, page: 1, pages: 1, limit: 12, items: [{ id: 999, sku: 'SL-MOCK-999', name: 'Mocked Gadget', category: 'Electronics', price: 1, stock: 5, rating: 5, reviewCount: 1 }] }
  }));
  await shopPage.goto();
  await expect(shopPage.cards).toHaveCount(1);
  await expect(shopPage.card('Mocked Gadget').getByTestId('product-price')).toHaveText('$1.00');
  await expect(shopPage.resultsCount).toHaveText('1 product');
});

test('patch a real response (route.fetch + modify)', async ({ page, shopPage }) => {
  await page.route('**/api/products?*', async route => {
    const response = await route.fetch();
    const body = await response.json();
    body.items[0].name = 'Patched by Playwright';
    await route.fulfill({ response, json: body });
  });
  await shopPage.goto();
  await expect(shopPage.cards.first().getByTestId('product-name')).toHaveText('Patched by Playwright');
});

test('aborted request shows an error state; Retry recovers', async ({ page, shopPage }) => {
  await page.route('**/api/products?*', route => route.abort('internetdisconnected'));
  await shopPage.goto();
  await expect(shopPage.errorState).toContainText('Network error');
  await page.unroute('**/api/products?*');
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(shopPage.cards).toHaveCount(12);
});

test('server error via the x-shoplab-fail header (real server, this request only)', async ({ page, shopPage }) => {
  await page.route('**/api/products?*', route => route.continue({ headers: { ...route.request().headers(), 'x-shoplab-fail': '503' } }));
  await shopPage.goto();
  await expect(page.getByTestId('error-message')).toHaveText('Forced 503 via x-shoplab-fail header');
});

test('slow API: skeletons and the loading bar are shown while waiting', async ({ page, shopPage }) => {
  await page.route('**/api/products?*', route => route.continue({ headers: { ...route.request().headers(), 'x-shoplab-latency': '1500' } }));
  await page.goto('/shop');
  await expect(page.getByTestId('skeleton').first()).toBeVisible();
  await expect(shopPage.loader).toBeVisible();
  await expect(shopPage.cards.first()).toBeVisible({ timeout: 5000 });
  await expect(page.getByTestId('skeleton')).toHaveCount(0);
  await expect(shopPage.loader).toBeHidden();
});

test('assert the exact API request the UI sends', async ({ page, shopPage }) => {
  await shopPage.goto();
  const [req] = await Promise.all([
    page.waitForRequest(r => r.url().includes('/api/products?') && r.url().includes('sort=')),
    shopPage.sort.selectOption('price_desc')
  ]);
  const url = new URL(req.url());
  expect(Object.fromEntries(url.searchParams)).toEqual({ sort: 'price_desc', limit: '12', page: '1' });
});

test('make the random "deal of the day" deterministic', async ({ page }) => {
  await page.route('**/api/deal', route => route.fulfill({ json: { product: { id: 3, name: 'Ceramic Coffee Mug' }, percentOff: 50 } }));
  await page.goto('/shop');
  await expect(page.getByTestId('deal-of-day')).toHaveText('Deal of the day: Ceramic Coffee Mug — 50% off');
  await page.getByTestId('deal-link').click();
  await expect(page).toHaveURL('/product/3');
});

test('block third-party noise / images by resource type', async ({ page, shopPage, guestApi }) => {
  const { items } = await ShopApi.ok<{ items: Array<{ id: number; name: string }> }>(
    await guestApi.get('/products', { limit: 12 })
  );
  const blocked: string[] = [];
  await page.route('**/*', route => {
    if (['image', 'font', 'media'].includes(route.request().resourceType())) { blocked.push(route.request().url()); return route.abort(); }
    return route.continue();
  });
  await shopPage.goto();
  await expect(shopPage.cards).toHaveCount(12);
  await expect(shopPage.cards.getByTestId('product-name')).toHaveText(items.map(product => product.name));
  await shopPage.cards.first().scrollIntoViewIfNeeded();
  await expect.poll(() => blocked.some(url => /\/assets\/products\/vortex-product-\d+\.webp$/.test(new URL(url).pathname))).toBe(true);
  expect(blocked.every(url => /^\/assets\/(fonts|products)\//.test(new URL(url).pathname))).toBe(true);
  for (const [index, product] of items.entries()) {
    await expect(shopPage.cards.nth(index).getByTestId('product-name')).toHaveAttribute('href', `/product/${product.id}`);
  }
  await shopPage.cards.first().getByTestId('product-name').click();
  await expect(page).toHaveURL(`/product/${items[0].id}`);
  await expect(page.getByTestId('product-title')).toHaveText(items[0].name);
});

