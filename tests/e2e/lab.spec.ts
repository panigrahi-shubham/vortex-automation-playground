import fs from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '../support/fixtures';

/** UI Lab: one test per awkward widget. Lab cards are scoped with getByTestId('lab-<name>'). */
test.use({ authAs: 'guest' });
test.beforeEach(async ({ page }) => { await page.goto('/lab'); });
const card = (page: import('@playwright/test').Page, name: string) => page.getByTestId(`lab-${name}`);

test('native alert / confirm / prompt', async ({ page }) => {
  const c = card(page, 'dialogs');
  page.once('dialog', async d => { expect(d.type()).toBe('alert'); expect(d.message()).toBe('Hello from ShopLab!'); await d.accept(); });
  await c.getByRole('button', { name: 'Alert' }).click();
  await expect(c.getByTestId('dialog-result')).toHaveText('Alert dismissed');

  page.once('dialog', d => d.dismiss());
  await c.getByRole('button', { name: 'Confirm' }).click();
  await expect(c.getByTestId('dialog-result')).toHaveText('Confirmed: Cancel');

  page.once('dialog', async d => { expect(d.defaultValue()).toBe('Tester'); await d.accept('Rupesh'); });
  await c.getByRole('button', { name: 'Prompt' }).click();
  await expect(c.getByTestId('dialog-result')).toHaveText('Hello, Rupesh!');
});

test('new tab (target=_blank)', async ({ page, context }) => {
  const [tab] = await Promise.all([context.waitForEvent('page'), card(page, 'windows').getByRole('link', { name: 'Open terms in new tab' }).click()]);
  await tab.waitForLoadState();
  await expect(tab).toHaveTitle('Terms of Service · ShopLab');
  await tab.close();
});

test('popup window talks back to its opener via postMessage', async ({ page }) => {
  const [popup] = await Promise.all([page.waitForEvent('popup'), card(page, 'windows').getByRole('button', { name: 'Open popup window' }).click()]);
  await popup.getByLabel('Message').fill('Hi from Playwright');
  await Promise.all([popup.waitForEvent('close'), popup.getByRole('button', { name: /Send to opener/ }).click()]);
  await expect(page.getByTestId('popup-message')).toHaveText('Popup says: Hi from Playwright');
});

test('nested iframes', async ({ page }) => {
  const outer = page.frameLocator('[data-testid="outer-frame"]');
  await outer.getByRole('button', { name: /Clicked 0 times/ }).click();
  await expect(outer.getByTestId('outer-counter')).toHaveText('Clicked 1 time');
  const inner = outer.frameLocator('[data-testid="inner-frame"]');
  await inner.getByLabel('Your name').fill('Rupesh');
  await inner.getByRole('button', { name: 'Greet' }).click();
  await expect(inner.getByTestId('inner-greeting')).toHaveText('Hello, Rupesh!');
});

test('shadow DOM: open roots are pierced automatically, closed roots are not', async ({ page }) => {
  const c = card(page, 'shadow');
  await c.getByRole('button', { name: '4 stars' }).click();
  await expect(c.getByTestId('shadow-rating-text')).toHaveText('You rated 4/5');
  await expect(c.getByTestId('shadow-host')).toHaveAttribute('value', '4');
  await expect(c.getByTestId('shadow-chip')).toHaveAttribute('part', 'chip'); // element inside a shadow root inside a shadow root
  await expect(c.locator('lab-chip')).toHaveText('shadow-in-shadow'); // slotted text lives in the light DOM
  // closed root: invisible to locators — use the component's public API instead
  await expect(c.getByRole('button', { name: 'Reveal secret' })).toHaveCount(0);
  await c.getByTestId('closed-shadow-host').evaluate((el: HTMLElement & { reveal(): void }) => el.reveal());
  await expect(c.getByTestId('closed-shadow-host')).toHaveAttribute('revealed', 'true');
});

test('drag and drop between kanban columns', async ({ page }) => {
  const c = card(page, 'dnd');
  await c.getByText('Automate login').dragTo(c.getByTestId('col-done'));
  await expect(c.getByTestId('col-done').getByTestId('task')).toHaveText(['Automate login']);
  await expect(c.getByTestId('dnd-result')).toHaveText('Moved “Automate login” to Done');
  await expect(c.getByTestId('col-todo').getByTestId('task')).toHaveCount(2);
});

test('hover menu, tooltip, double-click edit and right-click menu', async ({ page }) => {
  const c = card(page, 'mouse');
  await c.getByRole('button', { name: 'Hover me ▾' }).hover();
  await c.getByRole('menuitem', { name: 'Settings' }).click();
  await expect(c.getByTestId('mouse-result')).toHaveText('Hover menu: Settings');

  await expect(c.getByRole('tooltip')).toBeHidden();
  await c.getByRole('button', { name: 'ⓘ Info' }).hover();
  await expect(c.getByRole('tooltip')).toHaveText('Tooltips only exist on hover');

  await c.getByTestId('dblclick-target').dblclick();
  await c.getByLabel('Edit text').fill('Playwright rocks');
  await c.getByLabel('Edit text').press('Enter');
  await expect(c.getByTestId('mouse-result')).toHaveText('Saved: Playwright rocks');

  await c.getByTestId('context-area').click({ button: 'right' });
  await page.getByTestId('context-menu').getByRole('menuitem', { name: 'Rename' }).click();
  await expect(c.getByTestId('mouse-result')).toHaveText('Context action: Rename');
});

