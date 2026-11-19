# Page and design-reference inventory

Inventory date: **30 October 2026**. This is a source- and asset-backed inventory, not a visual-parity sign-off. It supports Milestone 1 of the [current master plan](VORTEX_AUTOMATION_PLAYGROUND_MASTER_PLAN.md); older screen counts in historical documents are superseded by the physical inventory below. The [29 October baseline](BASELINE_VALIDATION.md) remains dated historical evidence.

## Inventory method and totals

Three locations were inspected recursively, including the easily missed nested copy:

- **D** — `design/` in this repository.
- **S** — sibling `../Orvilo-design-screens/` relative to the repository root.
- **N** — nested sibling `../Orvilo-design-screens/Orvilo-design-screens/`.

Every physical file was hashed with SHA-256 and grouped by full-file content, not filename. All 22 canonical PNGs under `design/screenshots/` were opened and visually inspected. HTML references were source-inspected, not browser-rendered. The S and N PNG copies have identical hashes and therefore identical visual content; no image preview was inaccessible.

| Measure | Count |
|---|---:|
| Physical files in D | 53 |
| Physical files in S, including N | 106 |
| Combined physical files | 159 |
| Distinct screen/diagram references | 22 |
| Unique file contents by SHA-256 | 55 |

All 44 HTML/PNG reference assets are exact byte-for-byte triplicates across D, S and N. There are **20 page references** (including one mobile viewport) and **two 3D diagrams**. No cross-screen duplicate images were found.

Combined physical file types: 66 HTML, 66 PNG, 3 CSS, 15 WOFF2, 3 `README.md`, 3 `LICENSE.txt`, and 3 `OFL-LICENSE.txt`. The duplicate accounting is `(51 hashes × 3 copies) + (2 hashes × 2 copies) + 2 single older documents = 159`.

D and N contain the current 22-reference `README.md` and `LICENSE.txt`; S root contains unique older variants. The S root README's “15 static screens” statement is stale and does not match the 22 HTML and 22 PNG files physically present.

## Status definitions

- **Implemented core** — the route and main purpose exist in current source. This does not mean all reference sections or visuals match.
- **Partial / conditional** — only part of the reference exists, or support differs materially by storage mode.
- **Missing** — no corresponding application route/workflow was found.
- **Documentation asset** — a diagram/reference with no application route intended by this inventory.

PostgreSQL and legacy columns describe current source support, not fresh test certification. A matching filename, route or screenshot is never treated as proof of design parity.

## Screen and diagram inventory

For every row, the two listed relative reference paths exist under **each** of D, S and N. Links open the canonical D copies; the path text is the exact relative filename to use for the duplicate copies as well.

