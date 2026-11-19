require('dotenv/config');
const { createPrismaClient } = require('../server/database.cjs');
const { hashPassword } = require('../dist/auth/passwords.js');
const { encryptSecret } = require('../dist/auth/mfa.js');
const { throttleKey } = require('../dist/auth/throttle.js');
const { loadOtp } = require('../server/otp.cjs');

// Public test credentials. Fixture writes are confined to named loopback databases.
const accounts = {
  seller: { username: 'vortex_test_seller', name: 'Northline Supply', role: 'seller' },
  buyer: { username: 'vortex_test_buyer', name: 'Workshop Buyer', role: 'customer' },
  other: { username: 'vortex_test_other', name: 'Other Supplier', role: 'seller' }
};
const fixtures = {
  password: 'VortexFixture9!',
  otpSecret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP'
};
const ids = Object.keys(accounts).map(key => 'vortex_marketplace_fixture_' + key);

function checkFixtureDatabase() {
  const url = new URL(process.env.DATABASE_URL || 'postgresql://invalid');
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL ||
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    !['/vortex_test', '/vortex_marketplace_test'].includes(url.pathname) ||
    url.searchParams.get('schema') !== 'orvilo') {
    throw new Error('Marketplace fixtures require a named, disposable loopback PostgreSQL database');
  }
}

async function resetMarketplace(db) {
  checkFixtureDatabase();
  const usernames = Object.values(accounts).map(account => account.username);
  await db.$transaction([
    db.user.deleteMany({ where: { id: { in: ids }, username: { in: usernames } } }),
    db.rateLimit.deleteMany({ where: { key: { in: [...ids.flatMap(id => [throttleKey('login', id), throttleKey('mfa-login', id)]), ...usernames.map(name => throttleKey('login', name))] } } })
  ]);
}

async function seedMarketplace(db) {
  checkFixtureDatabase();
  const passwordHash = await hashPassword(fixtures.password);
  for (const [key, account] of Object.entries(accounts)) {
    const id = 'vortex_marketplace_fixture_' + key;
    const user = { ...account, passwordHash, email: account.username + '@example.test' };
    const mfa = { enabled: true, secret: encryptSecret(fixtures.otpSecret, id), expiresAt: new Date(Date.now() + 86_400_000) };
    await db.user.upsert({
      where: { id },
      create: { id, ...user, mfa: { create: mfa } },
      update: { ...user, mfa: { upsert: { create: mfa, update: mfa } } }
    });
  }
}

async function testOtp(secret, shiftSeconds = 0) {
  const { generateSync } = await loadOtp();
  return generateSync({ secret, epoch: Math.floor(Date.now() / 1000) + shiftSeconds });
}

module.exports = { accounts, fixtures, checkFixtureDatabase, resetMarketplace, seedMarketplace, testOtp };

if (require.main === module) {
  const action = process.argv[2];
  if (!['seed', 'reset'].includes(action)) throw new Error('Pass seed or reset');
  checkFixtureDatabase();
  const db = createPrismaClient();
  (action === 'seed' ? seedMarketplace(db) : resetMarketplace(db))
    .then(() => console.log('Marketplace fixtures ' + (action === 'seed' ? 'seeded' : 'reset')))
    .catch(error => { console.error('Marketplace fixture operation failed', error.code ?? error.name); process.exitCode = 1; })
    .finally(() => db.$disconnect());
}
