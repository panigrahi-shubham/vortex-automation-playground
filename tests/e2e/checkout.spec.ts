import { test, expect } from '../support/fixtures';
import { PRODUCTS, CARDS, THREE_DS_CODE, COUPONS, money } from '../support/test-data';

const { mug, pragmaticTester: book, robotKit } = PRODUCTS;

test('end-to-end: search → product → cart → 4-step checkout → confirmation → order history', async ({ page, shopPage, productPage, cartPage, checkoutPage, orderPage }) => {
  await shopPage.goto();
  await shopPage.searchFor('robot');
  await shopPage.card(robotKit.name).getByTestId('product-name').click();
  await productPage.increase.click();
  await productPage.addToCartButton.click();
  await expect(productPage.cartBadge).toHaveText('2');

  await page.getByRole('link', { name: 'Cart' }).click();
  const cartTotal = (await cartPage.totals()).total;
  await cartPage.checkoutButton.click();

  await expect(page).toHaveURL('/checkout/address');
  await expect(checkoutPage.currentStep()).toHaveText('Address');
  await checkoutPage.fillAddress();
  await checkoutPage.continueToDelivery();
  await expect(checkoutPage.currentStep()).toHaveText('Delivery');
  await checkoutPage.continueToPayment();
  await checkoutPage.fillPayment();
  await checkoutPage.continueToReview();
  await expect(page.getByTestId('card-last4')).toHaveText('4242');
  await expect(page.getByTestId('review-item')).toHaveText(new RegExp(`${robotKit.name} × 2`));
  await expect(checkoutPage.summaryTotal).toHaveText(`$${cartTotal.toFixed(2)}`);

  await checkoutPage.placeOrder();
  await expect(page).toHaveURL(/\/checkout\/complete\/ORD-\d{6}$/);
  await expect(page.getByTestId('order-success')).toHaveText('Thank you for your order!');
  const orderId = await page.getByTestId('order-id').innerText();
  expect(money(await page.getByTestId('order-total').innerText())).toBe(cartTotal);
  await expect(checkoutPage.cartBadge).toHaveText('0');

  await page.getByRole('link', { name: 'View order' }).click();
  await expect(orderPage.heading).toHaveText(`Order ${orderId}`);
  await expect(orderPage.status).toHaveText('Placed');
  await expect(orderPage.total).toHaveText(`$${cartTotal.toFixed(2)}`);
});

