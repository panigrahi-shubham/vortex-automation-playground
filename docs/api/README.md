# Core PostgreSQL API contract

[`openapi.core.v0.1.json`](openapi.core.v0.1.json) is a **partial, source-backed OpenAPI 3.0.3 contract** for exactly ten current `/api/v2` operations. It describes the current Express/Prisma wire behavior; it is not a redesign, a complete API specification, a legacy `/api` contract, or evidence from a live endpoint run.

All examples are fictitious. Product/user/order IDs, tokens, credentials, and customer details in the document are not stable fixtures or production data.

## Included operations

| Operation | Operation ID | Authentication |
| --- | --- | --- |
| `POST /register` | `registerCustomer` | Public |
| `POST /login` | `loginCustomer` | Public |
| `GET /me` | `getCurrentProfile` | Bearer session |
| `POST /logout` | `logoutCustomer` | Bearer session |
| `GET /categories` | `listCategories` | Public |
| `GET /products` | `listProducts` | Public |
| `GET /products/{id}` | `getProduct` | Public |
| `GET /cart` | `getCart` | Bearer session |
| `GET /orders` | `listOrders` | Bearer session |
| `GET /orders/{id}` | `getOrder` | Bearer session |

Each operation has an `x-source` array citing its route, serializer/middleware, and relevant current tests where available. The source is authoritative if this draft and implementation later diverge.

## Using the server base

The only declared server URL is the relative base:

```text
/api/v2
```

Resolve it against the scheme and host of the environment being used. For example, an OpenAPI client configured for a local server at `http://localhost:3000` calls `GET /products` as `http://localhost:3000/api/v2/products`. Do not append `/api/v2` twice, and do not substitute legacy `/api` paths.

Protected operations use the application's own session mechanism, **not Supabase Auth**:

```text
Authorization: Bearer <session-token>
```

A successful non-MFA `POST /login` returns that 64-character hexadecimal session token. Registration returns only a profile and does not create a session. If login returns `mfaRequired: true`, the body contains a challenge `mfaToken`, **not** an authenticated session token. Do not use the challenge token for Bearer authentication. MFA verification is outside this initial contract.

## Current wire behavior and limitations

- Decimal-backed product price/rating, cart money, order total, and order-line unit price are serialized as JSON **numbers**. Dates are JSON date-time strings.
- Product responses omit `deletedAt`. Cart `variant` and order-line `variant` are stored strings, not nested objects. Order serialization currently exposes `userId` and `idempotencyKey` and adds `paymentMode: "simulated"`.
- `GET /products` uses a `{ total, page, pages, limit, items }` envelope and `X-Total-Count`. `pages` is at least one even for zero results. Only exact `inStock=true` enables stock filtering; other values are ignored. Minimum and maximum prices are not cross-validated.
- `GET /orders` is a **bare array**, not an envelope. It has a fixed page size of 25, a `page` parameter, no total/pages metadata, and no server-side status filter.
- Missing, malformed, expired, revoked, and locked-session cases follow current middleware. Missing/malformed Bearer credentials return `401 { "error": "Unauthorized" }`; a well-formed token without a live session returns `401` with `code: "SESSION_EXPIRED"`; a locked account returns 423.
- Registration validation returns 422 with a `fields` map, while duplicate username/email returns the flat 409 error `Account already exists`. Login throttling returns 429 and `Retry-After`; this document does not declare equivalent rate limits for other operations.
- `GET /orders/{id}` deliberately has one 404 result for both missing and cross-user orders. It has no separate 403 response and no opaque-ID format validation.
- `address` and `pricing` are stored JSON snapshots. Their schemas describe the current checkout producer; they are not evidence of independent database JSON-schema validation or every possible historical row.
- The shared API error handler supplies documented malformed-JSON, body-size/encoding, and generic 500 responses where applicable. The application still has operation-specific error shapes; this contract does not claim a completed global error-convention redesign.

## Excluded from this partial contract

This file does **not** document the following as complete:

- checkout or idempotent order creation;
- cart additions, updates, deletion, coupons, or shipping mutations;
- order cancellation or invoices;
- MFA enrollment, verification, backup codes, or disablement;
- password recovery, profile/account/settings/avatar operations;
- admin, reviews, wishlist, deals, test inbox, test controls, fixtures, resets, faults, or events;
- legacy `/api` behavior, including legacy email OTP and its different session/token details.

