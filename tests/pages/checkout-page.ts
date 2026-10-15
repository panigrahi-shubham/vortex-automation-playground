import { expect, type FrameLocator, type Locator, type Page } from '@playwright/test';
import { BasePage } from './base-page';
import { ADDRESS, PAYMENT } from '../support/test-data';

type Address = typeof ADDRESS;
type Payment = ReturnType<typeof PAYMENT>;
const COUNTRY_NAMES: Record<string, string> = { IN: 'India', US: 'United States', UK: 'United Kingdom' };

/** One class for the 4-step wizard: /checkout/address → delivery → payment → review. */
export class CheckoutPage extends BasePage {
  readonly steps: Locator;
  readonly placeOrderButton: Locator;
  readonly paymentError: Locator;
  readonly summaryTotal: Locator;
  readonly threeDSFrame: FrameLocator;

  constructor(page: Page) {
    super(page);
    this.steps = page.getByRole('list', { name: 'Checkout progress' });
    this.placeOrderButton = page.getByRole('button', { name: /Place order/ });
    this.paymentError = page.getByTestId('payment-error');
    this.summaryTotal = page.getByTestId('summary-total');
    this.threeDSFrame = page.frameLocator('[data-testid="three-ds-frame"]');
  }

  currentStep() { return this.steps.locator('[aria-current="step"]'); }
  field(label: string) { return this.page.getByLabel(label, { exact: true }); }
  error(testid: string) { return this.page.getByTestId(`${testid}-error`); }

  async goto() { await this.page.goto('/checkout'); }

  async fillAddress(a: Partial<Address> = ADDRESS) {
    const v = { ...ADDRESS, ...a };
    await this.field('Full name').fill(v.fullName);
    await this.field('Phone').fill(v.phone);
    await this.field('Address line 1').fill(v.line1);
    await this.field('City').fill(v.city);
    if (v.country) await this.field('Country').selectOption({ label: COUNTRY_NAMES[v.country] });
    if (v.state) await this.field('State / region').selectOption(v.state);
    await this.field('Postal code').fill(v.zip);
  }
  async continueToDelivery() { await this.page.getByRole('button', { name: 'Continue to delivery' }).click(); }
  async chooseDelivery(id: 'standard' | 'express' | 'nextday') {
    const res = this.page.waitForResponse('**/api/cart/shipping');
    await this.page.getByTestId(`delivery-${id}`).click();
    await res;
  }
  async continueToPayment() { await this.page.getByRole('button', { name: 'Continue to payment' }).click(); }
  async fillPayment(p: Partial<Payment> = PAYMENT()) {
    const v = { ...PAYMENT(), ...p };
    await this.field('Card number').fill(v.cardNumber);
    await this.field('Expiry (MM/YY)').fill(v.expiry);
    await this.field('CVV').fill(v.cvv);
    await this.field('Name on card').fill(v.cardName);
  }
  async continueToReview() { await this.page.getByRole('button', { name: 'Review order' }).click(); }
  async placeOrder({ acceptTerms = true } = {}) {
    if (acceptTerms) await this.page.getByRole('checkbox', { name: /I agree to the terms of sale/ }).check();
    await this.placeOrderButton.click();
  }

  /** Address → Delivery → Payment → Review in one go. */
  async completeAllSteps(card?: string) {
    await this.goto();
    await this.fillAddress();
    await this.continueToDelivery();
    await expect(this.page).toHaveURL(/\/checkout\/delivery$/);
    await this.continueToPayment();
    await this.fillPayment(card ? { cardNumber: card } : {});
    await this.continueToReview();
    await expect(this.page).toHaveURL(/\/checkout\/review$/);
  }
}
