import { test, expect } from '../support/fixtures';
import { readFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page, authAs }) => {
  if (authAs === 'guest') return;
  await page.goto('/business');
  await page.getByLabel('Company name', { exact: true }).fill('Northline Trading');
  await page.getByLabel('Industry', { exact: true }).selectOption('Technology');
  await page.getByRole('button', { name: 'Create business workspace' }).click();
  await expect(page.getByRole('heading', { name: 'Your business, connected' })).toBeVisible();
});

test.describe('business entry', () => {
  test.use({ authAs: 'guest' });
  test('new sellers return to their business workspace after registration', async ({ page }) => {
    await page.goto('/business');
    await page.getByRole('link', { name: 'Create an account', exact: true }).click();
    const username = `biz_${Date.now().toString(36)}`;
    await page.getByTestId('reg-name').fill('Demo Business Owner');
    await page.getByTestId('reg-username').fill(username);
    await page.getByTestId('reg-email').fill(`${username}@example.test`);
    await page.getByTestId('reg-password').fill('TestPassword9');
    await page.getByTestId('reg-confirm').fill('TestPassword9');
    await page.getByTestId('reg-terms').check();
    await page.getByTestId('register-btn').click();
    await expect(page).toHaveURL(/\/business$/);
    await expect(page.getByRole('heading', { name: 'Make room for your business.' })).toBeVisible();
  });
});

