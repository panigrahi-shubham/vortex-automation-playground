const express = require('express');
const crypto = require('crypto');
const { db, reset, recomputeRatings, CATEGORIES, COUPONS, SHIPPING, COUNTRIES, DEFAULT_CHAOS } = require('./store');

const api = express.Router();
const { guard, productionLocked } = require('../src/test-hooks/guard');
api.use(guard);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const r2 = n => Math.round(n * 100) / 100;
const fail = (res, status, error, extra = {}) => res.status(status).json({ error, ...extra });
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const strongPassword = p => typeof p === 'string' && p.length >= 8 && /[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p);
const code6 = () => String(crypto.randomInt(100000, 1000000));
const isTestControl = p => p === '/health' || p === '/reset' || p.startsWith('/chaos') || p.startsWith('/test') || p === '/events';

/* ------------------------------------------------------------------ */
/* Chaos: global (chaos panel / POST /api/chaos) + per-request headers */
/* ------------------------------------------------------------------ */
api.use(async (req, res, next) => {
  res.set('X-Request-Id', crypto.randomUUID());
  if (isTestControl(req.path)) return next();
  const headerLatency = Math.min(+req.get('x-shoplab-latency') || 0, 10000);
  const latency = Math.max(db.chaos.latencyMs, headerLatency);
  if (latency) await sleep(latency);
  const forced = +req.get('x-shoplab-fail');
  if (forced >= 400 && forced <= 599) return fail(res, forced, `Forced ${forced} via x-shoplab-fail header`);
  if (Math.random() < db.chaos.errorRate) return fail(res, 500, 'Injected server error');
  next();
});

/* ---------------- auth helpers ---------------- */
const { tokenOf, issueSession, auth, admin } = require('../src/auth/sessions');
// Seeded bugs are on when: global bug mode, problem_user, or the x-shoplab-bugs: 1 header.
const bug = req => !productionLocked() && (db.chaos.bugMode || !!(req.user && req.user.bug) || req.get('x-shoplab-bugs') === '1');
const publicUser = u => ({ username: u.username, email: u.email, name: u.name, phone: u.phone, role: u.role, avatar: u.avatar, createdAt: u.createdAt });

// `ref` ties a mail to the request that caused it (e.g. the mfaToken) so parallel tests can find *their* code
function sendMail(to, subject, body, code, ref) {
  db.mailbox.unshift({ id: db.nextMail++, to: to.toLowerCase(), subject, body, code: code || null, ref: ref || null, createdAt: new Date().toISOString() });
}

/* ---------------- SSE (order status push) ---------------- */
const streams = new Map(); // username -> Set<res>
function emit(username, event) {
  const set = streams.get(username);
  if (!set) return;
  for (const res of set) res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
}
api.get('/events', auth, (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.flushHeaders();
  res.write(`event: hello\ndata: ${JSON.stringify({ type: 'hello', username: req.user.username })}\n\n`);
  const u = req.user.username;
  if (!streams.has(u)) streams.set(u, new Set());
  streams.get(u).add(res);
  const hb = setInterval(() => res.write(': ping\n\n'), 15000);
  req.on('close', () => { clearInterval(hb); streams.get(u)?.delete(res); });
});

/* ================================================================== */
/* Health, meta                                                        */
/* ================================================================== */
api.get('/health', (req, res) => res.json({ ok: true, uptime: Math.round(process.uptime()), version: '2.0.0' }));
api.get('/meta', (req, res) => res.json({
  categories: CATEGORIES,
  shipping: Object.entries(SHIPPING).map(([id, s]) => ({ id, ...s })),
  countries: Object.entries(COUNTRIES).map(([code, c]) => ({ code, name: c.name, states: c.states, zipHint: c.zipHint }))
}));

/* ================================================================== */
/* Auth: register, login (+MFA), logout, forgot/reset password         */
/* ================================================================== */
api.post('/register', (req, res) => {
  const { username = '', email = '', password = '', confirmPassword = '', name = '', acceptTerms } = req.body || {};
  const f = {};
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) f.username = 'Username must be 3-20 letters, numbers or _';
  else if (db.users[username.toLowerCase()]) f.username = 'Username is already taken';
  if (!EMAIL_RE.test(email)) f.email = 'Enter a valid email address';
  else if (Object.values(db.users).some(u => u.email === email.toLowerCase())) f.email = 'An account with this email already exists';
  if (!name.trim() || name.trim().length < 2) f.name = 'Full name is required';
  if (!strongPassword(password)) f.password = 'Min 8 characters with upper, lower case and a number';
  if (password !== confirmPassword) f.confirmPassword = 'Passwords do not match';
  if (acceptTerms !== true) f.acceptTerms = 'You must accept the terms';
  if (Object.keys(f).length) {
    const conflict = /taken|already exists/.test(f.username || '') || /already exists/.test(f.email || '');
    return fail(res, conflict ? 409 : 422, conflict ? 'Account already exists' : 'Validation failed', { fields: f });
  }
  const u = username.toLowerCase();
  db.users[u] = { username: u, password, email: email.toLowerCase(), name: name.trim(), phone: '', role: 'customer', locked: false, failedAttempts: 0, avatar: null, createdAt: new Date().toISOString() };
  sendMail(email, 'Welcome to ShopLab', `Hi ${name.trim()}, your account ${u} is ready. Happy testing!`);
  res.status(201).json(publicUser(db.users[u]));
});

