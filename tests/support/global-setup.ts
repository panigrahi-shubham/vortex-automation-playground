import { request, type FullConfig } from '@playwright/test';

/** Waits for the server (free hosts sleep!) and restores seed data once before the run. */
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL!;
  const ctx = await request.newContext({ baseURL });
  const deadline = Date.now() + 90_000;
  for (;;) {
    try { if ((await ctx.get('/api/health')).ok()) break; } catch { /* still waking up */ }
    if (Date.now() > deadline) throw new Error(`ShopLab at ${baseURL} did not become healthy`);
    await new Promise(r => setTimeout(r, 2000));
  }
  await ctx.post('/api/reset');
  await ctx.dispose();
}