test('draw a signature on a canvas with low-level mouse API', async ({ page }) => {
  const pad = page.getByTestId('signature-pad');
  await pad.scrollIntoViewIfNeeded();
  const box = (await pad.boundingBox())!;
  await page.mouse.move(box.x + 20, box.y + box.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(box.x + 20 + i * 20, box.y + box.height / 2 + (i % 2 ? -20 : 20));
  await page.mouse.up();
  await expect(page.getByTestId('signature-status')).toHaveText('Signed ✓');
});

test('every kind of form control', async ({ page }) => {
  const c = card(page, 'controls');
  await c.getByRole('slider').fill('75');
  await expect(c.getByTestId('range-value')).toHaveText('75');
  await c.getByLabel('Delivery date').fill('2026-12-25');
  await c.getByLabel('Time slot').fill('14:30');
  await c.getByLabel('Brand colour').fill('#ff0000');
  await c.getByLabel('Skills (multi-select)').selectOption(['Playwright', 'Postman']);
  await c.getByRole('radio', { name: '3-5 yrs' }).check();
  await c.getByRole('checkbox', { name: 'Cheese' }).check();
  await c.getByRole('checkbox', { name: 'Olives' }).check();
  const all = c.getByRole('checkbox', { name: 'All toppings' });
  expect(await all.evaluate((el: HTMLInputElement) => el.indeterminate)).toBe(true); // tri-state
  await c.getByRole('combobox', { name: 'City (autocomplete)' }).pressSequentially('ja');
  await expect(c.getByRole('listbox', { name: 'City (autocomplete)' }).getByRole('option')).toHaveText(['Jamshedpur']);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await c.getByRole('textbox', { name: 'Rich text (contenteditable)' }).fill('Hello rich text');
  await c.getByRole('button', { name: 'Show values' }).click();
  const values = JSON.parse(await c.getByTestId('controls-result').innerText());
  expect(values).toEqual({
    volume: 75, date: '2026-12-25', time: '14:30', color: '#ff0000', skills: ['Playwright', 'Postman'],
    experience: '3-5 yrs', toppings: ['Cheese', 'Olives'], city: 'Jamshedpur', richText: 'Hello rich text'
  });
});

test('auto-waiting for dynamic content', async ({ page }) => {
  const c = card(page, 'waits');
  await c.getByRole('button', { name: 'Load data (1–3 s)' }).click();
  await expect(c.getByRole('status', { name: 'Loading data' })).toBeVisible();
  await expect(c.getByTestId('wait-result')).toHaveText('Data loaded ✓', { timeout: 5000 });

  const delayed = c.getByTestId('delayed-button');
  await expect(delayed).toBeEnabled({ timeout: 7000 }); // the click itself would also auto-wait
  await delayed.click();
  await expect(c.getByTestId('delayed-result')).toHaveText('Clicked after waiting ✓');

  await c.getByRole('button', { name: 'Show temporary message' }).click();
  await expect(c.getByTestId('temp-message')).toBeVisible();
  await expect(c.getByTestId('temp-message')).toBeHidden({ timeout: 5000 });

  await c.getByRole('button', { name: 'Start upload' }).click();
  await expect(c.getByRole('progressbar', { name: 'Upload progress' })).toHaveAttribute('aria-valuenow', '100', { timeout: 10_000 });
  await expect(c.getByTestId('progress-text')).toHaveText('Complete!');
});

test('infinite scroll until the end', async ({ page }) => {
  const list = page.getByTestId('infinite-list');
  const items = list.getByTestId('infinite-item');
  await list.scrollIntoViewIfNeeded();
  await expect(items).toHaveCount(20);
  await expect(async () => {
    await items.last().scrollIntoViewIfNeeded();
    await expect(items).toHaveCount(100, { timeout: 1000 });
  }).toPass({ timeout: 15_000 });
  await expect(page.getByTestId('infinite-end')).toHaveText('You reached the end 🎉');
});

test('upload several files and download generated ones', async ({ page }) => {
  const c = card(page, 'files');
  await c.getByLabel('Choose files (multiple)').setInputFiles([
    { name: 'a.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') },
    { name: 'b.csv', mimeType: 'text/csv', buffer: Buffer.from('x,y\n1,2') }
  ]);
  await expect(c.getByTestId('uploaded-file')).toHaveText(['a.txt — 5 bytes', 'b.csv — 7 bytes']);

  const [download] = await Promise.all([page.waitForEvent('download'), c.getByRole('button', { name: '⬇ products.csv' }).click()]);
  expect(download.suggestedFilename()).toBe('products.csv');
  const lines = (await fs.readFile(await download.path(), 'utf8')).split('\n');
  expect(lines[0]).toBe('id,name,category,price,stock');
  expect(lines.length).toBe(41);
});

