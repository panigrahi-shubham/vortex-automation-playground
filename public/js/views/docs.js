import { esc, setTitle } from '../core.js';

const A = '🔒'; // needs Bearer token
const GROUPS = [
  ['Auth', [
    ['POST', '/api/register', '', '{ username, email, name, password, confirmPassword, acceptTerms } → 201 · 409 duplicate · 422 fields'],
    ['POST', '/api/login', '', '{ username|email, password, remember? } → 200 { token, expiresAt, user } · 200 { mfaRequired, mfaToken } · 401 · 422 · 423 locked (5 failed attempts locks the account)'],
    ['POST', '/api/login/mfa', '', '{ mfaToken, code } → 200 session · 422 wrong code (3 tries) · 401 expired'],
    ['POST', '/api/logout', A, 'Invalidates the token'],
    ['POST', '/api/password/forgot', '', '{ email } → always 200 (no user enumeration); code goes to the test inbox'],
    ['POST', '/api/password/reset', '', '{ email, code, password } → 200 · 400 bad code · 422 weak password']
  ]],
  ['Profile', [
    ['GET', '/api/me', A, 'Current user'], ['PUT', '/api/me', A, '{ name, email, phone } → 422 fields'],
    ['PUT', '/api/me/password', A, '{ currentPassword, newPassword } — signs out other sessions'],
    ['POST', '/api/me/avatar', A, 'Raw image body (Content-Type image/png|jpeg|gif|webp) → 201 · 415 wrong type · 413 > 1 MB'],
    ['DELETE', '/api/me/avatar', A, 'Remove photo']
  ]],
  ['Catalog', [
    ['GET', '/api/products', '', 'q, category (comma list), minPrice, maxPrice, inStock=true, minRating, sort (price_asc|price_desc|name_asc|name_desc|rating|newest), page, limit (1–50) → 400 on bad params · X-Total-Count header'],
    ['GET', '/api/products/:id', '', '400 non-numeric · 404 missing'], ['GET', '/api/products/:id/reviews', '', ''],
    ['POST', '/api/products/:id/reviews', A, '{ rating 1–5, title 3–60, body 10–500 } → 201 · 409 already reviewed · 422'],
    ['GET', '/api/categories', '', 'Names + counts'], ['GET', '/api/deal', '', 'Random deal — non-deterministic on purpose (mock it!)'], ['GET', '/api/meta', '', 'Countries/states, shipping methods']
  ]],
  ['Wishlist & cart', [
    ['GET', '/api/wishlist', A, ''], ['POST', '/api/wishlist', A, '{ productId } → 201 · 409 duplicate'], ['DELETE', '/api/wishlist/:productId', A, ''],
    ['GET', '/api/cart', A, '{ items, count, subtotal, discount, shipping, tax, total, coupon, shippingMethod }'],
    ['POST', '/api/cart', A, '{ productId, qty 1–10, variant? {size,color} } → 201 · 404 · 409 stock · 422 qty/variant'],
    ['PATCH', '/api/cart/:lineId', A, '{ qty }'], ['DELETE', '/api/cart/:lineId', A, ''], ['DELETE', '/api/cart', A, 'Clear cart'],
    ['POST', '/api/cart/coupon', A, '{ code } → 404 unknown · 422 expired/minimum'], ['DELETE', '/api/cart/coupon', A, ''],
    ['PUT', '/api/cart/shipping', A, '{ method: standard|express|nextday }']
  ]],
  ['Checkout & orders', [
    ['POST', '/api/checkout', A, '{ address{fullName,phone,line1,line2,city,country,state,zip}, payment{cardNumber,expiry,cvv,cardName} } → 201 order · 202 requires_action (3DS) · 400 empty cart · 402 declined · 409 stock · 422 fields'],
    ['POST', '/api/checkout/3ds', A, '{ challengeId, code } — code 123456; "cancel" aborts'],
    ['GET', '/api/orders', A, '?status=Placed|Processing|Shipped|Delivered|Cancelled'], ['GET', '/api/orders/:id', A, '404 for other users\' orders'],
    ['POST', '/api/orders/:id/cancel', A, '409 once shipped'], ['GET', '/api/orders/:id/invoice', A, 'CSV download (token may be passed as ?token=)'],
    ['GET', '/api/events?token=', A, 'Server-Sent Events: order-status pushes']
  ]],
  ['Admin (role=admin, else 403)', [
    ['GET', '/api/admin/stats', A, ''], ['GET', '/api/admin/products', A, ''], ['POST', '/api/admin/products', A, '{ name, category, price, stock, description }'],
    ['PUT', '/api/admin/products/:id', A, ''], ['DELETE', '/api/admin/products/:id', A, '204'],
    ['GET', '/api/admin/orders', A, ''], ['PATCH', '/api/admin/orders/:id', A, '{ status }'],
    ['GET', '/api/admin/users', A, ''], ['PATCH', '/api/admin/users/:username', A, '{ locked?, role? }']
  ]],
  ['Test control (no auth, for setup/teardown)', [
    ['GET', '/api/health', '', 'Wake-up / readiness probe'], ['POST', '/api/reset', '', 'Restore all seed data and default chaos'],
    ['GET', '/api/chaos', '', ''], ['POST', '/api/chaos', '', '{ latencyMs, errorRate 0–1, bugMode, sessionTtlSec, orderProgressSec }'],
    ['GET', '/api/test/mailbox?to=', '', 'Read OTP / reset codes / confirmations'], ['DELETE', '/api/test/mailbox', '', '']
  ]]
];

