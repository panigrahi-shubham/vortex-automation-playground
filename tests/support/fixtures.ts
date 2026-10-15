import { test as base, expect, type APIRequestContext } from '@playwright/test';
import { ShopApi, type TestUser } from './shop-api';
import { PASSWORD, USERS } from './test-data';
import { BasePage } from '../pages/base-page';
import { LoginPage } from '../pages/login-page';
import { ShopPage } from '../pages/shop-page';
import { ProductPage } from '../pages/product-page';
import { CartPage } from '../pages/cart-page';
import { CheckoutPage } from '../pages/checkout-page';
import { OrdersPage, OrderDetailPage } from '../pages/orders-page';
import { AccountPage, AdminPage } from '../pages/account-admin-pages';

type Options = {
  /** 'user' (default): the page starts signed in as a brand-new user. 'guest': signed out. */
  authAs: 'user' | 'guest';
};
type Fixtures = {
  apiContext: APIRequestContext;
  user: TestUser;
  api: ShopApi;          // signed in as `user`
  adminApi: ShopApi;     // signed in as admin_user
  guestApi: ShopApi;     // no token
  app: BasePage;
  loginPage: LoginPage;
  shopPage: ShopPage;
  productPage: ProductPage;
  cartPage: CartPage;
  checkoutPage: CheckoutPage;
  ordersPage: OrdersPage;
  orderPage: OrderDetailPage;
  accountPage: AccountPage;
  adminPage: AdminPage;
};

export const test = base.extend<Options & Fixtures>({
  authAs: ['user', { option: true }],

  // Our own API context: the built-in `request` fixture also consumes `storageState`,
  // which we override below using `user` — so seeding must not depend on `request`.
  apiContext: async ({ playwright, baseURL }, use) => {
    const ctx = await playwright.request.newContext({ baseURL });
    await use(ctx);
    await ctx.dispose();
  },
  // Every test gets its own freshly registered user → its own cart, wishlist and orders.
  // That is what makes the whole suite safe to run fully parallel against one server.
  user: async ({ apiContext }, use) => {
    await use(await new ShopApi(apiContext).createUser());
  },
  api: async ({ apiContext, user }, use) => use(new ShopApi(apiContext, user.token)),
  adminApi: async ({ apiContext }, use) => {
    const a = new ShopApi(apiContext);
    await a.login(USERS.admin, PASSWORD);
    await use(a);
  },
  guestApi: async ({ apiContext }, use) => use(new ShopApi(apiContext)),

  // Pre-seed localStorage through storageState: cookie banner dismissed + (optionally) the auth token.
  storageState: async ({ authAs, user, baseURL }, use) => {
    const localStorage = [{ name: 'shoplab.cookies', value: 'accepted' }];
    if (authAs === 'user') {
      localStorage.push({ name: 'shoplab.token', value: user.token }, { name: 'shoplab.user', value: JSON.stringify(user.profile) });
    }
    await use({ cookies: [], origins: [{ origin: new URL(baseURL!).origin, localStorage }] });
  },

  app: async ({ page }, use) => use(new BasePage(page)),
  loginPage: async ({ page }, use) => use(new LoginPage(page)),
  shopPage: async ({ page }, use) => use(new ShopPage(page)),
  productPage: async ({ page }, use) => use(new ProductPage(page)),
  cartPage: async ({ page }, use) => use(new CartPage(page)),
  checkoutPage: async ({ page }, use) => use(new CheckoutPage(page)),
  ordersPage: async ({ page }, use) => use(new OrdersPage(page)),
  orderPage: async ({ page }, use) => use(new OrderDetailPage(page)),
  accountPage: async ({ page }, use) => use(new AccountPage(page)),
  adminPage: async ({ page }, use) => use(new AdminPage(page))
});

export { expect, ShopApi };
