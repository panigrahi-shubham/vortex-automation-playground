import { PrismaClient } from '@prisma/client';
import { tokenHash } from './passwords';

export const throttleKey = (scope: string, identity: string) => tokenHash(`${scope}:${identity}`);
export async function consume(db: PrismaClient, scope: string, identity: string, limit: number, seconds: number) {
  const key = throttleKey(scope, identity);
  const [bucket] = await db.$queryRaw<{ count: number; resetsAt: Date }[]>`
    INSERT INTO orvilo."RateLimit" (key, count, "resetsAt") VALUES (${key}, 1, NOW() + ${seconds} * INTERVAL '1 second')
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN orvilo."RateLimit"."resetsAt" <= NOW() THEN 1 ELSE orvilo."RateLimit".count + 1 END,
      "resetsAt" = CASE WHEN orvilo."RateLimit"."resetsAt" <= NOW() THEN NOW() + ${seconds} * INTERVAL '1 second' ELSE orvilo."RateLimit"."resetsAt" END
    RETURNING count, "resetsAt"`;
  return { allowed: bucket.count <= limit, retryAfter: Math.max(1, Math.ceil((bucket.resetsAt.getTime() - Date.now()) / 1000)) };
}
