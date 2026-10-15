import { test, expect, ShopApi } from '../support/fixtures';

test('customers get 403 on every admin endpoint', async ({ api }) => {
  for (const res of await Promise.all([api.get('/admin/stats'), api.get('/admin/products'), api.post('/admin/products', {}), api.get('/admin/users'), api.patch('/admin/orders/ORD-1', {})])) {
    expect(res.status()).toBe(403);
  }
});

test('product validation (422)', async ({ adminApi }) => {
  const res = await adminApi.post('/admin/products', { name: 'x', category: 'Food', price: -1, stock: 1.5 });
  expect(res.status()).toBe(422);
  expect(Object.keys((await res.json()).fields).sort()).toEqual(['category', 'name', 'price', 'stock']);
});

test('order status must be a known value', async ({ adminApi, api }) => {
  const order = await api.placeOrder([[3, 1]]);
  expect((await adminApi.patch(`/admin/orders/${order.id}`, { status: 'Lost' })).status()).toBe(422);
  const updated = await ShopApi.ok(await adminApi.patch(`/admin/orders/${order.id}`, { status: 'Processing' }));
  expect(updated.history.at(-1).status).toBe('Processing');
});

test('locking a user blocks their live session (423) and login', async ({ adminApi, api, user, guestApi }) => {
  await ShopApi.ok(await adminApi.patch(`/admin/users/${user.username}`, { locked: true }));
  expect((await api.get('/me')).status()).toBe(423);
  expect((await guestApi.post('/login', { username: user.username, password: user.password })).status()).toBe(423);
  await ShopApi.ok(await adminApi.patch(`/admin/users/${user.username}`, { locked: false }));
  expect((await api.get('/me')).status()).toBe(200);
});

test('admin cannot lock themselves', async ({ adminApi }) => {
  expect((await adminApi.patch('/admin/users/admin_user', { locked: true })).status()).toBe(422);
});