Planned run-scoped reset and Normal/Practice/Defect Lab controls are not part of this contract. No client code, SDK, automation framework, or generated authentication material is included.

## Dependency-free consistency check

Run from the repository root with the installed Node.js runtime. This checks JSON parsing, the exact operation set, local `$ref` resolution, unique operation IDs, path parameters, security schemes, and `x-source` files/line ranges. It does **not** replace full OpenAPI-schema validation or runtime contract tests.

```bash
node <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const file = path.resolve('docs/api/openapi.core.v0.1.json');
const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
const errors = [];
const methods = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'trace'];
const expected = new Set([
  'POST /register', 'POST /login', 'GET /me', 'POST /logout',
  'GET /categories', 'GET /products', 'GET /products/{id}',
  'GET /cart', 'GET /orders', 'GET /orders/{id}'
]);
const actual = new Set();
const operationIds = new Set();

function resolveRef(ref) {
  if (!ref.startsWith('#/')) throw new Error(`Non-local ref: ${ref}`);
  return ref.slice(2).split('/').map(part => part.replaceAll('~1', '/').replaceAll('~0', '~'))
    .reduce((value, key) => value?.[key], doc);
}
function walk(value) {
  if (!value || typeof value !== 'object') return;
  if (value.$ref) {
    try { if (resolveRef(value.$ref) === undefined) errors.push(`Unresolved ref: ${value.$ref}`); }
    catch (error) { errors.push(error.message); }
  }
  for (const child of Object.values(value)) walk(child);
}
walk(doc);

for (const [route, item] of Object.entries(doc.paths || {})) {
  for (const method of methods) {
    const operation = item[method];
    if (!operation) continue;
    const key = `${method.toUpperCase()} ${route}`;
    actual.add(key);
    if (!expected.has(key)) errors.push(`Unexpected operation: ${key}`);
    if (!operation.operationId || operationIds.has(operation.operationId)) errors.push(`Missing/duplicate operationId: ${key}`);
    operationIds.add(operation.operationId);
    if (!Array.isArray(operation['x-source']) || !operation['x-source'].length) errors.push(`${key}: missing x-source`);
    for (const source of operation['x-source'] || []) {
      const match = source.match(/^(.+):(\d+)(?:-(\d+))?$/);
      if (!match) { errors.push(`${key}: malformed source ${source}`); continue; }
      if (!fs.existsSync(match[1])) { errors.push(`${key}: missing source ${match[1]}`); continue; }
      const lines = fs.readFileSync(match[1], 'utf8').split(/\r?\n/).length;
      if (Number(match[3] || match[2]) > lines) errors.push(`${key}: source outside file ${source}`);
    }
    const parameters = [...(item.parameters || []), ...(operation.parameters || [])];
    const declared = new Set(parameters.filter(parameter => parameter.in === 'path').map(parameter => parameter.name));
    for (const match of route.matchAll(/\{([^}]+)\}/g)) {
      const parameter = parameters.find(candidate => candidate.in === 'path' && candidate.name === match[1]);
      if (!parameter) errors.push(`${key}: missing path parameter ${match[1]}`);
      else if (parameter.required !== true) errors.push(`${key}: path parameter ${match[1]} is not required`);
      declared.delete(match[1]);
    }
    for (const extra of declared) errors.push(`${key}: undeclared route parameter ${extra}`);
    for (const requirement of operation.security || doc.security || []) {
      for (const scheme of Object.keys(requirement)) {
        if (!doc.components?.securitySchemes?.[scheme]) errors.push(`${key}: unknown security scheme ${scheme}`);
      }
    }
  }
}
for (const key of expected) if (!actual.has(key)) errors.push(`Missing operation: ${key}`);
if (doc.openapi !== '3.0.3') errors.push(`Expected OpenAPI 3.0.3, got ${doc.openapi}`);
if (doc.servers?.length !== 1 || doc.servers[0].url !== '/api/v2') errors.push('Server base must be exactly /api/v2');
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`PASS: OpenAPI ${doc.openapi}; ${actual.size} operations; ${operationIds.size} unique operationIds; local refs, path parameters, security schemes, server base, and x-source references are consistent.`);
NODE
```

Full specification-validator and live-runtime results are recorded separately in [`../handoffs/TASK_D_RESULT.md`](../handoffs/TASK_D_RESULT.md); this README does not assume either was run.
