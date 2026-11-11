import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '../support/fixtures';

test.use({ authAs: 'guest' });

test('Three.js viewer supports finish selection, keyboard rotation, reset, and route cleanup', async ({ page }) => {
  await page.goto('/showroom');
  await page.getByTestId('vortex-studio-load').click();
  await expect(page.getByTestId('vortex-studio-canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Clay finish', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Clay finish', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const rotation = page.getByTestId('vortex-studio-rotation');
  await rotation.focus();
  await page.keyboard.press('End');
  await expect(rotation).toHaveValue('360');
  await page.getByTestId('vortex-studio-reset').click();
  await expect(rotation).toHaveValue('25');
  await expect(page.getByRole('button', { name: 'Forest finish', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(scan.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))).toEqual([]);
  await page.getByTestId('nav-shop').click();
  await expect(page.getByTestId('product-card').first()).toBeVisible();
  await expect(page.getByTestId('vortex-studio-canvas')).toHaveCount(0);
});

test('WebGL failure keeps the product photo and a useful retry message', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: Parameters<typeof original>) {
      if (String(args[0]).startsWith('webgl')) return null;
      return Reflect.apply(original, this, args);
    } as typeof original;
  });
  await page.goto('/showroom');
  await page.getByTestId('vortex-studio-load').click();
  await expect(page.getByTestId('vortex-studio-status')).toContainText('unavailable in this browser');
  await expect(page.getByTestId('vortex-studio-stage').getByRole('img')).toBeVisible();
  await expect(page.getByTestId('vortex-studio-rotation')).toBeDisabled();
  for (const button of await page.getByTestId('vortex-studio-controls').getByRole('button').all()) await expect(button).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Try 3D again' })).toBeEnabled();
});

test('storefront images load on mobile without widening the page', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/shop');
  await expect(page.getByTestId('product-card')).toHaveCount(12);
  const images = page.getByTestId('product-card').locator('img.vortex-product-photo');
  await expect(images).toHaveCount(12);
  for (const image of await images.all()) {
    await image.scrollIntoViewIfNeeded();
    await expect(image).toHaveJSProperty('complete', true);
    expect(await image.evaluate(node => (node as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
