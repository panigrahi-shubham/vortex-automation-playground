import 'dotenv/config';
import { defineConfig } from '@playwright/test';

const database = new URL(process.env.DATABASE_URL || 'postgresql://invalid');
if (!['localhost', '127.0.0.1', '[::1]'].includes(database.hostname) ||
  process.env.NODE_ENV === 'production' || process.env.VERCEL || process.env.VORTEX_MARKETPLACE_STAGING_URL) {
  throw new Error('The database browser suite requires a disposable local PostgreSQL server');
}

export default defineConfig({
  testDir: './tests/postgres',
  workers: 1,
  timeout: 60_000,
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:3100', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: {
    command: 'node server.js',
    url: 'http://127.0.0.1:3100/api/health',
    reuseExistingServer: false,
    env: {
      PORT: '3100',
      SHOPLAB_STORAGE: 'postgres',
      VORTEX_STOCKPILOT_PUBLIC_KEYS: 'vortex_pk_ci_stockpilot'
    }
  }
});
