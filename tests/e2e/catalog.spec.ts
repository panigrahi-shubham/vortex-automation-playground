import { test, expect } from '../support/fixtures';
import { PRODUCTS } from '../support/test-data';

test.describe('Browse & search (guest)', () => {
  test.use({ authAs: 'guest' });

  test('first page shows 12 products and the total matches the API', async ({ shopPage, guestApi }) => {
    const { total } = await (await guestApi.get('/products')).json();
    await shopPage.goto();
    await expect(shopPage.cards).toHaveCount(12);
    await expect(shopPage.resultsCount).toHaveText(`${total} products`);
    await expect(shopPage.pageInfo).toHaveText(`Page 1 of ${Math.ceil(total / 12)}`);
  });

  test('search is case-insensitive and synced to the URL', async ({ page, shopPage }) => {
    await shopPage.goto();
    await shopPage.searchFor('KEYBOARD');
    await expect(page).toHaveURL(/\?q=KEYBOARD/);
    await expect(page.getByTestId('shop-title')).toHaveText('Results for “KEYBOARD”');
    await expect(shopPage.cards).toHaveCount(1);
    await expect(shopPage.card(PRODUCTS.keyboard.name)).toBeVisible();
  });

  test('search-as-you-type is debounced (one request for a burst of keystrokes)', async ({ page, shopPage }) => {
    await shopPage.goto();
    const calls: string[] = [];
    page.on('request', r => { if (r.url().includes('/api/products?')) calls.push(r.url()); });
    await shopPage.search.pressSequentially('lamp', { delay: 50 });
    await expect(shopPage.cards).toHaveCount(1);
    expect(calls.filter(u => u.includes('q=')).length).toBe(1);
  });

  test('no results shows an empty state', async ({ shopPage }) => {
    await shopPage.goto();
    await shopPage.searchFor('unicorn-xyz');
    await expect(shopPage.emptyState).toContainText('No products found');
    await expect(shopPage.resultsCount).toHaveText('0 products');
  });

  test('category filter narrows results and updates the URL', async ({ page, shopPage }) => {
    await shopPage.goto();
    await shopPage.filterCategory('Books');
    await expect(page).toHaveURL(/category=Books/);
    const cats = await shopPage.cards.locator('.cat').allInnerTexts();
    expect(cats.length).toBeGreaterThan(0);
    expect(new Set(cats.map(c => c.toLowerCase()))).toEqual(new Set(['books']));
  });

  test('sort by price low → high and high → low', async ({ shopPage }) => {
    await shopPage.goto('limit=48');
    await shopPage.sortBy('Price: low to high');
    const asc = await shopPage.prices();
    expect(asc).toEqual([...asc].sort((a, b) => a - b));
    await shopPage.sortBy('Price: high to low');
    const desc = await shopPage.prices();
    expect(desc).toEqual([...desc].sort((a, b) => b - a));
  });

  test('sort by name A–Z', async ({ shopPage }) => {
    await shopPage.goto('category=Home');
    await shopPage.sortBy('Name: A–Z');
    const names = await shopPage.names();
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  test('price range + in-stock filters', async ({ shopPage, page }) => {
    await shopPage.goto();
    await page.getByLabel('Minimum price').fill('20');
    await page.getByLabel('Maximum price').fill('50');
    await page.getByRole('button', { name: 'Apply price' }).click();
    await shopPage.waitForGrid();
    await page.getByRole('checkbox', { name: 'In stock only' }).check();
    await shopPage.waitForGrid();
    await expect(page).toHaveURL(/minPrice=20.*maxPrice=50.*inStock=true/);
    for (const p of await shopPage.prices()) {
      expect(p).toBeGreaterThanOrEqual(20);
      expect(p).toBeLessThanOrEqual(50);
    }
    await expect(shopPage.cards.getByText('Out of stock')).toHaveCount(0);
  });

  test('deep link restores filter UI state', async ({ page, shopPage }) => {
    await shopPage.goto('category=Toys,Fashion&sort=price_desc&inStock=true');
    await expect(page.getByRole('checkbox', { name: 'Toys' })).toBeChecked();
    await expect(page.getByRole('checkbox', { name: 'Fashion' })).toBeChecked();
    await expect(page.getByRole('checkbox', { name: 'Books' })).not.toBeChecked();
    await expect(shopPage.sort).toHaveValue('price_desc');
    await expect(page.getByRole('checkbox', { name: 'In stock only' })).toBeChecked();
  });

  test('pagination: next/prev, URL and browser back', async ({ page, shopPage }) => {
    await shopPage.goto();
    const firstPage = await shopPage.names();
    await shopPage.next.click();
    await shopPage.waitForGrid();
    await expect(page).toHaveURL(/page=2/);
    await expect(shopPage.pageInfo).toContainText('Page 2 of');
    const secondPage = await shopPage.names();
    expect(secondPage.filter(n => firstPage.includes(n))).toEqual([]); // no overlap between pages
    await page.goBack();
    await shopPage.waitForGrid();
    await expect(shopPage.prev).toBeDisabled();
    expect(await shopPage.names()).toEqual(firstPage);
  });

  test('clear all filters resets to /shop', async ({ page, shopPage }) => {
    await shopPage.goto('category=Books&q=test');
    await page.getByRole('button', { name: 'Clear all filters' }).click();
    await expect(page).toHaveURL('/shop');
    await expect(shopPage.cards).toHaveCount(12);
  });

  test('guest clicking Add is sent to login and comes back', async ({ page, shopPage }) => {
    await shopPage.goto(`q=${encodeURIComponent(PRODUCTS.mug.name)}`);
    await shopPage.addToCart(PRODUCTS.mug.name);
    await expect(page).toHaveURL(/\/login\?returnTo=%2Fshop/);
    await expect(page.getByTestId('login-notice')).toBeVisible();
  });

  test('out-of-stock product cannot be added', async ({ shopPage, productPage }) => {
    await shopPage.goto(`q=${encodeURIComponent(PRODUCTS.outOfStock.name)}`);
    await expect(shopPage.card(PRODUCTS.outOfStock.name).getByRole('button', { name: /out of stock/ })).toBeDisabled();
    await productPage.goto(PRODUCTS.outOfStock.id);
    await expect(productPage.addToCartButton).toBeDisabled();
    await expect(productPage.stock).toHaveText('Out of stock');
  });
});

test.describe('Product page', () => {
  test('open from the grid, breadcrumbs, tabs and gallery', async ({ page, shopPage, productPage }) => {
    await shopPage.goto(`q=${encodeURIComponent(PRODUCTS.pragmaticTester.name)}`);
    await shopPage.card(PRODUCTS.pragmaticTester.name).getByTestId('product-name').click();
    await expect(page).toHaveURL(`/product/${PRODUCTS.pragmaticTester.id}`);
    await expect(page).toHaveTitle(`${PRODUCTS.pragmaticTester.name} · ShopLab`);
    await expect(productPage.title).toHaveText(PRODUCTS.pragmaticTester.name);
    await expect(productPage.price).toHaveText('$24.99');
    const crumbs = page.getByRole('navigation', { name: 'Breadcrumb' });
    await expect(crumbs.getByRole('link', { name: 'Books' })).toHaveAttribute('href', '/shop?category=Books');
    await expect(crumbs.getByRole('listitem').last()).toHaveAttribute('aria-current', 'page');

    // tabs: click and keyboard
    await productPage.openTab('Specifications');
    await expect(page.getByRole('tabpanel')).toContainText('SL-BOO-002');
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: /Reviews/ })).toHaveAttribute('aria-selected', 'true');

    // gallery
    await page.getByRole('button', { name: 'Show image 3' }).click();
    await expect(page.getByTestId('main-image').getByRole('img')).toHaveAttribute('aria-label', /view 3/);
  });

  test('variant product needs size and colour', async ({ productPage, app }) => {
    await productPage.goto(PRODUCTS.hoodie.id);
    await productPage.addToCartButton.click();
    await expect(productPage.sizeError).toHaveText('Please select a size');
    await expect(productPage.colourError).toHaveText('Please select a colour');
    await productPage.chooseSize('M');
    await productPage.chooseColour('Navy');
    await productPage.addToCartButton.click();
    await expect(app.toast(`Added ${PRODUCTS.hoodie.name} to cart`)).toBeVisible();
    await expect(app.cartBadge).toHaveText('1');
  });

  test('quantity stepper respects stock', async ({ productPage, api }) => {
    await productPage.goto(PRODUCTS.lowStock.id);
    await expect(productPage.stock).toContainText('only 2 left');
    await productPage.increase.click();
    await expect(productPage.qty).toHaveValue('2');
    await expect(productPage.increase).toBeDisabled();
    await productPage.addToCartButton.click();
    await expect.poll(async () => (await api.cart()).count).toBe(2);
  });

  test('write a review; a second one is rejected', async ({ productPage, page }) => {
    await productPage.goto(PRODUCTS.robotKit.id);
    await productPage.writeReview(4, 'Solid kit', 'My students loved building this robot.');
    await expect(productPage.toast('Your review was posted')).toBeVisible();
    await expect(productPage.reviews.first()).toContainText('Solid kit');
    await productPage.writeReview(5, 'Again', 'Trying to review the same product twice.');
    await expect(page.getByTestId('review-error')).toHaveText('You have already reviewed this product');
  });

  test('review validation messages', async ({ productPage, page }) => {
    await productPage.goto(PRODUCTS.mug.id);
    await productPage.openTab(/Reviews/);
    await page.getByRole('button', { name: 'Submit review' }).click();
    await expect(page.getByTestId('rating-error')).toHaveText('Choose a rating from 1 to 5');
    await expect(page.getByTestId('review-title-input-error')).toHaveText('Title must be 3-60 characters');
    await expect(page.getByTestId('review-body-error')).toHaveText('Review must be 10-500 characters');
  });

  test('unknown product shows a friendly 404', async ({ page }) => {
    await page.goto('/product/9999');
    await expect(page.getByTestId('product-not-found')).toBeVisible();
  });
});

