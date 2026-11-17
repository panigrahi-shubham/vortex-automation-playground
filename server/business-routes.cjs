const { Router } = require('express');
const { createHash } = require('node:crypto');
const { BusinessError, seed, apply, searchTrips, publicCourses, cities } = require('./business.cjs');

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}

function businessRoutes({ db, auth }) {
  const router = Router();
  router.use(auth);
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  const load = async (req, res) => {
    if (!db) return req.user.businessWorkspace ||= { state: seed(), version: 0 };
    return db.businessWorkspace.upsert({ where: { userId: res.locals.user.id }, create: { userId: res.locals.user.id, state: seed() }, update: {} });
  };
  router.get('/', async (req, res, next) => {
    try { const record = await load(req, res); res.json({ state: record.state, version: record.version, courses: publicCourses(), cities }); } catch (error) { next(error); }
  });
  router.get('/trips', (req, res, next) => {
    try { res.json(searchTrips(req.query)); } catch (error) { next(error); }
  });
  router.post('/actions', async (req, res, next) => {
    try {
      const { type, payload, version, requestId } = req.body || {};
      if (!Number.isSafeInteger(version) || version < 0 || typeof requestId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(requestId)) throw new BusinessError('A workspace version and request ID are required', 400);
      const fingerprint = createHash('sha256').update(JSON.stringify(canonical({ type, payload }))).digest('hex');
      const replay = record => {
        if (!record.state.requests.includes(requestId)) return false;
        if (record.state.requestFingerprints?.[requestId] && record.state.requestFingerprints[requestId] !== fingerprint) throw new BusinessError('This request ID was used for different details. Review your transaction history.', 409, 'REQUEST_REUSED');
        res.json({ state: record.state, version: record.version, message: 'Your previous action was already saved' });
        return true;
      };
      const current = await load(req, res);
      if (replay(current)) return;
      if (current.version !== version) throw new BusinessError('Your workspace changed in another tab. Refresh the workspace and try again.', 409, 'WORKSPACE_CONFLICT');
      const result = apply(current.state, type, payload);
      result.state.requests = [...current.state.requests.slice(-199), requestId];
      result.state.requestFingerprints = Object.fromEntries(result.state.requests.map(id => [id, id === requestId ? fingerprint : current.state.requestFingerprints?.[id]]).filter(([, hash]) => hash));
      if (db) {
        const updated = await db.businessWorkspace.updateMany({ where: { userId: res.locals.user.id, version }, data: { state: result.state, version: { increment: 1 } } });
        if (!updated.count) {
          if (replay(await load(req, res))) return;
          throw new BusinessError('Your workspace changed. Refresh the workspace before trying again.', 409, 'WORKSPACE_CONFLICT');
        }
      } else {
        if (req.user.businessWorkspace.version !== version) {
          if (replay(req.user.businessWorkspace)) return;
          throw new BusinessError('Your workspace changed. Refresh the workspace before trying again.', 409, 'WORKSPACE_CONFLICT');
        }
        req.user.businessWorkspace = { state: result.state, version: version + 1 };
      }
      res.json({ ...result, version: version + 1 });
    } catch (error) { next(error); }
  });
  router.use((error, _req, res, next) => {
    if (error instanceof BusinessError) return res.status(error.status).json({ error: error.message, ...(error.code ? { code: error.code } : {}) });
    next(error);
  });
  return router;
}
module.exports = { businessRoutes };
