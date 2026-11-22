import { test, expect } from '../support/fixtures';

test.use({ authAs: 'guest' });

test('filters and pages the GraphQL catalog and rejects a mutation', async ({ page, apiContext }) => {
  await page.goto('/lab/graphql');
  const result = page.waitForResponse(response => response.url().endsWith('/api/graphql'));
  await page.getByRole('button', { name: 'Run GraphQL query' }).click();
  const data = await (await result).json();
  expect(data.errors).toBeUndefined();
  expect(data.data.products.length).toBeGreaterThan(0);
  for (const product of data.data.products) {
    expect(Object.keys(product)).toEqual(['name', 'category', 'price']);
    expect(product.name).toMatch(/keyboard/i);
  }
  await expect(page.getByTestId('vortex-graphql-result')).toContainText(data.data.products[0].name);

  const catalog = await apiContext.post('/api/graphql', {
    data: { query: '{ first: products(limit: 1) { id } next: products(offset: 1, limit: 1) { id } categories(limit: 2) { name count } reviews(productId: 1, limit: 1) { rating } }' },
  });
  const body = await catalog.json();
  expect(body.errors).toBeUndefined();
  expect(body.data.first[0].id).not.toBe(body.data.next[0].id);
  expect(body.data.categories).toHaveLength(2);
  expect(body.data.reviews).toHaveLength(1);

  const mutation = await apiContext.post('/api/graphql', { data: { query: 'mutation { removeProduct(id: 1) }' } });
  expect((await mutation.json()).errors[0].message).toContain('mutation');
});
