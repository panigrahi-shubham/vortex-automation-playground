import { $, api, esc, state, requireAuth, setTitle, setAuth, field, showErrors, clearErrors, formAlert, busy, toast, fmtDate, isDatabaseMode } from '../core.js';
import { avatarHtml } from '../app.js';
import { strengthMeter } from './auth.js';

export function applyAccountSettings(settings) {
  const theme = settings.theme === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : settings.theme;
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.reducedMotion = String(settings.reducedMotion);
  try { localStorage.setItem('shoplab.theme', theme); } catch {}
}

export async function settings(el, { isCurrent }) {
  if (!requireAuth()) return;
  if (!isDatabaseMode()) { el.textContent = 'Account settings require database mode.'; return; }
  const saved = await api('/me/settings');
  if (!isCurrent()) return;
  setTitle('Settings');
  el.innerHTML = `<h2>Settings</h2><form data-testid="settings-form" class="card" style="max-width:560px">
    <div data-form-alert role="status" hidden></div>
    <h3>Notification preferences</h3>
    <p class="small muted">Preferences are saved for future notifications. Email delivery is not enabled yet.</p>
    <label class="check"><input name="orderEmails" type="checkbox" ${saved.orderEmails ? 'checked' : ''}> Order emails</label>
    <label class="check"><input name="marketingEmails" type="checkbox" ${saved.marketingEmails ? 'checked' : ''}> Offers and coupons by email</label>
    <h3 style="margin-top:24px">Appearance</h3>
    ${field({ name: 'theme', label: 'Theme', value: saved.theme, options: [['system', 'Use device setting'], ['light', 'Light'], ['dark', 'Dark']], testid: 'settings-theme' })}
    <label class="check"><input name="reducedMotion" type="checkbox" ${saved.reducedMotion ? 'checked' : ''}> Reduce motion</label>
    <button class="btn" data-testid="save-settings" style="margin-top:16px">Save settings</button></form>`;
  const form = $('form', el);
  form.onsubmit = async event => {
    event.preventDefault();
    await busy($('[data-testid=save-settings]', el), async () => {
      try {
        const data = await api('/me/settings', { method: 'PUT', body: { orderEmails: form.orderEmails.checked, marketingEmails: form.marketingEmails.checked, theme: form.theme.value, reducedMotion: form.reducedMotion.checked } });
        applyAccountSettings(data); formAlert(form, 'Settings saved.', 'success');
      } catch (error) { formAlert(form, error.message); }
    }, 'Saving…');
  };
}

export async function render(el, { params, isCurrent }) {
  if (!requireAuth()) return;
  const tab = params[0] || 'profile';
  const me = await api('/me');
  if (!isCurrent()) return;
  setAuth(state.token, me);
  setTitle('My account');
  el.innerHTML = `<div class="page-head"><div class="row">${avatarHtml(me, 'lg')}<div><h1 style="margin:0" data-testid="account-name">${esc(me.name)}</h1>
      <p class="muted small" style="margin:0">@${esc(me.username)} · member since ${fmtDate(me.createdAt).split(',')[0]}</p></div></div></div>
    <nav role="tablist" aria-label="Account sections">
      ${[['profile', 'Profile'], ['security', 'Password & security'], ['avatar', 'Profile photo'], ...(isDatabaseMode() ? [['settings', 'Settings']] : [])].map(([id, l]) => `<a role="tab" href="/account/${id}" aria-selected="${tab === id}" data-testid="account-tab-${id}">${l}</a>`).join('')}
    </nav>
    <section class="card" style="max-width:560px" id="panel" role="tabpanel"></section>`;
  const panel = $('#panel', el);
  if (tab === 'settings' && isDatabaseMode()) return settings(panel, { isCurrent });
  ({ profile, security, avatar })[tab](panel, me, el);
}

