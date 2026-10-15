import { test, expect, ShopApi } from '../support/fixtures';
import { PRODUCTS, money } from '../support/test-data';

test('customers get an access-denied page and no Admin link', async ({ page }) => {
  await page.goto('/admin');
  await expect(page.getByTestId('access-denied')).toContainText('Access denied');
  await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Admin' })).toBeHidden();
});

test.describe('Admin console', () => {
  test.use({ authAs: 'guest' });

  // Sign in as admin by injecting the token before any page script runs
  test.beforeEach(async ({ page, adminApi }) => {
    const me = await (await adminApi.get('/me')).json();
    await page.addInitScript(([token, user]) => {
      localStorage.setItem('shoplab.token', token);
      localStorage.setItem('shoplab.user', user);
    }, [adminApi.token!, JSON.stringify(me)] as const);
  });

  test('dashboard shows stats from the API', async ({ page, adminApi }) => {
    const stats = await (await adminApi.get('/admin/stats')).json();
    await page.goto('/admin');
    await expect(page.getByTestId('stat-out-of-stock')).toHaveText(String(stats.outOfStock));
    expect(Number(await page.getByTestId('stat-users').innerText())).toBeGreaterThanOrEqual(6);
  });

  test('products table: sort by price, filter, paginate', async ({ adminPage, page }) => {
    await adminPage.goto('products');
    await expect(adminPage.productRows).toHaveCount(10);
    await page.getByRole('button', { name: 'Price' }).click(); // ascending
    await page.getByRole('button', { name: 'Price' }).click(); // descending
    await expect(page.getByRole('columnheader', { name: 'Price' })).toHaveAttribute('aria-sort', 'descending');
    const prices = (await adminPage.productRows.getByTestId('cell-price').allInnerTexts()).map(money);
    expect(prices).toEqual([...prices].sort((a, b) => b - a));
    await adminPage.filter.fill('books');
    await expect(adminPage.productRows.getByTestId('cell-category')).toHaveText(Array(8).fill('Books'));
    await adminPage.filter.fill('zzz');
    await expect(page.getByTestId('admin-no-results')).toBeVisible();
    await adminPage.filter.clear();
    await page.getByTestId('admin-next').click();
    await expect(page.getByTestId('admin-page-info')).toContainText('Page 2 of');
  });

  test('add-product form validates before saving', async ({ adminPage, page }) => {
    await adminPage.goto('products');
    await adminPage.addProduct.click();
    await expect(adminPage.modal).toHaveAccessibleName('Add product');
    await adminPage.fillProduct({ name: 'ab', price: '0', stock: '1.5' });
    await adminPage.modal.getByRole('button', { name: 'Create product' }).click();
    await expect(page.getByTestId('product-name-input-error')).toHaveText('Name must be at least 3 characters');
    await expect(page.getByTestId('product-category-select-error')).toHaveText('Select a category');
    await expect(page.getByTestId('product-price-input-error')).toHaveText('Price must be greater than 0');
    await expect(page.getByTestId('product-stock-input-error')).toHaveText('Stock must be a whole number ≥ 0');
    await adminPage.modal.getByRole('button', { name: 'Cancel' }).click();
    await expect(adminPage.modal).toBeHidden();
  });

  test("change a customer's order status from the orders table", async ({ adminPage, page, apiContext }) => {
    const customer = new ShopApi(apiContext);
    await customer.createUser();
    const order = await customer.placeOrder([[PRODUCTS.mug.id, 1]]);
    await adminPage.goto('orders');
    await page.getByRole('combobox', { name: `Status for ${order.id}` }).selectOption('Delivered');
    await expect(adminPage.toast(`${order.id} → Delivered`)).toBeVisible();
    expect((await (await customer.get(`/orders/${order.id}`)).json()).status).toBe('Delivered');
  });

  test('lock and unlock a user', async ({ adminPage, page, apiContext }) => {
    const victim = new ShopApi(apiContext);
    const u = await victim.createUser();
    await adminPage.goto('users');
    const row = page.getByTestId('admin-user-row').filter({ hasText: u.username });
    await row.getByRole('button', { name: 'Lock' }).click();
    await expect(row.getByTestId('user-status')).toHaveText('Locked');
    expect((await victim.get('/cart')).status()).toBe(423); // existing session now refused
    await row.getByRole('button', { name: 'Unlock' }).click();
    await expect(row.getByTestId('user-status')).toHaveText('Active');
    expect((await victim.get('/cart')).status()).toBe(200);
  });
});
