import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { test, expect } from '../support/fixtures';
import { PRODUCTS } from '../support/test-data';

async function audit(page: Page, lab = false) {
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  let scanner = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']);
  if (lab) {
    await expect(page.getByTestId('vortex-lab-graphql')).toBeVisible();
    // The existing lab spec separately asserts the intentionally broken sample.
    scanner = scanner.exclude('[data-testid=lab-a11y]');
  }
  const { violations } = await scanner.analyze();
  expect(violations.map(violation => ({
    id: violation.id,
    nodes: violation.nodes.map(node => ({ target: node.target, detail: node.failureSummary })),
  }))).toEqual([]);
}

test.describe('Guest accessibility', () => {
  test.use({ authAs: 'guest' });
  for (const path of [
    '/shop', '/product/' + PRODUCTS.mug.id, '/login', '/register', '/forgot-password',
    '/docs', '/lab', '/mailbox', '/pages/about.html', '/pages/testing-guide.html', '/terms', '/mock-idp',
  ]) {
    test('WCAG 2.1 AA check on ' + path, async ({ page }) => {
      await page.goto(path);
      await audit(page, path === '/lab');
    });
  }
});

for (const path of ['/account', '/account/security', '/wishlist', '/orders']) {
  test('WCAG 2.1 AA check on ' + path, async ({ page }) => {
    await page.goto(path);
    await audit(page);
  });
}

test('WCAG 2.1 AA check on populated cart and checkout', async ({ page, api, checkoutPage }) => {
  test.setTimeout(90_000);
  await api.addToCart(PRODUCTS.mug.id);
  await page.goto('/cart');
  await audit(page);
  await page.goto('/checkout/address');
  await audit(page);
  await checkoutPage.fillAddress();
  await checkoutPage.continueToDelivery();
  await audit(page);
  await checkoutPage.continueToPayment();
  await audit(page);
  await checkoutPage.fillPayment();
  await checkoutPage.continueToReview();
  await audit(page);
});

test('WCAG 2.1 AA check on the admin console', async ({ page, adminApi }) => {
  const response = await adminApi.get('/me');
  const user = await response.json();
  await page.addInitScript(([token, profile]) => {
    localStorage.setItem('shoplab.token', token);
    localStorage.setItem('shoplab.user', JSON.stringify(profile));
  }, [adminApi.token!, user] as const);
  await page.goto('/admin');
  await audit(page);
});
