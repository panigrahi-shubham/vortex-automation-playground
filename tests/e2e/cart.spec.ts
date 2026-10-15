import { test, expect } from '../support/fixtures';
import { PRODUCTS, COUPONS, TAX_RATE, STANDARD_SHIPPING, round2 } from '../support/test-data';

const { mug, pragmaticTester: book, keyboard, earbuds } = PRODUCTS;

test('add from the shop grid updates the header badge and the cart', async ({ shopPage, cartPage, page }) => {
  await shopPage.goto(`q=${encodeURIComponent(mug.name)}`);
  await shopPage.addToCart(mug.name);
  await expect(shopPage.toast(`Added ${mug.name} to cart`)).toBeVisible();
  await expect(shopPage.cartBadge).toHaveText('1');
  await page.getByRole('link', { name: 'Cart' }).click();
  await expect(cartPage.items).toHaveCount(1);
  await expect(cartPage.item(mug.name).getByTestId('line-total')).toHaveText('$12.50');
});

test('totals: subtotal, 8% tax, standard shipping', async ({ api, cartPage }) => {
  await api.addToCart(book.id, 2);
  await api.addToCart(mug.id, 1);
  await cartPage.goto();
  const t = await cartPage.totals();
  const subtotal = round2(book.price * 2 + mug.price);
  expect(t.subtotal).toBe(subtotal);
  expect(t.shipping).toBe(STANDARD_SHIPPING);
  expect(t.tax).toBe(round2(subtotal * TAX_RATE));
  expect(t.total).toBe(round2(subtotal + STANDARD_SHIPPING + subtotal * TAX_RATE));
});

test('change quantity with the stepper and by typing', async ({ api, cartPage }) => {
  await api.addToCart(book.id, 1);
  await cartPage.goto();
  await cartPage.increase(book.name);
  await expect(cartPage.qtyOf(book.name)).toHaveValue('2');
  await cartPage.setQty(book.name, 5);
  await expect(cartPage.item(book.name).getByTestId('line-total')).toHaveText(`$${(book.price * 5).toFixed(2)}`);
  await expect(cartPage.cartBadge).toHaveText('5');
});

test('quantity above 10 is rejected and the old value comes back', async ({ api, cartPage }) => {
  await api.addToCart(book.id, 3);
  await cartPage.goto();
  await cartPage.setQty(book.name, 11);
  await expect(cartPage.toast('Quantity must be between 1 and 10')).toBeVisible();
  await expect(cartPage.qtyOf(book.name)).toHaveValue('3');
});

test('remove the last item shows the empty cart', async ({ api, cartPage }) => {
  await api.addToCart(mug.id);
  await cartPage.goto();
  await cartPage.remove(mug.name);
  await expect(cartPage.empty).toContainText('Your cart is empty');
  await expect(cartPage.cartBadge).toHaveText('0');
});

test('cart lives on the server: survives reload and a new browser', async ({ api, cartPage, page, browser, user, baseURL }) => {
  await api.addToCart(mug.id, 2);
  await cartPage.goto();
  await page.reload();
  await expect(cartPage.qtyOf(mug.name)).toHaveValue('2');
  const other = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [{ origin: new URL(baseURL!).origin, localStorage: [{ name: 'shoplab.token', value: user.token }, { name: 'shoplab.cookies', value: 'accepted' }] }] } });
  const p2 = await other.newPage();
  await p2.goto('/cart');
  await expect(p2.getByLabel(`Quantity of ${mug.name}`, { exact: true })).toHaveValue('2');
  await other.close();
});

test.describe('Coupons', () => {
  test('SAVE10 takes 10% off and can be removed', async ({ api, cartPage, page }) => {
    await api.addToCart(book.id, 2);
    await cartPage.goto();
    await cartPage.apply('save10'); // codes are case-insensitive
    await expect(cartPage.couponApplied).toContainText('SAVE10');
    const t = await cartPage.totals();
    expect(t.discount).toBe(round2(t.subtotal * 0.1));
    expect(t.tax).toBe(round2((t.subtotal - t.discount) * TAX_RATE));
    await page.getByRole('button', { name: 'Remove', exact: true }).click(); // exact: item rows have "Remove <name>" buttons
    await expect(cartPage.couponInput).toBeVisible();
    await expect(page.getByTestId('discount')).toHaveCount(0);
  });

  for (const [code, message] of [
    ['NOPE123', 'Invalid coupon code'],
    [COUPONS.expired, 'This coupon has expired'],
    [COUPONS.flat50, 'Minimum order of $200 required for FLAT50'],
    ['', 'Enter a coupon code']
  ]) {
    test(`rejects coupon "${code || '(blank)'}"`, async ({ api, cartPage }) => {
      await api.addToCart(mug.id);
      await cartPage.goto();
      await cartPage.apply(code);
      await expect(cartPage.couponError).toHaveText(message);
      await expect(cartPage.couponInput).toHaveAttribute('aria-invalid', 'true');
    });
  }

  test('FLAT50 on a $200+ cart, then a warning when the cart drops below the minimum', async ({ api, cartPage, page }) => {
    await api.addToCart(keyboard.id, 3); // 3 × 89.50 = 268.50
    await cartPage.goto();
    await cartPage.apply(COUPONS.flat50);
    expect((await cartPage.totals()).discount).toBe(50);
    await cartPage.setQty(keyboard.name, 2); // 179.00
    await expect(page.getByTestId('coupon-warning')).toHaveText('Add $21.00 more to use FLAT50');
    expect((await cartPage.totals()).discount).toBe(0);
  });

  test('FREESHIP makes shipping free', async ({ api, cartPage, page }) => {
    await api.addToCart(mug.id);
    await cartPage.goto();
    await cartPage.chooseShipping(/Express/);
    await expect(page.getByTestId('shipping')).toHaveText('$14.99');
    await cartPage.apply(COUPONS.freeShip);
    await expect(page.getByTestId('shipping')).toHaveText('Free');
  });
});

test('standard shipping is free over $100; express always costs', async ({ api, cartPage, page }) => {
  await api.addToCart(earbuds.id, 2); // 119.98
  await cartPage.goto();
  await expect(page.getByTestId('shipping')).toHaveText('Free');
  await cartPage.chooseShipping(/Express/);
  await expect(page.getByTestId('shipping')).toHaveText('$14.99');
  await cartPage.chooseShipping(/Next day/);
  await expect(page.getByTestId('shipping')).toHaveText('$24.99');
});

test('save for later moves the item to the wishlist', async ({ api, cartPage, page }) => {
  await api.addToCart(earbuds.id);
  await cartPage.goto();
  await page.getByRole('button', { name: `Move ${earbuds.name} to wishlist` }).click();
  await expect(cartPage.empty).toBeVisible();
  await expect(cartPage.wishlistBadge).toHaveText('1');
});

test('clear cart asks for confirmation (custom modal, not a native dialog)', async ({ api, cartPage, page }) => {
  await api.addToCart(mug.id);
  await api.addToCart(book.id);
  await cartPage.goto();
  await page.getByRole('button', { name: 'Clear cart' }).click();
  const dialog = page.getByRole('dialog', { name: 'Clear your cart?' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(cartPage.items).toHaveCount(2);
  await page.getByRole('button', { name: 'Clear cart' }).click();
  await page.keyboard.press('Escape'); // Esc also cancels
  await expect(dialog).toBeHidden();
  await page.getByRole('button', { name: 'Clear cart' }).click();
  await dialog.getByRole('button', { name: 'Clear cart' }).click();
  await expect(cartPage.empty).toBeVisible();
});