test('UI Lab and the responsive business workspace have separate pages', async ({ page }) => {
  await page.goto('/lab');
  await expect(page).toHaveURL('/lab');
  await expect(page.getByRole('heading', { name: 'UI Lab', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Business', exact: true }).click();
  await expect(page).toHaveURL(/\/business$/);
  await expect(page.getByRole('link', { name: 'UI Lab', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId('business-nav-finance')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByTestId('business-nav-finance').click();
  await expect(page.getByTestId('business-balance')).toHaveText('$25000.00');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto('/shop');
  await expect(page.getByTestId('product-card').first()).toBeVisible();
});

test('seller adds inventory, quotes a buyer, reserves stock and ships an order', async ({ page }) => {
  await page.getByTestId('business-nav-seller').click();
  await page.getByRole('button', { name: 'Add product' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Product name').fill('Conference microphone');
  await dialog.getByLabel('SKU', { exact: true }).fill('VX-MIC-04');
  await dialog.getByLabel('Unit price').fill('89.95');
  await dialog.getByLabel('Available stock').fill('60');
  await dialog.getByLabel('Minimum order quantity').fill('5');
  await dialog.getByLabel('Listing status').selectOption('Active');
  await dialog.getByRole('button', { name: 'Save product' }).click();
  await expect(page.getByTestId('business-product-row').filter({ hasText: 'Conference microphone' })).toContainText('$89.95');
  await page.reload();
  await expect(page.getByTestId('business-product-row').filter({ hasText: 'Conference microphone' })).toBeVisible();
  const rfq = page.getByTestId('business-rfq').filter({ hasText: 'Northstar Studio' });
  await rfq.getByRole('button', { name: 'Send quote' }).click();
  await dialog.getByLabel('Quoted unit price').fill('200');
  await dialog.getByRole('button', { name: 'Send quote' }).click();
  await rfq.getByRole('button', { name: 'Simulate buyer acceptance' }).click();
  await dialog.getByRole('button', { name: 'Accept quote' }).click();
  await expect(page.getByTestId('business-product-row').filter({ hasText: 'VX-DESK-01' })).toContainText('70 units');
  await page.getByRole('button', { name: 'Ship order' }).click();
  await dialog.getByLabel('Tracking reference').fill('DEMO-TRACK-2200');
  await dialog.getByRole('button', { name: 'Confirm shipment' }).click();
  await expect(page.getByText('DEMO-TRACK-2200', { exact: true })).toBeVisible();
  await page.getByTestId('business-nav-finance').click();
  await expect(page.getByTestId('business-balance')).toHaveText('$27000.00');
  await expect(page.getByTestId('business-transaction').filter({ hasText: 'Northstar Studio' })).toContainText('$2000.00');
});

test('travel validates route, books a trip, downloads itinerary and refunds cancellation once', async ({ page }) => {
  await page.getByTestId('business-nav-travel').click();
  await page.getByLabel('To', { exact: true }).selectOption('Bengaluru');
  await page.getByRole('button', { name: 'Search flights' }).click();
  await expect(page.getByRole('alert')).toContainText('two different');
  await page.getByLabel('To', { exact: true }).selectOption('Delhi');
  await page.getByRole('button', { name: 'Search flights' }).click();
  await page.getByRole('button', { name: 'Select flight' }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm booking' }).click();
  await expect(page.getByTestId('business-booking')).toContainText('Confirmed');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download itinerary' }).click();
  expect((await download).suggestedFilename()).toMatch(/itinerary\.txt$/);
  await page.getByRole('button', { name: 'Cancel booking', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByTestId('business-booking')).toContainText('Confirmed');
  await page.getByRole('button', { name: 'Cancel booking', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel booking', exact: true }).click();
  await expect(page.getByTestId('business-booking')).toContainText('Cancelled');
  await page.getByTestId('business-nav-finance').click();
  await expect(page.getByTestId('business-balance')).toHaveText('$25000.00');
  await expect(page.getByTestId('business-transaction').filter({ hasText: 'Business travel refund' })).toHaveCount(1);
});

test('banking reviews transfers, rejects overdrafts and exports the updated ledger', async ({ page }) => {
  await page.getByTestId('business-nav-finance').click();
  await page.getByRole('button', { name: 'Add beneficiary', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Beneficiary name').fill('Northline Logistics');
  await dialog.getByLabel('Demo account reference').fill('DEMO-9090');
  await dialog.getByRole('button', { name: 'Add beneficiary' }).click();
  async function review(amount: string) {
    await page.getByRole('button', { name: 'Send payment' }).click();
    await dialog.getByLabel('Beneficiary', { exact: true }).selectOption({ label: 'Northline Logistics · DEMO-9090' });
    await dialog.getByLabel('Amount (USD)').fill(amount);
    await dialog.getByLabel('Payment reference').fill('Delivery November');
    await dialog.getByRole('button', { name: 'Review payment' }).click();
    await expect(dialog.getByRole('heading', { name: 'Review your payment' })).toBeVisible();
  }
  await review('30000');
  await dialog.getByRole('button', { name: 'Confirm transfer' }).click();
  await expect(dialog.getByRole('alert')).toHaveText('Insufficient business balance');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await review('125.50');
  await dialog.getByRole('button', { name: 'Confirm transfer' }).click();
  await expect(page.getByTestId('business-balance')).toHaveText('$24874.50');
  await page.reload();
  await expect(page.getByTestId('business-balance')).toHaveText('$24874.50');
  await expect(page.getByTestId('business-transaction').filter({ hasText: 'Delivery November' })).toHaveCount(1);
  await page.getByLabel('Transaction type', { exact: true }).selectOption('Debit');
  await expect(page.getByTestId('business-transaction')).toHaveCount(1);
  await page.getByLabel('Search transactions', { exact: true }).fill('No matching payment');
  await expect(page.getByText('No transactions match your search.')).toBeVisible();
  await page.getByLabel('Search transactions', { exact: true }).fill('Delivery November');
  await expect(page.getByTestId('business-transaction')).toHaveCount(1);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export statement' }).click();
  const statement = await download;
  expect(statement.suggestedFilename()).toBe('vortex-business-statement.csv');
  const csv = await readFile((await statement.path())!, 'utf8');
  expect(csv).toContain('Delivery November'); expect(csv).toContain(',-125.50');
});

test('a lost payment response can be retried without a second debit', async ({ page }) => {
  await page.getByTestId('business-nav-finance').click();
  let lost = false;
  const ids: string[] = [];
  await page.route('**/api/business/actions', async route => {
    const command = route.request().postDataJSON();
    if (command.type !== 'transfer.send') return route.continue();
    ids.push(command.requestId);
    if (!lost) { lost = true; await route.fetch(); return route.abort('failed'); }
    await route.continue();
  });
  await page.getByRole('button', { name: 'Send payment' }).click();
  await page.getByLabel('Amount (USD)').fill('125.50'); await page.getByLabel('Payment reference').fill('Uncertain payment');
  await page.getByRole('button', { name: 'Review payment' }).click();
  await page.getByRole('button', { name: 'Confirm transfer' }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Connection interrupted');
  await page.getByRole('button', { name: 'Confirm transfer' }).click();
  await expect(page.getByTestId('business-balance')).toHaveText('$24874.50');
  expect(ids).toHaveLength(2); expect(ids[0]).toBe(ids[1]);
  await expect(page.getByTestId('business-transaction').filter({ hasText: 'Uncertain payment' })).toHaveCount(1);
});

test('an interrupted payment is safely recovered after reload', async ({ page }) => {
  await page.getByTestId('business-nav-finance').click();
  let interrupted = false;
  await page.route('**/api/business/actions', route => {
    if (route.request().postDataJSON().type === 'transfer.send' && !interrupted) { interrupted = true; return route.abort('failed'); }
    return route.continue();
  });
  await page.getByRole('button', { name: 'Send payment' }).click();
  await page.getByLabel('Amount (USD)').fill('125.50'); await page.getByLabel('Payment reference').fill('Recovered payment');
  await page.getByRole('button', { name: 'Review payment' }).click(); await page.getByRole('button', { name: 'Confirm transfer' }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Connection interrupted');
  await page.reload();
  await expect(page.getByTestId('business-balance')).toHaveText('$24874.50');
  await expect(page.getByTestId('business-transaction').filter({ hasText: 'Recovered payment' })).toHaveCount(1);
});

test('sample enquiries cover newly activated inventory and cancelling an order restores stock', async ({ page }) => {
  await page.getByTestId('business-nav-seller').click();
  const hub = page.getByTestId('business-product-row').filter({ hasText: 'USB-C business hub' });
  await hub.getByRole('button', { name: 'Edit' }).click();
  await page.getByRole('dialog').getByLabel('Listing status').selectOption('Active');
  await page.getByRole('dialog').getByRole('button', { name: 'Save product' }).click();
  await expect(hub.getByRole('button', { name: 'Edit' })).toBeFocused();
  await page.getByRole('button', { name: 'Sample buyer request' }).click();
  await page.getByLabel('Sample buyer name').fill('New Sample Company');
  await page.getByRole('dialog').getByLabel('Product', { exact: true }).selectOption('hub');
  await page.getByLabel('Requested quantity').fill('20'); await page.getByRole('button', { name: 'Create request', exact: true }).click();
  const rfq = page.getByTestId('business-rfq').filter({ hasText: 'New Sample Company' });
  await rfq.getByRole('button', { name: 'Send quote' }).click(); await page.getByLabel('Quoted unit price').fill('35');
  await page.getByRole('dialog').getByRole('button', { name: 'Send quote' }).click();
  await rfq.getByRole('button', { name: 'Simulate buyer acceptance' }).click(); await page.getByRole('button', { name: 'Accept quote' }).click();
  await expect(hub).toContainText('230 units');
  await page.getByRole('button', { name: 'Cancel order', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel order', exact: true }).click();
  await expect(hub).toContainText('250 units');
  await expect(page.getByRole('button', { name: 'Ship order' })).toHaveCount(0);
});

test('learning gates assessments, records progress and awards a certificate', async ({ page }) => {
  await page.getByTestId('business-nav-learning').click();
  const course = page.getByTestId('business-course').filter({ hasText: 'Your first wholesale order' });
  await course.getByRole('button', { name: 'Enrol in course' }).click();
  await expect(course.getByRole('button', { name: 'Take assessment' })).toBeDisabled();
  for (const title of ['Build a wholesale listing', 'Quote and fulfil']) {
    await course.getByRole('button', { name: title }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Mark lesson complete' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
  await page.reload();
  await expect(course.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  await course.getByRole('button', { name: 'Take assessment' }).click();
  await page.getByLabel('Only the product colour').check();
  await page.getByRole('button', { name: 'Submit assessment' }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('not correct');
  await page.getByLabel('Available stock and minimum quantity').check();
  await page.getByRole('button', { name: 'Submit assessment' }).click();
  const download = page.waitForEvent('download');
  await course.getByRole('button', { name: 'Download certificate' }).click();
  expect((await download).suggestedFilename()).toMatch(/^CERT-.*\.txt$/);
});

test('business pages and dialogs are accessible and fit a narrow screen', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  for (const section of ['overview', 'seller', 'travel', 'finance', 'learning']) {
    await page.getByTestId(`business-nav-${section}`).click();
    await expect(page.getByTestId('business-portal')).toBeVisible();
    const scan = await new AxeBuilder({ page }).include('.biz-shell').analyze();
    expect(scan.violations, section).toEqual([]);
    await page.setViewportSize({ width: 360, height: 800 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), section).toBe(true);
    await page.setViewportSize({ width: 1280, height: 900 });
  }
  await page.getByRole('button', { name: 'Edit business profile', exact: true }).click();
  expect((await new AxeBuilder({ page }).include('.biz-dialog').analyze()).violations).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Edit business profile', exact: true })).toBeFocused();
  expect(errors).toEqual([]);
});