api.post('/login', async (req, res) => {
  const { username, password, remember } = req.body || {};
  if (!username || !password) return fail(res, 422, 'Username and password are required');
  const key = String(username).toLowerCase();
  const user = db.users[key] || Object.values(db.users).find(u => u.email === key);
  if (user && user.locked) return fail(res, 423, 'This account is locked');
  if (!user || user.password !== password) {
    if (user) {
      user.failedAttempts++;
      if (user.failedAttempts >= 5) { user.locked = true; return fail(res, 423, 'Too many failed attempts. This account is locked'); }
    }
    return fail(res, 401, 'Invalid username or password');
  }
  user.failedAttempts = 0;
  if (user.delay) await sleep(user.delay);
  if (user.mfa) {
    const mfaToken = crypto.randomUUID();
    const code = code6();
    db.mfa[mfaToken] = { username: user.username, code, attempts: 0, expiresAt: Date.now() + 5 * 60000, remember: !!remember };
    sendMail(user.email, 'Your ShopLab sign-in code', `Your one-time code is ${code}. It expires in 5 minutes.`, code, mfaToken);
    return res.json({ mfaRequired: true, mfaToken, sentTo: user.email.replace(/^(.).*(@.*)$/, '$1***$2') });
  }
  res.json({ ...issueSession(user.username, !!remember), user: publicUser(user) });
});

api.post('/login/mfa', (req, res) => {
  const { mfaToken, code } = req.body || {};
  const m = db.mfa[mfaToken];
  if (!m || Date.now() > m.expiresAt) return fail(res, 401, 'Code expired. Please sign in again');
  if (String(code) !== m.code) {
    m.attempts++;
    if (m.attempts >= 3) { delete db.mfa[mfaToken]; return fail(res, 401, 'Too many incorrect codes. Please sign in again'); }
    return fail(res, 422, 'Incorrect code', { attemptsLeft: 3 - m.attempts });
  }
  delete db.mfa[mfaToken];
  res.json({ ...issueSession(m.username, m.remember), user: publicUser(db.users[m.username]) });
});

api.post('/logout', auth, (req, res) => { delete db.sessions[req.token]; res.json({ ok: true }); });

api.post('/password/forgot', (req, res) => {
  const { email = '' } = req.body || {};
  if (!EMAIL_RE.test(email)) return fail(res, 422, 'Enter a valid email address', { fields: { email: 'Enter a valid email address' } });
  const user = Object.values(db.users).find(u => u.email === email.toLowerCase());
  if (user) {
    const code = code6();
    db.resetCodes[user.email] = { code, expiresAt: Date.now() + 10 * 60000 };
    sendMail(user.email, 'Reset your ShopLab password', `Use code ${code} to reset your password. It expires in 10 minutes.`, code);
  }
  res.json({ message: 'If an account exists for that email, a reset code has been sent.' });
});

api.post('/password/reset', (req, res) => {
  const { email = '', code = '', password = '' } = req.body || {};
  const rc = db.resetCodes[email.toLowerCase()];
  if (!rc || rc.code !== String(code) || Date.now() > rc.expiresAt) return fail(res, 400, 'Invalid or expired reset code', { fields: { code: 'Invalid or expired reset code' } });
  if (!strongPassword(password)) return fail(res, 422, 'Validation failed', { fields: { password: 'Min 8 characters with upper, lower case and a number' } });
  const user = Object.values(db.users).find(u => u.email === email.toLowerCase());
  user.password = password;
  user.locked = false;
  user.failedAttempts = 0;
  delete db.resetCodes[user.email];
  res.json({ message: 'Password updated. You can now sign in.' });
});

