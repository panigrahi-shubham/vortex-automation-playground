// Database-mode storefront smoke: register → shop → cart → coupon → shipping →
// checkout → order detail → invoice download → cancel. Requires the server to be
// running with DATABASE_URL set (postgres storage).
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const HEADED = process.env.HEADED === '1';

/* Remove the disposable account (and its orders) so repeat runs don't pile up fixtures. */
async function cleanupUser(username) {
  if (!process.env.DATABASE_URL) return;
  try {
    const { prisma } = require('../dist/db/client');
    const user = await prisma.user.findUnique({ where: { username }, select: { id: true, email: true } });
    if (user) {
      const { cancelOrder } = require('../dist/workflows/cancel-order');
      const orders = await prisma.order.findMany({ where: { userId: user.id } });
      for (const order of orders) await cancelOrder(prisma, user.id, order.id);
      await prisma.outboxEvent.deleteMany({ where: { aggregateId: { in: orders.map(order => order.id) } } });
      await prisma.order.deleteMany({ where: { userId: user.id } });
      const { throttleKey } = require('../dist/auth/throttle');
      await prisma.rateLimit.deleteMany({ where: { key: { in: [throttleKey('login', user.id), throttleKey('forgot', user.email), throttleKey('reset', user.email), throttleKey('avatar', user.id)] } } });
      await prisma.user.delete({ where: { id: user.id } });
      console.log(`Cleaned up ${username}`);
    }
    await prisma.$disconnect();
  } catch (err) { console.log(`Cleanup skipped: ${String(err.message).split('\n')[0]}`); }
}

