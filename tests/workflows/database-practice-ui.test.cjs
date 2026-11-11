const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const { once } = require('node:events');
const { chromium, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
require('dotenv').config();

test(
  'PostgreSQL practice controls activate the personal storefront and reset defects',
  {
    skip: !process.env.DATABASE_URL,
    timeout: 90000,
  },
  async () => {
    const { prisma: db } = require('../../dist/db/client');
    const { tokenHash } = require('../../dist/auth/passwords');
    const { throttleKey } = require('../../dist/auth/throttle');
    const app = require('../../src/app');
    let user, server, browser;
    try {
      const username = randomUUID(),
        token = randomBytes(32).toString('hex');
      user = await db.user.create({
        data: {
          username,
          email: username + '@example.test',
          name: 'Practice Browser',
          passwordHash: 'unused fixture',
          sessions: { create: { tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + 90000) } },
        },
      });
      server = app.listen(0, '127.0.0.1');
      await once(server, 'listening');
      const origin = 'http://127.0.0.1:' + server.address().port;
      browser = await chromium.launch();
      const context = await browser.newContext({
        reducedMotion: 'reduce',
        storageState: {
          cookies: [],
          origins: [
            {
              origin,
              localStorage: [
                { name: 'shoplab.token', value: token },
                {
                  name: 'shoplab.user',
                  value: JSON.stringify({ username, name: user.name, role: 'customer' }),
                },
                { name: 'shoplab.cookies', value: 'accepted' },
              ],
            },
          ],
        },
      });
      const page = await context.newPage();
      await page.goto(origin + '/practice');
      await expect(page.getByTestId('vortex-practice-form')).toBeVisible();
      await page.getByTestId('vortex-practice-enabled').check();
      await page.getByTestId('vortex-defect-BUG-01').check();
      await page.getByTestId('vortex-practice-save').click();
      await expect(page.getByTestId('vortex-practice-status')).toContainText('Practice is active');
      await expect(page.getByTestId('vortex-practice-banner')).toBeVisible();
      const audit = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      assert.deepEqual(
        audit.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
        [],
      );
      await page.getByTestId('nav-shop').click();
      await page.getByTestId('sort').selectOption('price_asc');
      const personal = await db.practiceProfile.findUniqueOrThrow({ where: { userId: user.id } });
      const expected = personal.workspace.products
        .map((p) => p.price)
        .sort((a, b) => b - a)
        .slice(0, 12);
      await expect(page.getByTestId('product-card')).toHaveCount(expected.length);
      await expect(page.getByTestId('product-card').first().getByTestId('product-price')).toContainText(
        '$' + expected[0].toFixed(2),
      );
      await page.goto(origin + '/practice');
      page.once('dialog', (dialog) => dialog.accept());
      await page.getByTestId('vortex-practice-reset').click();
      await expect(page.getByTestId('vortex-defect-BUG-01')).not.toBeChecked();
      assert.deepEqual(
        (await db.practiceProfile.findUniqueOrThrow({ where: { userId: user.id } })).defects,
        [],
      );
      page.once('dialog', (dialog) => dialog.accept());
      await page.getByTestId('vortex-practice-exit').click();
      await expect(page.getByTestId('vortex-practice-status')).toContainText('Practice is off');
      await expect(page.getByTestId('vortex-practice-banner')).toBeHidden();
    } finally {
      if (browser) await browser.close();
      if (server) {
        server.closeAllConnections();
        await new Promise((resolve) => server.close(resolve));
      }
      if (user) {
        await db.rateLimit.deleteMany({ where: { key: throttleKey('vortex-practice', user.id) } });
        await db.user.delete({ where: { id: user.id } });
      }
      await db.$disconnect();
    }
  },
);