/* ================================================================== */
/* Profile                                                             */
/* ================================================================== */
api.get('/me', auth, (req, res) => res.json(publicUser(req.user)));
api.put('/me', auth, (req, res) => {
  const { name = '', email = '', phone = '' } = req.body || {};
  const f = {};
  if (name.trim().length < 2 || name.trim().length > 50) f.name = 'Name must be 2-50 characters';
  if (!EMAIL_RE.test(email)) f.email = 'Enter a valid email address';
  else if (Object.values(db.users).some(u => u.email === email.toLowerCase() && u.username !== req.user.username)) f.email = 'Email is already in use';
  if (phone && !/^\d{10}$/.test(phone)) f.phone = 'Phone must be 10 digits';
  if (Object.keys(f).length) return fail(res, 422, 'Validation failed', { fields: f });
  req.user.name = bug(req) ? name.trim().slice(0, -1) : name.trim(); // BUG-08
  req.user.email = email.toLowerCase();
  req.user.phone = phone;
  res.json(publicUser(req.user));
});
api.put('/me/password', auth, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (currentPassword !== req.user.password) return fail(res, 400, 'Current password is incorrect', { fields: { currentPassword: 'Current password is incorrect' } });
  if (!strongPassword(newPassword)) return fail(res, 422, 'Validation failed', { fields: { newPassword: 'Min 8 characters with upper, lower case and a number' } });
  if (newPassword === currentPassword) return fail(res, 422, 'Validation failed', { fields: { newPassword: 'New password must be different' } });
  req.user.password = newPassword;
  // sign out every other session
  for (const [t, s] of Object.entries(db.sessions)) if (s.username === req.user.username && t !== req.token) delete db.sessions[t];
  res.json({ message: 'Password changed' });
});
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
api.post('/me/avatar', auth, express.raw({ type: () => true, limit: '1mb' }), (req, res) => {
  const type = (req.get('content-type') || '').split(';')[0];
  if (!IMAGE_TYPES.includes(type)) return fail(res, 415, 'Only PNG, JPEG, GIF or WEBP images are allowed');
  if (!req.body || !req.body.length) return fail(res, 400, 'Empty file');
  req.user.avatar = `data:${type};base64,${req.body.toString('base64')}`;
  res.status(201).json({ avatar: req.user.avatar, bytes: req.body.length });
});
api.delete('/me/avatar', auth, (req, res) => { req.user.avatar = null; res.json({ ok: true }); });

/* ================================================================== */
/* Catalog                                                             */
/* ================================================================== */
const SORTS = ['', 'price_asc', 'price_desc', 'name_asc', 'name_desc', 'rating', 'newest'];
api.get('/categories', (req, res) => res.json(CATEGORIES.map(c => ({ name: c, count: db.products.filter(p => p.category === c).length }))));

api.get('/products', optionalUser, (req, res) => {
  const { q = '', category = '', sort = '', minPrice, maxPrice, inStock, minRating } = req.query;
  const num = (v, d) => (v === undefined || v === '' ? d : Number(v));
  const page = num(req.query.page, 1), limit = num(req.query.limit, 12);
  if (!SORTS.includes(sort)) return fail(res, 400, `Invalid sort. Use one of: ${SORTS.filter(Boolean).join(', ')}`);
  if (!Number.isInteger(page) || page < 1) return fail(res, 400, 'page must be a positive integer');
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) return fail(res, 400, 'limit must be between 1 and 50');
  const cats = String(category).split(',').filter(Boolean);
  const term = String(q).trim();
  let list = db.products.filter(p => {
    const hit = bug(req) ? p.name.includes(term) : p.name.toLowerCase().includes(term.toLowerCase()); // BUG-04
    return hit
      && (!cats.length || cats.includes(p.category))
      && (minPrice === undefined || minPrice === '' || p.price >= +minPrice)
      && (maxPrice === undefined || maxPrice === '' || p.price <= +maxPrice)
      && (inStock !== 'true' || p.stock > 0)
      && (!minRating || p.rating >= +minRating);
  });
  const by = {
    price_asc: (a, b) => a.price - b.price, price_desc: (a, b) => b.price - a.price,
    name_asc: (a, b) => a.name.localeCompare(b.name), name_desc: (a, b) => b.name.localeCompare(a.name),
    rating: (a, b) => b.rating - a.rating || a.id - b.id, newest: (a, b) => b.id - a.id
  }[sort];
  if (by) list = [...list].sort(by);
  if (sort === 'price_asc' && bug(req)) list.reverse(); // BUG-01
  const pages = Math.max(1, Math.ceil(list.length / limit));
  let start = (page - 1) * limit;
  if (bug(req) && page > 1) start -= 1; // BUG-07: page 2+ repeats the last item of the previous page
  res.set('X-Total-Count', String(list.length));
  res.json({ total: list.length, page, pages, limit, items: list.slice(start, start + limit) });
});

