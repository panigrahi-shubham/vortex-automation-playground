import { APIRequestContext, APIResponse, expect } from '@playwright/test';
import { ADDRESS, PAYMENT, STRONG_PASSWORD, uniqueName } from './test-data';

export type TestUser = { username: string; email: string; name: string; password: string; token: string; profile: Record<string, unknown> };
type Json = Record<string, unknown> | unknown[];

/**
 * Thin typed client over ShopLab's JSON API.
 * Use it to SEED state fast (users, carts, orders) so UI tests only exercise what they are about.
 */
export class ShopApi {
  constructor(readonly request: APIRequestContext, public token?: string, private extraHeaders: Record<string, string> = {}) {}

  headers(extra: Record<string, string> = {}) {
    return { ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}), ...this.extraHeaders, ...extra };
  }
  get(path: string, params?: Record<string, string | number | boolean>) { return this.request.get(`/api${path}`, { headers: this.headers(), params }); }
  post(path: string, data?: Json) { return this.request.post(`/api${path}`, { headers: this.headers(), data }); }
  put(path: string, data?: Json) { return this.request.put(`/api${path}`, { headers: this.headers(), data }); }
  patch(path: string, data?: Json) { return this.request.patch(`/api${path}`, { headers: this.headers(), data }); }
  delete(path: string) { return this.request.delete(`/api${path}`, { headers: this.headers() }); }

  /** Returns a copy of this client that sends extra headers (e.g. x-shoplab-bugs) on every call. */
  with(headers: Record<string, string>) { return new ShopApi(this.request, this.token, { ...this.extraHeaders, ...headers }); }

  static async ok<T = any>(res: APIResponse, status = 200): Promise<T> {
    expect(res.status(), `${res.url()} → ${await res.text()}`).toBe(status);
    return res.status() === 204 ? (undefined as T) : res.json();
  }

  /* ---------- auth ---------- */
  async login(username: string, password: string) {
    const body = await ShopApi.ok(await this.post('/login', { username, password }));
    this.token = body.token;
    return body;
  }
  /** Registers a brand-new customer and logs in — every test gets its own isolated cart/orders. */
  async createUser(overrides: Partial<{ username: string; email: string; name: string; password: string }> = {}): Promise<TestUser> {
    const username = overrides.username ?? uniqueName();
    const u = { username, email: overrides.email ?? `${username}@shoplab.test`, name: overrides.name ?? 'Test Automation', password: overrides.password ?? STRONG_PASSWORD };
    await ShopApi.ok(await this.post('/register', { ...u, confirmPassword: u.password, acceptTerms: true }), 201);
    const { token, user } = await this.login(u.username, u.password);
    return { ...u, token, profile: user };
  }

  /* ---------- cart / checkout ---------- */
  async addToCart(productId: number, qty = 1, variant?: { size: string; color: string }) {
    return ShopApi.ok(await this.post('/cart', { productId, qty, ...(variant ? { variant } : {}) }), 201);
  }
  async cart() { return ShopApi.ok(await this.get('/cart')); }
  async checkout(cardNumber?: string, address = ADDRESS) {
    return ShopApi.ok(await this.post('/checkout', { address, payment: PAYMENT(cardNumber) }), 201);
  }
  /** Seeds a paid order in one call and returns it. */
  async placeOrder(items: Array<[number, number?]> = [[1, 1]]) {
    for (const [id, qty] of items) await this.addToCart(id, qty ?? 1);
    return this.checkout();
  }

  /* ---------- test inbox ---------- */
  async latestMail(to: string, subject: RegExp | string) {
    let found: any;
    await expect.poll(async () => {
      const mails = await ShopApi.ok<any[]>(await this.request.get('/api/test/mailbox', { params: { to } }));
      found = mails.find(m => (typeof subject === 'string' ? m.subject.includes(subject) : subject.test(m.subject)));
      return !!found;
    }, { message: `email "${subject}" to ${to}`, timeout: 5000 }).toBe(true);
    return found as { subject: string; body: string; code: string | null };
  }
}
