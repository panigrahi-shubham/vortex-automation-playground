import 'dotenv/config';
import { defineConfig } from '@playwright/test';

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
    env: { PORT: '3100', SHOPLAB_STORAGE: 'postgres' }
  }
});
