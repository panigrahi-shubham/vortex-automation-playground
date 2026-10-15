import { test, expect, ShopApi } from '../support/fixtures';
import { ADDRESS, CARDS, PAYMENT, PRODUCTS, THREE_DS_CODE, round2 } from '../support/test-data';

const { mug, pragmaticTester: book, hoodie, outOfStock, lowStock, keyboard } = PRODUCTS;

test.describe('cart', () => {
  test('add, merge same line, update, remove', async ({ api }) => {
    await api.addToCart(book.id, 2);
    const merged = await api.addToCart(book.id, 1);
    expect(merged.items).toHaveLength(1);
    expect(merged.items[0]).toMatchObject({ lineId: String(book.id), qty: 3, lineTotal: round2(book.price * 3) });
    const updated = await ShopApi.ok(await api.patch(`/cart/${book.id}`, { qty: 1 }));
    expect(updated.count).toBe(1);
    const removed = await ShopApi.ok(await api.delete(`/cart/${book.id}`));
    expect(removed).toMatchObject({ items: [], count: 0, subtotal: 0, shipping: 0, total: 0 });
  });

  test('variants create separate lines', async ({ api }) => {
    await api.addToCart(hoodie.id, 1, { size: 'M', color: 'Black' });
    const cart = await api.addToCart(hoodie.id, 1, { size: 'L', color: 'Black' });
    expect(cart.items.map((i: { lineId: string }) => i.lineId)).toEqual(['5-M-Black', '5-L-Black']);
  });

  const bad: Array<[string, Record<string, unknown>, number, string]> = [
    ['unknown product', { productId: 999 }, 404, 'Product not found'],
    ['out of stock', { productId: outOfStock.id }, 409, 'Out of stock'],
    ['qty 0', { productId: mug.id, qty: 0 }, 422, 'Quantity must be between 1 and 10'],
    ['qty 11', { productId: mug.id, qty: 11 }, 422, 'Quantity must be between 1 and 10'],
    ['more than stock', { productId: lowStock.id, qty: 3 }, 409, 'Only 2 left in stock'],
    ['variant missing', { productId: hoodie.id }, 422, 'Please select a size'],
    ['bad colour', { productId: hoodie.id, variant: { size: 'M', color: 'Pink' } }, 422, 'Please select a colour']
  ];
  for (const [name, body, status, error] of bad) {
    test(`POST /cart rejects ${name} (${status})`, async ({ api }) => {
      const res = await api.post('/cart', body);
      expect(res.status()).toBe(status);
      expect((await res.json()).error).toBe(error);
    });
  }

  test('totals math: discount → tax on discounted subtotal → shipping thresholds', async ({ api }) => {
    await api.addToCart(keyboard.id, 3); // 268.50
    const c = await ShopApi.ok(await api.post('/cart/coupon', { code: 'FLAT50' }));
    expect(c).toMatchObject({ subtotal: 268.5, discount: 50, shipping: 0, tax: round2(218.5 * 0.08) });
    expect(c.total).toBe(round2(218.5 + 218.5 * 0.08));
    const express = await ShopApi.ok(await api.put('/cart/shipping', { method: 'express' }));
    expect(express.shipping).toBe(14.99);
    expect((await api.put('/cart/shipping', { method: 'teleport' })).status()).toBe(422);
  });

  test('coupon errors', async ({ api }) => {
    await api.addToCart(mug.id);
    expect((await api.post('/cart/coupon', { code: 'BOGUS' })).status()).toBe(404);
    expect((await api.post('/cart/coupon', { code: 'EXPIRED20' })).status()).toBe(422);
    expect((await api.post('/cart/coupon', { code: 'FLAT50' })).status()).toBe(422);
    expect((await api.post('/cart/coupon', {})).status()).toBe(422);
  });
});

test.describe('checkout', () => {
  test('empty cart → 400', async ({ api }) => {
    const res = await api.post('/checkout', { address: ADDRESS, payment: PAYMENT() });
    expect(res.status()).toBe(400);
  });

  test('every field is validated (422)', async ({ api }) => {
    await api.addToCart(mug.id);
    const res = await api.post('/checkout', { address: { country: 'US', state: 'Telangana', zip: '500016' }, payment: { cardNumber: CARDS.invalidLuhn, expiry: '13/30', cvv: '12' } });
    expect(res.status()).toBe(422);
    expect((await res.json()).fields).toEqual({
      fullName: 'Full name is required', line1: 'Address is required', city: 'City is required', state: 'Select a state',
      zip: 'Postal code must be 5 digits', phone: 'Phone must be 10 digits', cardNumber: 'Enter a valid card number',
      expiry: 'Use MM/YY', cvv: 'CVV must be 3 or 4 digits', cardName: 'Name on card is required'
    });
  });

  for (const [card, error, code] of [
    [CARDS.declined, 'Your card was declined', 'card_declined'],
    [CARDS.insufficientFunds, 'Insufficient funds', 'insufficient_funds'],
    [CARDS.bankExpired, 'Your card has expired', 'expired_card']
  ]) {
    test(`402 ${code}`, async ({ api }) => {
      await api.addToCart(mug.id);
      const res = await api.post('/checkout', { address: ADDRESS, payment: PAYMENT(card) });
      expect(res.status()).toBe(402);
      expect(await res.json()).toEqual({ error, code });
      expect((await api.cart()).count).toBe(1); // cart untouched on failure
    });
  }

  test('happy path: 201, cart emptied, stock reduced, email sent', async ({ api, guestApi, user }) => {
    const stockBefore = (await ShopApi.ok(await guestApi.get(`/products/${book.id}`))).stock;
    await api.addToCart(book.id, 2);
    const order = await api.checkout();
    expect(order).toMatchObject({ id: expect.stringMatching(/^ORD-\d{6}$/), status: 'Placed', payment: { brand: 'Visa', last4: '4242' }, subtotal: round2(book.price * 2) });
    expect((await api.cart()).count).toBe(0);
    expect((await ShopApi.ok(await guestApi.get(`/products/${book.id}`))).stock).toBeLessThanOrEqual(stockBefore - 2);
    await guestApi.latestMail(user.email, `Order ${order.id} confirmed`);
  });

  test('3-D Secure: 202 → wrong code 422 → correct code 201', async ({ api }) => {
    await api.addToCart(mug.id);
    const pending = await ShopApi.ok(await api.post('/checkout', { address: ADDRESS, payment: PAYMENT(CARDS.threeDS) }), 202);
    expect(pending).toMatchObject({ status: 'requires_action', challengeId: expect.any(String) });
    const wrong = await api.post('/checkout/3ds', { challengeId: pending.challengeId, code: '111111' });
    expect(wrong.status()).toBe(422);
    const order = await ShopApi.ok(await api.post('/checkout/3ds', { challengeId: pending.challengeId, code: THREE_DS_CODE }), 201);
    expect(order.status).toBe('Placed');
  });

  test('3-D Secure: three wrong codes fail the payment', async ({ api }) => {
    await api.addToCart(mug.id);
    const { challengeId } = await ShopApi.ok(await api.post('/checkout', { address: ADDRESS, payment: PAYMENT(CARDS.threeDS) }), 202);
    for (const status of [422, 422, 402]) expect((await api.post('/checkout/3ds', { challengeId, code: '000000' })).status()).toBe(status);
    expect((await api.post('/checkout/3ds', { challengeId, code: THREE_DS_CODE })).status()).toBe(404);
  });
});

