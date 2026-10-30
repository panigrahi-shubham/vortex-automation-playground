const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { once } = require('node:events');
const Module = require('node:module');

const projectRoot = path.join(__dirname, '../..');
const appPath = path.join(projectRoot, 'src/app.js');
const legacyPath = path.join(projectRoot, 'server/api.js');
const storePath = path.join(projectRoot, 'server/store.js');
const sessionsPath = path.join(projectRoot, 'src/auth/sessions.js');
const dummyDatabase = 'postgresql://boundary:boundary@127.0.0.1:59998/orvilo?schema=orvilo&connect_timeout=1';

// The real compiled recovery router is required so production rejection is observed
// in actual request handling. Only the other database routers are stubbed.
const compiled = [
  'dist/auth/recovery-routes.js', 'dist/auth/passwords.js', 'dist/auth/profile.js',
  'dist/auth/throttle.js', 'dist/db/transaction.js'
];
if (compiled.some(file => !fs.existsSync(path.join(projectRoot, file)))) {
  require('node:child_process').execFileSync(
    process.execPath,
    [path.join(projectRoot, 'node_modules/typescript/bin/tsc'), '-p', 'tsconfig.build.json'],
    { cwd: projectRoot, stdio: 'pipe' }
  );
}

const routeStubs = {
  '../dist/auth/routes': 'authRoutes',
  '../dist/auth/account-routes': 'accountRoutes',
  '../dist/auth/avatar-routes': 'avatarRoutes',
  '../dist/modules/admin/routes': 'adminRoutes',
  '../dist/auth/mfa-routes': 'mfaRoutes',
  '../dist/modules/catalog/routes': 'catalogRoutes',
  '../dist/modules/reviews/routes': 'reviewRoutes',
  '../dist/modules/wishlist/routes': 'wishlistRoutes',
  '../dist/modules/cart/routes': 'cartRoutes',
  '../dist/modules/orders/routes': 'orderRoutes'
};

let legacyRequires = 0;
let distRequires = [];
let prismaReads = 0;
const fakePrisma = new Proxy({}, {
  get() { prismaReads += 1; throw new Error('Unexpected database access in a boundary test'); }
});
const probeRouters = new Map();

function probeRouter(exportName) {
  if (!probeRouters.has(exportName)) {
    const router = require('express').Router();
    router.get('/__probe', (_req, res) => res.json({ router: exportName }));
    probeRouters.set(exportName, router);
  }
  return probeRouters.get(exportName);
}

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'dotenv') return { config: () => ({ parsed: {} }) };
  if (parent && parent.filename === appPath) {
    if (request === '../server/api') legacyRequires += 1;
    if (request.startsWith('../dist/')) distRequires.push(request);
    if (request === '../dist/db/client') return { prisma: fakePrisma };
    if (routeStubs[request]) return { [routeStubs[request]]: () => probeRouter(routeStubs[request]) };
  }
  return originalLoad.call(this, request, parent, isMain);
};

