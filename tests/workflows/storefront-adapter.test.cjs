const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('database storefront metadata never falls back to the legacy API', async () => {
  const source = fs.readFileSync(require('node:path').join(__dirname, '../../web/js/api-v2.js'), 'utf8');
  const adapter = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async url => { calls.push(url); return new Response(JSON.stringify({ shipping: [], countries: [] }), { status: 200 }); };
  try {
    await adapter.request('/meta');
    assert.deepEqual(calls, ['/api/v2/meta']);
  } finally { global.fetch = originalFetch; }
});

test('checkout reuses its key after a lost response and forwards terms consent', async () => {
  const source = fs.readFileSync(require('node:path').join(__dirname, '../../web/js/api-v2.js'), 'utf8');
  const adapter = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (_url, opts) => {
    calls.push(opts);
    if (calls.length === 1) throw new Error('Lost response');
    return new Response(JSON.stringify({ order: { id: 'order', lines: [], total: 1 } }), { status: 200 });
  };
  const body = { address: { fullName: 'Test', line1: '1 Road', city: 'Mumbai', country: 'IN', zip: '400001' }, payment: { cardNumber: '4242424242424242' }, acceptTerms: true };
  try {
    await assert.rejects(adapter.request('/checkout', { method: 'POST', body, token: 'test' }));
    await adapter.request('/checkout', { method: 'POST', body, token: 'test' });
    assert.equal(calls[0].headers['Idempotency-Key'], calls[1].headers['Idempotency-Key']);
    assert.equal(JSON.parse(calls[1].body).acceptTerms, true);
    await adapter.request('/checkout', { method: 'POST', body: { ...body, acceptTerms: false }, token: 'test' });
    assert.equal(JSON.parse(calls[2].body).acceptTerms, false);
    assert.notEqual(calls[2].headers['Idempotency-Key'], calls[1].headers['Idempotency-Key']);
  } finally { global.fetch = originalFetch; }
});
