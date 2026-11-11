import { Prisma, PrismaClient } from '@prisma/client';
import { Router } from 'express';
import { requireSession } from '../auth/database-sessions';
import { publicProfile } from '../auth/profile';
import { rateLimit } from '../auth/throttle';
import { transaction } from '../db/transaction';
import { WorkflowError } from '../workflows/errors';
import { z } from '../http/validation';
import { defectIds, operate, snapshot, type Workspace } from './workspace';

const settingsSchema = z.strictObject({ enabled: z.boolean(), defects: z.array(z.enum(defectIds)).max(8) });
const resetSchema = z.strictObject({ generation: z.number().int().nonnegative() });
const selectedPath = /^\/(products(?:\/[^/]+(?:\/reviews)?)?|categories|deal|cart(?:\/[^/]+)?|wishlist(?:\/[^/]+)?|checkout|orders(?:\/[^/]+(?:\/cancel|\/invoice)?)?|me)$/;

export function practiceRoutes(db: PrismaClient) {
  const router = Router();
  const auth = requireSession(db);
  const throttle = rateLimit(db, 'vortex-practice', (_req, res) => res.locals.user.id, 120, 60);
  router.use((req, res, next) => {
    const controls = req.path === '/vortex/practice' || req.path === '/vortex/practice/reset';
    const storefront = selectedPath.test(req.path) && (req.path !== '/me' || ['GET', 'PUT'].includes(req.method));
    if (!controls && !storefront) return next();
    if (!controls && !req.get('authorization')) return next();
    auth(req, res, error => {
      if (error) return next(error);
      throttle(req, res, throttleError => {
        if (throttleError) return next(throttleError);
        run().catch(next);
      });
    });
    async function run() {
      try {
        const result = await transaction(db, async tx => {
          const id: string = res.locals.user.id;
          await tx.$queryRaw`SELECT id FROM orvilo."User" WHERE id = ${id} FOR UPDATE`;
          const user = await tx.user.findUnique({ where: { id } });
          const session = await tx.session.findUnique({ where: { tokenHash: res.locals.tokenHash } });
          if (!user || user.locked || !session || session.expiresAt <= new Date()) throw new WorkflowError(401, 'Session expired');
          const profile = await tx.practiceProfile.findUnique({ where: { userId: id } });
          const describe = (p = profile) => ({
            enabled: p?.enabled ?? false, defects: p?.defects ?? [],
            generation: p?.generation ?? 0, supported: defectIds,
          });
          if (controls) {
            if (req.path.endsWith('/reset')) {
              if (req.method !== 'POST') throw new WorkflowError(405, 'Method not allowed');
              const input = resetSchema.safeParse(req.body);
              if (!input.success) throw new WorkflowError(422, 'Supply the current workspace generation');
              if (!profile || input.data.generation !== profile.generation) throw new WorkflowError(409, 'Workspace changed. Refresh before resetting');
              const workspace = await snapshot(tx, user.name);
              return { data: describe(await tx.practiceProfile.update({
                where: { userId: id }, data: { defects: [], workspace: workspace as unknown as Prisma.InputJsonValue, generation: { increment: 1 } },
              })) };
            }
            if (req.method === 'GET') return { data: describe() };
            if (req.method === 'DELETE') {
              // Keep the generation so stale reset requests cannot affect a re-created workspace.
              if (!profile) return { data: describe() };
              return { data: describe(await tx.practiceProfile.update({
                where: { userId: id }, data: { enabled: false, defects: [], workspace: {}, generation: { increment: 1 } },
              })) };
            }
            if (req.method !== 'PUT') throw new WorkflowError(405, 'Method not allowed');
            const input = settingsSchema.safeParse(req.body);
            if (!input.success) throw new WorkflowError(422, 'Choose a valid practice mode and defect list');
            const workspace = (profile && (profile.workspace as Record<string, unknown>).products
              ? profile.workspace : await snapshot(tx, user.name) as unknown as Prisma.InputJsonValue
            ) as Prisma.InputJsonValue;
            const data = { ...input.data, defects: [...new Set(input.data.defects)], workspace, generation: (profile?.generation ?? 0) + 1 };
            return { data: describe(await tx.practiceProfile.upsert({ where: { userId: id }, create: { userId: id, ...data }, update: data })) };
          }
          if (!profile?.enabled) return null;
          const workspace = profile.workspace as unknown as Workspace;
          if (req.path === '/me' && req.method === 'GET') return { data: { ...publicProfile(user), name: workspace.name, vortexPractice: true } };
          const data = operate(workspace, profile.defects, {
            path: req.path, method: req.method, query: req.query, body: req.body,
            key: req.get('Idempotency-Key') || '', username: user.username,
          });
          if (!['GET', 'HEAD'].includes(req.method)) {
            await tx.practiceProfile.update({ where: { userId: id }, data: { workspace: workspace as unknown as Prisma.InputJsonValue, generation: { increment: 1 } } });
          }
          return { data: req.path === '/me' ? { ...publicProfile(user), name: workspace.name, vortexPractice: true } : data };
        });
        if (!result) return next();
        res.set('Cache-Control', 'no-store').set('X-Vortex-Practice', 'personal');
        if (req.path.endsWith('/invoice')) {
          res.type('text/plain').attachment('vortex-practice-invoice.txt').send((result.data as { invoice: string }).invoice);
          return;
        }
        res.json(result.data);
      } catch (error) {
        if (error instanceof WorkflowError) { res.status(error.status).json({ error: error.message }); return; }
        next(error);
      }
    }
  });
  return router;
}
