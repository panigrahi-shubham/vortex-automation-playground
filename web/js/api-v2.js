// Maps the SPA's legacy API calls onto the staged /api/v2 contract and normalizes the
// responses back to the shapes the views already expect. Only used when /api/config
// reports the postgres store; the memory store keeps the original /api routes untouched.
const BASE = '/api/v2';

export class V2HttpError extends Error {
  constructor(status, data) {
    super((data && data.error) || `Request failed (${status})`);
    this.name = 'V2HttpError';
    this.status = status;
    this.data = data || {};
  }
}

const unavailable = message => { throw new V2HttpError(501, { error: message }); };
const num = value => Number(value ?? 0);

async function call(path, { method = 'GET', body, token, headers = {} } = {}) {
  const opts = { method, headers: { ...headers } };
  if (body instanceof Blob) {
    opts.body = body;
    opts.headers['Content-Type'] = body.type || 'application/octet-stream';
  } else if (body !== undefined) {
    opts.body = JSON.stringify(body);
    opts.headers['Content-Type'] = 'application/json';
  }
  if (token) opts.headers.Authorization = `Bearer ${token}`;
  let res;
  try { res = await fetch(BASE + path, opts); }
  catch { throw new V2HttpError(0, { error: 'Network error — please check your connection and try again' }); }
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new V2HttpError(res.status, data);
  return data;
}

async function callRaw(path, token) {
  let res;
  try { res = await fetch(BASE + path, { headers: token ? { Authorization: `Bearer ${token}` } : {} }); }
  catch { throw new V2HttpError(0, { error: 'Network error — please check your connection and try again' }); }
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new V2HttpError(res.status, data);
  }
  return res;
}

const normalizeUser = user => ({
  username: user.username,
  email: user.email,
  name: user.name,
  phone: user.phone || '',
  role: user.role,
  avatar: user.avatar || null,
  createdAt: user.createdAt
});

const normalizeProduct = product => ({
  ...product,
  price: num(product.price),
  rating: num(product.rating),
  reviewCount: num(product.reviewCount),
  onSale: false,
  variants: product.variants ?? null
});

const COUPON_LABELS = {
  SAVE10: '10% off',
  FLAT50: '$50 off orders over $200',
  FREESHIP: 'Free shipping',
  EXPIRED20: '20% off (expired)'
};

const decodeVariant = value => {
  if (!value) return null;
  try { return JSON.parse(value); } catch { return { size: value, color: '' }; }
};
const normalizeCart = cart => ({
  ...cart,
  items: cart.items.map(item => ({
    ...item,
    price: num(item.price),
    lineTotal: num(item.lineTotal),
    variant: decodeVariant(item.variant)
  })),
  couponLabel: cart.coupon ? COUPON_LABELS[cart.coupon] || cart.coupon : null
});

const normalizeOrder = order => {
  const pricing = order.pricing || {};
  const address = order.address || {};
  const items = (order.lines || []).map(line => ({
    lineId: line.id,
    productId: line.productId,
    name: line.name,
    qty: line.quantity,
    price: num(line.unitPrice),
    lineTotal: Math.round(num(line.unitPrice) * line.quantity * 100) / 100,
    variant: decodeVariant(line.variant)
  }));
  const history = [{ status: 'Placed', at: order.createdAt }];
  if (order.status !== 'Placed') history.push({ status: order.status, at: order.updatedAt });
  return {
    id: order.id,
    items,
    subtotal: num(pricing.subtotal),
    discount: num(pricing.discount),
    coupon: pricing.coupon ?? null,
    couponLabel: pricing.coupon ? COUPON_LABELS[pricing.coupon] || pricing.coupon : null,
    shippingMethod: pricing.shippingMethod ?? 'standard',
    shipping: num(pricing.shipping),
    tax: num(pricing.tax),
    total: num(order.total),
    address: {
      fullName: address.name || '',
      line1: address.line1 || '',
      line2: address.line2 || '',
      city: address.city || '',
      state: address.state || '',
      zip: address.postalCode || '',
      country: address.country || '',
      phone: address.phone || ''
    },
    payment: { brand: 'Card', last4: order.paymentLast4 || 'TEST' },
    status: order.status,
    history,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt
  };
};

