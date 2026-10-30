# Task E result — static testing guide

Task ID: **E**  
Date: 30 October 2026  
Outcome: **completed within the three-file documentation/static-page scope**

Added a publicly served, static manual-testing guide at `/pages/testing-guide.html`. No application route, API, database, backend, dependency, package manifest, navigation, existing view, build configuration, or test-control behavior was changed. Deployment and the overall milestone are not claimed complete.

## New files

1. [`web/pages/testing-guide.html`](../../web/pages/testing-guide.html)
   - Contains six journeys: account sign up/sign in, catalog filtering, wishlist/cart, checkout/order detail, cancellation, and UI Lab.
   - Gives each journey a public starting route, prerequisites, ordered steps, observable outcomes, and known limits.
   - Separates current PostgreSQL and legacy memory behavior, planned Normal/Practice/Defect Lab controls, simulated payment/refund/email, authenticator MFA versus legacy OTP, and separate Android work.
   - Includes a local evidence checklist, keyboard/theme/responsive/reduced-motion checks, and clear guidance not to use real data or shared legacy reset controls.

2. [`docs/TESTING_GUIDE_PAGE.md`](../TESTING_GUIDE_PAGE.md)
   - Documents route, journey scope, source basis, static-asset policy, accessibility decisions, runtime boundaries, and maintenance ownership.

3. [`docs/handoffs/TASK_E_RESULT.md`](TASK_E_RESULT.md)
   - This result and verification report.

## Source basis

The guide was written from the current checkout after comparing the relevant views and workflows:

| Journey | Primary source compared |
| --- | --- |
| Account | `web/js/app.js`, `web/js/views/auth.js`, `src/auth/mfa-routes.ts`, `src/auth/recovery-routes.ts` |
| Catalog | `web/js/views/shop.js`, `web/js/views/product.js` |
| Wishlist/cart | `web/js/views/product.js`, `web/js/views/cart.js`, `src/modules/catalog/variants.ts` |
| Checkout/order | `web/js/views/checkout.js`, `web/js/views/orders.js`, current PostgreSQL serializers |
| Cancellation | `web/js/views/orders.js`, `src/workflows/cancel-order.ts`, `src/modules/orders/routes.ts` |
| UI Lab | `web/js/views/lab.js` |

The runtime comparison and planned-control statements were checked against `README.md`, `docs/SETUP.md`, `docs/AUTOMATION_COMPATIBILITY.md`, the authentication routes, and the current legacy/PostgreSQL split. The public guide links only to existing application destinations, never repository `docs/` paths.

## Verification commands and results

### Existing server

The already-running local server responded successfully; no competing process was started and no server or data reset was performed.

```text
GET http://localhost:3000/pages/testing-guide.html -> 200
```

### Static contract

A dependency-free Node.js check read the delivered page and reported:

```text
{"status":"PASS","journeys":6,"uniqueIds":19,"stylesheets":["/assets/fonts.css","/css/app.css","/css/orvilo.css"],"inlineScripts":0,"externalAssetUrls":0}
```

The final file-size/contract follow-up also reported:

```text
web/pages/testing-guide.html bytes=24937 lines=279
docs/TESTING_GUIDE_PAGE.md bytes=4247 lines=84
static_contract=PASS
```

The check covers six journey articles, unique IDs, three local stylesheets, no inline script, no external asset URL, and no credential or database-URL text.

### Browser and accessibility verification

Playwright ran against the existing server at the exact viewport configurations below. It used safe reads and local DOM-only theme/motion adjustments; it did not sign in, submit a form, mutate an API, or write application data.

| Configuration | HTTP | Page overflow | Columns | External requests | Axe WCAG 2 A/AA + 2.1 A/AA |
| --- | --- | --- | --- | --- | --- |
| 1440 × 1000, light | 200 | none | 2 | 0 | 0 violations |
| 1440 × 1000, dark | 200 | none | 2 | 0 | 0 violations |
| 412 × 915, light | 200 | none | 1 | 0 | 0 violations |
| 412 × 915, dark | 200 | none | 1 | 0 | 0 violations |
| 1440 × 1000, reduced motion | 200 | none | 2 | 0 | 0 violations |

At 412px the runtime table stayed inside its labelled scroll region (`clientWidth=378`, `scrollWidth=720`) while the document width remained 412px. The page had zero scripts and zero active animations in every configuration.

The first axe pass found nine `link-in-text-block` instances because inline links relied on color alone. A page-scoped underline rule was added to non-button links in `main`; all five configurations then passed with no axe violations. Automated accessibility checks do not prove complete accessibility, but no WCAG A/AA violation was reported by this scan.

### Keyboard and destinations

```text
First Tab focus: "Skip to testing guide"
Focus outline: solid, 2px
Enter on skip link: hash="#guide-main", active element id="guide-main"
Checklist checkbox: toggled on with Space, then returned to off
```

Safe GET checks returned `200 text/html` for:

```text
/pages/testing-guide.html
/register
/login
/shop
/wishlist
/cart
/orders
/lab
```

Screenshots at 1440px light, 1440px dark, and 412px light were visually inspected for hierarchy, wrapping, contrast, button layout, and section spacing; all were clean. They were temporary verification artifacts, not added to the repository.

## Limitations and checks not run

- The guide was not used to execute the six journeys end to end. Account creation, sign in, cart mutation, checkout, payment, order creation, cancellation, and UI Lab exercises were not run as part of Task E.
- Route checks confirm public HTML delivery only; protected-route redirects and authenticated states were not exercised.
- No live database, PostgreSQL endpoint, legacy reset control, chaos setting, fixture, support inbox, deployment hostname, credential, or generated record ID was used or changed.
- The static page does not read browser theme storage and has no theme toggle. Dark mode was verified by applying the existing `data-theme="dark"` root hook in the test harness.
- No APK or Appium implementation/result exists here, and no Android behavior is claimed verified.
- No navigation link was added. The page is reachable by direct public URL.
- No deployment, production-email delivery, real payment, or overall project completion is claimed.

## Request outside Task E ownership

**Optional:** add a “Testing guide” link to `web/index.html` main navigation (and its mobile behavior), pointing to `/pages/testing-guide.html`. That file belongs to the shared application shell, so Task E did not modify it. Until the owner makes that change, the guide has no in-app navigation entry point.
