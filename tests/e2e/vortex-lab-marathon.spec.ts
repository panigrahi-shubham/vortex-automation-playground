import { test, expect } from '../support/fixtures';

test.use({ authAs: 'guest' });

test('finish the marathon in order and resume after a reload', async ({ page }) => {
  await page.goto('/lab?level=1');
  await page.getByRole('link', { name: 'Open marathon' }).click();
  const next = page.getByRole('button', { name: 'Next exercise' });
  const progress = page.getByRole('progressbar', { name: 'Marathon progress' });
  const quote = page.getByRole('button', { name: 'Request quote for Desk lamp' });
  await quote.click();
  await expect(progress).toHaveJSProperty('value', 0);
  await page.getByLabel('Show in-stock items only').check();
  await page.getByRole('button', { name: 'Request quote for USB-C dock' }).click();
  await expect(next).toBeHidden();
  await quote.click();
  await expect(next).toBeVisible();
  await page.reload();
  await expect(progress).toHaveJSProperty('value', 1);
  const email = page.getByLabel('Billing email');
  await email.fill('invalid');
  await page.getByRole('button', { name: 'Save billing contact' }).click();
  await expect(page.getByText('Enter a valid billing email.')).toBeVisible();
  await email.fill('buyer@example.com');
  await page.getByRole('button', { name: 'Save billing contact' }).click();
  await next.click();

  await page.getByRole('button', { name: 'How do I track an order?' }).click();
  await page.getByRole('button', { name: 'How do I return an item?' }).click();
  await next.click();
  await page.getByRole('tab', { name: 'Delivery' }).press('ArrowRight');
  await page.getByRole('tab', { name: 'Returns' }).press('ArrowLeft');
  await next.click();
  const input = page.getByLabel('Press any key combination here');
  await input.press('Control+a');
  await input.press('Shift+ArrowDown');
  await next.click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Alert', exact: true }).click();
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  page.once('dialog', dialog => dialog.accept('Asha'));
  await page.getByRole('button', { name: 'Prompt', exact: true }).click();
  await next.click();

  await page.getByRole('button', { name: 'Show toast' }).click();
  await expect(page.getByText('Practice item saved')).toBeVisible();
  await page.getByRole('button', { name: 'View results' }).click();
  await expect(page.getByRole('heading', { name: 'Marathon complete' })).toBeFocused();
  await page.reload();
  await expect(progress).toHaveJSProperty('value', 7);
  await expect(page.getByRole('heading', { name: 'Marathon complete' })).toBeVisible();
  await page.getByRole('link', { name: 'Back to UI Lab' }).click();
  await expect(page.getByLabel('Difficulty')).toHaveValue('1');
});

test('retry clears the current attempt and challenge mode works on a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto('/lab/marathon?challenge=1');
  await expect(page.getByRole('heading', { name: 'Supplier catalog availability' })).toBeInViewport();
  const first = page.getByRole('list', { name: 'Exercise steps' }).getByRole('listitem').first();
  await page.getByLabel('Show in-stock items only').check();
  await expect(first).not.toHaveAttribute('aria-current', 'step');
  await page.getByRole('button', { name: 'Retry exercise' }).click();
  await expect(first).toHaveAttribute('aria-current', 'step');
  await expect(page.getByLabel('Show in-stock items only')).not.toBeChecked();
  await page.getByRole('button', { name: 'Native dialogs' }).click();
  await expect(page.getByRole('button', { name: 'Alert', exact: true })).toBeVisible();
  await expect(page.getByTestId('btn-alert')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('search combines with level and CSS filters and survives a card visit', async ({ page }) => {
  await page.goto('/lab');
  const search = page.getByRole('searchbox', { name: 'Find an exercise' });
  const results = page.getByRole('status', { name: 'Exercise results' });
  await search.fill('supplier');
  await page.getByLabel('Difficulty').selectOption('1');
  await page.getByLabel('CSS examples only').check();
  await expect(results).toHaveText('1 exercise shown');
  await page.getByRole('link', { name: 'Open Supplier catalog availability' }).click();
  await page.getByRole('link', { name: 'Back to all cards' }).click();
  await expect(search).toHaveValue('supplier');
  await expect(results).toHaveText('1 exercise shown');
  await search.fill('nonexistent');
  await expect(results).toContainText('No matching exercises');
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(search).toBeFocused();
  await expect(page.getByLabel('CSS examples only')).not.toBeChecked();
  await expect(page.getByRole('heading', { name: 'Level 3 · Advanced' })).toBeVisible();
});
