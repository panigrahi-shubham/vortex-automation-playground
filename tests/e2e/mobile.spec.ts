import { test, expect } from '../support/fixtures';
import { PRODUCTS } from '../support/test-data';

// Runs in the `mobile` project (Pixel 7: small viewport, touch, mobile UA).

test('hamburger menu opens the main navigation', async ({ page }) => {
  await page.goto('/shop');
  const nav = page.getByRole('navigation', { name: 'Main' });
  const burger = page.getByRole('button', { name: 'Open menu' });
  await expect(nav).toBeHidden();
  await burger.tap();
  await expect(burger).toHaveAttribute('aria-expanded', 'true');
  await nav.getByRole('link', { name: 'UI Lab' }).tap();
  await expect(page).toHaveURL('/lab');
  await expect(nav).toBeHidden(); // menu closes after navigating
});

test('filters live behind a toggle on small screens', async ({ page, shopPage }) => {
  await shopPage.goto();
  const filters = page.getByRole('complementary', { name: 'Filters' });
  await expect(filters).toBeHidden();
  await page.getByRole('button', { name: '⚙ Filters' }).tap();
  await expect(filters).toBeVisible();
  await filters.getByRole('checkbox', { name: 'Toys' }).check();
  await expect(page).toHaveURL(/category=Toys/);
});

test('tap to add to cart', async ({ shopPage }) => {
  await shopPage.goto(`q=${encodeURIComponent(PRODUCTS.mug.name)}`);
  await shopPage.card(PRODUCTS.mug.name).getByRole('button', { name: `Add ${PRODUCTS.mug.name} to cart` }).tap();
  await expect(shopPage.cartBadge).toHaveText('1');
});

test('layout has no horizontal scroll', async ({ page }) => {
  for (const path of ['/shop', '/product/5', '/cart', '/lab', '/docs']) {
    await page.goto(path);
    // not 'networkidle': the app keeps a Server-Sent Events connection open, so the network is never idle
    await expect(page.locator('#app')).not.toBeEmpty();
    await expect(page.getByTestId('loader')).toBeHidden();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `horizontal overflow on ${path}`).toBeLessThanOrEqual(0);
  }
});