function profile(panel, me) {
  panel.innerHTML = `<h2>Profile</h2><form id="profile-form" novalidate data-testid="profile-form">
    <div data-form-alert hidden role="alert"></div>
    ${field({ name: 'name', label: 'Full name', value: me.name, testid: 'profile-name' })}
    ${field({ name: 'username', label: 'Username', value: me.username, testid: 'profile-username', attrs: 'readonly', hint: 'Usernames cannot be changed' })}
    ${field({ name: 'email', label: 'Email', type: 'email', value: me.email, testid: 'profile-email' })}
    ${field({ name: 'phone', label: 'Phone (optional)', type: 'tel', value: me.phone, testid: 'profile-phone', attrs: 'inputmode="numeric" maxlength="10"', hint: '10 digits' })}
    ${isDatabaseMode() ? field({ name: 'currentPassword', label: 'Current password (required to change email)', type: 'password', testid: 'profile-current-password', attrs: 'autocomplete="current-password"' }) : ''}
    <button class="btn" data-testid="save-profile">Save changes</button></form>`;
  const form = $('#profile-form', panel);
  form.onsubmit = async e => {
    e.preventDefault(); clearErrors(form);
    await busy($('[data-testid=save-profile]', form), async () => {
      try {
        const u = await api('/me', { method: 'PUT', body: { name: form.name.value, email: form.email.value.trim(), phone: form.phone.value.trim(), ...(isDatabaseMode() ? { currentPassword: form.currentPassword.value } : {}) } });
        setAuth(state.token, u);
        $('[data-testid=account-name]').textContent = u.name;
        toast('Profile updated');
      } catch (err) { if (err.fields) showErrors(form, err.fields); else formAlert(form, err.message); }
    }, 'Saving…');
  };
}

function security(panel) {
  panel.innerHTML = `<h2>Change password</h2><form id="pw-form" novalidate data-testid="password-form">
    <div data-form-alert hidden role="alert" data-testid="password-alert"></div>
    ${field({ name: 'currentPassword', label: 'Current password', type: 'password', testid: 'current-password', attrs: 'autocomplete="current-password"' })}
    ${field({ name: 'newPassword', label: 'New password', type: 'password', testid: 'new-password', attrs: 'autocomplete="new-password"', hint: 'At least 8 characters with upper and lower case letters and a number' })}
    <div id="meter" style="margin:-6px 0 12px"></div>
    ${field({ name: 'confirm', label: 'Confirm new password', type: 'password', testid: 'confirm-password', attrs: 'autocomplete="new-password"' })}
    <button class="btn" data-testid="change-password">Update password</button>
    <p class="small muted" style="margin:12px 0 0">Changing your password signs you out on every other device.</p></form>`;
  const form = $('#pw-form', panel);
  strengthMeter(form.newPassword, $('#meter', panel));
  form.onsubmit = async e => {
    e.preventDefault(); clearErrors(form);
    if (form.newPassword.value !== form.confirm.value) return showErrors(form, { confirm: 'Passwords do not match' });
    await busy($('[data-testid=change-password]', form), async () => {
      try {
        await api('/me/password', { method: 'PUT', body: { currentPassword: form.currentPassword.value, newPassword: form.newPassword.value } });
        form.reset(); $('#meter', panel).innerHTML = '';
        formAlert(form, 'Password updated successfully.', 'success');
        toast('Password changed');
      } catch (err) { if (err.fields) showErrors(form, err.fields); else formAlert(form, err.message); }
    }, 'Updating…');
  };
  if (isDatabaseMode()) { const host = document.createElement('section'); host.className = 'card'; host.style.marginTop = '24px'; panel.append(host); mfaSettings(host).catch(error => toast(error.message, 'error')); }
}