const DECLINED_CARDS = {
  '4000000000000002': 'Your card was declined',
  '4000000000009995': 'Insufficient funds',
  '4000000000000069': 'Your card has expired'
};
const THREE_DS_CARD = '4000002760003184';
let pendingCheckout;

function checkoutAddress(address = {}) {
  const mapped = {
    name: address.fullName,
    line1: address.line1,
    city: address.city,
    postalCode: address.zip,
    country: address.country
  };
  for (const field of ['line2', 'state', 'phone']) if (address[field]) mapped[field] = address[field];
  return mapped;
}

export async function request(rawPath, { method = 'GET', body, token, raw = false } = {}) {
  const [path, search = ''] = rawPath.split('?');
  const query = new URLSearchParams(search);
  const verb = method.toUpperCase();

  /* ---- read-only metadata is available without the legacy API ---- */
  if (path === '/meta' && verb === 'GET') return call('/meta');

  /* ---- auth ---- */
  if (path === '/login' && verb === 'POST') {
    const data = await call('/login', { method: 'POST', body });
    return data.mfaRequired ? data : { token: data.token, expiresAt: data.expiresAt, user: normalizeUser(data.user) };
  }
  if (path === '/register' && verb === 'POST') return call('/register', { method: 'POST', body });
  if (path === '/logout' && verb === 'POST') return call('/logout', { method: 'POST', token });
  if (path === '/me' && verb === 'GET') return normalizeUser(await call('/me', { token }));
  if (path === '/login/mfa') { const data = await call(path, { method: 'POST', body }); return { ...data, user: normalizeUser(data.user) }; }
  if (path === '/me/mfa' || path.startsWith('/me/mfa/')) return call(path, { method: verb, body, token });
  if (path === '/me' && verb === 'PUT') return normalizeUser(await call('/me', { method: verb, body, token }));
  if (path === '/me/password' && verb === 'PUT') return call(path, { method: verb, body, token });
  if (path === '/me/settings' && ['GET', 'PUT'].includes(verb)) return call(path, { method: verb, body, token });
  if (path === '/me/avatar' && ['POST', 'DELETE'].includes(verb)) return call(path, { method: verb, body, token });
  if ((path === '/password/forgot' || path === '/password/reset') && verb === 'POST') return call(path, { method: verb, body });

  /* ---- catalog ---- */
  if (path === '/categories' && verb === 'GET') return call('/categories');
  if (path === '/deal' && verb === 'GET') {
    const deal = await call('/deal');
    return { ...deal, product: normalizeProduct(deal.product) };
  }
  if (path === '/products' && verb === 'GET') {
    const params = new URLSearchParams();
    for (const key of ['q', 'category', 'sort', 'page', 'limit', 'minPrice', 'maxPrice', 'inStock', 'minRating']) {
      const value = query.get(key);
      if (value) params.set(key, value);
    }

    const data = await call(`/products${params.toString() ? `?${params}` : ''}`);
    return { ...data, items: data.items.map(normalizeProduct) };
  }
  if (/^\/products\/\d+\/reviews$/.test(path) && verb === 'GET') return call(path + (search ? '?' + search : ''), { token });
  if (/^\/products\/\d+\/reviews$/.test(path) && verb === 'POST') return call(path, { method: verb, body, token });
  if (/^\/products\/\d+$/.test(path) && verb === 'GET') return normalizeProduct(await call(path));

  /* ---- wishlist ---- */
  if (path === '/wishlist' && verb === 'GET') return (await call('/wishlist', { token })).map(normalizeProduct);
  if (path === '/wishlist' && verb === 'POST') return call(path, { method: verb, body, token });
  if (/^\/wishlist\/\d+$/.test(path) && verb === 'DELETE') return call(path, { method: verb, token });
  if (path === '/wishlist') unavailable('The wishlist is not available in database mode yet');

  /* ---- cart ---- */
  if (path === '/cart' && verb === 'GET') return normalizeCart(await call('/cart', { token }));
  if (path === '/cart' && verb === 'POST') {

    return normalizeCart(await call('/cart', { method: 'POST', body: { productId: body?.productId, qty: body?.qty, variant: body?.variant }, token }));
  }
  if (path === '/cart' && verb === 'DELETE') return normalizeCart(await call('/cart', { method: 'DELETE', token }));
  if (path === '/cart/coupon' && verb === 'POST') return normalizeCart(await call('/cart/coupon', { method: 'POST', body, token }));
  if (path === '/cart/coupon' && verb === 'DELETE') return normalizeCart(await call('/cart/coupon', { method: 'DELETE', token }));
  if (path === '/cart/shipping' && verb === 'PUT') return normalizeCart(await call('/cart/shipping', { method: 'PUT', body, token }));
  if (/^\/cart\/[^/]+$/.test(path)) {
    if (verb === 'PATCH') return normalizeCart(await call(path, { method: 'PATCH', body, token }));
    if (verb === 'DELETE') return normalizeCart(await call(path, { method: 'DELETE', token }));
  }

  /* ---- checkout ---- */
  if (path === '/checkout' && verb === 'POST') {
    const card = String(body?.payment?.cardNumber || '').replace(/\s+/g, '');
    if (card === THREE_DS_CARD) throw new V2HttpError(402, { error: '3-D Secure is not available in database mode — use the 4242 test card', code: 'not_supported' });
    if (DECLINED_CARDS[card]) throw new V2HttpError(402, { error: DECLINED_CARDS[card], code: 'card_declined' });
    const payload = { address: checkoutAddress(body?.address), acceptTerms: body?.acceptTerms === true, testPayment: 'approved' };
    const fingerprint = JSON.stringify([token, payload]);
    if (!pendingCheckout || pendingCheckout.fingerprint !== fingerprint) {
      pendingCheckout = { fingerprint, key: `web-${globalThis.crypto.randomUUID()}` };
    }
    let data;
    try { data = await call('/checkout', {
      method: 'POST',
      token,
      headers: { 'Idempotency-Key': pendingCheckout.key },
      body: payload
    }); } catch (error) {
      if (error.status >= 400 && error.status < 500) pendingCheckout = undefined;
      throw error;
    }
    pendingCheckout = undefined;
    return normalizeOrder(data.order);
  }
  if (path === '/checkout/3ds') unavailable('3-D Secure is not available in database mode yet');

  /* ---- orders ---- */
  if (path === '/orders' && verb === 'GET') {
    const orders = (await call('/orders', { token })).map(normalizeOrder);
    const status = query.get('status');
    return status ? orders.filter(order => order.status === status) : orders;
  }
  if (/^\/orders\/[^/]+\/invoice$/.test(path) && verb === 'GET') {
    if (raw) return callRaw(path, token);
    unavailable('Invoices are served as CSV downloads');
  }
  if (/^\/orders\/[^/]+\/cancel$/.test(path) && verb === 'POST') return normalizeOrder(await call(path, { method: 'POST', token }));
  if (/^\/orders\/[^/]+$/.test(path) && verb === 'GET') return normalizeOrder(await call(path, { token }));

  /* ---- not migrated ---- */
  if (path.startsWith('/admin/')) {
    const result = await call(path, { method: verb, body, token });
    if (path === '/admin/orders' && verb === 'GET') return result.map(order => ({ ...normalizeOrder(order), username: order.username }));
    if (path.startsWith('/admin/orders/') && verb === 'PATCH') return { ...normalizeOrder(result), username: result.username };
    return result;
  }
  if (path === '/chaos' || path === '/reset' || path === '/test/mailbox' || path === '/events') {
    unavailable('Test controls are not available in database mode yet');
  }
  unavailable('This endpoint is not available in database mode yet');
}






