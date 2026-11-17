import { randomUUID } from 'node:crypto';
import { test, expect, ShopApi } from '../support/fixtures';

test('business endpoints require a valid account session', async ({ guestApi }) => {
  expect((await guestApi.get('/business')).status()).toBe(401);
  expect((await guestApi.get('/business/trips')).status()).toBe(401);
  expect((await guestApi.post('/business/actions', {})).status()).toBe(401);
});

test('workspace data is isolated by authenticated account, not a supplied user ID', async ({ api, apiContext }) => {
  const initial = await ShopApi.ok(await api.get('/business'));
  const saved = await ShopApi.ok(await api.post('/business/actions', {
    type: 'company.save', payload: { name: 'Private Northline', contact: 'Demo Seller', industry: 'Technology' },
    version: initial.version, requestId: randomUUID(), userId: 'admin_user'
  }));
  expect(saved.state.company.name).toBe('Private Northline');
  const other = new ShopApi(apiContext); await other.createUser();
  const isolated = await ShopApi.ok(await other.get('/business'));
  expect(isolated.state.company).toBeNull();
  expect(isolated.version).toBe(0);
  expect((await ShopApi.ok(await api.get('/business'))).state.company.name).toBe('Private Northline');
});

test('retrying a payment request cannot debit twice, and stale concurrent actions conflict', async ({ api }) => {
  const initial = await ShopApi.ok(await api.get('/business'));
  const setup = await ShopApi.ok(await api.post('/business/actions', {
    type: 'company.save', payload: { name: 'Demo Business', contact: 'Demo Seller', industry: 'Technology' }, version: initial.version, requestId: randomUUID()
  }));
  const payment = { type: 'transfer.send', payload: { beneficiaryId: 'supplier', amount: '125.50', reference: 'Demo payment' }, version: setup.version, requestId: randomUUID() };
  const first = await ShopApi.ok(await api.post('/business/actions', payment));
  const retry = await ShopApi.ok(await api.post('/business/actions', payment));
  expect(retry.state.balanceCents).toBe(2487450);
  expect(retry.version).toBe(first.version);
  expect(retry.state.ledger).toHaveLength(2);
  const reused = await api.post('/business/actions', { ...payment, payload: { ...payment.payload, amount: '999' } });
  expect(reused.status()).toBe(409);
  expect((await reused.json()).code).toBe('REQUEST_REUSED');
  expect((await api.post('/business/actions', { ...payment, requestId: randomUUID() })).status()).toBe(409);
  const concurrent = await Promise.all([1, 2].map(() => api.post('/business/actions', { ...payment, version: first.version, requestId: randomUUID() })));
  expect(concurrent.map(res => res.status()).sort()).toEqual([200, 409]);
});