| # | Reference and purpose | Route and current source | PostgreSQL | Legacy memory | Status, visible gaps and verification still needed |
|---:|---|---|---|---|---|
| 01 | [index.html](../design/index.html) · [screenshots/01-shop-catalogue.png](../design/screenshots/01-shop-catalogue.png) — catalog search, filters, sorting, grid and pagination; 1440×1560 | `/shop` (`/` redirects); SHOP | Core catalog supported | Core catalog supported | **Implemented core.** Reference visual comparison and a fresh PostgreSQL/mobile check remain. |
| 02 | [product.html](../design/product.html) · [screenshots/02-product-detail.png](../design/screenshots/02-product-detail.png) — gallery, variants, stock, cart/wishlist, tabs and reviews; 1440×1595 | `/product/:id`; PRODUCT, shared SHOP actions | Core supported | Core supported | **Implemented core.** Reference recommendations/3D extras are not evident in the current view; gallery and full visual comparison remain. |
| 03 | [cart.html](../design/cart.html) · [screenshots/03-cart.png](../design/screenshots/03-cart.png) — quantities, removal/save-for-later, coupon, shipping and totals; 1440×1000 | `/cart`; CART | Core supported | Core supported | **Implemented core.** Pricing/coupon behavior still needs mode-appropriate verification; reference visual parity is unapproved. |
| 04 | [checkout.html](../design/checkout.html) · [screenshots/04-checkout-payment-step.png](../design/screenshots/04-checkout-payment-step.png) — payment step in four-step checkout; 1440×1396 | `/checkout/payment`; CHECKOUT | Simulated approved checkout; no legacy 3DS | Test cards and simulated 3DS | **Implemented core**, with deliberate payment-mode differences. Full reference comparison and PostgreSQL failure/3DS work remain. |
| 05 | [confirmation.html](../design/confirmation.html) · [screenshots/05-order-placed.png](../design/screenshots/05-order-placed.png) — order confirmation and delivery details; 1440×940 | `/checkout/complete/:id`; CHECKOUT | Supported | Supported | **Partial.** Current confirmation is a compact success card rather than the reference's full item/delivery/payment summary; responsive visual verification remains. |
| 06 | [signin.html](../design/signin.html) · [screenshots/06-sign-in.png](../design/screenshots/06-sign-in.png) — sign-in, test accounts, recovery and errors; 1440×900 | `/login`; AUTH | Persistent login/throttling; protected development recovery when configured | Seeded accounts, lock/delay personas and inbox recovery | **Implemented core**, with mode-specific recovery/personas. Error-state and reference visual comparisons remain. |
| 07 | [verify.html](../design/verify.html) · [screenshots/07-two-step-verification.png](../design/screenshots/07-two-step-verification.png) — six-digit second-step verification; 1440×900 | `/login/verify`; AUTH | Authenticator TOTP/backup code | Email OTP through test inbox | **Implemented core**, but the two MFA mechanisms are not interchangeable. All states and reference visuals still need verification. |
| 08 | [orders.html](../design/orders.html) · [screenshots/08-orders.png](../design/screenshots/08-orders.png) — order history and status filtering; 1440×1000 | `/orders`; ORDERS | Supported | Supported | **Implemented core.** Reference keyword/date filters are absent from current list source; visual and empty-state comparison remains. |
| 09 | [orderdetail.html](../design/orderdetail.html) · [screenshots/09-order-detail-live-status.png](../design/screenshots/09-order-detail-live-status.png) — tracking, invoice, reorder and cancellation; 1440×1120 | `/orders/:id`; ORDERS, APP event wiring | Core actions; no SSE live update | Core actions plus SSE live update | **Implemented core**, with mode-dependent live status. Timeline/reference visual comparison and durable progression remain. |
| 10 | [account.html](../design/account.html) · [screenshots/10-account.png](../design/screenshots/10-account.png) — profile, photo and two-step verification; 1440×1000 | `/account`, `/account/profile`, `/account/avatar`, `/account/security`; ACCOUNT | Persistent profile/avatar/security and authenticator MFA | Legacy profile/avatar/security and email OTP | **Implemented core**, distributed across tabs. Full state/reference comparison remains. |
| 11 | [admin.html](../design/admin.html) · [screenshots/11-admin-products.png](../design/screenshots/11-admin-products.png) — product table, sort/filter/pagination and CRUD; 1440×1040 | `/admin/products`; ADMIN | Server-authorized admin API/UI | Legacy admin API/UI | **Implemented core.** Seller workflows are separate; role/CRUD regression and reference visual comparison remain. |
| 12 | [lab.html](../design/lab.html) · [screenshots/12-ui-lab.png](../design/screenshots/12-ui-lab.png) — automation exercises and controls; 1440×1240 | `/lab`; LAB | Lab page available; individual network/control behavior is mode-specific | Full original lab/control environment | **Implemented core.** Do not infer per-card PostgreSQL equivalence; full responsive and mode-specific verification remains. |
| 13 | [inbox.html](../design/inbox.html) · [screenshots/13-test-inbox.png](../design/screenshots/13-test-inbox.png) — OTP/reset/order test messages; 1440×900 | `/mailbox`; MAILBOX | Page explicitly unavailable; protected recovery mail is API/CLI-only | Functional test inbox | **Partial / conditional.** No shared PostgreSQL inbox page or production delivery; mode-specific states need visual verification. |
| 14 | [docs.html](../design/docs.html) · [screenshots/14-api-docs.png](../design/screenshots/14-api-docs.png) — API documentation and test data; 1440×1100 | `/docs`; DOCS | Page available; content is primarily the legacy endpoint summary | Legacy endpoint summary | **Implemented core**, but not generated OpenAPI or the reference's detailed endpoint view. Content parity and PostgreSQL contract documentation remain. |
| 15 | [mobileshop.html](../design/mobileshop.html) · [screenshots/15-shop-on-a-phone.png](../design/screenshots/15-shop-on-a-phone.png) — two-column mobile shop/navigation; 390×844 | Same `/shop`; SHOP, SHELL, CSS | Responsive candidate | Responsive candidate | **Partial.** No separate mobile route; CSS supplies hamburger/two-column layout but not the reference bottom tab bar. PostgreSQL/mobile visual verification remains. |
| 16 | [selleradd.html](../design/selleradd.html) · [screenshots/16-seller-add-product.png](../design/screenshots/16-seller-add-product.png) — seller images, pricing, variants and publishing; 1440×1518 | Closest analogue: add-product modal at `/admin/products`; ADMIN | Basic admin add only | Basic admin add only | **Partial.** No seller route, seller ownership or full image/variant/publishing workflow; end-to-end implementation and verification remain. |
| 17 | [sellerdelete.html](../design/sellerdelete.html) · [screenshots/17-seller-delete-product.png](../design/screenshots/17-seller-delete-product.png) — typed deletion, trash and undo; 1440×1000 | Closest analogue: delete at `/admin/products`; ADMIN, CORE dialog helper | Narrow admin deletion | Narrow admin deletion | **Partial.** No seller trash/undo or typed-confirmation workflow; implementation and verification remain. |
| 18 | [messages.html](../design/messages.html) · [screenshots/18-message-center-buyer-bot-and-support.png](../design/screenshots/18-message-center-buyer-bot-and-support.png) — buyer/bot/support threads and order context; 1440×1000 | No route/view in APP or `web/js/views/` | Missing | Missing | **Missing.** Message center, participant permissions, persistence and all visual/behavior verification remain. |
| 19 | [settings.html](../design/settings.html) · [screenshots/19-settings.png](../design/screenshots/19-settings.png) — notifications, appearance, locale, tokens and deletion; 1440×1638 | `/settings`, `/account/settings`; ACCOUNT | Two email preferences, theme and reduced motion persist | Full reference settings not implemented; local theme exists | **Partial.** Locale, tokens, deletion and other reference controls are absent; behavior and visual verification remain. |
| 20 | [profile.html](../design/profile.html) · [screenshots/20-my-profile.png](../design/screenshots/20-my-profile.png) — profile dashboard, stats, addresses, cards, reviews and activity; 1440×1214 | Closest: `/account`; ACCOUNT | Profile/security/avatar editing, not reference dashboard | Profile/security/avatar editing, not reference dashboard | **Partial.** Stats, addresses, cards, review/activity dashboard sections are absent; implementation and verification remain. |
| 21 | [flow3d.html](../design/flow3d.html) · [screenshots/21-3d-flow-order-journey.png](../design/screenshots/21-3d-flow-order-journey.png) — isometric order journey and test hook points; 1440×1000 | No frontend route; HTML contains scalable SVG diagram | Not an application screen | Not an application screen | **Documentation asset.** Reuse in documentation where useful; no interactive 3D engine is required by this inventory. |
| 22 | [architecture3d.html](../design/architecture3d.html) · [screenshots/22-3d-flow-system-architecture.png](../design/screenshots/22-3d-flow-system-architecture.png) — system architecture and test infrastructure; 1440×1000 | No frontend route; HTML contains scalable SVG diagram | Not an application screen | Not an application screen | **Documentation asset.** Reuse in architecture documentation; no application parity claim applies. |

