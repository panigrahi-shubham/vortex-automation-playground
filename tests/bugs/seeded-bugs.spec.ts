import { test, expect, ShopApi } from '../support/fixtures';
import { PASSWORD, PRODUCTS, USERS, round2 } from '../support/test-data';

/**
 * THE BUG HUNT
 * Each test asserts the CORRECT behaviour with seeded bugs switched on (x-shoplab-bugs: 1).
 * They are marked test.fail(): the suite stays green while the bug exists, and Playwright
 * flags "expected to fail but passed" the day someone fixes it.
 *
 * Students: delete the test.fail() line to see the real failure and write the bug report.
 * Answer key: BUGS.md
 */
const BUGS = { 'x-shoplab-bugs': '1' };

test.describe('API level', () => {
  test('BUG-01 sort=price_asc returns cheapest first', async ({ guestApi }) => {
    test.fail(true, 'BUG-01: price_asc is reversed');
    const { items } = await ShopApi.ok(await guestApi.with(BUGS).get('/products', { sort: 'price_asc', limit: 50 }));
    const prices = items.map((p: { price: number }) => p.price);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  test('BUG-02 adding a product adds THAT product', async ({ api }) => {
    test.fail(true, 'BUG-02: products with id % 5 === 0 add the next product instead');
    const cart = await ShopApi.ok(await api.with(BUGS).post('/cart', { productId: 10, qty: 1, variant: { size: '9', color: 'Black' } }), 201);
    expect(cart.items[0].productId).toBe(10);
  });

  test('BUG-03 order total = subtotal − discount + shipping + tax', async ({ api }) => {
    test.fail(true, 'BUG-03: tax is counted twice at checkout');
    const buggy = api.with(BUGS);
    await buggy.addToCart(PRODUCTS.mug.id, 2);
    const order = await buggy.checkout();
    expect(order.total).toBe(round2(order.subtotal - order.discount + order.shipping + order.tax));
  });

  test('BUG-04 search is case-insensitive', async ({ guestApi }) => {
    test.fail(true, 'BUG-04: search becomes case-sensitive');
    const { total } = await ShopApi.ok(await guestApi.with(BUGS).get('/products', { q: 'keyboard' }));
    expect(total).toBe(1);
  });

  test('BUG-05 SAVE10 gives 10% off', async ({ api }) => {
    test.fail(true, 'BUG-05: SAVE10 only takes 1% off');
    const buggy = api.with(BUGS);
    await buggy.addToCart(PRODUCTS.pragmaticTester.id, 4);
    const cart = await ShopApi.ok(await buggy.post('/cart/coupon', { code: 'SAVE10' }));
    expect(cart.discount).toBe(round2(cart.subtotal * 0.1));
  });

  test('BUG-06 cart quantity is validated on update', async ({ api }) => {
    test.fail(true, 'BUG-06: PATCH /cart/:lineId accepts any quantity');
    const buggy = api.with(BUGS);
    await buggy.addToCart(PRODUCTS.mug.id, 1);
    expect((await buggy.patch(`/cart/${PRODUCTS.mug.id}`, { qty: -5 })).status()).toBe(422);
  });

  test('BUG-07 pages do not overlap', async ({ guestApi }) => {
    test.fail(true, 'BUG-07: page 2+ repeats the last item of the previous page');
    const buggy = guestApi.with(BUGS);
    const p1 = await ShopApi.ok(await buggy.get('/products', { limit: 10, page: 1 }));
    const p2 = await ShopApi.ok(await buggy.get('/products', { limit: 10, page: 2 }));
    expect(p2.items[0].id).not.toBe(p1.items.at(-1).id);
  });

  test('BUG-08 profile name is saved exactly', async ({ api }) => {
    test.fail(true, 'BUG-08: the last character of the name is dropped');
    const me = await ShopApi.ok(await api.with(BUGS).put('/me', { name: 'Rupesh Kumar', email: (await (await api.get('/me')).json()).email }));
    expect(me.name).toBe('Rupesh Kumar');
  });
});

test.describe('UI level', () => {
  test('BUG-02 (UI) the cart contains the product you added', async ({ page, productPage, cartPage }) => {
    test.fail(true, 'BUG-02 seen from the browser');
    await page.setExtraHTTPHeaders(BUGS); // bug mode for this browser context only
    await productPage.goto(PRODUCTS.hoodie.id);
    await productPage.chooseSize('L');
    await productPage.chooseColour('Sand');
    await productPage.addToCartButton.click();
    await expect(productPage.toast(`Added ${PRODUCTS.hoodie.name} to cart`)).toBeVisible(); // the UI *claims* success…
    await cartPage.goto();
    await expect(cartPage.item(PRODUCTS.hoodie.name)).toBeVisible({ timeout: 2000 }); // …but the cart says otherwise
  });

  test('BUG-01 (UI) problem_user sees price low → high in the right order', async ({ browser, baseURL, apiContext }) => {
    test.fail(true, 'BUG-01 is always on for problem_user');
    const problem = new ShopApi(apiContext);
    await problem.login(USERS.problem, PASSWORD);
    const ctx = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [{ origin: new URL(baseURL!).origin, localStorage: [{ name: 'shoplab.token', value: problem.token! }, { name: 'shoplab.cookies', value: 'accepted' }] }] } });
    const page = await ctx.newPage();
    await page.goto('/shop?sort=price_asc');
    await expect(page.getByTestId('product-grid')).toHaveAttribute('aria-busy', 'false');
    const prices = (await page.getByTestId('product-price').allInnerTexts()).map(t => Number(t.split('$')[1]));
    await ctx.close();
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });
});
