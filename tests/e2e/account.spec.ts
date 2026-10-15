import { test, expect } from '../support/fixtures';

// 1×1 transparent PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

test.describe('Profile', () => {
  test('update name and phone; header and reload reflect it', async ({ page, accountPage }) => {
    await accountPage.goto();
    await accountPage.name.fill('Rupesh QA');
    await accountPage.phone.fill('9123456780');
    await accountPage.save.click();
    await expect(accountPage.toast('Profile updated')).toBeVisible();
    await expect(page.getByTestId('user-name')).toHaveText('Rupesh QA');
    await page.reload();
    await expect(accountPage.name).toHaveValue('Rupesh QA');
    await expect(accountPage.phone).toHaveValue('9123456780');
  });

  test('field validation and duplicate email', async ({ page, accountPage }) => {
    await accountPage.goto();
    await accountPage.name.fill('A');
    await accountPage.email.fill('not-an-email');
    await accountPage.phone.fill('123');
    await accountPage.save.click();
    await expect(page.getByTestId('profile-name-error')).toHaveText('Name must be 2-50 characters');
    await expect(page.getByTestId('profile-email-error')).toHaveText('Enter a valid email address');
    await expect(page.getByTestId('profile-phone-error')).toHaveText('Phone must be 10 digits');
    await accountPage.name.fill('Valid Name');
    await accountPage.email.fill('standard_user@shoplab.test');
    await accountPage.phone.fill('');
    await accountPage.save.click();
    await expect(page.getByTestId('profile-email-error')).toHaveText('Email is already in use');
  });

  test('username is read-only', async ({ page, accountPage, user }) => {
    await accountPage.goto();
    await expect(page.getByLabel('Username')).toHaveValue(user.username);
    await expect(page.getByLabel('Username')).not.toBeEditable();
  });
});

test.describe('Password', () => {
  test('wrong current password and mismatched confirmation', async ({ page, accountPage }) => {
    await accountPage.goto('security');
    await accountPage.changePassword('wrong', 'NewPassword1');
    await expect(page.getByTestId('current-password-error')).toHaveText('Current password is incorrect');
    await accountPage.changePassword('x', 'NewPassword1', 'Different1');
    await expect(page.getByTestId('confirm-password-error')).toHaveText('Passwords do not match');
  });

  test('change password, sign out, sign back in with the new one', async ({ page, accountPage, loginPage, user }) => {
    await accountPage.goto('security');
    await accountPage.changePassword(user.password, 'Changed-Pass9');
    await expect(page.getByTestId('password-alert')).toHaveText('Password updated successfully.');
    await accountPage.signOut();
    await loginPage.login(user.username, user.password);
    await expect(loginPage.error).toHaveText('Invalid username or password');
    await loginPage.login(user.username, 'Changed-Pass9');
    await expect(page).toHaveURL('/shop');
  });
});

test.describe('Avatar upload', () => {
  test('upload with setInputFiles, then remove', async ({ page, accountPage }) => {
    await accountPage.goto('avatar');
    await page.getByTestId('avatar-input').setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: PNG });
    await expect(accountPage.toast('Profile photo updated')).toBeVisible();
    await expect(page.getByTestId('user-menu').getByTestId('avatar-img')).toHaveAttribute('src', /^data:image\/png;base64,/);
    await page.getByRole('button', { name: 'Remove photo' }).click();
    await expect(page.getByRole('button', { name: 'Remove photo' })).toBeDisabled();
    await expect(page.getByTestId('user-menu').getByTestId('avatar-img')).toHaveCount(0);
  });

  test('wrong file type is rejected by the server (415)', async ({ page, accountPage }) => {
    await accountPage.goto('avatar');
    const res = page.waitForResponse('**/api/me/avatar');
    await page.getByTestId('avatar-input').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
    expect((await res).status()).toBe(415);
    await expect(page.getByTestId('avatar-error')).toHaveText('Only PNG, JPEG, GIF or WEBP images are allowed');
  });

  test('file over 1 MB is rejected (413)', async ({ page, accountPage }) => {
    await accountPage.goto('avatar');
    await page.getByTestId('avatar-input').setInputFiles({ name: 'huge.png', mimeType: 'image/png', buffer: Buffer.alloc(1_100_000, 1) });
    await expect(page.getByTestId('avatar-error')).toHaveText('File too large (max 1 MB)');
  });

  test('drag-and-drop a file onto the drop zone (synthetic DataTransfer)', async ({ page, accountPage }) => {
    await accountPage.goto('avatar');
    const dataTransfer = await page.evaluateHandle(async b64 => {
      const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      const dt = new DataTransfer();
      dt.items.add(new File([bytes], 'dropped.png', { type: 'image/png' }));
      return dt;
    }, PNG.toString('base64'));
    await page.getByTestId('avatar-dropzone').dispatchEvent('drop', { dataTransfer });
    await expect(accountPage.toast('Profile photo updated')).toBeVisible();
  });
});