test.describe('Checkout validation', () => {
  test.beforeEach(async ({ api }) => { await api.addToCart(mug.id); });

  test('address: every required field is validated', async ({ page, checkoutPage }) => {
    await checkoutPage.goto();
    await checkoutPage.field('Full name').clear();
    await checkoutPage.continueToDelivery();
    await expect(checkoutPage.error('fullName')).toHaveText('Full name is required');
    await expect(checkoutPage.error('phone')).toHaveText('Phone must be 10 digits');
    await expect(checkoutPage.error('line1')).toHaveText('Address is required');
    await expect(checkoutPage.error('city')).toHaveText('City is required');
    await expect(checkoutPage.error('country')).toHaveText('Select a country');
    await expect(checkoutPage.field('Full name')).toBeFocused(); // focus moves to the first invalid field
    await expect(page).toHaveURL('/checkout/address');
  });

  test('address: dependent country → state dropdown and postal-code rules', async ({ checkoutPage }) => {
    await checkoutPage.goto();
    const state = checkoutPage.field('State / region');
    await expect(state).toBeDisabled();
    await checkoutPage.field('Country').selectOption({ label: 'United States' });
    await expect(state).toBeEnabled();
    await expect(state.locator('option')).toContainText(['Select a state', 'California', 'New York', 'Texas', 'Washington', 'Florida']);
    await expect(checkoutPage.page.locator('#zip-hint')).toHaveText('5 digits');

    await checkoutPage.fillAddress({ country: 'IN', state: 'Telangana', zip: '12345' });
    await checkoutPage.continueToDelivery();
    await expect(checkoutPage.error('zip')).toHaveText('Postal code must be 6 digits');

    await checkoutPage.fillAddress({ country: 'UK', state: 'England', zip: 'SW1A 1AA' });
    await checkoutPage.continueToDelivery();
    await expect(checkoutPage.page).toHaveURL('/checkout/delivery');
  });

  test('payment: card formatting, brand detection and validation', async ({ page, checkoutPage }) => {
    await checkoutPage.goto();
    await checkoutPage.fillAddress();
    await checkoutPage.continueToDelivery();
    await checkoutPage.continueToPayment();
    const card = checkoutPage.field('Card number');
    await card.pressSequentially('4242424242424242');
    await expect(card).toHaveValue('4242 4242 4242 4242');
    await expect(page.getByTestId('card-brand')).toHaveText('Visa');
    await checkoutPage.field('Expiry (MM/YY)').pressSequentially('1230');
    await expect(checkoutPage.field('Expiry (MM/YY)')).toHaveValue('12/30');

    await checkoutPage.fillPayment({ cardNumber: CARDS.invalidLuhn, expiry: '01/20', cvv: '1', cardName: ' ' });
    await checkoutPage.continueToReview();
    await expect(checkoutPage.error('cardNumber')).toHaveText('Enter a valid card number');
    await expect(checkoutPage.error('expiry')).toHaveText('Card has expired');
    await expect(checkoutPage.error('cvv')).toHaveText('CVV must be 3 or 4 digits');
    await expect(checkoutPage.error('cardName')).toHaveText('Name on card is required');
  });

  test('test-card helper fills the card number', async ({ page, checkoutPage }) => {
    await checkoutPage.goto();
    await checkoutPage.fillAddress();
    await checkoutPage.continueToDelivery();
    await checkoutPage.continueToPayment();
    await page.getByText('Test cards', { exact: true }).click();
    await page.getByTestId('use-card-4000002760003184').click();
    await expect(checkoutPage.field('Card number')).toHaveValue(CARDS.threeDS);
    await expect(checkoutPage.field('Expiry (MM/YY)')).toBeFocused();
  });

  test('terms must be accepted', async ({ checkoutPage }) => {
    await checkoutPage.completeAllSteps();
    await checkoutPage.placeOrder({ acceptTerms: false });
    await expect(checkoutPage.error('terms')).toHaveText('You must accept the terms of sale');
  });

  test('step guards: skipping ahead or an empty cart redirects', async ({ page, api }) => {
    await page.goto('/checkout/payment');
    await expect(page).toHaveURL('/checkout/address');
    await api.delete('/cart');
    await page.goto('/checkout/address');
    await expect(page).toHaveURL('/cart');
  });

  test('reloading the review step forgets the card (security) and returns to Payment', async ({ page, checkoutPage }) => {
    await checkoutPage.completeAllSteps();
    await page.reload();
    await expect(page).toHaveURL('/checkout/payment');
    await expect(checkoutPage.toast('Please re-enter your payment details')).toBeVisible();
    await expect(checkoutPage.field('Card number')).toHaveValue('');
  });

  test('delivery choice updates the summary', async ({ checkoutPage }) => {
    await checkoutPage.goto();
    await checkoutPage.fillAddress();
    await checkoutPage.continueToDelivery();
    await checkoutPage.chooseDelivery('nextday');
    await expect(checkoutPage.page.getByTestId('summary-shipping')).toHaveText('$24.99');
    await expect(checkoutPage.summaryTotal).toHaveText(`$${(mug.price + 24.99 + mug.price * 0.08).toFixed(2)}`);
  });
});

