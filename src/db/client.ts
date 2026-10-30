import { PrismaClient } from '@prisma/client';
const { createPrismaClient } = require('../../server/database.cjs') as { createPrismaClient: () => PrismaClient };
const globalDb = globalThis as unknown as { orviloPrisma?: PrismaClient };
export const prisma = globalDb.orviloPrisma ?? createPrismaClient();
if (process.env.NODE_ENV !== 'production') globalDb.orviloPrisma = prisma;
