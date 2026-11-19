import { validateV2 } from '../../http/validation';
import { Router } from 'express';
const { storeMetadata } = require('../../../server/catalog-metadata.cjs');

export function metadataRoutes() {
  const router = Router();
  router.get('/meta', validateV2(), (_req, res) => { res.set('Cache-Control', 'no-store').json(storeMetadata()); });
  return router;
}