test.describe('Payments', () => {
  test.beforeEach(async ({ api }) => { await api.addToCart(book.id); });

  test('declined card shows an error; retry with a good card succeeds', async ({ page, checkoutPage }) => {
    await checkoutPage.completeAllSteps(CARDS.declined);
    await checkoutPage.placeOrder();
    await expect(checkoutPage.paymentError).toContainText('Payment failed: Your card was declined');
    await page.getByRole('link', { name: 'Use a different card' }).click();
    await checkoutPage.fillPayment({ cardNumber: CARDS.success });
    await checkoutPage.continueToReview();
    await checkoutPage.placeOrder();
    await expect(page.getByTestId('order-success')).toBeVisible();
  });

  test('insufficient funds', async ({ checkoutPage }) => {
    await checkoutPage.completeAllSteps(CARDS.insufficientFunds);
    await checkoutPage.placeOrder();
    await expect(checkoutPage.page.getByTestId('payment-error-message')).toHaveText('Insufficient funds');
  });

  test('3-D Secure: enter the code inside the bank iframe', async ({ page, checkoutPage }) => {
    await checkoutPage.completeAllSteps(CARDS.threeDS);
    await checkoutPage.placeOrder();
    const bank = checkoutPage.threeDSFrame;
    await expect(page.getByRole('dialog', { name: 'Verify your payment' })).toBeVisible();
    await expect(bank.getByTestId('3ds-amount')).toHaveText(await checkoutPage.summaryTotal.innerText());
    await bank.getByLabel('One-time passcode').fill('000000');
    await bank.getByRole('button', { name: 'Verify' }).click();
    await expect(bank.getByRole('alert')).toHaveText('Incorrect verification code (2 attempts left)');
    await bank.getByLabel('One-time passcode').fill(THREE_DS_CODE);
    await bank.getByRole('button', { name: 'Verify' }).click();
    await expect(page).toHaveURL(/\/checkout\/complete\/ORD-/);
  });

  test('3-D Secure: cancelling fails the payment', async ({ checkoutPage }) => {
    await checkoutPage.completeAllSteps(CARDS.threeDS);
    await checkoutPage.placeOrder();
    await checkoutPage.threeDSFrame.getByRole('button', { name: 'Cancel payment' }).click();
    await expect(checkoutPage.paymentError).toContainText('Payment authentication was cancelled');
  });

  test('place order cannot be double-submitted', async ({ page, checkoutPage, api }) => {
    await checkoutPage.completeAllSteps();
    // slow the request down so a second click would land while the first is in flight
    await page.route('**/api/checkout', route => route.continue({ headers: { ...route.request().headers(), 'x-shoplab-latency': '1500' } }));
    await page.getByRole('checkbox', { name: /I agree/ }).check();
    await checkoutPage.placeOrderButton.dblclick(); // impatient customer
    await expect(page.getByRole('button', { name: 'Processing payment…' })).toBeDisabled();
    await expect(page.getByTestId('order-success')).toBeVisible();
    expect(await (await api.get('/orders')).json()).toHaveLength(1);
  });

  test('server-side validation errors are listed (mocked 422)', async ({ page, checkoutPage }) => {
    await checkoutPage.completeAllSteps();
    await page.route('**/api/checkout', route => route.fulfill({ status: 422, json: { error: 'Validation failed', fields: { zip: 'Postal code must be 6 digits', cvv: 'CVV must be 3 or 4 digits' } } }));
    await checkoutPage.placeOrder();
    await expect(checkoutPage.paymentError.getByRole('listitem')).toHaveText(['Postal code must be 6 digits', 'CVV must be 3 or 4 digits']);
    await expect(checkoutPage.paymentError.getByRole('link', { name: 'Edit address' })).toBeVisible();
  });
});

test('coupon applied in the cart carries into checkout', async ({ api, checkoutPage, page }) => {
  await api.addToCart(book.id, 2);
  await api.post('/cart/coupon', { code: COUPONS.percent10 });
  await checkoutPage.goto();
  await expect(page.getByTestId('summary-discount')).toHaveText('−$5.00');
});
