import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Client generation needs no database connection. Migration commands use the
// session/direct URL; the running application independently uses DATABASE_URL.
const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  ...(url ? { datasource: { url } } : {})
});
