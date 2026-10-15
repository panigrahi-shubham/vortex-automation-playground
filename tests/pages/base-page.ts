import { expect, type Locator, type Page } from '@playwright/test';

/** Header, toasts and other chrome that every page shares. */
export class BasePage {
  readonly cartBadge: Locator;
  readonly wishlistBadge: Locator;
  readonly userMenu: Locator;
  readonly signedInAs: Locator;
  readonly toasts: Locator;
  readonly loader: Locator;
  readonly mainNav: Locator;

  constructor(readonly page: Page) {
    this.cartBadge = page.getByTestId('cart-badge');
    this.wishlistBadge = page.getByTestId('wishlist-count');
    this.userMenu = page.getByTestId('user-menu');
    this.signedInAs = page.getByTestId('signed-in-as');
    this.toasts = page.getByTestId('toast');
    this.loader = page.getByTestId('loader');
    this.mainNav = page.getByRole('navigation', { name: 'Main' });
  }

  toast(text: string | RegExp) { return this.toasts.filter({ hasText: text }); }
  async expectToast(text: string | RegExp) { await expect(this.toast(text).first()).toBeVisible(); }

  async signOut() {
    await this.userMenu.click();
    await this.page.getByRole('menuitem', { name: 'Sign out' }).click();
    await expect(this.page).toHaveURL(/\/login/);
  }
}
