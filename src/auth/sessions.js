const crypto = require('crypto');
const { db } = require('../../server/store');
const fail = (res,status,error,extra={}) => res.status(status).json({error,...extra});
function tokenOf(req) {
  const h = req.get('authorization') || '';
  if (h.startsWith('Bearer ')) return h.slice(7);
  return req.query.token || '';
}
function issueSession(username, remember) {
  const token = crypto.randomUUID();
  const ttl = remember ? 7 * 24 * 3600 : db.chaos.sessionTtlSec;
  db.sessions[token] = { username, expiresAt: Date.now() + ttl * 1000 };
  return { token, expiresAt: new Date(db.sessions[token].expiresAt).toISOString() };
}
function auth(req, res, next) {
  const t = tokenOf(req);
  const s = db.sessions[t];
  if (!t || !s) return fail(res, 401, 'Unauthorized');
  if (Date.now() > s.expiresAt) { delete db.sessions[t]; return fail(res, 401, 'Session expired', { code: 'SESSION_EXPIRED' }); }
  const user = db.users[s.username];
  if (!user) return fail(res, 401, 'Unauthorized');
  if (user.locked) return fail(res, 423, 'This account is locked');
  req.user = user;
  req.token = t;
  next();
}
const admin = (req, res, next) => (req.user.role === 'admin' ? next() : fail(res, 403, 'Admin access required'));

module.exports = { tokenOf, issueSession, auth, admin };
