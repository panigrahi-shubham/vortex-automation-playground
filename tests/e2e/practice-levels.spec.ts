import { test, expect } from '../support/fixtures';

test.use({ authAs: 'guest' });

test('CSS filters persist through a standalone exercise and reset only that exercise', async ({ page }) => {
  await page.goto('/lab?topic=css&level=1');
  await expect(page.getByRole('heading', { name: 'Level 2 · Intermediate' })).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Supplier catalog availability' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Native dialogs' })).toBeHidden();
  await page.getByRole('link', { name: 'Open Supplier catalog availability' }).click();
  const card = page.getByTestId('lab-css-catalog-states');
  await expect(card.getByRole('button', { name: 'Request quote for Monitor arm' })).toBeDisabled();
  await card.getByLabel('Show in-stock items only').check();
  await expect(card.getByRole('status')).toHaveText('2 listings shown');
  await card.getByRole('button', { name: 'Request quote for Desk lamp' }).click();
  await expect(card.getByRole('status')).toHaveText('Quote requested for Desk lamp');
  await card.getByRole('button', { name: 'Reset Supplier catalog availability' }).click();
  await expect(card.getByRole('status')).toHaveText('3 listings shown');
  await page.getByRole('link', { name: 'Back to all cards' }).click();
  await expect(page.getByLabel('Difficulty')).toHaveValue('1');
  await expect(page.getByLabel('CSS examples only')).toBeChecked();
  await page.getByLabel('Challenge mode').check();
  await expect(page.getByTestId('lab-css-catalog-states')).toHaveCount(0);
  await expect(page.getByText('CSS locator example')).toHaveCount(0);
});

test('CSS examples expose form validation, container layout and reduced motion', async ({ page }) => {
  await page.goto('/lab/css-invoice-form');
  const billing = page.getByLabel('Billing email');
  await billing.fill('invalid');
  await page.getByRole('button', { name: 'Save billing contact' }).click();
  await expect(page.locator('input:user-invalid + .qa-field-error')).toBeVisible();
  await billing.fill('billing@example.com');
  await page.getByRole('button', { name: 'Save billing contact' }).click();
  await expect(page.getByTestId('lab-css-invoice-form').getByRole('status')).toHaveText('Billing contact saved');
  await expect(page.locator('.qa-field-error')).toBeHidden();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/lab/css-shipment-layout');
  const aside = page.getByRole('heading', { name: 'Delivery summary' });
  const items = page.getByRole('heading', { name: 'Pack shipment' });
  const narrowAside = (await aside.boundingBox())!;
  const narrowItems = (await items.boundingBox())!;
  expect(narrowAside.y).toBeGreaterThan(narrowItems.y);
  await page.getByRole('button', { name: 'Wide preview' }).click();
  await expect(page.locator('.qa-shipment-grid')).toHaveCSS('grid-template-columns', /px .*px/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  await page.goto('/lab/css-quote-review');
  const review = page.getByRole('button', { name: 'Review selected quote' });
  await expect(review).toBeDisabled();
  await page.getByRole('radio', { name: /Meridian Supplies/ }).check();
  await expect(page.locator('.qa-quote:has(input:checked)')).toContainText('Meridian Supplies');
  await review.click();
  await expect(page.getByTestId('lab-css-quote-review').getByRole('status')).toHaveText('Reviewing Meridian Supplies · $210.00');

  await page.goto('/lab/css-fulfilment-queue');
  const queue = page.getByRole('region', { name: 'Scrollable fulfilment queue' });
  const header = queue.getByRole('columnheader', { name: 'Order' });
  const initialHeader = (await header.boundingBox())!;
  await queue.evaluate(element => { element.scrollTop = 100; });
  expect(await queue.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  expect((await header.boundingBox())!.y).toBeCloseTo(initialHeader.y);
  await page.getByLabel('Delayed orders only').check();
  await expect(queue.locator('tbody tr:visible')).toHaveCount(3);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/lab/css-order-notice');
  await expect(page.locator('.qa-progress-fill')).toHaveCSS('transition-property', 'none');
  await page.getByRole('button', { name: 'Mark order packed' }).click();
  await expect(page.getByTestId('lab-css-order-notice').getByRole('status')).toHaveText('Packed · ready for pickup');
});

test('API lab runs every example against the storefront and shows raw evidence', async ({ page }) => {
  await page.goto('/docs?level=1');
  const docs = page.getByTestId('api-docs');
  await expect(docs.getByRole('heading', { name: 'Level 3 · Advanced' })).toBeHidden();

  for (const level of ['1', '2', '3']) {
    await docs.getByLabel('Difficulty').selectOption(level);
    const cards = docs.locator('.qa-level:visible [data-example]');
    await expect(cards).toHaveCount(level === '3' ? 4 : 3);
    for (const card of await cards.all()) {
      await card.getByRole('button', { name: 'Run example' }).click();
      await expect(card.getByRole('status')).toHaveText(/\d of \d checks passed/);
      await expect(card.locator('[data-result=fail]')).toHaveCount(0);
    }
  }

  const pagination = docs.getByRole('article', { name: 'Compare two catalog pages' });
  await pagination.getByText('Response 2 · HTTP 200').click();
  await expect(pagination.locator('details[open] pre').last()).toContainText('"page": 2');

  const graphql = docs.getByRole('article', { name: 'Query a catalog with GraphQL variables' });
  await graphql.getByLabel('Product search').fill("A name that doesn't occur");
  await graphql.getByRole('button', { name: 'Run example' }).click();
  await expect(graphql.locator('[data-result=pass]')).toHaveCount(4);
  await graphql.getByText('Response HTTP 200').click();
  await expect(graphql.locator('details[open] pre').last()).toContainText('"products": []');

  await page.reload();
  await expect(docs.getByLabel('Difficulty')).toHaveValue('3');
  await page.setViewportSize({ width: 360, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
