import { type Locator, type Page } from '@playwright/test';
import { BasePage } from './base-page';

export class LoginPage extends BasePage {
  readonly username: Locator;
  readonly password: Locator;
  readonly rememberMe: Locator;
  readonly submit: Locator;
  readonly error: Locator;
  readonly notice: Locator;

  constructor(page: Page) {
    super(page);
    this.username = page.getByLabel('Username or email');
    this.password = page.getByLabel('Password', { exact: true });
    this.rememberMe = page.getByLabel('Remember me for 7 days');
    this.submit = page.getByRole('button', { name: 'Sign in' });
    this.error = page.getByTestId('login-error');
    this.notice = page.getByTestId('login-notice');
  }

  async goto(returnTo?: string) {
    await this.page.goto(returnTo ? `/login?returnTo=${encodeURIComponent(returnTo)}` : '/login');
  }

  async login(username: string, password: string, { remember = false } = {}) {
    await this.username.fill(username);
    await this.password.fill(password);
    if (remember) await this.rememberMe.check();
    await this.submit.click();
  }
}
