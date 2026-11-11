import { PrismaClient } from '@prisma/client';
import type { Request, RequestHandler, Response } from 'express';
import { isIP } from 'node:net';
import { tokenHash } from './passwords';

export const throttleKey = (scope: string, identity: string) => tokenHash(`${scope}:${identity}`);

export function clientIp(req: Request): string {
  if (process.env.VERCEL === '1') {
    const forwarded = req.get('x-vercel-forwarded-for');
    if (forwarded && isIP(forwarded)) return forwarded;
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}
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

export function rateLimit(
  db: PrismaClient,
  scope: string,
  identify: (req: Request, res: Response) => string,
  limit: number,
  seconds: number
): RequestHandler {
  return async (req, res, next) => {
    try {
      if (req.method === 'GET' || req.method === 'HEAD') return next();
      const result = await consume(db, scope, identify(req, res), limit, seconds);
      if (!result.allowed) {
        res.set('Retry-After', String(result.retryAfter)).status(429).json({ error: 'Too many requests. Try again later.' });
        return;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
