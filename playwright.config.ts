import { defineConfig, devices } from '@playwright/test';

/**
 * ShopLab reference suite.
 *  - Run against local:   npx playwright test                (starts `npm start` for you)
 *  - Run against a deploy: BASE_URL=https://your-app.onrender.com npx playwright test
 *
 * Projects
 *  api           pure API tests (request fixture, no browser)
 *  chromium      UI journeys on desktop Chrome
 *  mobile        responsive checks on a Pixel 7 viewport
 *  bugs          the seeded-bug hunt — each test is marked test.fail() until the bug is fixed
 *  global-state  tests that flip server-wide chaos settings; runs last, one test at a time
 */
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

export default defineConfig({
  testDir: './tests',
  globalSetup: './tests/support/global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 30_000,
  expect: { timeout: 7_000 },
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    testIdAttribute: 'data-testid',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  webServer: process.env.BASE_URL
    ? undefined
    : { command: 'npm start', url: `${BASE_URL}/api/health`, reuseExistingServer: !process.env.CI, timeout: 90_000, env: { SHOPLAB_STORAGE: 'legacy' } },
  projects: [
    { name: 'api', testDir: './tests/api' },
    { name: 'chromium', testDir: './tests/e2e', testIgnore: /mobile\.spec\.ts/, use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', testDir: './tests/e2e', testMatch: /mobile\.spec\.ts/, use: { ...devices['Pixel 7'] } },
    { name: 'bugs', testDir: './tests/bugs', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'global-state',
      testDir: './tests/serial',
      fullyParallel: false,
      dependencies: ['api', 'chromium', 'mobile', 'bugs'],
      use: { ...devices['Desktop Chrome'] }
    }
  ]
});
