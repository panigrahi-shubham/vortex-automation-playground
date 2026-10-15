import fs from 'node:fs/promises';
import { test, expect, ShopApi } from '../support/fixtures';
import { PRODUCTS } from '../support/test-data';

const { mug, pragmaticTester: book, earbuds } = PRODUCTS;

test('a new user has no orders', async ({ ordersPage }) => {
  await ordersPage.goto();
  await expect(ordersPage.empty).toContainText('No orders yet');
});

test('order history lists newest first and filters by status', async ({ api, ordersPage, page }) => {
  const first = await api.placeOrder([[mug.id, 1]]);
  const second = await api.placeOrder([[book.id, 2]]);
  await api.post(`/orders/${first.id}/cancel`);
  await ordersPage.goto();
  await expect(ordersPage.rows.getByTestId('order-link')).toHaveText([second.id, first.id]);
  await page.getByRole('link', { name: 'Cancelled' }).click();
  await expect(page).toHaveURL('/orders?status=Cancelled');
  await expect(ordersPage.rows).toHaveCount(1);
  await expect(ordersPage.row(first.id).getByTestId('order-status')).toHaveText('Cancelled');
});

test('cancel an order through the confirmation modal', async ({ api, orderPage, page }) => {
  const order = await api.placeOrder([[mug.id, 2]]);
  await orderPage.goto(order.id);
  await orderPage.cancelButton.click();
  const dialog = page.getByRole('dialog', { name: `Cancel ${order.id}?` });
  await dialog.getByRole('button', { name: 'Keep order' }).click();
  await expect(orderPage.status).toHaveText('Placed');
  await orderPage.cancelButton.click();
  await dialog.getByRole('button', { name: 'Yes, cancel order' }).click();
  await expect(orderPage.status).toHaveText('Cancelled');
  await expect(orderPage.step('Cancelled')).toHaveAttribute('data-done', 'true');
  await expect(orderPage.cancelButton).toBeHidden();
});

test('status pushed live over SSE when an admin ships the order (no reload)', async ({ api, adminApi, orderPage }) => {
  const order = await api.placeOrder([[earbuds.id, 1]]);
  await orderPage.goto(order.id);
  await expect(orderPage.status).toHaveText('Placed');
  await expect(orderPage.cancelButton).toBeVisible();
  // the browser holds an EventSource; the server pushes the change
  await adminApi.patch(`/admin/orders/${order.id}`, { status: 'Shipped' });
  await expect(orderPage.toast(`Order ${order.id} is now Shipped`)).toBeVisible();
  await expect(orderPage.status).toHaveText('Shipped');
  await expect(orderPage.step('Shipped')).toHaveAttribute('data-done', 'true');
  await expect(orderPage.step('Delivered')).toHaveAttribute('data-done', 'false');
  await expect(orderPage.cancelButton).toBeHidden(); // shipped orders can't be cancelled
});

test('download the invoice CSV and check its contents', async ({ api, orderPage, page }) => {
  const order = await api.placeOrder([[book.id, 3]]);
  await orderPage.goto(order.id);
  const [download] = await Promise.all([page.waitForEvent('download'), orderPage.invoiceLink.click()]);
  expect(download.suggestedFilename()).toBe(`invoice-${order.id}.csv`);
  const csv = await fs.readFile(await download.path(), 'utf8');
  expect(csv).toContain(`Order:    ${order.id}`);
  expect(csv).toContain(`"${book.name}",3,${book.price.toFixed(2)}`);
  expect(csv).toContain(`TOTAL,,,${order.total.toFixed(2)}`);
});

test('buy again puts the same items back in the cart', async ({ api, orderPage, page, cartPage }) => {
  const order = await api.placeOrder([[mug.id, 2], [book.id, 1]]);
  await orderPage.goto(order.id);
  await orderPage.buyAgain.click();
  await expect(page).toHaveURL('/cart');
  await expect(cartPage.items).toHaveCount(2);
  await expect(cartPage.qtyOf(mug.name)).toHaveValue('2');
});

test("you can't open someone else's order", async ({ apiContext, orderPage, page }) => {
  // place an order as a *different* user, then try to open it as ours
  const other = new ShopApi(apiContext);
  await other.createUser();
  const theirs = await other.placeOrder([[mug.id, 1]]);
  await orderPage.goto(theirs.id);
  await expect(page.getByTestId('order-not-found')).toBeVisible();
});