function optionalUser(req, res, next) {
  const s = db.sessions[tokenOf(req)];
  if (s && Date.now() <= s.expiresAt) req.user = db.users[s.username];
  next();
}
function findProduct(req, res) {
  if (!/^\d+$/.test(req.params.id)) { fail(res, 400, 'Product id must be numeric'); return null; }
  const p = db.products.find(x => x.id === +req.params.id);
  if (!p) { fail(res, 404, 'Product not found'); return null; }
  return p;
}
// Random "deal of the day" - non-deterministic on purpose: mock it with page.route() in tests
api.get('/deal', (req, res) => {
  const inStock = db.products.filter(p => p.stock > 0);
  const p = inStock[Math.floor(Math.random() * inStock.length)];
  res.json({ product: p, percentOff: 5 + Math.floor(Math.random() * 6) * 5, endsAt: new Date(Date.now() + 3600e3).toISOString() });
});
api.get('/products/:id', (req, res) => { const p = findProduct(req, res); if (p) res.json(p); });
api.get('/products/:id/reviews', (req, res) => {
  const p = findProduct(req, res); if (!p) return;
  res.json(db.reviews.filter(r => r.productId === p.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
});
api.post('/products/:id/reviews', auth, (req, res) => {
  const p = findProduct(req, res); if (!p) return;
  const { rating, title = '', body = '' } = req.body || {};
  const f = {};
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) f.rating = 'Choose a rating from 1 to 5';
  if (title.trim().length < 3 || title.trim().length > 60) f.title = 'Title must be 3-60 characters';
  if (body.trim().length < 10 || body.trim().length > 500) f.body = 'Review must be 10-500 characters';
  if (Object.keys(f).length) return fail(res, 422, 'Validation failed', { fields: f });
  if (db.reviews.some(r => r.productId === p.id && r.username === req.user.username)) return fail(res, 409, 'You have already reviewed this product');
  const review = { id: db.nextReview++, productId: p.id, username: req.user.username, rating, title: title.trim(), body: body.trim(), createdAt: new Date().toISOString() };
  db.reviews.push(review);
  recomputeRatings();
  res.status(201).json(review);
});

/* ================================================================== */
/* Wishlist                                                            */
/* ================================================================== */
const wl = u => (db.wishlists[u] = db.wishlists[u] || []);
api.get('/wishlist', auth, (req, res) => res.json(wl(req.user.username).map(id => db.products.find(p => p.id === id)).filter(Boolean)));
api.post('/wishlist', auth, (req, res) => {
  const id = +(req.body || {}).productId;
  if (!db.products.some(p => p.id === id)) return fail(res, 404, 'Product not found');
  const list = wl(req.user.username);
  if (list.includes(id)) return fail(res, 409, 'Already in wishlist');
  list.push(id);
  res.status(201).json({ productIds: list });
});
api.delete('/wishlist/:productId', auth, (req, res) => {
  const list = wl(req.user.username);
  const i = list.indexOf(+req.params.productId);
  if (i === -1) return fail(res, 404, 'Not in wishlist');
  list.splice(i, 1);
  res.json({ productIds: list });
});

/* ================================================================== */
/* Cart                                                                */
/* ================================================================== */
const cartOf = u => (db.carts[u] = db.carts[u] || { items: [], coupon: null, shipping: 'standard' });
const lineId = (productId, variant) => [productId, variant && variant.size, variant && variant.color].filter(Boolean).join('-');

function cartView(req) {
  const cart = cartOf(req.user.username);
  const items = cart.items.map(i => {
    const p = db.products.find(x => x.id === i.productId) || {};
    return { lineId: i.lineId, productId: i.productId, name: p.name, category: p.category, price: p.price, qty: i.qty, variant: i.variant || null, stock: p.stock, lineTotal: r2(p.price * i.qty) };
  });
  const subtotal = r2(items.reduce((s, i) => s + i.lineTotal, 0));
  let discount = 0, couponError = null, freeShip = false;
  const c = cart.coupon && COUPONS[cart.coupon];
  if (c) {
    if (c.type === 'percent') discount = r2(subtotal * (bug(req) && cart.coupon === 'SAVE10' ? 1 : c.value) / 100); // BUG-05
    if (c.type === 'flat') { if (subtotal >= c.min) discount = Math.min(c.value, subtotal); else couponError = `Add $${r2(c.min - subtotal).toFixed(2)} more to use ${cart.coupon}`; }
    if (c.type === 'shipping') freeShip = true;
  }
  const method = SHIPPING[cart.shipping];
  const afterDiscount = r2(subtotal - discount);
  const shipping = !items.length || freeShip || (method.freeOver && afterDiscount >= method.freeOver) ? 0 : method.price;
  const tax = r2(afterDiscount * 0.08);
  return {
    items, count: items.reduce((s, i) => s + i.qty, 0),
    subtotal, discount, coupon: cart.coupon, couponLabel: c ? c.label : null, couponError,
    shippingMethod: cart.shipping, shipping, tax, total: r2(afterDiscount + shipping + tax)
  };
}

api.get('/cart', auth, (req, res) => res.json(cartView(req)));
api.post('/cart', auth, (req, res) => {
  let { productId, qty = 1, variant = null } = req.body || {};
  productId = +productId;
  if (bug(req) && productId % 5 === 0) productId = productId + 1 > db.products.length ? productId : productId + 1; // BUG-02
  const p = db.products.find(x => x.id === productId);
  if (!p) return fail(res, 404, 'Product not found');
  if (!Number.isInteger(qty) || qty < 1 || qty > 10) return fail(res, 422, 'Quantity must be between 1 and 10');
  if (p.variants) {
    if (!variant || !p.variants.size.includes(variant.size)) return fail(res, 422, 'Please select a size', { fields: { size: 'Please select a size' } });
    if (!p.variants.color.includes(variant.color)) return fail(res, 422, 'Please select a colour', { fields: { color: 'Please select a colour' } });
    variant = { size: variant.size, color: variant.color };
  } else variant = null;
  if (p.stock < 1) return fail(res, 409, 'Out of stock');
  const cart = cartOf(req.user.username);
  const id = lineId(p.id, variant);
  const line = cart.items.find(i => i.lineId === id);
  const newQty = (line ? line.qty : 0) + qty;
  if (newQty > p.stock) return fail(res, 409, `Only ${p.stock} left in stock`);
  if (newQty > 10) return fail(res, 422, 'Maximum 10 per item');
  if (line) line.qty = newQty; else cart.items.push({ lineId: id, productId: p.id, qty, variant });
  res.status(201).json(cartView(req));
});
// NOTE: must be registered before DELETE /cart/:lineId or 'coupon' is treated as a line id
api.delete('/cart/coupon', auth, (req, res) => { cartOf(req.user.username).coupon = null; res.json(cartView(req)); });
api.patch('/cart/:lineId', auth, (req, res) => {
  const cart = cartOf(req.user.username);
  const line = cart.items.find(i => i.lineId === req.params.lineId);
  if (!line) return fail(res, 404, 'Item not in cart');
  const qty = (req.body || {}).qty;
  const p = db.products.find(x => x.id === line.productId);
  if (!bug(req)) { // BUG-06: no quantity validation in bug mode
    if (!Number.isInteger(qty) || qty < 1 || qty > 10) return fail(res, 422, 'Quantity must be between 1 and 10');
    if (qty > p.stock) return fail(res, 409, `Only ${p.stock} left in stock`);
  }
  line.qty = qty;
  res.json(cartView(req));
});
api.delete('/cart/:lineId', auth, (req, res) => {
  const cart = cartOf(req.user.username);
  const before = cart.items.length;
  cart.items = cart.items.filter(i => i.lineId !== req.params.lineId);
  if (cart.items.length === before) return fail(res, 404, 'Item not in cart');
  res.json(cartView(req));
});
api.delete('/cart', auth, (req, res) => { db.carts[req.user.username] = { items: [], coupon: null, shipping: 'standard' }; res.json(cartView(req)); });
api.post('/cart/coupon', auth, (req, res) => {
  const code = String((req.body || {}).code || '').trim().toUpperCase();
  if (!code) return fail(res, 422, 'Enter a coupon code');
  const c = COUPONS[code];
  if (!c) return fail(res, 404, 'Invalid coupon code');
  if (c.expired) return fail(res, 422, 'This coupon has expired');
  const view = cartView(req);
  if (c.min && view.subtotal < c.min) return fail(res, 422, `Minimum order of $${c.min} required for ${code}`);
  cartOf(req.user.username).coupon = code;
  res.json(cartView(req));
});
api.put('/cart/shipping', auth, (req, res) => {
  const m = (req.body || {}).method;
  if (!SHIPPING[m]) return fail(res, 422, `Shipping method must be one of: ${Object.keys(SHIPPING).join(', ')}`);
  cartOf(req.user.username).shipping = m;
  res.json(cartView(req));
});

/* ================================================================== */
/* Checkout + payments (test cards, 3-D Secure)                        */
/* ================================================================== */
function luhn(num) {
  let sum = 0, dbl = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let d = +num[i];
    if (dbl) { d *= 2; if (d > 9) d -= 9; }
    sum += d; dbl = !dbl;
  }
  return sum % 10 === 0;
}
function validateCheckout(body) {
  const { address = {}, payment = {} } = body || {};
  const f = {};
  const country = COUNTRIES[address.country];
  if (!address.fullName || address.fullName.trim().length < 2) f.fullName = 'Full name is required';
  if (!address.line1 || !address.line1.trim()) f.line1 = 'Address is required';
  if (!address.city || !address.city.trim()) f.city = 'City is required';
  if (!country) f.country = 'Select a country';
  else if (!country.states.includes(address.state)) f.state = 'Select a state';
  if (country && !country.zip.test(address.zip || '')) f.zip = `Postal code must be ${country.zipHint}`;
  if (!/^\d{10}$/.test(address.phone || '')) f.phone = 'Phone must be 10 digits';
  const card = String(payment.cardNumber || '').replace(/\s+/g, '');
  if (!/^\d{13,19}$/.test(card) || !luhn(card)) f.cardNumber = 'Enter a valid card number';
  const m = /^(\d{2})\s*\/\s*(\d{2})$/.exec(payment.expiry || '');
  if (!m || +m[1] < 1 || +m[1] > 12) f.expiry = 'Use MM/YY';
  else {
    const exp = new Date(2000 + +m[2], +m[1], 1); // first day of month after expiry
    if (exp <= new Date()) f.expiry = 'Card has expired';
  }
  if (!/^\d{3,4}$/.test(payment.cvv || '')) f.cvv = 'CVV must be 3 or 4 digits';
  if (!payment.cardName || !payment.cardName.trim()) f.cardName = 'Name on card is required';
  return { fields: f, card };
}
function placeOrder(req, address, card) {
  const view = cartView(req);
  for (const i of view.items) {
    const p = db.products.find(x => x.id === i.productId);
    if (p.stock < i.qty) return { error: [409, `Only ${p.stock} left of ${p.name}`] };
  }
  for (const i of view.items) db.products.find(x => x.id === i.productId).stock -= i.qty;
  const total = bug(req) ? r2(view.subtotal - view.discount + view.shipping + view.tax * 2) : view.total; // BUG-03
  const now = new Date().toISOString();
  const order = {
    id: `ORD-${db.nextOrder++}`, username: req.user.username,
    items: view.items, subtotal: view.subtotal, discount: view.discount, coupon: view.coupon,
    shippingMethod: view.shippingMethod, shipping: view.shipping, tax: view.tax, total,
    address: { ...address }, payment: { brand: card.startsWith('4') ? 'Visa' : card.startsWith('5') ? 'Mastercard' : 'Card', last4: card.slice(-4) },
    status: 'Placed', history: [{ status: 'Placed', at: now }], createdAt: now, updatedAt: now
  };
  db.orders.unshift(order);
  db.carts[req.user.username] = { items: [], coupon: null, shipping: 'standard' };
  sendMail(req.user.email, `Order ${order.id} confirmed`, `Thanks for your order! Total charged: $${total.toFixed(2)}.`);
  return { order };
}
const CARD_OUTCOMES = {
  '4000000000000002': [402, 'Your card was declined', 'card_declined'],
  '4000000000009995': [402, 'Insufficient funds', 'insufficient_funds'],
  '4000000000000069': [402, 'Your card has expired', 'expired_card']
};
const THREE_DS_CARD = '4000002760003184';

