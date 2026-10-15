import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from './base-page';
import { money } from '../support/test-data';

export class ShopPage extends BasePage {
  readonly search: Locator;
  readonly sort: Locator;
  readonly pageSize: Locator;
  readonly cards: Locator;
  readonly resultsCount: Locator;
  readonly emptyState: Locator;
  readonly errorState: Locator;
  readonly pageInfo: Locator;
  readonly next: Locator;
  readonly prev: Locator;
  readonly grid: Locator;

  constructor(page: Page) {
    super(page);
    this.search = page.getByRole('searchbox', { name: 'Search products' });
    this.sort = page.getByLabel('Sort by');
    this.pageSize = page.getByLabel('Show');
    this.grid = page.getByTestId('product-grid');
    this.cards = page.getByTestId('product-card');
    this.resultsCount = page.getByTestId('results-count');
    this.emptyState = page.getByTestId('empty-results');
    this.errorState = page.getByTestId('error-state');
    this.pageInfo = page.getByTestId('page-info');
    this.next = page.getByRole('button', { name: 'Next page' });
    this.prev = page.getByRole('button', { name: 'Previous page' });
  }

  async goto(query = '') {
    await this.page.goto(`/shop${query ? `?${query}` : ''}`);
    await this.waitForGrid();
  }
  /** The grid flips aria-busy=false once products (or an empty/error state) are rendered. */
  async waitForGrid() { await expect(this.grid).toHaveAttribute('aria-busy', 'false'); }

  card(name: string) { return this.cards.filter({ has: this.page.getByTestId('product-name').getByText(name, { exact: true }) }); }

  async searchFor(term: string) {
    await this.search.fill(term);
    await this.search.press('Enter');
    await this.waitForGrid();
  }
  async filterCategory(name: string) {
    await this.page.getByRole('checkbox', { name }).check();
    await this.waitForGrid();
  }
  async sortBy(label: string) {
    await this.sort.selectOption({ label });
    await this.waitForGrid();
  }
  async addToCart(name: string) {
    await this.card(name).getByRole('button', { name: `Add ${name} to cart` }).click();
  }
  async names() { return this.cards.getByTestId('product-name').allInnerTexts(); }
  async prices() { return (await this.cards.getByTestId('product-price').allInnerTexts()).map(t => money(t.split('$').filter(Boolean)[0])); }
  async count() { return Number((await this.resultsCount.innerText()).split(' ')[0]); }
}