test.describe('orders', () => {
  test('cancel restores stock; cancelling twice is 409', async ({ api, guestApi }) => {
    // Aroma Diffuser (id 33) is used by no other test, so its stock can be asserted exactly
    // even with many workers buying things in parallel.
    const diffuser = 33;
    const before = (await ShopApi.ok(await guestApi.get(`/products/${diffuser}`))).stock;
    const order = await api.placeOrder([[diffuser, 4]]);
    expect((await ShopApi.ok(await guestApi.get(`/products/${diffuser}`))).stock).toBe(before - 4);
    const cancelled = await ShopApi.ok(await api.post(`/orders/${order.id}/cancel`));
    expect(cancelled.status).toBe('Cancelled');
    expect(cancelled.history.map((h: { status: string }) => h.status)).toEqual(['Placed', 'Cancelled']);
    expect((await ShopApi.ok(await guestApi.get(`/products/${diffuser}`))).stock).toBe(before);
    expect((await api.post(`/orders/${order.id}/cancel`)).status()).toBe(409);
  });

  test('shipped orders cannot be cancelled', async ({ api, adminApi }) => {
    const order = await api.placeOrder([[mug.id, 1]]);
    await adminApi.patch(`/admin/orders/${order.id}`, { status: 'Shipped' });
    const res = await api.post(`/orders/${order.id}/cancel`);
    expect(res.status()).toBe(409);
    expect((await res.json()).error).toBe('Order cannot be cancelled once shipped');
  });

  test("other users' orders are 404 (no information leak)", async ({ api, apiContext }) => {
    const order = await api.placeOrder([[mug.id, 1]]);
    const stranger = new ShopApi(apiContext);
    await stranger.createUser();
    expect((await stranger.get(`/orders/${order.id}`)).status()).toBe(404);
    expect((await stranger.post(`/orders/${order.id}/cancel`)).status()).toBe(404);
  });

  test('invoice is a CSV attachment', async ({ api }) => {
    const order = await api.placeOrder([[mug.id, 1]]);
    const res = await api.get(`/orders/${order.id}/invoice`);
    expect(res.headers()['content-type']).toContain('text/csv');
    expect(res.headers()['content-disposition']).toBe(`attachment; filename="invoice-${order.id}.csv"`);
    expect(await res.text()).toContain(`TOTAL,,,${order.total.toFixed(2)}`);
  });

  test('filter by status', async ({ api }) => {
    const a = await api.placeOrder([[mug.id, 1]]);
    await api.placeOrder([[mug.id, 1]]);
    await api.post(`/orders/${a.id}/cancel`);
    const cancelled = await ShopApi.ok(await api.get('/orders', { status: 'Cancelled' }));
    expect(cancelled.map((o: { id: string }) => o.id)).toEqual([a.id]);
  });
});

test.describe('per-request chaos headers', () => {
  test('x-shoplab-fail forces a status code', async ({ guestApi }) => {
    const res = await guestApi.with({ 'x-shoplab-fail': '503' }).get('/products');
    expect(res.status()).toBe(503);
  });
  test('x-shoplab-latency delays only that request', async ({ guestApi }) => {
    const t0 = Date.now();
    await guestApi.with({ 'x-shoplab-latency': '800' }).get('/categories');
    expect(Date.now() - t0).toBeGreaterThanOrEqual(780);
  });
  test('malformed JSON body → 400', async ({ apiContext }) => {
    const res = await apiContext.post('/api/login', { headers: { 'content-type': 'application/json' }, data: '{"username": ' });
    expect(res.status()).toBe(400);
    expect(await res.json()).toEqual({ error: 'Malformed JSON body' });
  });
  test('unknown route → JSON 404', async ({ guestApi }) => {
    const res = await guestApi.get('/does-not-exist');
    expect(res.status()).toBe(404);
    expect((await res.json()).error).toBe('No route for GET /api/does-not-exist');
  });
});