api.post('/checkout', auth, (req, res) => {
  const view = cartView(req);
  if (!view.items.length) return fail(res, 400, 'Your cart is empty');
  const { fields, card } = validateCheckout(req.body);
  if (Object.keys(fields).length) return fail(res, 422, 'Validation failed', { fields });
  const outcome = CARD_OUTCOMES[card];
  if (outcome) return fail(res, outcome[0], outcome[1], { code: outcome[2] });
  if (card === THREE_DS_CARD) {
    const challengeId = crypto.randomUUID();
    db.challenges[challengeId] = { username: req.user.username, address: req.body.address, card, attempts: 0 };
    return res.status(202).json({ status: 'requires_action', challengeId, hint: 'Use code 123456 in the bank verification frame' });
  }
  const r = placeOrder(req, req.body.address, card);
  if (r.error) return fail(res, ...r.error);
  res.status(201).json(r.order);
});
api.post('/checkout/3ds', auth, (req, res) => {
  const { challengeId, code } = req.body || {};
  const ch = db.challenges[challengeId];
  if (!ch || ch.username !== req.user.username) return fail(res, 404, 'Challenge not found');
  if (code === 'cancel') { delete db.challenges[challengeId]; return fail(res, 402, 'Payment authentication was cancelled', { code: 'authentication_cancelled' }); }
  if (String(code) !== '123456') {
    ch.attempts++;
    if (ch.attempts >= 3) { delete db.challenges[challengeId]; return fail(res, 402, 'Payment authentication failed', { code: 'authentication_failed' }); }
    return fail(res, 422, 'Incorrect verification code', { attemptsLeft: 3 - ch.attempts });
  }
  delete db.challenges[challengeId];
  const r = placeOrder(req, ch.address, ch.card);
  if (r.error) return fail(res, ...r.error);
  res.status(201).json(r.order);
});

