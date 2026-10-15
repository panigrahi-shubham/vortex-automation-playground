import { test, expect, ShopApi } from '../support/fixtures';
import { PRODUCTS } from '../support/test-data';

type Product = { id: number; name: string; category: string; price: number; stock: number; rating: number };

test.describe('GET /api/products', () => {
  test('response shape (lightweight schema check)', async ({ guestApi }) => {
    const res = await guestApi.get('/products', { limit: 5 });
    expect(res.headers()['x-total-count']).toBeDefined();
    const body = await ShopApi.ok(res);
    expect(body).toEqual({ total: expect.any(Number), page: 1, pages: expect.any(Number), limit: 5, items: expect.any(Array) });
    for (const p of body.items) {
      expect(p).toMatchObject({ id: expect.any(Number), sku: expect.stringMatching(/^SL-[A-Z]{3}-\d{3}$/), name: expect.any(String), category: expect.any(String), price: expect.any(Number), stock: expect.any(Number) });
    }
  });

  test('filters combine: category list + price range + inStock + minRating', async ({ guestApi }) => {
    const body = await ShopApi.ok(await guestApi.get('/products', { category: 'Books,Toys', minPrice: 15, maxPrice: 40, inStock: true, minRating: 3, limit: 50 }));
    expect(body.items.length).toBeGreaterThan(0);
    for (const p of body.items as Product[]) {
      expect(['Books', 'Toys']).toContain(p.category);
      expect(p.price).toBeGreaterThanOrEqual(15);
      expect(p.price).toBeLessThanOrEqual(40);
      expect(p.stock).toBeGreaterThan(0);
      expect(p.rating).toBeGreaterThanOrEqual(3);
    }
  });

  for (const [sort, cmp] of [
    ['price_asc', (a: Product, b: Product) => a.price - b.price],
    ['price_desc', (a: Product, b: Product) => b.price - a.price],
    ['name_asc', (a: Product, b: Product) => a.name.localeCompare(b.name)],
    ['name_desc', (a: Product, b: Product) => b.name.localeCompare(a.name)]
  ] as const) {
    test(`sort=${sort}`, async ({ guestApi }) => {
      const { items } = await ShopApi.ok(await guestApi.get('/products', { sort, limit: 50 }));
      expect(items).toEqual([...items].sort(cmp));
    });
  }

  test('pagination covers every product exactly once', async ({ guestApi }) => {
    const first = await ShopApi.ok(await guestApi.get('/products', { limit: 7 }));
    const ids: number[] = [];
    for (let page = 1; page <= first.pages; page++) {
      ids.push(...(await ShopApi.ok(await guestApi.get('/products', { limit: 7, page }))).items.map((p: Product) => p.id));
    }
    expect(ids).toHaveLength(first.total);
    expect(new Set(ids).size).toBe(first.total);
  });

  for (const [params, error] of [
    [{ sort: 'cheapest' }, 'Invalid sort. Use one of: price_asc, price_desc, name_asc, name_desc, rating, newest'],
    [{ limit: 0 }, 'limit must be between 1 and 50'],
    [{ limit: 51 }, 'limit must be between 1 and 50'],
    [{ page: -1 }, 'page must be a positive integer'],
    [{ page: 'two' }, 'page must be a positive integer']
  ] as const) {
    test(`400 for ${JSON.stringify(params)}`, async ({ guestApi }) => {
      const res = await guestApi.get('/products', params as Record<string, string | number>);
      expect(res.status()).toBe(400);
      expect((await res.json()).error).toBe(error);
    });
  }
});

test.describe('GET /api/products/:id', () => {
  test('known product', async ({ guestApi }) => {
    expect(await ShopApi.ok(await guestApi.get(`/products/${PRODUCTS.hoodie.id}`))).toMatchObject({
      name: PRODUCTS.hoodie.name, variants: { size: PRODUCTS.hoodie.sizes, color: PRODUCTS.hoodie.colors }
    });
  });
  test('404 and 400', async ({ guestApi }) => {
    expect((await guestApi.get('/products/9999')).status()).toBe(404);
    expect((await guestApi.get('/products/abc')).status()).toBe(400);
  });
});

test.describe('reviews', () => {
  test('post a review, rating average updates, second review is 409', async ({ api, guestApi }) => {
    const id = PRODUCTS.headphones.id;
    const before = await ShopApi.ok(await guestApi.get(`/products/${id}/reviews`));
    const created = await ShopApi.ok(await api.post(`/products/${id}/reviews`, { rating: 5, title: 'Great', body: 'Really blocks out the open-plan office.' }), 201);
    expect(created).toMatchObject({ rating: 5, productId: id });
    const product = await ShopApi.ok(await guestApi.get(`/products/${id}`));
    expect(product.reviewCount).toBeGreaterThanOrEqual(before.length + 1);
    expect((await api.post(`/products/${id}/reviews`, { rating: 1, title: 'Again', body: 'Second attempt at a review' })).status()).toBe(409);
  });
  test('422 with field errors', async ({ api }) => {
    const res = await api.post(`/products/1/reviews`, { rating: 6, title: 'x', body: 'short' });
    expect(res.status()).toBe(422);
    expect(Object.keys((await res.json()).fields)).toEqual(['rating', 'title', 'body']);
  });
});

test.describe('wishlist', () => {
  test('add, duplicate 409, list, remove, remove-again 404', async ({ api }) => {
    expect((await api.post('/wishlist', { productId: 3 })).status()).toBe(201);
    expect((await api.post('/wishlist', { productId: 3 })).status()).toBe(409);
    expect((await api.post('/wishlist', { productId: 999 })).status()).toBe(404);
    expect((await ShopApi.ok<Product[]>(await api.get('/wishlist'))).map(p => p.id)).toEqual([3]);
    expect((await api.delete('/wishlist/3')).status()).toBe(200);
    expect((await api.delete('/wishlist/3')).status()).toBe(404);
  });
});

test('categories and meta', async ({ guestApi }) => {
  const cats = await ShopApi.ok(await guestApi.get('/categories'));
  expect(cats.map((c: { name: string }) => c.name)).toEqual(['Electronics', 'Books', 'Home', 'Toys', 'Fashion']);
  const meta = await ShopApi.ok(await guestApi.get('/meta'));
  expect(meta.shipping.map((s: { id: string }) => s.id)).toEqual(['standard', 'express', 'nextday']);
  expect(meta.countries.map((c: { code: string }) => c.code)).toEqual(['IN', 'US', 'UK']);
});
