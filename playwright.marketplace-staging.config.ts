import { defineConfig } from '@playwright/test';

const url = new URL(process.env.VORTEX_MARKETPLACE_STAGING_URL || 'about:blank');
if (url.protocol !== 'https:' || url.hostname === 'vortex-qa.vercel.app' || url.username || url.password) {
  throw new Error('Set VORTEX_MARKETPLACE_STAGING_URL to the separate HTTPS staging deployment');
}

export default defineConfig({
  testDir: './tests/postgres',
  testMatch: 'marketplace-smoke.spec.ts',
  workers: 1,
  reporter: [['list']],
  use: { baseURL: url.origin }
});
