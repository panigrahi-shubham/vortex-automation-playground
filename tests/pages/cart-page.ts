import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from './base-page';
import { money } from '../support/test-data';

export class CartPage extends BasePage {
  readonly items: Locator;
  readonly empty: Locator;
  readonly couponInput: Locator;
  readonly applyCoupon: Locator;
  readonly couponError: Locator;
  readonly couponApplied: Locator;
  readonly checkoutButton: Locator;
  readonly summary: Locator;

  constructor(page: Page) {
    super(page);
    this.items = page.getByTestId('cart-item');
    this.empty = page.getByTestId('cart-empty');
    this.couponInput = page.getByLabel('Coupon code');
    this.applyCoupon = page.getByRole('button', { name: 'Apply' });
    this.couponError = page.getByTestId('coupon-error');
    this.couponApplied = page.getByTestId('coupon-applied');
    this.checkoutButton = page.getByRole('link', { name: 'Proceed to checkout' });
    this.summary = page.getByTestId('order-summary');
  }

  async goto() {
    await this.page.goto('/cart');
    await expect(this.items.first().or(this.empty)).toBeVisible();
  }
  item(name: string) { return this.items.filter({ has: this.page.getByTestId('cart-item-name').getByText(name, { exact: true }) }); }
  qtyOf(name: string) { return this.page.getByLabel(`Quantity of ${name}`, { exact: true }); }

  async setQty(name: string, qty: number) {
    const res = this.page.waitForResponse(r => r.url().includes('/api/cart/') && r.request().method() === 'PATCH');
    await this.qtyOf(name).fill(String(qty));
    await this.qtyOf(name).press('Tab');
    await res;
  }
  async increase(name: string) { await this.page.getByRole('button', { name: `Increase quantity of ${name}` }).click(); }
  async remove(name: string) { await this.page.getByRole('button', { name: `Remove ${name}` }).click(); }
  async apply(code: string) {
    await this.couponInput.fill(code);
    await this.applyCoupon.click();
  }
  async chooseShipping(label: RegExp | string) { await this.page.getByRole('radio', { name: label }).check(); }

  /** Reads the order summary as numbers: { subtotal, discount, shipping, tax, total }. */
  async totals() {
    const read = async (id: string) => (await this.page.getByTestId(id).count()) ? money(await this.page.getByTestId(id).innerText()) : 0;
    const shippingText = await this.page.getByTestId('shipping').innerText();
    return {
      subtotal: await read('subtotal'), discount: await read('discount'),
      shipping: shippingText === 'Free' ? 0 : money(shippingText), tax: await read('tax'), total: await read('total')
    };
  }
}