(async () => {
  const browser = await chromium.launch({ headless: !HEADED });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  await context.addInitScript(() => localStorage.setItem('shoplab.cookies', 'accepted'));
  const page = await context.newPage();
  const failures = [];
  const events = [];
  page.on('pageerror', err => events.push(`pageerror: ${err.message}`));
  page.on('console', msg => { if (msg.type() === 'error') events.push(`console: ${msg.text()}`); });

  const check = async (name, fn) => {
    try { await fn(); console.log(`PASS  ${name}`); }
    catch (err) { failures.push(name); console.log(`FAIL  ${name}\n      ${String(err.message || err).split('\n').slice(0, 6).join('\n      ')}`); }
  };

  const username = `v2smoke_${Date.now().toString(36)}`;
  const email = `${username}@example.test`;
  const password = 'Secret123';

  try {
    const config = await (await page.request.get(`${BASE}/api/config`)).json();
    assert.equal(config.storage, 'postgres', 'server must be in postgres mode for this smoke test');

    await check('Boots in database mode', async () => {
      await page.goto(`${BASE}/shop`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('[data-testid=product-card]');
      assert.equal(await page.evaluate(() => document.documentElement.dataset.storage), 'postgres');
      assert.ok(await page.locator('[data-testid=nav-wishlist]').isVisible(), 'wishlist nav is available in database mode');
      assert.ok(await page.locator('[data-testid=nav-mailbox]').isHidden(), 'test inbox nav stays hidden in database mode');
      assert.ok(await page.locator('[data-testid=wishlist-toggle]').count() > 0, 'wishlist hearts on cards');
      assert.equal(await page.locator('[data-testid=filter-rating]').count(), 1, 'rating filter');
    });

    await check('Login page hides legacy-only affordances', async () => {
      await page.goto(`${BASE}/login`);
      await page.waitForSelector('[data-testid=login-form]');
      assert.equal(await page.locator('[data-testid=forgot-link]').count(), 1, 'development recovery link');
      assert.equal(await page.locator('[data-testid=test-accounts]').count(), 0, 'no test accounts panel');
    });

    await check('Registers a new account', async () => {
      await page.goto(`${BASE}/register`);
      await page.locator('[data-testid=reg-name]').fill('V2 Smoke');
      await page.locator('[data-testid=reg-username]').fill(username);
      await page.locator('[data-testid=reg-email]').fill(email);
      await page.locator('[data-testid=reg-password]').fill(password);
      await page.locator('[data-testid=reg-confirm]').fill(password);
      await page.locator('[data-testid=reg-terms]').check();
      await page.locator('[data-testid=register-btn]').click();
      await page.waitForURL('**/shop', { timeout: 20_000 });
      await page.waitForSelector('[data-testid=user-menu]');
      assert.equal(await page.locator('[data-testid=user-name]').innerText(), 'V2 Smoke');
    });

    await check('Wishlist persists across reloads', async () => {
      const heart = page.locator('[data-testid=wishlist-toggle]').first();
      await heart.click();
      await page.waitForFunction(() => document.querySelector('[data-testid=wishlist-count]')?.textContent === '1');
      await page.goto(`${BASE}/wishlist`);
      await page.waitForSelector('[data-testid=wishlist-grid] [data-testid=product-card]');
      await page.reload();
      await page.waitForSelector('[data-testid=wishlist-grid] [data-testid=product-card]');
      await page.locator('[data-testid=wishlist-toggle]').click();
      await page.waitForSelector('[data-testid=wishlist-empty]');
      await page.goto(`${BASE}/shop`);
      await page.waitForSelector('[data-testid=product-card]');
    });
    await check('Adds a product to the cart', async () => {
      const add = page.locator('[data-testid=add-to-cart]:not([disabled])').first();
      await add.click();
      await page.waitForFunction(() => Number(document.querySelector('[data-testid=cart-badge]')?.textContent) >= 1);
      assert.ok(Number(await page.locator('[data-testid=cart-badge]').innerText()) >= 1);
    });

    await check('Opens the product detail page and posts a review', async () => {
      await page.locator('[data-testid=product-name]').first().click();
      await page.waitForSelector('[data-testid=product-detail]');
            await page.locator('[data-testid=tab-reviews]').click();
      await page.locator('label[for=star-5]').click();
      await page.locator('[data-testid=review-title-input]').fill('Smoke review');
      await page.locator('[data-testid=review-body]').fill('Review persisted through the database storefront.');
      await page.locator('[data-testid=submit-review]').click();
      await page.waitForSelector('[data-testid=review]');
      await page.reload();
      await page.locator('[data-testid=tab-reviews]').click();
      assert.ok((await page.locator('[data-testid=review-list]').innerText()).includes('Smoke review'));
      assert.equal(await page.locator('[data-testid=wishlist-toggle]').count(), 1, 'wishlist button');
    });

    await check('Selects product size and colour', async () => {
      await page.goto(`${BASE}/shop?q=Classic%20Hoodie`);
      await page.locator('[data-testid=choose-options]').first().click();
      await page.waitForSelector('[data-testid=product-detail]');
      await page.locator('label[for=size-M]').click();
      await page.locator('[data-testid=color-select]').selectOption('Navy');
      const before = Number(await page.locator('[data-testid=cart-badge]').innerText());
      await page.locator('[data-testid=add-to-cart]').click();
      await page.waitForFunction(before => Number(document.querySelector('[data-testid=cart-badge]')?.textContent) > before, before);
      await page.goto(`${BASE}/cart`);
      await page.waitForSelector('[data-testid=cart-items]');
      assert.equal((await page.locator('[data-testid=cart-item-variant]').first().innerText()).trim(), 'Size M · Navy');
    });
    await check('Applies the SAVE10 coupon', async () => {
      await page.goto(`${BASE}/cart`);
      await page.waitForSelector('[data-testid=cart-items]');
      await page.locator('[data-testid=coupon-input]').fill('SAVE10');
      await page.locator('[data-testid=apply-coupon]').click();
      await page.waitForSelector('[data-testid=coupon-applied]');
      assert.match(await page.locator('[data-testid=discount]').innerText(), /^\−?\$?\d/);
    });

    await check('Switches to express shipping', async () => {
      await page.locator('[data-testid=shipping-express]').check();
      await page.waitForFunction(() => document.querySelector('[data-testid=shipping]')?.textContent.includes('14.99'));
    });

    await check('Completes the checkout wizard', async () => {
      await page.locator('[data-testid=checkout-btn]').click();
      await page.waitForSelector('[data-testid=address-form]');
      await page.locator('[data-testid=fullName]').fill('V2 Smoke');
      await page.locator('[data-testid=phone]').fill('4155550100');
      await page.locator('[data-testid=line1]').fill('1 Market Street');
      await page.locator('[data-testid=line2]').fill('Suite 100');
      await page.locator('[data-testid=city]').fill('San Francisco');
      await page.locator('[data-testid=country]').selectOption('US');
      await page.locator('[data-testid=state]').selectOption('California');
      await page.locator('[data-testid=zip]').fill('94105');
      await page.locator('[data-testid=continue-delivery]').click();

      await page.waitForSelector('[data-testid=delivery-express]');
      assert.ok(await page.locator('[data-testid=delivery-express] input').isChecked());
      await page.locator('[data-testid=continue-payment]').click();

      await page.waitForSelector('[data-testid=payment-mode-note]');
      assert.equal(await page.locator('[data-testid=use-card-4000002760003184]').count(), 0, '3-D Secure card hidden');
      await page.locator('[data-testid=test-cards] summary').click();
      await page.locator('[data-testid=use-card-4242424242424242]').click();
      await page.locator('[data-testid=expiry]').fill('12/30');
      await page.locator('[data-testid=cvv]').fill('123');
      await page.locator('[data-testid=cardName]').fill('V2 Smoke');
      await page.locator('[data-testid=continue-review]').click();

      await page.waitForSelector('[data-testid=review-items]');
      await page.locator('[data-testid=accept-terms]').check();
      await page.locator('[data-testid=place-order]').click();
      await page.waitForURL('**/checkout/complete/**', { timeout: 25_000 });
      const id = (await page.locator('[data-testid=order-id]').innerText()).trim();
      assert.ok(id.length > 8, `order id looks like a cuid (${id})`);
      assert.equal(await page.locator('[data-testid=confirmation-inbox]').count(), 0, 'no test-inbox link in database mode');
      await page.evaluate(id => sessionStorage.setItem('smoke.order', id), id);
    });

    const orderId = await page.evaluate(() => sessionStorage.getItem('smoke.order'));

    await check('Lists the order and opens its detail', async () => {
      await page.goto(`${BASE}/orders`);
      await page.waitForSelector('[data-testid=order-row]');
      assert.equal(await page.locator(`[data-order-id="${orderId}"]`).count(), 1);
      await page.locator('[data-testid=order-link]').first().click();
      await page.waitForSelector('[data-testid=order-heading]');
      assert.match(await page.locator('[data-testid=order-heading]').innerText(), new RegExp(orderId));
      assert.match(await page.locator('[data-testid=order-payment]').innerText(), /Card ending in TEST/);
      assert.match(await page.locator('[data-testid=order-address]').innerText(), /San Francisco/);
    });

    await check('Downloads the CSV invoice', async () => {
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 15_000 }),
        page.locator('[data-testid=download-invoice]').click()
      ]);
      assert.equal(download.suggestedFilename(), `invoice-${orderId}.csv`);
      const body = await require('node:fs/promises').readFile(await download.path(), 'utf8');
      assert.match(body, /Subtotal/);
      assert.match(body, /TOTAL/);
    });

    await check('Cancels the order', async () => {
      await page.locator('[data-testid=cancel-order]').click();
      await page.locator('[data-testid=confirm-ok]').click();
      await page.waitForFunction(() => document.querySelector('[data-testid=order-status]')?.textContent === 'Cancelled');
    });

    await check('Profile and settings persist after reload', async () => {
      await page.goto(`${BASE}/account`);
      await page.waitForSelector('[data-testid=profile-form]');
      await page.locator('[data-testid=profile-name]').fill('Updated Smoke User');
      await page.locator('[data-testid=profile-phone]').fill('9876543210');
      await page.locator('[data-testid=save-profile]').click();
      await page.waitForFunction(() => document.querySelector('[data-testid=account-name]')?.textContent === 'Updated Smoke User');
      await page.reload();
      await page.waitForSelector('[data-testid=profile-phone]');
      assert.equal(await page.locator('[data-testid=profile-phone]').inputValue(), '9876543210');
      await page.locator('[data-testid=account-tab-settings]').click();
      await page.waitForSelector('[data-testid=settings-form]');
      await page.locator('[data-testid=settings-theme]').selectOption('dark');
      await page.getByLabel('Reduce motion', { exact: true }).check();
      await page.locator('[data-testid=save-settings]').click();
      await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark' && document.documentElement.dataset.reducedMotion === 'true');
      await page.reload();
      await page.waitForSelector('[data-testid=settings-form]');
      assert.equal(await page.locator('[data-testid=settings-theme]').inputValue(), 'dark');
      assert.equal(await page.getByLabel('Reduce motion', { exact: true }).isChecked(), true);
    });
    await check('Avatar persists after reload and can be removed', async () => {
      await page.goto(`${BASE}/account/avatar`);
      const buffer = await require('sharp')({ create: { width:100, height:100, channels:3, background:'blue' } }).png().toBuffer();
      await page.locator('[data-testid=avatar-input]').setInputFiles({ name:'avatar.png', mimeType:'image/png', buffer });
      await page.waitForFunction(() => document.querySelector('#preview img')?.naturalWidth > 0);
      const url = await page.locator('#preview img').getAttribute('src');
      await page.reload();
      await page.waitForFunction(() => document.querySelector('#preview img')?.naturalWidth > 0);
      assert.equal(await page.locator('#preview img').getAttribute('src'),url);
      assert.equal(await page.locator('.user-menu [data-testid=avatar-img]').getAttribute('src'),url);
      await page.locator('[data-testid=avatar-remove]').click();
      await page.waitForFunction(() => !document.querySelector('#preview img') && !document.querySelector('.user-menu img'));
      assert.equal((await page.request.get(BASE+url)).status(),404);
    });
    await check('Password can be changed from the account page', async () => {
      await page.goto(`${BASE}/account/security`);
      await page.locator('[data-testid=current-password]').fill(password);
      await page.locator('[data-testid=new-password]').fill('UpdatedSecret123');
      await page.locator('[data-testid=confirm-password]').fill('UpdatedSecret123');
      await page.locator('[data-testid=change-password]').click();
      await page.waitForFunction(() => document.querySelector('[data-testid=password-alert]')?.textContent.includes('successfully'));
    });
    await check('Recovers the password through the protected development inbox', async () => {
      await page.evaluate(() => { localStorage.removeItem('shoplab.token'); localStorage.removeItem('shoplab.user'); });
      await page.goto(`${BASE}/forgot-password`);
      await page.locator('[data-testid=forgot-email]').fill(email);
      await page.locator('[data-testid=send-code]').click();
      await page.waitForSelector('[data-testid=reset-code]');
      const response = await page.request.get(`${BASE}/api/v2/test/mailbox?to=${encodeURIComponent(email)}`, { headers: { 'X-Orvilo-Test-Key': process.env.ORVILO_TEST_KEY } });
      assert.equal(response.status(), 200);
      const mails = await response.json();
      await page.locator('[data-testid=reset-code]').fill(mails[0].code);
      await page.locator('[data-testid=reset-password]').fill('RecoveredSecret123');
      await page.locator('[data-testid=reset-btn]').click();
      await page.waitForSelector('[data-testid=login-form]');
      await page.locator('[data-testid=username]').fill(username);
      await page.locator('[data-testid=password]').fill('RecoveredSecret123');
      await page.locator('[data-testid=login-btn]').click();
      await page.waitForURL('**/shop');
      await page.waitForSelector('[data-testid=product-card]');
    });
    await check('Enrolls MFA, signs in with a backup code, and disables MFA', async () => {
      await page.goto(`${BASE}/account/security`);
      await page.waitForSelector('[data-testid=mfa-settings-form]');
      await page.locator('[data-testid=mfa-password]').fill('RecoveredSecret123');
      await page.locator('[data-testid=mfa-action]').click();
      await page.waitForSelector('[data-testid=mfa-secret]');
      const secret = await page.locator('[data-testid=mfa-secret]').innerText();
      await page.locator('[data-testid=mfa-code]').fill(require('otplib').generateSync({ secret }));
      await page.locator('[data-testid=mfa-action]').click();
      await page.waitForSelector('[data-testid=mfa-backup-codes]');
      const codes = (await page.locator('[data-testid=mfa-backup-codes]').innerText()).trim().split(/\s+/);
      assert.equal(codes.length, 8);
      await page.evaluate(() => { localStorage.removeItem('shoplab.token'); localStorage.removeItem('shoplab.user'); });
      await page.goto(`${BASE}/login`);
      await page.locator('[data-testid=username]').fill(username);
      await page.locator('[data-testid=password]').fill('RecoveredSecret123');
      await page.locator('[data-testid=login-btn]').click();
      await page.waitForURL('**/login/verify');
      await page.locator('[data-testid=mfa-backup-code]').fill(codes[0]);
      await page.locator('[data-testid=otp-submit]').click();
      await page.waitForURL('**/shop');
      await page.waitForSelector('[data-testid=product-card]');
      await page.goto(`${BASE}/account/security`);
      await page.waitForSelector('[data-testid=mfa-settings-form]');
      await page.locator('[data-testid=mfa-password]').fill('RecoveredSecret123');
      await page.locator('[data-testid=mfa-code]').fill(codes[1]);
      await page.locator('[data-testid=mfa-action]').click();
      await page.waitForFunction(() => document.querySelector('[data-testid=mfa-status]')?.textContent === 'Not enabled');
    });
    await check('Admin products can be created, edited and deleted', async () => {
      const { prisma } = require('../dist/db/client');
      await prisma.user.update({ where: { username }, data: { role:'admin' } });
      await page.goto(`${BASE}/admin`);
      await page.waitForSelector('[data-testid=stat-products]');
      await page.locator('[data-testid=admin-tab-products]').click();
      await page.locator('[data-testid=add-product]').click();
      const name = `Admin smoke ${username}`;
      let productId;
      try {
        await page.locator('[data-testid=product-name-input]').fill(name);
        await page.locator('[data-testid=product-category-select]').selectOption('Books');
        await page.locator('[data-testid=product-price-input]').fill('19.99');
        await page.locator('[data-testid=product-stock-input]').fill('4');
        await page.locator('[data-testid=product-description-input]').fill('Disposable browser fixture');
        await page.locator('[data-testid=product-save]').click();
        await page.waitForSelector('[data-testid=product-form]',{state:'detached'});
        await page.locator('[data-testid=admin-product-search]').fill(name);
        const row = page.locator('[data-testid=admin-product-row]').filter({hasText:name});
        await row.waitFor(); productId=Number(await row.getAttribute('data-product-id'));
        await row.locator('[data-testid=edit-product]').click();
        await page.locator('[data-testid=product-stock-input]').fill('7');
        await page.locator('[data-testid=product-save]').click();
        await page.waitForFunction(id=>document.querySelector(`[data-product-id="${id}"] [data-testid=cell-stock]`)?.textContent==='7',productId);
        await row.locator('[data-testid=delete-product]').click();
        await page.locator('[data-testid=confirm-ok]').click();
        await row.waitFor({state:'detached'});
        assert.ok((await prisma.product.findUnique({where:{id:productId}})).deletedAt);
      } finally {
        const fixture=await prisma.product.findFirst({where:{name}});
        if(fixture){await prisma.outboxEvent.deleteMany({where:{aggregateId:String(fixture.id)}});await prisma.product.delete({where:{id:fixture.id}});}
      }
    });
    await check('Unavailable pages show notices instead of erroring', async () => {
      await page.goto(`${BASE}/account`);
      await page.goto(`${BASE}/wishlist`);
      await page.waitForSelector('[data-testid=wishlist-empty]');
      await page.goto(`${BASE}/mailbox`);
      await page.waitForSelector('[data-testid=mailbox-unavailable]');
      await page.goto(`${BASE}/forgot-password`);
      await page.waitForSelector('[data-testid=forgot-card]');
      await page.waitForSelector('[data-testid=forgot-email]');
    });
  } catch (err) {
    failures.push('unexpected error');
    console.error(err);
  }

  if (events.length) { failures.push('Browser errors'); console.log(`\nPage errors:\n${events.join('\n')}`); }
  await browser.close();
  await cleanupUser(username);
  console.log(`\n${failures.length ? `${failures.length} FAILED` : 'ALL CHECKS PASSED'}`);
  process.exit(failures.length ? 1 : 0);
})();