Summary: **12 implemented-core, 7 partial/conditional, 1 missing application screen, and 2 documentation assets**. These categories describe route/purpose coverage only.

## Current implementation source key

Every listed SPA route is registered in **APP**: [`web/js/app.js`](../web/js/app.js). Shared identity, API selection and mode gating are in [`web/js/core.js`](../web/js/core.js) (**CORE**) and [`web/index.html`](../web/index.html) (**SHELL**). Responsive/shared styling is in [`web/css/app.css`](../web/css/app.css) and [`web/css/orvilo.css`](../web/css/orvilo.css) (**CSS**).

| Key | Source |
|---|---|
| SHOP | [`web/js/views/shop.js`](../web/js/views/shop.js) |
| PRODUCT | [`web/js/views/product.js`](../web/js/views/product.js) |
| CART | [`web/js/views/cart.js`](../web/js/views/cart.js) |
| CHECKOUT | [`web/js/views/checkout.js`](../web/js/views/checkout.js) |
| AUTH | [`web/js/views/auth.js`](../web/js/views/auth.js) |
| ORDERS | [`web/js/views/orders.js`](../web/js/views/orders.js) |
| ACCOUNT | [`web/js/views/account.js`](../web/js/views/account.js) |
| ADMIN | [`web/js/views/admin.js`](../web/js/views/admin.js) |
| LAB | [`web/js/views/lab.js`](../web/js/views/lab.js) |
| MAILBOX | [`web/js/views/mailbox.js`](../web/js/views/mailbox.js) |
| DOCS | [`web/js/views/docs.js`](../web/js/views/docs.js) |

