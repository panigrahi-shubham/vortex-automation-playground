import { type Locator, type Page } from '@playwright/test';
import { BasePage } from './base-page';

export class AccountPage extends BasePage {
  readonly name: Locator;
  readonly email: Locator;
  readonly phone: Locator;
  readonly save: Locator;
  readonly heading: Locator;
  constructor(page: Page) {
    super(page);
    this.name = page.getByLabel('Full name');
    this.email = page.getByLabel('Email');
    this.phone = page.getByLabel('Phone (optional)');
    this.save = page.getByRole('button', { name: 'Save changes' });
    this.heading = page.getByTestId('account-name');
  }
  async goto(tab: 'profile' | 'security' | 'avatar' = 'profile') { await this.page.goto(`/account/${tab}`); }
  async changePassword(current: string, next: string, confirm = next) {
    await this.page.getByLabel('Current password').fill(current);
    await this.page.getByLabel('New password', { exact: true }).fill(next);
    await this.page.getByLabel('Confirm new password').fill(confirm);
    await this.page.getByRole('button', { name: 'Update password' }).click();
  }
}

export class AdminPage extends BasePage {
  readonly productRows: Locator;
  readonly filter: Locator;
  readonly addProduct: Locator;
  readonly modal: Locator;
  constructor(page: Page) {
    super(page);
    this.productRows = page.getByTestId('admin-product-row');
    this.filter = page.getByRole('searchbox', { name: 'Filter products' });
    this.addProduct = page.getByRole('button', { name: '+ Add product' });
    this.modal = page.getByRole('dialog');
  }
  async goto(tab: '' | 'products' | 'orders' | 'users' = '') { await this.page.goto(`/admin${tab ? `/${tab}` : ''}`); }
  row(text: string) { return this.productRows.filter({ hasText: text }); }
  async fillProduct(p: { name?: string; category?: string; price?: string; stock?: string }) {
    if (p.name !== undefined) await this.modal.getByLabel('Name').fill(p.name);
    if (p.category !== undefined) await this.modal.getByLabel('Category').selectOption(p.category);
    if (p.price !== undefined) await this.modal.getByLabel('Price ($)').fill(p.price);
    if (p.stock !== undefined) await this.modal.getByLabel('Stock').fill(p.stock);
  }
}
