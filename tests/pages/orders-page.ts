import { type Locator, type Page } from '@playwright/test';
import { BasePage } from './base-page';

export class OrdersPage extends BasePage {
  readonly rows: Locator;
  readonly empty: Locator;
  constructor(page: Page) {
    super(page);
    this.rows = page.getByTestId('order-row');
    this.empty = page.getByTestId('orders-empty');
  }
  async goto(status?: string) { await this.page.goto(status ? `/orders?status=${status}` : '/orders'); }
  row(orderId: string) { return this.rows.filter({ hasText: orderId }); }
}

export class OrderDetailPage extends BasePage {
  readonly heading: Locator;
  readonly status: Locator;
  readonly cancelButton: Locator;
  readonly invoiceLink: Locator;
  readonly buyAgain: Locator;
  readonly timeline: Locator;
  readonly total: Locator;
  constructor(page: Page) {
    super(page);
    this.heading = page.getByTestId('order-heading');
    this.status = page.locator('.page-head').getByTestId('order-status');
    this.cancelButton = page.getByRole('button', { name: 'Cancel order' });
    this.invoiceLink = page.getByRole('link', { name: /Invoice/ });
    this.buyAgain = page.getByRole('button', { name: 'Buy again' });
    this.timeline = page.getByTestId('order-timeline');
    this.total = page.getByTestId('order-total');
  }
  async goto(orderId: string) { await this.page.goto(`/orders/${orderId}`); }
  step(status: string) { return this.page.getByTestId(`timeline-${status.toLowerCase()}`); }
}
