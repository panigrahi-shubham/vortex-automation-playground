import type { RequestHandler } from 'express';
import { z } from '../../http/validation';
import { WorkflowError } from '../../workflows/errors';

export function marketplaceHandler(fn: RequestHandler): RequestHandler {
  return async (req, res, next) => {
    try { await fn(req, res, next); }
    catch (error) {
      if (error instanceof WorkflowError) { res.status(error.status).json({ error: error.message }); return; }
      if (error instanceof z.ZodError) {
        res.status(422).json({ error: 'Validation failed', fields: z.flattenError(error).fieldErrors });
        return;
      }
      next(error);
    }
  };
}