const envKeys = ['NODE_ENV', 'VERCEL_ENV', 'DATABASE_URL', 'DIRECT_URL', 'SHOPLAB_STORAGE', 'ORVILO_TEST_KEY'];
async function withEnv(values, fn) {
  const saved = new Map(envKeys.map(key => [key, process.env[key]]));
  for (const key of envKeys) delete process.env[key];
  Object.assign(process.env, values);
  try { return await fn(); }
  finally {
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function unloadApp() {
  for (const key of Object.keys(require.cache)) {
    if (key === appPath || key === legacyPath || key === storePath || key === sessionsPath) delete require.cache[key];
  }
}

async function withApp(env, fn) {
  return withEnv(env, async () => {
    unloadApp();
    legacyRequires = 0;
    distRequires = [];
    prismaReads = 0;
    return withServer(require(appPath), fn);
  });
}

async function withServer(app, fn) {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try { return await fn(`http://127.0.0.1:${server.address().port}`); }
  finally {
    await new Promise(resolve => { server.close(resolve); server.closeAllConnections?.(); });
  }
}

async function request(base, method, route, { body, headers } = {}) {
  const options = { method, headers: { ...headers } };
  if (body !== undefined) {
    options.headers['content-type'] = 'application/json';
    options.body = JSON.stringify(body);
  }
  const res = await fetch(base + route, options);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* non-JSON response */ }
  return { status: res.status, type: res.headers.get('content-type') || '', text, json };
}

test('production boundaries', async t => {
  await t.test('NODE_ENV=production without DATABASE_URL fails closed before loading any router', async () => {
    const result = await withApp({ NODE_ENV: 'production' }, async base => ({
      health: await request(base, 'GET', '/api/health'),
      config: await request(base, 'GET', '/api/config'),
      register: await request(base, 'POST', '/api/register', { body: { username: 'boundary_user' } }),
      products: await request(base, 'GET', '/api/products'),
      v2: await request(base, 'GET', '/api/v2/products'),
      guide: await request(base, 'GET', '/pages/testing-guide.html')
    }));
    assert.equal(result.health.status, 200);
    assert.deepEqual(result.health.json.ok, true);
    assert.equal(result.config.status, 503);
    assert.match(result.config.json.error, /configuration is incomplete/i);
    assert.ok(!result.config.text.includes('127.0.0.1'));
    assert.ok(!/postgresql:/i.test(result.config.text));
    assert.equal(result.register.status, 503);
    assert.equal(result.products.status, 503);
    assert.equal(result.v2.status, 503);
    assert.equal(result.guide.status, 200);
    assert.equal(legacyRequires, 0);
    assert.deepEqual(distRequires, []);
  });

  await t.test('VERCEL_ENV=production with legacy storage requested fails closed without mounting the memory API', async () => {
    const result = await withApp({ VERCEL_ENV: 'production', SHOPLAB_STORAGE: 'legacy', DATABASE_URL: dummyDatabase }, async base => ({
      health: await request(base, 'GET', '/api/health'),
      config: await request(base, 'GET', '/api/config'),
      register: await request(base, 'POST', '/api/register', { body: { username: 'boundary_user' } }),
      products: await request(base, 'GET', '/api/products')
    }));
    assert.equal(result.health.status, 200);
    assert.equal(result.config.status, 503);
    assert.doesNotMatch(result.config.text, /boundary:boundary|127\.0\.0\.1|postgresql:/i);
    assert.equal(result.register.status, 503);
    assert.equal(result.products.status, 503);
    assert.equal(legacyRequires, 0);
    assert.deepEqual(distRequires, []);
  });

  for (const indicator of ['NODE_ENV', 'VERCEL_ENV']) {
    await t.test(`${indicator}=production with a database serves v2 only`, async () => {
      const result = await withApp({ [indicator]: 'production', DATABASE_URL: dummyDatabase }, async base => ({
        health: await request(base, 'GET', '/api/health'),
        config: await request(base, 'GET', '/api/config'),
        probe: await request(base, 'GET', '/api/v2/__probe'),
        metadata: await request(base, 'GET', '/api/v2/meta'),
        legacyMetadata: await request(base, 'GET', '/api/meta'),
        recovery: await request(base, 'POST', '/api/v2/password/forgot', { body: { email: 'person@example.test' } }),
        mailbox: await request(base, 'GET', '/api/v2/test/mailbox?to=person@example.test'),
        unknownV2: await request(base, 'GET', '/api/v2/does-not-exist'),
        legacyRegister: await request(base, 'POST', '/api/register', { body: { username: 'boundary_user', password: 'Boundary1' } }),
        legacyProducts: await request(base, 'GET', '/api/products'),
        guide: await request(base, 'GET', '/pages/testing-guide.html')
      }));
      assert.equal(result.health.status, 200);
      assert.equal(result.config.status, 200);
      assert.deepEqual(result.config.json, { storage: 'postgres', recoveryAvailable: false });
      assert.equal(result.probe.status, 200);
      assert.equal(result.probe.json.router, 'authRoutes');
      assert.equal(result.metadata.status, 200);
      assert.ok(result.metadata.json.countries.find(c => c.code === 'US').states.includes('California'));
      assert.equal(result.metadata.json.shipping.find(s => s.id === 'express').price, 14.99);
      assert.equal(result.legacyMetadata.status, 404);
      assert.equal(result.recovery.status, 503);
      assert.match(result.recovery.json.error, /recovery delivery is not configured/i);
      assert.equal(result.mailbox.status, 404);
      assert.equal(result.unknownV2.status, 404);
      assert.equal(result.legacyRegister.status, 404);
      assert.equal(result.legacyProducts.status, 404);
      assert.equal(result.legacyRegister.type.split(';')[0], 'application/json');
      assert.equal(result.guide.status, 200);
      assert.equal(legacyRequires, 0);
      assert.equal(require.cache[legacyPath], undefined);
      assert.equal(prismaReads, 0);
      for (const name of Object.values(routeStubs)) {
        assert.ok(distRequires.includes(Object.keys(routeStubs).find(key => routeStubs[key] === name)), `${name} was not mounted`);
      }
    });
  }

  await t.test('development memory mode keeps the legacy reference API', async () => {
    const result = await withApp({}, async base => ({
      config: await request(base, 'GET', '/api/config'),
      products: await request(base, 'GET', '/api/products'),
      probe: await request(base, 'GET', '/api/v2/__probe')
    }));
    assert.equal(result.config.status, 200);
    assert.equal(result.config.json.storage, 'memory');
    assert.equal(result.products.status, 200);
    assert.ok(Array.isArray(result.products.json.items) && result.products.json.items.length > 0);
    assert.equal(result.probe.status, 404);
    assert.ok(legacyRequires > 0);
    assert.deepEqual(distRequires, []);
  });

  await t.test('development PostgreSQL mode keeps v2 dispatch and the legacy reference API', async () => {
    const result = await withApp({ DATABASE_URL: dummyDatabase }, async base => ({
      config: await request(base, 'GET', '/api/config'),
      products: await request(base, 'GET', '/api/products'),
      probe: await request(base, 'GET', '/api/v2/__probe')
    }));
    assert.equal(result.config.status, 200);
    assert.equal(result.config.json.storage, 'postgres');
    assert.equal(result.products.status, 200);
    assert.equal(result.probe.status, 200);
    assert.ok(legacyRequires > 0);
    assert.ok(distRequires.length > 0);
    assert.equal(prismaReads, 0);
  });

  await t.test('development legacy flag still forces memory even with a database configured', async () => {
    const result = await withApp({ SHOPLAB_STORAGE: 'legacy', DATABASE_URL: dummyDatabase }, async base => ({
      config: await request(base, 'GET', '/api/config'),
      products: await request(base, 'GET', '/api/products')
    }));
    assert.equal(result.config.json.storage, 'memory');
    assert.equal(result.products.status, 200);
    assert.ok(legacyRequires > 0);
    assert.deepEqual(distRequires, []);
  });

  await t.test('production guard rejects test controls and strips chaos headers on real requests', async () => {
    await withEnv({ NODE_ENV: 'production', DATABASE_URL: dummyDatabase }, async () => {
      const store = require(storePath);
      store.db.chaos.latencyMs = 0;
      store.db.chaos.errorRate = 0;
      store.db.chaos.bugMode = false;
      store.db.users.boundary_sentinel = { username: 'boundary_sentinel' };
      const express = require('express');
      const bare = express();
      bare.use('/api', require(legacyPath));
      await withServer(bare, async base => {
        const started = Date.now();
        const products = await request(base, 'GET', '/api/products', {
          headers: { 'x-shoplab-fail': '500', 'x-shoplab-bugs': '1', 'x-shoplab-latency': '10000' }
        });
        assert.equal(products.status, 200);
        assert.ok(Array.isArray(products.json.items));
        assert.ok(Date.now() - started < 2500, 'latency header was not suppressed');
        assert.equal((await request(base, 'POST', '/api/reset')).status, 404);
        assert.equal((await request(base, 'GET', '/api/chaos')).status, 404);
        assert.equal((await request(base, 'GET', '/api/test/mailbox?to=person@example.test')).status, 404);
        assert.ok(store.db.users.boundary_sentinel, 'reset request reached the state-changing handler');
      });
    });
  });
});