test('keyboard combinations', async ({ page }) => {
  const input = page.getByLabel('Press any key combination here');
  await input.press('Control+a');
  await expect(page.getByTestId('key-result')).toHaveText('Pressed: Control+a');
  await input.press('Shift+ArrowDown');
  await expect(page.getByTestId('key-result')).toHaveText('Pressed: Shift+ArrowDown');
});

test('clipboard read & write (needs permissions)', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const c = card(page, 'clipboard');
  await c.getByRole('button', { name: 'Copy coupon' }).click();
  await c.getByRole('button', { name: 'Paste from clipboard' }).click();
  await expect(c.getByTestId('clipboard-result')).toHaveText('Clipboard contains: SAVE10');
});

test.describe('geolocation', () => {
  test.use({ geolocation: { latitude: 23.3441, longitude: 85.3096 }, permissions: ['geolocation'] });
  test('finds the nearest store from a mocked position (Ranchi)', async ({ page }) => {
    await card(page, 'geo').getByRole('button', { name: /Find my nearest store/ }).click();
    await expect(page.getByTestId('geo-result')).toContainText('Nearest store: Ranchi (0 km)');
  });
  test('moving the device changes the answer', async ({ page, context }) => {
    await context.setGeolocation({ latitude: 17.44, longitude: 78.45 });
    await card(page, 'geo').getByRole('button', { name: /Find my nearest store/ }).click();
    await expect(page.getByTestId('geo-result')).toContainText('Nearest store: Hyderabad (Ameerpet)');
  });
});

test('control time with page.clock', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-14T08:59:00') });
  await page.goto('/lab');
  // install() lets time keep flowing; pauseAt() freezes it so the assertion can't race a slow machine
  await page.clock.pauseAt(new Date('2026-10-14T09:00:00'));
  await expect(page.getByTestId('clock-now')).toHaveText('09:00:00');
  await page.getByRole('button', { name: 'Start 10-minute timer' }).click();
  await page.clock.fastForward('05:00');
  await expect(page.getByTestId('timer-remaining')).toHaveText('05:00');
  await page.clock.fastForward('05:01');
  await expect(page.getByTestId('timer-status')).toHaveText("Time's up!");
});

test('stable locators survive random ids and classes', async ({ page }) => {
  const c = card(page, 'dynamic-ids');
  const idBefore = await c.getByRole('button', { name: 'Edit' }).getAttribute('id');
  await c.getByRole('button', { name: 'Re-render' }).click();
  expect(await c.getByRole('button', { name: 'Edit' }).getAttribute('id')).not.toBe(idBefore);
  await c.getByRole('button', { name: 'Edit' }).click();
  await expect(c.getByTestId('dynamic-result')).toContainText('Clicked Edit');
});

test('web table: filter, sort and paginate', async ({ page }) => {
  const c = card(page, 'table');
  const rows = c.getByTestId('employee-row');
  await c.getByLabel('Filter employees').fill('QA');
  await expect(c.getByTestId('table-info')).toHaveText('Page 1 of 1 · 5 rows');
  await expect(rows.locator('td:nth-child(2)')).toHaveText(Array(5).fill('QA'));
  await c.getByLabel('Filter employees').clear();
  await c.getByRole('button', { name: 'Salary' }).click();
  await c.getByRole('button', { name: 'Salary' }).click();
  const salaries = (await rows.locator('td:nth-child(4)').allInnerTexts()).map(s => Number(s.replace(/\D/g, '')));
  expect(salaries).toEqual([...salaries].sort((a, b) => b - a));
  await c.getByRole('button', { name: 'Next ›' }).click();
  await expect(c.getByTestId('table-info')).toHaveText('Page 2 of 5 · 25 rows');
});

test('accessibility scan finds the deliberately broken widgets', async ({ page }) => {
  const results = await new AxeBuilder({ page }).include('[data-testid="lab-a11y"]').analyze();
  const ids = results.violations.map(v => v.id);
  expect(ids).toEqual(expect.arrayContaining(['image-alt', 'button-name', 'label', 'color-contrast']));
});

test('visual snapshot of a stable component', async ({ page }) => {
  test.skip(!process.env.VISUAL, 'Set VISUAL=1 (and run once with --update-snapshots) to enable visual tests');
  await expect(page.getByTestId('visual-target')).toHaveScreenshot('order-card.png');
  await page.getByLabel(/Introduce a 2px layout shift/).check();
  await expect(page.getByTestId('visual-target')).not.toHaveScreenshot('order-card.png');
});
