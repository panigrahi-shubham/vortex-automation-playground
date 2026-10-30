const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

// Load only connection settings; never print connection strings or raw errors.
const envFile = path.join(__dirname, '..', '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*(DATABASE_URL|DIRECT_URL)\s*=\s*(.*?)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^(["'])(.*)\1$/, '$2');
  }
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('MISSING_CONFIGURATION');
  const url = new URL(process.env.DATABASE_URL);
  if (url.searchParams.get('schema') !== 'orvilo') throw new Error('WRONG_SCHEMA');
  const db = require('../server/database.cjs').createPrismaClient({ log: [] });
  const marker = `connection-check-${randomUUID()}`;
  const rollback = new Error('EXPECTED_ROLLBACK');
  try {
    await db.$connect();
    await Promise.all([
      db.user.count(), db.session.count(), db.product.count(), db.cart.count(),
      db.cartLine.count(), db.order.count(), db.orderLine.count(), db.outboxEvent.count(), db.wishlistEntry.count(), db.review.count(), db.rateLimit.count(), db.recoveryChallenge.count(), db.testMail.count(), db.mfaCredential.count(), db.mfaLogin.count(), db.mfaBackupCode.count(), db.avatar.count()
    ]);
    try {
      await db.$transaction(async tx => {
        await tx.outboxEvent.create({ data: { id: marker, type: 'connection.check', aggregateId: marker, payload: {} } });
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
    if (await db.outboxEvent.findUnique({ where: { id: marker } })) throw new Error('ROLLBACK_FAILED');
    console.log('Database connected. All seventeen application tables are accessible. Transaction rollback verified.');
  } finally {
    await db.$disconnect();
  }
}
main().catch(error => {
  const safeCodes = ['MISSING_CONFIGURATION', 'WRONG_SCHEMA', 'ROLLBACK_FAILED'];
  const prismaCode = error.code || error.errorCode;
  const code = safeCodes.includes(error.message) ? error.message : /^P\d{4}$/.test(prismaCode || '') ? prismaCode : 'CONNECTION_CHECK_FAILED';
  console.error(`Database check failed (${code}). Check local .env credentials, schema=orvilo, and network access.`);
  process.exitCode = 1;
});






