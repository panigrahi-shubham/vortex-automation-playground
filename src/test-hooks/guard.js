function productionLocked() {
  return process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
}
function guard(req, res, next) {
  if (!productionLocked()) return next();
  if (/^\/(reset|chaos|test)(\/|$)/.test(req.path)) return res.status(404).json({ error: 'Not found' });
  for (const key of ['x-shoplab-latency', 'x-shoplab-fail', 'x-shoplab-bugs']) delete req.headers[key];
  next();
}
module.exports = { guard, productionLocked };
