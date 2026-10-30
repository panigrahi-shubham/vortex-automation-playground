const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const fs = require('node:fs');
const path = require('node:path');

// Shared by the application and local operator scripts. Do not log this config.
function createPrismaClient(options = {}) {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  let url;
  try { url = new URL(process.env.DATABASE_URL); }
  catch { throw new Error('DATABASE_URL is invalid'); }
  const supabase = /(?:^|\.)pooler\.supabase\.com$/.test(url.hostname) || /^db\.[a-z0-9]+\.supabase\.co$/.test(url.hostname);
  let ssl;
  if (supabase) {
    if (url.searchParams.get('sslmode') === 'disable') throw new Error('Supabase requires verified TLS');
    // pg URL SSL options override an explicit ssl object: remove them before
    // supplying the vendor CA. Node retains hostname and certificate validation.
    for (const key of ['sslmode', 'sslrootcert', 'sslcert', 'sslkey', 'uselibpqcompat']) url.searchParams.delete(key);
    ssl = { ca: fs.readFileSync(path.join(__dirname, 'certs/supabase-root-2021.crt'), 'utf8'), rejectUnauthorized: true };
  }
  const schema = url.searchParams.get('schema') || 'orvilo';
  const seconds = Number(url.searchParams.get('connect_timeout') || 10);
  const limit = Number(url.searchParams.get('connection_limit') || 2);
  for (const key of ['schema', 'pgbouncer', 'connect_timeout', 'connection_limit']) url.searchParams.delete(key);
  const adapter = new PrismaPg({
    connectionString: url.toString(),
    ...(ssl ? { ssl } : {}),
    max: Number.isSafeInteger(limit) && limit >= 1 && limit <= 10 ? limit : 2,
    connectionTimeoutMillis: Number.isFinite(seconds) && seconds > 0 && seconds <= 60 ? seconds * 1000 : 10000,
    idleTimeoutMillis: 30000
  }, { schema });
  return new PrismaClient({ ...options, adapter });
}

module.exports = { createPrismaClient };
