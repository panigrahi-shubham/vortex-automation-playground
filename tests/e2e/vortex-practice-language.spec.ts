import { test, expect } from '../support/fixtures';
import { PRODUCTS } from '../support/test-data';

test('persists Hindi across shop, cart, and checkout and keeps the same test IDs', async ({ page, api }) => {
  await api.addToCart(PRODUCTS.mug.id);
  await page.goto('/shop');
  const switcher = page.getByTestId('vortex-language');
  await expect(page.getByTestId('shop-title')).toHaveText('All products');
  await switcher.selectOption('hi');
  await expect(page.getByTestId('shop-title')).toHaveText('सभी उत्पाद');
  await expect(page.locator('html')).toHaveAttribute('lang', 'hi');
  await page.reload();
  await expect(switcher).toHaveValue('hi');
  await page.goto('/cart');
  await expect(page.getByRole('heading', { name: /आपका कार्ट/ })).toBeVisible();
  await page.getByTestId('checkout-btn').click();
  await expect(page.getByRole('heading', { name: 'चेकआउट', exact: true })).toBeVisible();
  await expect(page.getByTestId('fullName')).toHaveAccessibleName('पूरा नाम');
  await switcher.selectOption('en');
  await expect(page.getByTestId('fullName')).toHaveAccessibleName('Full name');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});
