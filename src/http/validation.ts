import type { RequestHandler } from 'express';
import { z, type ZodType } from 'zod';

export const fields = z.object({});
export const text = z.string();
export const productId = z.number().int().positive().max(2147483647);
export const positiveNumberString = z.string().regex(/^\d+$/);
export const identifier = z.string().min(1).max(128);
export const productPath = z.object({ id: positiveNumberString });
export const objectPath = z.object({ id: identifier });
export const pagination = z.object({ page: positiveNumberString.optional() });
export const variant = z.union([z.object({ size: text.max(100), color: text.max(100) }), z.literal('')]);

type Parts = { body?: ZodType; query?: ZodType; params?: ZodType };
type Options = { status?: number; message?: string };

export function validateV2(parts: Parts = { query: fields }, options: Options = {}): RequestHandler {
  return (req, res, next) => {
    for (const part of ['params', 'query', 'body'] as const) {
      const schema = parts[part];
      if (!schema) continue;
      const result = schema.safeParse(req[part]);
      if (result.success) continue;
      const messages: Record<string, string> = Object.create(null);
      for (const issue of result.error.issues) {
        const path = issue.path.join('.') || part;
        messages[path] = issue.message;
      }
      const status = options.status ?? (part === 'body' ? 422 : 400);
      res.status(status).json({ error: options.message ?? 'Validation failed', fields: messages });
      return;
    }
    next();
  };
}

export { z };
