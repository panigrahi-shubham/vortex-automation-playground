# Testing Guide Page

Task E adds a standalone, publicly served manual-testing guide at
`/pages/testing-guide.html`. The implementation is
`web/pages/testing-guide.html`; Express serves it directly from `web/` without an
SPA route or application behavior change.

## Scope and navigation

The guide contains six tool-neutral journeys:

| Journey | Public starting point | Main evidence |
| --- | --- | --- |
| Sign up and sign in | `/register`, then `/login` | Registration, login, protected-route, and MFA boundaries |
| Catalog filtering | `/shop` | Search/filter/sort controls and product detail |
| Wishlist and cart | `/wishlist`, `/cart` | Saved products, variants, quantities, totals, and reload behavior |
| Checkout and order detail | Non-empty `/cart`, then `/orders` | Four-step checkout, simulated payment, and persisted order detail |
| Cancellation | `/orders` | User-owned order selection, eligible statuses, confirmation, and stock restoration |
| UI Lab exploration | `/lab` | Independent browser-automation exercises and their observable results |

The guide deliberately links only to public application destinations, not to
repository `docs/` paths. Order details are reached from `/orders` so no generated
record ID is hard-coded. Task E supplied the direct static URL; integration added
a storefront footer link. Its explicit same-window target loads the standalone
document rather than routing it through the SPA. No main-navigation item was added.

## Source basis

- `web/js/app.js:4-17` defines the existing browser routes used by the guide.
- `web/js/views/auth.js` implements registration, automatic post-registration
  login, sign in, and the separate MFA challenge.
- `web/js/views/shop.js` implements catalog query/filter/sort behavior.
- `web/js/views/cart.js` and `web/js/views/product.js` implement wishlist, cart,
  and variant interactions.
- `web/js/views/checkout.js:60-75` requires authentication and a non-empty cart;
  `web/js/views/checkout.js:140-148` distinguishes PostgreSQL payment from the
  legacy 3-D Secure exercise.
- `web/js/views/orders.js:47-80` exposes cancellation only for Placed or
  Processing orders and requires confirmation.
- `src/workflows/cancel-order.ts:10-19` checks ownership and status, restores
  stock, and records cancellation.
- `web/js/views/lab.js:9-59` inventories the UI Lab exercises and their visible
  result surfaces.
- `src/auth/mfa-routes.ts` establishes authenticator-based PostgreSQL MFA.
- `src/auth/recovery-routes.ts` limits PostgreSQL recovery to non-production
  configurations with the protected test key and test sink.
- `docs/AUTOMATION_COMPATIBILITY.md` identifies Normal, Practice, Defect Lab,
  run-scoped reset, and fixture controls as planned rather than current behavior.
- `README.md` and `docs/SETUP.md` provide the current PostgreSQL/legacy storage
  boundary used in the comparison table.

No planned capability is presented as operational. The page states that payment
and refunds are simulated, real order email is not sent, PostgreSQL MFA is not
legacy email OTP, and Android/APK/Appium work remains separate.

## Page implementation

The document uses existing local assets only:

1. `/assets/fonts.css`
2. `/css/app.css`
3. `/css/orvilo.css`
4. A page-scoped inline style block for guide layout

It has no JavaScript, external assets, tracking, API calls, login form, reset
control, credentials, deployment hostname, or generated fixture identifiers.
Checkboxes in the manual results checklist are local native controls wrapped in
explicit text labels; their state is neither saved nor submitted.

Accessibility and layout provisions include:

- One `main` landmark, a keyboard-visible skip link, logical heading levels,
  breadcrumb and comparison-region labels, and native links and checkboxes.
- Existing `:focus-visible` styling, 44px minimum checklist targets, and no
  pointer-only page interaction.
- Responsive single-column journey/checklist layouts at narrow widths and a
  separately scrollable runtime-comparison table.
- Existing root token support for `data-theme="dark"`; the static page does not
  add a theme toggle or read browser storage.
- Existing reduced-motion CSS plus no guide animation, transition, or smooth
  scrolling.

Execution evidence and remaining limits belong in
`docs/handoffs/TASK_E_RESULT.md`, not in this design note.
