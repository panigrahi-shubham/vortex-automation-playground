import { test, expect, ShopApi } from '../support/fixtures';
import { PRODUCTS } from '../support/test-data';

/**
 * Tests that change SERVER-WIDE settings (chaos panel, session TTL, order auto-progress, catalog).
 * They would break other tests running in parallel, so this project depends on all others,
 * and the file runs serially.
 */
test.describe.configure({ mode: 'serial' });

const DEFAULTS = { latencyMs: 0, errorRate: 0, bugMode: false, sessionTtlSec: 3600, orderProgressSec: 15 };
test.afterEach(async ({ guestApi }) => { await guestApi.post('/chaos', DEFAULTS); });
test.afterAll(async ({ playwright, baseURL }) => {
  const ctx = await playwright.request.newContext({ baseURL });
  await ctx.post('/api/reset');
  await ctx.dispose();
});

test('chaos panel: global latency through the UI, then reset', async ({ page, shopPage }) => {
  await page.goto('/shop');
  const panel = page.getByTestId('chaos-panel'); // scope: the shop also has an "Apply price" button
  await panel.getByText('⚡ Chaos panel').click();
  await panel.getByLabel('Latency (ms)').fill('1200');
  await panel.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(shopPage.toast('Chaos settings applied')).toBeVisible();
  await expect(page.getByTestId('chaos-indicator')).toHaveAttribute('aria-label', 'Chaos active');

  const t0 = Date.now();
  await page.reload();
  await shopPage.waitForGrid();
  expect(Date.now() - t0).toBeGreaterThan(1200);

  if ((await panel.getAttribute('open')) === null) await panel.getByText('⚡ Chaos panel').click(); // re-open if it closed
  await panel.getByRole('button', { name: 'Reset server' }).click();
  await expect(page).toHaveURL('/login'); // reset wipes sessions too
  await expect(page.getByTestId('chaos-indicator')).toHaveAttribute('aria-label', 'Chaos off');
});

test('100% error rate: the shop shows its error state and recovers', async ({ page, shopPage, guestApi }) => {
  await page.goto('/shop');
  await shopPage.waitForGrid();
  await guestApi.post('/chaos', { errorRate: 1 });
  await page.getByLabel('Sort by').selectOption('rating');
  await expect(shopPage.errorState).toContainText('Injected server error');
  await guestApi.post('/chaos', { errorRate: 0 });
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(shopPage.cards).toHaveCount(12);
});

test('a real session expiry (TTL = 2 s)', async ({ page, guestApi, apiContext }) => {
  await guestApi.post('/chaos', { sessionTtlSec: 2 });
  const shortLived = new ShopApi(apiContext);
  const u = await shortLived.createUser(); // token issued with a 2-second lifetime
  await page.addInitScript(t => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('shoplab.token', t); sessionStorage.setItem('seeded', '1'); } }, u.token);
  await page.goto('/orders');
  await expect(page.getByTestId('orders-empty')).toBeVisible();
  await page.waitForTimeout(2500); // a real wall-clock wait is the point of this test
  await page.getByRole('link', { name: 'Cart' }).click();
  await expect(page).toHaveURL(/\/login\?returnTo=%2Fcart&reason=expired/);
  await expect(page.getByTestId('login-notice')).toHaveText('Your session has expired. Please sign in again.');
});

test('orders progress on their own and the page updates live', async ({ api, guestApi, orderPage }) => {
  await guestApi.post('/chaos', { orderProgressSec: 1 });
  const order = await api.placeOrder([[PRODUCTS.mug.id, 1]]);
  await orderPage.goto(order.id);
  await expect(orderPage.status).toHaveText('Delivered', { timeout: 10_000 });
  for (const s of ['Placed', 'Processing', 'Shipped', 'Delivered']) await expect(orderPage.step(s)).toHaveAttribute('data-done', 'true');
});

test('admin creates, edits and deletes a product that shoppers can see', async ({ page, adminApi, adminPage, guestApi }) => {
  const name = `Playwright Mug ${Date.now()}`;
  const me = await (await adminApi.get('/me')).json();
  await page.addInitScript(([t, u]) => { localStorage.setItem('shoplab.token', t); localStorage.setItem('shoplab.user', u); }, [adminApi.token!, JSON.stringify(me)] as const);

  await adminPage.goto('products');
  await adminPage.addProduct.click();
  await adminPage.fillProduct({ name, category: 'Home', price: '9.99', stock: '5' });
  await adminPage.modal.getByRole('button', { name: 'Create product' }).click();
  await expect(adminPage.toast(`Created ${name}`)).toBeVisible();

  const { items } = await (await guestApi.get('/products', { q: name })).json();
  expect(items).toHaveLength(1);
  const id = items[0].id;

  await adminPage.filter.fill(name);
  await adminPage.row(name).getByRole('button', { name: `Edit ${name}` }).click();
  await adminPage.fillProduct({ price: '12.49' });
  await adminPage.modal.getByRole('button', { name: 'Save changes' }).click();
  await expect(adminPage.row(name).getByTestId('cell-price')).toHaveText('$12.49');

  await page.goto(`/product/${id}`);
  await expect(page.getByTestId('product-detail').getByTestId('product-price')).toHaveText('$12.49');

  await adminPage.goto('products');
  await adminPage.filter.fill(name);
  await adminPage.row(name).getByRole('button', { name: `Delete ${name}` }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
  await expect(adminPage.productRows).toHaveCount(0);
  expect((await guestApi.get(`/products/${id}`)).status()).toBe(404);
});
