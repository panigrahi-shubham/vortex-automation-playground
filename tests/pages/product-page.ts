import { type Locator, type Page } from '@playwright/test';
import { BasePage } from './base-page';

export class ProductPage extends BasePage {
  readonly title: Locator;
  readonly price: Locator;
  readonly stock: Locator;
  readonly qty: Locator;
  readonly increase: Locator;
  readonly decrease: Locator;
  readonly addToCartButton: Locator;
  readonly wishlistButton: Locator;
  readonly colour: Locator;
  readonly sizeError: Locator;
  readonly colourError: Locator;
  readonly reviews: Locator;

  constructor(page: Page) {
    super(page);
    this.title = page.getByTestId('product-title');
    this.price = page.getByTestId('product-detail').getByTestId('product-price');
    this.stock = page.getByTestId('product-detail').getByTestId('stock-status');
    this.qty = page.getByLabel('Quantity', { exact: true }); // exact: the +/- buttons are labelled "Increase quantity" etc.
    this.increase = page.getByRole('button', { name: 'Increase quantity' });
    this.decrease = page.getByRole('button', { name: 'Decrease quantity' });
    this.addToCartButton = page.getByTestId('product-detail').getByTestId('add-to-cart');
    this.wishlistButton = page.getByTestId('product-detail').getByTestId('wishlist-toggle');
    this.colour = page.getByLabel('Colour');
    this.sizeError = page.getByTestId('size-error');
    this.colourError = page.getByTestId('color-select-error');
    this.reviews = page.getByTestId('review');
  }

  async goto(id: number) { await this.page.goto(`/product/${id}`); }
  async chooseSize(size: string) { await this.page.getByRole('radiogroup', { name: 'Size' }).getByText(size, { exact: true }).click(); }
  async chooseColour(colour: string) { await this.colour.selectOption(colour); }
  async openTab(name: RegExp | string) { await this.page.getByRole('tab', { name }).click(); }

  async writeReview(stars: number, title: string, body: string) {
    await this.openTab(/Reviews/);
    const form = this.page.getByTestId('review-form');
    await form.getByLabel(`${stars} star${stars > 1 ? 's' : ''}`, { exact: true }).check({ force: true });
    await form.getByLabel('Title').fill(title);
    await form.getByLabel('Review').fill(body);
    await form.getByRole('button', { name: 'Submit review' }).click();
  }
}