Server-side storage selection and `/api/v2` module mounts are in [`src/app.js`](../src/app.js); the SPA adapter is [`web/js/api-v2.js`](../web/js/api-v2.js). See [SETUP.md](SETUP.md) for runtime setup and mode boundaries.

## Non-screen files and folders accounted for

Each location has only `assets/fonts/`, `screenshots/`, the 22 root HTML references, and the listed support documents. No additional nested references or support files were found.

The following relative paths exist under D, S and N:

| Relative path | Purpose and duplication |
|---|---|
| `README.md` | Screen catalog/usage guidance; D/N current 22-reference copies match, S root is an older 15-screen version. |
| `LICENSE.txt` | CC0 design/font-license explanation; D/N current copies match, S root is older. |
| `assets/fonts.css` | Plus Jakarta Sans `@font-face` declarations; exact triplicate. |
| `assets/fonts/OFL-LICENSE.txt` | Plus Jakarta Sans SIL OFL license; exact triplicate. |
| `assets/fonts/plus-jakarta-sans-latin-400-normal.woff2` | Font weight 400; exact triplicate. |
| `assets/fonts/plus-jakarta-sans-latin-500-normal.woff2` | Font weight 500; exact triplicate. |
| `assets/fonts/plus-jakarta-sans-latin-600-normal.woff2` | Font weight 600; exact triplicate. |
| `assets/fonts/plus-jakarta-sans-latin-700-normal.woff2` | Font weight 700; exact triplicate. |
| `assets/fonts/plus-jakarta-sans-latin-800-normal.woff2` | Font weight 800; exact triplicate. |

## Verification still required

- Compare implemented pages against the canonical references at documented desktop and mobile viewports; record screenshots and review them rather than inferring parity from this inventory.
- Verify PostgreSQL browser behavior separately from the legacy Playwright suite, especially authentication, admin, checkout, order updates and mode-specific unavailable states.
- Implement the missing message center and complete partial seller, settings, profile and confirmation experiences only under their master-plan milestones.
- Keep the two diagrams as documentation assets unless an interactive experience is separately approved. Mobile-shop is a responsive viewport target, not another application.