export function render(el) {
  setTitle('API docs');
  el.innerHTML = `<div class="page-head"><div><h1>API &amp; test data</h1><p class="muted" style="margin:0">Everything the UI does goes through this JSON API — so you can seed state with <code>request</code> and assert in the browser.</p></div></div>
    <div class="grid-2" style="margin-bottom:16px">
      <section class="card"><h2>Users <span class="muted small">password: secret123</span></h2><table class="small"><tbody>
        <tr><td class="mono">standard_user</td><td>Happy path</td></tr><tr><td class="mono">locked_user</td><td>423 Locked</td></tr><tr><td class="mono">slow_user</td><td>3 s login delay</td></tr>
        <tr><td class="mono">problem_user</td><td>Seeded bugs on</td></tr><tr><td class="mono">mfa_user</td><td>Email OTP, read it from the test inbox</td></tr><tr><td class="mono">admin_user</td><td>Admin console</td></tr></tbody></table>
        <p class="small muted" style="margin:10px 0 0">New-user password rule: 8+ chars, upper + lower case and a number.</p></section>
      <section class="card"><h2>Payment &amp; coupons</h2><table class="small"><tbody>
        <tr><td class="mono">4242 4242 4242 4242</td><td>Success</td></tr><tr><td class="mono">4000 0027 6000 3184</td><td>3-D Secure (code 123456)</td></tr>
        <tr><td class="mono">4000 0000 0000 0002</td><td>402 declined</td></tr><tr><td class="mono">4000 0000 0000 9995</td><td>402 insufficient funds</td></tr><tr><td class="mono">4000 0000 0000 0069</td><td>402 expired (bank side)</td></tr>
        <tr><td class="mono">SAVE10</td><td>10% off</td></tr><tr><td class="mono">FLAT50</td><td>$50 off orders ≥ $200</td></tr><tr><td class="mono">FREESHIP</td><td>Free shipping</td></tr><tr><td class="mono">EXPIRED20</td><td>Always "expired"</td></tr></tbody></table></section>
    </div>
    <section class="card" style="margin-bottom:16px"><h2>Per-request chaos headers</h2>
      <p class="small">Safe for parallel tests — they only affect the request that carries them. Set them with <code>page.setExtraHTTPHeaders()</code> or <code>test.use({ extraHTTPHeaders })</code>.</p>
      <table class="small"><tbody><tr><td class="mono">x-shoplab-latency: 2000</td><td>Delay this request (ms, max 10000)</td></tr><tr><td class="mono">x-shoplab-fail: 503</td><td>Force this status code</td></tr><tr><td class="mono">x-shoplab-bugs: 1</td><td>Turn seeded bugs on for this request</td></tr></tbody></table></section>
    ${GROUPS.map(([g, eps]) => `<section class="card" style="margin-bottom:16px" data-testid="docs-group"><h2>${esc(g)}</h2>
      ${eps.map(([m, p, a, d]) => `<div class="endpoint"><span class="method ${m}">${m}</span><code>${esc(p)} ${a}</code><span class="desc small muted">${esc(d)}</span></div>`).join('')}</section>`).join('')}`;
}