/* ================================================================== */
/* Orders                                                              */
/* ================================================================== */
const FLOW = ['Placed', 'Processing', 'Shipped', 'Delivered'];
function setStatus(order, status) {
  order.status = status;
  order.updatedAt = new Date().toISOString();
  order.history.push({ status, at: order.updatedAt });
  emit(order.username, { type: 'order-status', orderId: order.id, status });
}
// Background job: move orders along Placed -> Processing -> Shipped -> Delivered
setInterval(() => {
  const sec = db.chaos.orderProgressSec;
  if (!sec) return;
  const now = Date.now();
  for (const o of db.orders) {
    const i = FLOW.indexOf(o.status);
    if (i > -1 && i < FLOW.length - 1 && now - Date.parse(o.updatedAt) >= sec * 1000) setStatus(o, FLOW[i + 1]);
  }
}, 500).unref();

const myOrder = (req, res) => {
  const o = db.orders.find(x => x.id === req.params.id && x.username === req.user.username);
  if (!o) fail(res, 404, 'Order not found');
  return o;
};
api.get('/orders', auth, (req, res) => {
  const { status = '' } = req.query;
  res.json(db.orders.filter(o => o.username === req.user.username && (!status || o.status === status)));
});
api.get('/orders/:id', auth, (req, res) => { const o = myOrder(req, res); if (o) res.json(o); });
api.post('/orders/:id/cancel', auth, (req, res) => {
  const o = myOrder(req, res); if (!o) return;
  if (!['Placed', 'Processing'].includes(o.status)) return fail(res, 409, `Order cannot be cancelled once ${o.status.toLowerCase()}`);
  for (const i of o.items) { const p = db.products.find(x => x.id === i.productId); if (p) p.stock += i.qty; }
  setStatus(o, 'Cancelled');
  res.json(o);
});
api.get('/orders/:id/invoice', auth, (req, res) => {
  const o = myOrder(req, res); if (!o) return;
  const lines = [
    'SHOPLAB INVOICE', '='.repeat(40), `Order:    ${o.id}`, `Date:     ${o.createdAt}`, `Customer: ${o.address.fullName}`, `Status:   ${o.status}`, '',
    'Item,Qty,Price,Line total',
    ...o.items.map(i => `"${i.name}${i.variant ? ` (${i.variant.size}/${i.variant.color})` : ''}",${i.qty},${i.price.toFixed(2)},${i.lineTotal.toFixed(2)}`),
    '', `Subtotal,,,${o.subtotal.toFixed(2)}`, `Discount,,,-${o.discount.toFixed(2)}`, `Shipping,,,${o.shipping.toFixed(2)}`, `Tax,,,${o.tax.toFixed(2)}`, `TOTAL,,,${o.total.toFixed(2)}`
  ];
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="invoice-${o.id}.csv"`);
  res.send(lines.join('\n'));
});

/* ================================================================== */
/* Admin                                                               */
/* ================================================================== */
api.get('/admin/stats', auth, admin, (req, res) => {
  const live = db.orders.filter(o => o.status !== 'Cancelled');
  res.json({
    products: db.products.length, outOfStock: db.products.filter(p => p.stock === 0).length,
    users: Object.keys(db.users).length, orders: db.orders.length,
    revenue: r2(live.reduce((s, o) => s + o.total, 0))
  });
});
function validateProduct(b) {
  const f = {};
  if (!b.name || b.name.trim().length < 3) f.name = 'Name must be at least 3 characters';
  if (!CATEGORIES.includes(b.category)) f.category = 'Select a category';
  if (!(typeof b.price === 'number' && b.price > 0)) f.price = 'Price must be greater than 0';
  if (!Number.isInteger(b.stock) || b.stock < 0) f.stock = 'Stock must be a whole number ≥ 0';
  return f;
}
api.get('/admin/products', auth, admin, (req, res) => res.json(db.products));
api.post('/admin/products', auth, admin, (req, res) => {
  const b = req.body || {};
  const f = validateProduct(b);
  if (Object.keys(f).length) return fail(res, 422, 'Validation failed', { fields: f });
  const id = db.nextProduct++;
  const p = { id, sku: `SL-${b.category.slice(0, 3).toUpperCase()}-${String(id).padStart(3, '0')}`, name: b.name.trim(), category: b.category, price: r2(b.price), stock: b.stock, rating: 0, reviewCount: 0, description: b.description || `${b.name.trim()} - added by an admin.`, createdAt: new Date().toISOString(), onSale: false, variants: null };
  db.products.push(p);
  res.status(201).json(p);
});
api.put('/admin/products/:id', auth, admin, (req, res) => {
  const p = findProduct(req, res); if (!p) return;
  const b = { ...p, ...(req.body || {}) };
  const f = validateProduct(b);
  if (Object.keys(f).length) return fail(res, 422, 'Validation failed', { fields: f });
  Object.assign(p, { name: b.name.trim(), category: b.category, price: r2(b.price), stock: b.stock, description: b.description });
  res.json(p);
});
api.delete('/admin/products/:id', auth, admin, (req, res) => {
  const p = findProduct(req, res); if (!p) return;
  require('../src/workflows/delete-product').deleteProduct(db, p.id);
  res.status(204).end();
});
api.get('/admin/orders', auth, admin, (req, res) => res.json(db.orders));
api.patch('/admin/orders/:id', auth, admin, (req, res) => {
  const o = db.orders.find(x => x.id === req.params.id);
  if (!o) return fail(res, 404, 'Order not found');
  const { status } = req.body || {};
  if (![...FLOW, 'Cancelled'].includes(status)) return fail(res, 422, `Status must be one of: ${[...FLOW, 'Cancelled'].join(', ')}`);
  if (status !== o.status) setStatus(o, status);
  res.json(o);
});
api.get('/admin/users', auth, admin, (req, res) => res.json(Object.values(db.users).map(u => ({ ...publicUser(u), locked: u.locked, avatar: undefined }))));
api.patch('/admin/users/:username', auth, admin, (req, res) => {
  const u = db.users[req.params.username];
  if (!u) return fail(res, 404, 'User not found');
  const { locked, role } = req.body || {};
  if (u.username === req.user.username) return fail(res, 422, 'You cannot change your own account here');
  if (locked !== undefined) { u.locked = !!locked; if (!u.locked) u.failedAttempts = 0; }
  if (role !== undefined) { if (!['customer', 'admin'].includes(role)) return fail(res, 422, 'Role must be customer or admin'); u.role = role; }
  res.json({ ...publicUser(u), locked: u.locked, avatar: undefined });
});

/* ================================================================== */
/* Test-control endpoints (no auth, on purpose, for setup/teardown)    */
/* ================================================================== */
api.get('/chaos', (req, res) => res.json(db.chaos));
api.post('/chaos', (req, res) => {
  const b = req.body || {};
  const clamp = (v, lo, hi) => Math.min(Math.max(+v || 0, lo), hi);
  if (b.latencyMs !== undefined) db.chaos.latencyMs = clamp(b.latencyMs, 0, 10000);
  if (b.errorRate !== undefined) db.chaos.errorRate = clamp(b.errorRate, 0, 1);
  if (b.bugMode !== undefined) db.chaos.bugMode = !!b.bugMode;
  if (b.sessionTtlSec !== undefined) db.chaos.sessionTtlSec = clamp(b.sessionTtlSec, 1, 7 * 24 * 3600);
  if (b.orderProgressSec !== undefined) db.chaos.orderProgressSec = clamp(b.orderProgressSec, 0, 3600);
  res.json(db.chaos);
});
api.post('/reset', (req, res) => { reset(); res.json({ ok: true, chaos: DEFAULT_CHAOS }); });
api.get('/test/mailbox', (req, res) => {
  const to = String(req.query.to || '').toLowerCase();
  res.json(to ? db.mailbox.filter(m => m.to === to) : db.mailbox.slice(0, 50));
});
api.delete('/test/mailbox', (req, res) => { db.mailbox = []; res.json({ ok: true }); });

api.use((req, res) => fail(res, 404, `No route for ${req.method} /api${req.path}`));
// JSON error handler (bad JSON body, payload too large, etc.)
// eslint-disable-next-line no-unused-vars
api.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') return fail(res, 413, 'File too large (max 1 MB)');
  if (err.type === 'entity.parse.failed') return fail(res, 400, 'Malformed JSON body');
  console.error(err);
  fail(res, 500, 'Internal server error');
});

module.exports = api;


