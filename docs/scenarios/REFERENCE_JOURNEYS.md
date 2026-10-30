# Reference journeys

These walkthroughs target current source and existing Playwright tests. They are examples to execute in an **authorized disposable local environment**, not reports of a new run and not evidence that another recorder is compatible.

The Playwright commands use the repository's global setup, which calls `POST /api/reset` before the legacy reference run. Do not point them at shared or public infrastructure. The PostgreSQL smoke creates, changes, cancels, and deletes disposable records; it also must only run against an authorized disposable development database.

## 1. Customer business journey — `SHOP-CHECKOUT-001`

**Starting route:** `/shop`  
**Difficulty:** Level 2 · target Normal classification  
**Storage evidence:** exact legacy browser journey plus a related PostgreSQL smoke journey

### Prerequisites

1. Start with a signed-in disposable customer and an empty cart.
2. Confirm the environment's storage through `GET /api/config` before choosing the reference below.
3. Locate **Robot Building Kit** by search and visible business name. Do not substitute a generated PostgreSQL product ID.
4. Use address and test-card fixtures from [`tests/support/test-data.ts`](../../tests/support/test-data.ts), never real payment details.

### Ordered walkthrough

| Step | Action and public selector | Observable result |
| --- | --- | --- |
| 1 | Fill `role=searchbox name=Search products` with `robot`, press Enter, and wait for `data-testid=product-grid` to have `aria-busy=false`. | The filtered grid contains the exact product name Robot Building Kit. |
| 2 | Within the matching `data-testid=product-card`, click `data-testid=product-name`. | Product detail opens for the selected logical product. |
| 3 | Click `role=button name=Increase quantity`, then `data-testid=add-to-cart` inside `data-testid=product-detail`. | `data-testid=cart-badge` is `2`. |
| 4 | Open `role=link name=Cart`; read `data-testid=total` inside the order summary and retain it as `cartTotal`; select `role=link name=Proceed to checkout`. | The browser reaches `/checkout/address`; the current checkout step is Address. |
| 5 | Fill Full name, Phone, Address line 1, City, Country, State / region, and Postal code; select Continue to delivery, then Continue to payment. | The wizard reaches Delivery and then Payment without skipping guards. |
| 6 | Fill Card number, Expiry (MM/YY), CVV, and Name on card from the test fixtures; select Review order. | Review shows `data-testid=card-last4` = `4242`. |
| 7 | Inspect `data-testid=review-item` and `data-testid=summary-total`. | The item contains `Robot Building Kit × 2`; review total equals `cartTotal`. |
| 8 | Check the terms-of-sale checkbox and select the Place order button. | Confirmation shows `data-testid=order-success` = `Thank you for your order!`. |
| 9 | Read and retain `data-testid=order-id` and `data-testid=order-total`; inspect the cart badge. | The generated order ID is present, confirmation total equals `cartTotal`, and the badge is `0`. |
| 10 | Select `role=link name=View order`. | `data-testid=order-heading` contains the generated ID, status is `Placed`, and order total still equals `cartTotal`. |

### Reproduce the legacy source

From the repository root, against disposable legacy storage:

```sh
npx playwright test tests/e2e/checkout.spec.ts --project=chromium --grep "end-to-end: search"
```