test.describe('Wishlist', () => {
  test('heart a product, see it on the wishlist page, then remove it', async ({ page, shopPage, app }) => {
    await shopPage.goto(`q=${encodeURIComponent(PRODUCTS.earbuds.name)}`);
    const heart = shopPage.card(PRODUCTS.earbuds.name).getByRole('button', { name: `Add ${PRODUCTS.earbuds.name} to wishlist` });
    await heart.click();
    await expect(shopPage.card(PRODUCTS.earbuds.name).getByTestId('wishlist-toggle')).toHaveAttribute('aria-pressed', 'true');
    await expect(app.wishlistBadge).toHaveText('1');
    await page.getByRole('link', { name: 'Wishlist' }).click();
    await expect(page.getByTestId('wishlist-grid').getByTestId('product-card')).toHaveCount(1);
    await page.getByRole('button', { name: `Remove ${PRODUCTS.earbuds.name} from wishlist` }).click();
    await expect(page.getByTestId('wishlist-empty')).toBeVisible();
    await expect(app.wishlistBadge).toHaveText('0');
  });
});

test('command palette (Ctrl+K) finds a product and navigates', async ({ page }) => {
  await page.goto('/shop');
  await page.keyboard.press('Control+K');
  const palette = page.getByRole('dialog', { name: 'Command palette' });
  await expect(palette).toBeVisible();
  await palette.getByRole('combobox').fill('webcam');
  await expect(palette.getByRole('option').first()).toContainText('4K Webcam');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL('/product/11');
});
