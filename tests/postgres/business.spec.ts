import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
const { createPrismaClient } = require('../../server/database.cjs');

test('a PostgreSQL account completes seller, travel, finance and learning journeys across browser sessions', async ({ page, request, browser }) => {
  const db = createPrismaClient();
  const username = `biz_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
  const password = `Test9${randomUUID()}`;
  let userId: string | undefined;
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  try {
    const registration = await request.post('/api/v2/register', { data: { username, password, confirmPassword: password, email: `${username}@example.test`, name: 'Business Owner', acceptTerms: true } });
    expect(registration.status()).toBe(201); userId = (await registration.json()).id;
    const login = await request.post('/api/v2/login', { data: { username, password } });
    expect(login.status()).toBe(200); const session = await login.json();
    const storage = (data: { token: string; user: unknown }) => {
      localStorage.setItem('shoplab.token', data.token); localStorage.setItem('shoplab.user', JSON.stringify(data.user)); localStorage.setItem('shoplab.cookies', 'accepted');
    };
    await page.addInitScript(storage, session); await page.goto('/business');
    await expect(page.locator('html')).toHaveAttribute('data-storage', 'postgres');
    await page.getByLabel('Company name', { exact: true }).fill('Durable Demo Business');
    await page.getByLabel('Industry', { exact: true }).selectOption('Technology');
    await page.getByRole('button', { name: 'Create business workspace' }).click();
    await page.getByTestId('business-nav-seller').click();
    const rfq = page.getByTestId('business-rfq').filter({ hasText: 'Northstar Studio' });
    await rfq.getByRole('button', { name: 'Send quote' }).click(); await page.getByLabel('Quoted unit price').fill('200');
    await page.getByRole('dialog').getByRole('button', { name: 'Send quote' }).click();
    await rfq.getByRole('button', { name: 'Simulate buyer acceptance' }).click(); await page.getByRole('button', { name: 'Accept quote' }).click();
    await page.getByRole('button', { name: 'Ship order' }).click(); await page.getByLabel('Tracking reference').fill('DEMO-DURABLE-TRACK');
    await page.getByRole('button', { name: 'Confirm shipment' }).click();
    await page.getByTestId('business-nav-finance').click(); await expect(page.getByTestId('business-balance')).toHaveText('$27000.00');
    await page.getByRole('button', { name: 'Send payment' }).click();
    await page.getByLabel('Amount (USD)').fill('125.50'); await page.getByLabel('Payment reference').fill('Durable payment');
    await page.getByRole('button', { name: 'Review payment' }).click(); await page.getByRole('button', { name: 'Confirm transfer' }).click();
    await expect(page.getByTestId('business-balance')).toHaveText('$26874.50');
    await page.getByTestId('business-nav-travel').click(); await page.getByRole('button', { name: 'Search flights' }).click();
    await page.getByRole('button', { name: 'Select flight' }).first().click(); await page.getByRole('button', { name: 'Confirm booking' }).click();
    await page.getByRole('button', { name: 'Cancel booking', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel booking', exact: true }).click();
    await page.getByTestId('business-nav-learning').click();
    const course = page.getByTestId('business-course').filter({ hasText: 'Your first wholesale order' });
    await course.getByRole('button', { name: 'Enrol in course' }).click();
    for (const title of ['Build a wholesale listing', 'Quote and fulfil']) {
      await course.getByRole('button', { name: title }).click(); await page.getByRole('button', { name: 'Mark lesson complete' }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
    }
    await course.getByRole('button', { name: 'Take assessment' }).click(); await page.getByLabel('Available stock and minimum quantity').check();
    await page.getByRole('button', { name: 'Submit assessment' }).click(); await expect(course.getByRole('button', { name: 'Download certificate' })).toBeVisible();
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    try {
      await context.addInitScript(storage, session); const fresh = await context.newPage();
      await fresh.goto('http://127.0.0.1:3100/business/finance'); await expect(fresh.getByTestId('business-balance')).toHaveText('$26874.50');
      await expect(fresh.getByTestId('business-transaction').filter({ hasText: 'Durable payment' })).toHaveCount(1);
      expect(await fresh.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    } finally { await context.close(); }
    const saved = await db.businessWorkspace.findUnique({ where: { userId } });
    expect(saved.state.balanceCents).toBe(2687450); expect(saved.state.learning.seller.passed).toBe(true); expect(saved.state.bookings[0].status).toBe('Cancelled');
    expect(errors).toEqual([]);
  } finally {
    if (userId) await db.user.deleteMany({ where: { id: userId } }); await db.$disconnect();
  }
});