The executable implementation is [`tests/e2e/checkout.spec.ts:6-41`](../../tests/e2e/checkout.spec.ts#L6-L41). Its address, payment, and terms helpers are in [`tests/pages/checkout-page.ts:17-72`](../../tests/pages/checkout-page.ts#L17-L72).

### Related PostgreSQL reference

With the current backend built and a PostgreSQL server already running in `postgres` storage mode:

```sh
npm run smoke:storefront:db
```

The smoke registers a unique disposable user, resolves current catalog records at runtime, completes checkout, captures the generated order ID, opens order detail, downloads the invoice, cancels the order, and invokes its own cleanup. See [`scripts/smoke-v2-storefront.cjs:73-88`](../../scripts/smoke-v2-storefront.cjs#L73-L88), [`scripts/smoke-v2-storefront.cjs:135-213`](../../scripts/smoke-v2-storefront.cjs#L135-L213), and [`scripts/smoke-v2-storefront.cjs:354-358`](../../scripts/smoke-v2-storefront.cjs#L354-L358).

The PostgreSQL smoke also exercises coupon, express shipping, reviews, variants, wishlist, MFA, and admin behavior; it is not an isolated execution of only this scenario. Its checkout path is related evidence, not an identical Robot Building Kit trace.

### Required reporting boundary

Record the storage mode, generated order ID, cart total, confirmation total, order-detail total, and any failure. Do not report success from a toast alone. This browser journey does **not** by itself prove stored-total integrity, stock decrement, duplicate-request idempotency, or stock restoration after cancellation; add separately sourced API/database assertions before claiming those invariants.

## 2. Nested frames — `UI-FRAME-001`

**Starting route:** `/lab`  
**Difficulty:** Level 2 · target Practice classification  
**Storage evidence:** legacy browser test; no business fixture required

1. Open `/lab` in a guest context.
2. Create a frame locator for `[data-testid="outer-frame"]`.
3. Inside that frame, click the button whose name matches `Clicked 0 times`.
4. Assert `outer-counter` is `Clicked 1 time`.
5. From the outer frame, create a frame locator for `[data-testid="inner-frame"]`.
6. In the inner frame, fill `Your name` with `Rupesh` and click `Greet`.
7. Assert `inner-greeting` is `Hello, Rupesh!`.

```ts
await page.goto('/lab');
const outer = page.frameLocator('[data-testid="outer-frame"]');
await outer.getByRole('button', { name: /Clicked 0 times/ }).click();
await expect(outer.getByTestId('outer-counter')).toHaveText('Clicked 1 time');

const inner = outer.frameLocator('[data-testid="inner-frame"]');
await inner.getByLabel('Your name').fill('Rupesh');
await inner.getByRole('button', { name: 'Greet' }).click();
await expect(inner.getByTestId('inner-greeting')).toHaveText('Hello, Rupesh!');
```

Reproduce the existing test against disposable legacy storage:

```sh
npx playwright test tests/e2e/lab.spec.ts --project=chromium --grep "nested iframes"
```

Source: [`tests/e2e/lab.spec.ts:39-47`](../../tests/e2e/lab.spec.ts#L39-L47). The inner frame must be located relative to the outer frame; a page-level locator does not establish the same context.

## 3. Shadow DOM — `UI-SHADOW-001`

**Starting route:** `/lab`  
**Difficulty:** Level 3 · target Practice classification  
**Storage evidence:** legacy browser test; no business fixture required

1. Open `/lab` and scope all locators to `data-testid=lab-shadow`.
2. Click `role=button name=4 stars` in the open shadow component.
3. Assert `shadow-rating-text` = `You rated 4/5` and `shadow-host` has `value=4`.
4. Assert the nested `shadow-chip` has `part=chip` and `lab-chip` contains `shadow-in-shadow`.
5. Assert `role=button name=Reveal secret` has count zero: it lives inside a closed root and is not promised to be selectable.
6. Call the public `reveal()` component method on `closed-shadow-host` and assert its `revealed` attribute becomes `true`.

```ts
await page.goto('/lab');
const c = page.getByTestId('lab-shadow');
await c.getByRole('button', { name: '4 stars' }).click();
await expect(c.getByTestId('shadow-rating-text')).toHaveText('You rated 4/5');
await expect(c.getByTestId('shadow-host')).toHaveAttribute('value', '4');
await expect(c.getByTestId('shadow-chip')).toHaveAttribute('part', 'chip');
await expect(c.locator('lab-chip')).toHaveText('shadow-in-shadow');

await expect(c.getByRole('button', { name: 'Reveal secret' })).toHaveCount(0);
await c.getByTestId('closed-shadow-host').evaluate(
  (el: HTMLElement & { reveal(): void }) => el.reveal()
);
await expect(c.getByTestId('closed-shadow-host')).toHaveAttribute('revealed', 'true');
```

Reproduce the existing test against disposable legacy storage:

```sh
npx playwright test tests/e2e/lab.spec.ts --project=chromium --grep "shadow DOM: open roots"
```

Source: [`tests/e2e/lab.spec.ts:49-60`](../../tests/e2e/lab.spec.ts#L49-L60). Playwright pierces open roots for these locators; the closed-root step intentionally uses the component's public API instead. Another tool must run and report this distinction before it can claim equivalent compatibility.