async function mfaSettings(host) {
  const status = await api('/me/mfa');
  let action = status.enabled ? 'disable' : 'enroll';
  host.innerHTML = `<h2>Two-step verification</h2><p data-testid="mfa-status">${status.enabled ? 'Enabled' : 'Not enabled'}</p>
    <form data-testid="mfa-settings-form"><div data-form-alert role="alert" hidden></div>
    ${field({ name: 'password', label: 'Current password for MFA', type: 'password', testid: 'mfa-password', attrs: 'autocomplete="current-password"' })}
    <div data-testid="mfa-enrollment"></div>
    <div id="mfa-code" ${status.enabled ? '' : 'hidden'}>${field({ name: 'code', label: 'Authenticator or backup code', testid: 'mfa-code', attrs: 'autocomplete="one-time-code" maxlength="24"' })}</div>
    <button class="btn" data-testid="mfa-action">${status.enabled ? 'Disable MFA' : 'Set up authenticator'}</button></form>`;
  const form = $('form', host), button = $('[data-testid=mfa-action]', host);
  form.onsubmit = async event => {
    event.preventDefault();
    await busy(button, async () => {
      try {
        const result = await api(`/me/mfa/${action}`, { method: 'POST', body: { password: form.password.value, code: form.code.value.trim() } });
        if (action === 'enroll') {
          $('[data-testid=mfa-enrollment]', host).innerHTML = `<p>Add this setup key to your authenticator app, then enter its six-digit code. Setup expires in ten minutes.</p><code data-testid="mfa-secret">${esc(result.secret)}</code>`;
          $('#mfa-code', host).hidden = false; action = 'enable';
          // busy() restores the button label after this callback.
          setTimeout(() => { button.textContent = 'Confirm MFA'; }, 0);
        } else if (action === 'enable') {
          host.innerHTML = `<h2>MFA enabled</h2><p>Save these one-use backup codes somewhere safe. They are shown once.</p><pre data-testid="mfa-backup-codes">${result.backupCodes.map(esc).join('\n')}</pre><a href="/account/security">Back to security settings</a>`;
        } else await mfaSettings(host);
      } catch (error) { formAlert(form, error.message); }
    }, 'Verifying…');
  };
}

function avatar(panel, me, el) {
  panel.innerHTML = `<h2>Profile photo</h2>
    <div class="row" style="margin-bottom:16px"><div id="preview">${avatarHtml(me, 'lg')}</div>
      <div class="small muted">PNG, JPEG, GIF or WEBP · max 1 MB.<br>Anything else is rejected by the server (415 / 413).</div></div>
    <div data-form-alert hidden role="alert" data-testid="avatar-error"></div>
    <label class="dropzone" id="drop" for="avatar-input" data-testid="avatar-dropzone" style="display:block;cursor:pointer">
      <strong>Drop an image here</strong> or click to choose a file
      <input type="file" id="avatar-input" accept="image/*" data-testid="avatar-input" class="sr-only">
    </label>
    <div class="row" style="margin-top:14px"><button class="btn secondary" id="remove" data-testid="avatar-remove" ${me.avatar ? '' : 'disabled'}>Remove photo</button></div>`;
  const alertHost = panel; // formAlert looks for [data-form-alert] inside this element
  const drop = $('#drop', panel), input = $('#avatar-input', panel);
  const upload = async file => {
    clearErrors(alertHost);
    if (!file) return;
    try {
      await api('/me/avatar', { method: 'POST', body: file });
      const u = await api('/me');
      setAuth(state.token, u);
      $('#preview', panel).innerHTML = avatarHtml(u, 'lg');
      const head = $('.page-head .avatar', el); if (head) head.outerHTML = avatarHtml(u, 'lg');
      $('#remove', panel).disabled = false;
      toast('Profile photo updated');
    } catch (err) { formAlert(alertHost, err.message); }
    input.value = '';
  };
  input.onchange = () => upload(input.files[0]);
  ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', e => upload(e.dataTransfer.files[0]));
  $('#remove', panel).onclick = async () => {
    await api('/me/avatar', { method: 'DELETE' });
    const u = await api('/me'); setAuth(state.token, u);
    $('#preview', panel).innerHTML = avatarHtml(u, 'lg');
    const head = $('.page-head .avatar', el); if (head) head.outerHTML = avatarHtml(u, 'lg');
    $('#remove', panel).disabled = true;
    toast('Profile photo removed', 'info');
  };
}




