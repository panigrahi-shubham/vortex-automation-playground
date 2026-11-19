import { devices, expect, test, type BrowserContext, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

const { accounts, fixtures, resetMarketplace, seedMarketplace, testOtp } = require('../../scripts/vortex-marketplace-fixtures.cjs');
const { createPrismaClient } = require('../../server/database.cjs');
const staging = process.env.VORTEX_MARKETPLACE_STAGING_URL;

type Actor = { username: string; password: string; otpSecret: string };
function actor(role: 'seller' | 'buyer'): Actor {
  if (!staging) return { username: accounts[role].username, ...fixtures };
  const prefix = 'VORTEX_MARKETPLACE_' + role.toUpperCase();
  const [username, password, otpSecret] = ['USERNAME', 'PASSWORD', 'OTP_SECRET'].map(field => process.env[prefix + '_' + field]);
  if (!username || !password || !otpSecret) throw new Error('Configure staging credentials for both marketplace roles');
  return { username, password, otpSecret };
}

async function open(context: BrowserContext, path: string) {
  context.setDefaultTimeout(staging ? 15_000 : 8_000);
  await context.addInitScript(() => localStorage.setItem('shoplab.cookies', 'accepted'));
  const page = await context.newPage();
  await page.goto(path);
  return page;
}

async function signIn(page: Page, account: Actor, path: string, previousWindow = true) {
  await page.goto('/login?returnTo=' + encodeURIComponent(path));
  await page.getByTestId('username').fill(account.username);
  await page.getByTestId('password').fill(account.password);
  await page.getByTestId('login-btn').click();
  await expect(page.getByRole('heading', { name: 'Verify with your authenticator' })).toBeVisible();
  // Near a boundary, wait before generating the code so its previous window
  // remains valid while Playwright fills the six fields.
  await expect.poll(() => Math.floor(Date.now() / 1000) % 30, {
    timeout: 10_000, intervals: [500]
  }).toBeLessThan(25);
  const code: string = await testOtp(account.otpSecret, previousWindow ? -30 : 0);
  for (const [index, digit] of [...code].entries()) await page.getByTestId('otp-' + (index + 1)).fill(digit);
  await page.getByTestId('otp-submit').click();
  await expect(page.getByRole('heading', { name: 'B2B Marketplace' })).toBeVisible();
}

test.beforeAll(async ({ request }) => {
  if (staging) {
    const response = await request.get('/api/config');
    expect(response.ok()).toBe(true);
    expect(await response.json()).toMatchObject({ storage: 'postgres', vortexMarketplaceStaging: true });
    return;
  }
  const db = createPrismaClient();
  try { await resetMarketplace(db); await seedMarketplace(db); }
  finally { await db.$disconnect(); }
});

test.afterAll(async () => {
  if (staging) return;
  const db = createPrismaClient();
  try { await resetMarketplace(db); }
  finally { await db.$disconnect(); }
});

test('seller publishes on desktop, mobile buyer requests a quote, seller replies and buyer signs back in to see it', async ({ browser, baseURL }) => {
  test.setTimeout(staging ? 180_000 : 100_000);
  const sellerContext = await browser.newContext({ ...devices['Desktop Chrome'], baseURL });
  const buyerContext = await browser.newContext({ ...devices['Pixel 7'], baseURL });
  const title = 'Steel Workshop Rack ' + randomUUID().slice(0, 8);
  const seller = actor('seller'), buyer = actor('buyer');
  const sellerPage = await open(sellerContext, '/marketplace/products');
  const buyerPage = await open(buyerContext, '/marketplace/catalog');
  const sellerListing = sellerPage.getByTestId('vortex-market-listing').filter({ hasText: title });
  const photoName = title + '.png';
  const workbookName = title + '.xlsx';
  const sellerFile = sellerPage.getByTestId('vortex-market-file').filter({ hasText: photoName });
  const workbookFile = sellerPage.getByTestId('vortex-market-file').filter({ hasText: workbookName });
  let published = false;
  let uploaded = false;
  try {
    await test.step('Seller signs in, uploads a photo and publishes a draft', async () => {
      await signIn(sellerPage, seller, '/marketplace/products', false);
      await sellerPage.getByRole('link', { name: 'Photos & Docs' }).click();
      const image = await sharp({ create: { width: 16, height: 16, channels: 3, background: '#126359' } }).png().toBuffer();
      const sheet = await readFile(join(__dirname, 'fixtures', 'workshop.xlsx'));
      await sellerPage.getByLabel('Files to upload').setInputFiles([
        { name: photoName, mimeType: 'image/png', buffer: image },
        { name: workbookName, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: sheet }
      ]);
      await sellerPage.getByRole('button', { name: 'Upload files' }).click();
      await expect(sellerFile).toBeVisible();
      uploaded = true;
      await workbookFile.getByRole('button', { name: 'Preview' }).click();
      const preview = sellerPage.getByRole('dialog', { name: 'File preview' });
      await expect(preview.getByRole('cell', { name: 'Workshop quantity' })).toBeVisible();
      await preview.getByRole('button', { name: 'Close preview' }).click();
      const download = sellerPage.waitForEvent('download');
      await workbookFile.getByRole('button', { name: 'Download' }).click();
      expect((await download).suggestedFilename()).toBe(workbookName);
      await sellerPage.getByRole('link', { name: 'My Products' }).click();
      await sellerPage.getByText('New listing', { exact: true }).click();
      const draft = sellerPage.getByRole('form', { name: 'Create a listing' });
      await draft.getByLabel('Product name').fill(title);
      await draft.getByLabel('Description').fill('Adjustable rack for bulk workshop storage.');
      await draft.getByRole('combobox', { name: 'Category', exact: true }).selectOption('Industrial supplies');
      await draft.getByLabel('Unit price (USD)', { exact: true }).fill('44.50');
      await draft.getByLabel('Minimum order quantity').fill('10');
      await draft.getByRole('combobox', { name: 'Saved photo', exact: true }).selectOption({ label: photoName });
      await draft.getByRole('button', { name: 'Save draft' }).click();
      await expect(sellerListing.getByText('Draft', { exact: true })).toBeVisible();
      await sellerListing.getByRole('button', { name: 'Publish', exact: true }).click();
      await expect(sellerListing.getByText('Published', { exact: true })).toBeVisible();
      published = true;
    });
    await test.step('Buyer finds the published listing on mobile and sends the request', async () => {
      await signIn(buyerPage, buyer, '/marketplace/catalog');
      await buyerPage.getByLabel('Search products').fill(title);
      await buyerPage.getByRole('combobox', { name: 'Category', exact: true }).selectOption('Industrial supplies');
      await buyerPage.getByRole('button', { name: 'Search', exact: true }).click();
      const product = buyerPage.getByTestId('vortex-market-catalog-item').filter({ hasText: title });
      await expect(product.getByRole('heading', { name: title })).toBeVisible();
      await expect(product.getByText('44.50', { exact: false })).toBeVisible();
      await expect(product.getByRole('img', { name: title })).toBeVisible();
      await expect.poll(() => product.getByRole('img').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
      await product.getByText('Request Quote', { exact: true }).click();
      await product.getByLabel('Quantity', { exact: true }).fill('25');
      await product.getByLabel('Message').fill('Please quote delivery to the workshop.');
      await product.getByRole('button', { name: 'Send request' }).click();
      const enquiry = buyerPage.getByTestId('vortex-market-enquiry').filter({ hasText: title });
      await expect(enquiry.getByText('New', { exact: true })).toBeVisible();
      expect(await buyerPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await buyerPage.getByTestId('user-menu').click();
      await buyerPage.getByRole('menuitem', { name: 'Sign out' }).click();
      await expect(buyerPage.getByRole('heading', { name: 'Sign in' })).toBeVisible();
      await buyerPage.goto('/marketplace/enquiries');
      await expect(buyerPage).toHaveURL(/\/login\?returnTo=/);
    });
    await test.step('Seller sends a priced quote from the enquiry inbox', async () => {
      await sellerPage.getByRole('link', { name: 'Enquiry Inbox' }).click();
      const enquiry = sellerPage.getByTestId('vortex-market-enquiry').filter({ hasText: title });
      await expect(enquiry.getByText('Please quote delivery to the workshop.')).toBeVisible();
      await enquiry.getByText('Reply with quote', { exact: true }).click();
      await expect(enquiry.getByLabel('Quoted quantity')).toHaveValue('25');
      await enquiry.getByLabel('Quoted unit price (USD)').fill('39.75');
      await enquiry.getByLabel('Delivery estimate (days)').fill('5');
      await enquiry.getByRole('button', { name: 'Send quote' }).click();
      await expect(enquiry.getByText('Replied', { exact: true })).toBeVisible();
    });
    await test.step('Buyer signs back in and sees the quote from the database', async () => {
      await signIn(buyerPage, buyer, '/marketplace/enquiries', false);
      const quote = buyerPage.getByTestId('vortex-market-enquiry').filter({ hasText: title });
      await expect(quote.getByText('Replied', { exact: true })).toBeVisible();
      await expect(quote.getByText('25', { exact: true })).toBeVisible();
      await expect(quote.getByText('USD 39.75', { exact: true })).toBeVisible();
      await expect(quote.getByText('5 days', { exact: true })).toBeVisible();
    });
  } finally {
    try {
      if (staging && (published || uploaded)) {
        if (published) {
          await sellerPage.goto('/marketplace/products?' + new URLSearchParams({ q: title }));
          await sellerListing.getByRole('button', { name: 'Deactivate' }).click({ timeout: 5000 });
          await expect(sellerListing.getByText('Inactive', { exact: true })).toBeVisible();
        }
        if (uploaded) {
          await sellerPage.goto('/marketplace/files');
          for (const file of [sellerFile, workbookFile]) {
            if (!await file.count()) continue;
            sellerPage.once('dialog', dialog => dialog.accept());
            await file.getByRole('button', { name: 'Delete' }).click({ timeout: 5000 });
            await expect(file).toHaveCount(0);
          }
        }
      }
    } finally {
      await Promise.all([sellerContext.close(), buyerContext.close()]);
    }
  }
});
