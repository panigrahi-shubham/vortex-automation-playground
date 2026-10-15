import { $, api, esc, state, requireAuth, setTitle, setAuth, field, showErrors, clearErrors, formAlert, busy, toast, fmtDate } from '../core.js';
import { avatarHtml } from '../app.js';
import { strengthMeter } from './auth.js';

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
      ${[['profile', 'Profile'], ['security', 'Password & security'], ['avatar', 'Profile photo']].map(([id, l]) => `<a role="tab" href="/account/${id}" aria-selected="${tab === id}" data-testid="account-tab-${id}">${l}</a>`).join('')}
    </nav>
    <section class="card" style="max-width:560px" id="panel" role="tabpanel"></section>`;
  const panel = $('#panel', el);
  ({ profile, security, avatar })[tab](panel, me, el);
}

function profile(panel, me) {
  panel.innerHTML = `<h2>Profile</h2><form id="profile-form" novalidate data-testid="profile-form">
    <div data-form-alert hidden role="alert"></div>
    ${field({ name: 'name', label: 'Full name', value: me.name, testid: 'profile-name' })}
    ${field({ name: 'username', label: 'Username', value: me.username, testid: 'profile-username', attrs: 'readonly', hint: 'Usernames cannot be changed' })}
    ${field({ name: 'email', label: 'Email', type: 'email', value: me.email, testid: 'profile-email' })}
    ${field({ name: 'phone', label: 'Phone (optional)', type: 'tel', value: me.phone, testid: 'profile-phone', attrs: 'inputmode="numeric" maxlength="10"', hint: '10 digits' })}
    <button class="btn" data-testid="save-profile">Save changes</button></form>`;
  const form = $('#profile-form', panel);
  form.onsubmit = async e => {
    e.preventDefault(); clearErrors(form);
    await busy($('[data-testid=save-profile]', form), async () => {
      try {
        const u = await api('/me', { method: 'PUT', body: { name: form.name.value, email: form.email.value.trim(), phone: form.phone.value.trim() } });
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
    $('#remove', panel).disabled = true;
    toast('Profile photo removed', 'info');
  };
}
