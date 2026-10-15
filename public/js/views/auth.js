import { $, $$, api, esc, field, showErrors, clearErrors, formAlert, formData, busy, setAuth, navigate, toast, isAuthed, setTitle, refreshCounts } from '../core.js';

const safeReturn = q => { const r = q.get('returnTo') || '/shop'; return r.startsWith('/') && !r.startsWith('//') && !r.startsWith('/login') ? r : '/shop'; };
const ss = { get: k => { try { return JSON.parse(sessionStorage.getItem(k)); } catch { return null; } }, set: (k, v) => { try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } } };

export function strength(pw) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw) || pw.length >= 12) s++;
  return { score: s, label: ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'][s] };
}
export function strengthMeter(input, out) {
  const upd = () => {
    const { score, label } = strength(input.value);
    out.innerHTML = input.value ? `<div class="progress" aria-hidden="true"><div style="width:${score * 25}%;background:${['var(--bad)', 'var(--bad)', 'var(--amber)', 'var(--accent)', 'var(--ok)'][score]}"></div></div><span class="small">Strength: <strong data-testid="password-strength">${label}</strong></span>` : '';
  };
  input.addEventListener('input', upd);
}
function passwordToggle(root) {
  $$('[data-toggle-pw]', root).forEach(btn => {
    btn.onclick = () => {
      const input = $(`#${btn.dataset.togglePw}`, root);
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.setAttribute('aria-pressed', String(show));
      btn.textContent = show ? 'Hide' : 'Show';
    };
  });
}
const pwField = (name, label, testid, attrs = '') => field({ name, label, type: 'password', testid, attrs }).replace('</label>', `</label><div class="input-group" style="position:relative">`).replace(/(<input[^>]+>)/, `$1<button type="button" class="btn secondary sm" data-toggle-pw="f-${name}" aria-pressed="false" data-testid="${testid}-toggle">Show</button></div>`);

/* ================= LOGIN ================= */
export async function login(el, { query }) {
  if (isAuthed()) return navigate(safeReturn(query), { replace: true });
  setTitle('Sign in');
  const reason = query.get('reason');
  const notice = reason === 'expired' ? ['warn', 'Your session has expired. Please sign in again.']
    : query.get('reset') ? ['success', 'Password updated. Sign in with your new password.']
    : query.get('returnTo') ? ['info', 'Please sign in to continue.'] : null;
  el.innerHTML = `<div class="auth-wrap">
    <div class="card">
      <h1>Sign in</h1>
      <p class="muted">Welcome back to ShopLab.</p>
      ${notice ? `<div class="alert ${notice[0]}" data-testid="login-notice">${notice[1]}</div>` : ''}
      <form id="login-form" novalidate data-testid="login-form">
        <div data-form-alert hidden role="alert" data-testid="login-error"></div>
        ${field({ name: 'username', label: 'Username or email', testid: 'username', attrs: 'autocomplete="username" autofocus' })}
        ${pwField('password', 'Password', 'password', 'autocomplete="current-password"')}
        <div class="spread" style="margin-bottom:16px">
          <label class="check"><input type="checkbox" name="remember" data-testid="remember-me"> Remember me for 7 days</label>
          <a href="/forgot-password" data-testid="forgot-link">Forgot password?</a>
        </div>
        <button class="btn block" type="submit" data-testid="login-btn">Sign in</button>
      </form>
      <p class="small" style="margin:16px 0 0;text-align:center">New here? <a href="/register" data-testid="register-link">Create an account</a></p>
    </div>
    <details class="card small" style="margin-top:16px" data-testid="test-accounts">
      <summary style="cursor:pointer;font-weight:600">Test accounts (password <code>secret123</code>)</summary>
      <table style="margin-top:8px"><tbody>
        ${[['standard_user', 'Happy path'], ['locked_user', '423 locked'], ['slow_user', '3 s login delay'], ['problem_user', 'Seeded bugs ON'], ['mfa_user', 'Email OTP (2FA)'], ['admin_user', 'Admin console']]
          .map(([u, d]) => `<tr><td><code>${u}</code></td><td class="muted">${d}</td><td class="num"><button class="btn link sm" type="button" data-fill="${u}" data-testid="fill-${u}">Use</button></td></tr>`).join('')}
      </tbody></table>
    </details></div>`;
  const form = $('#login-form', el);
  passwordToggle(form);
  $$('[data-fill]', el).forEach(b => (b.onclick = () => { form.username.value = b.dataset.fill; form.password.value = 'secret123'; form.password.focus(); }));
  form.onsubmit = async e => {
    e.preventDefault();
    clearErrors(form);
    const d = formData(form);
    const f = {};
    if (!d.username.trim()) f.username = 'Username is required';
    if (!d.password) f.password = 'Password is required';
    if (Object.keys(f).length) return showErrors(form, f);
    await busy($('[data-testid=login-btn]', form), async () => {
      try {
        const r = await api('/login', { method: 'POST', body: { username: d.username.trim(), password: d.password, remember: !!d.remember } });
        if (r.mfaRequired) {
          ss.set('shoplab.mfa', { mfaToken: r.mfaToken, sentTo: r.sentTo, username: d.username.trim(), returnTo: safeReturn(query) });
          return navigate('/login/verify');
        }
        setAuth(r.token, r.user);
        toast(`Welcome back, ${r.user.name}!`);
        navigate(safeReturn(query), { replace: true });
      } catch (err) {
        formAlert(form, err.message);
        form.password.value = '';
      }
    }, 'Signing in…');
  };
}

/* ================= MFA VERIFY ================= */
export async function verify(el) {
  const m = ss.get('shoplab.mfa');
  if (!m) return navigate('/login', { replace: true });
  setTitle('Verify sign-in');
  const email = /@/.test(m.username) ? m.username : `${m.username}@shoplab.test`;
  el.innerHTML = `<div class="auth-wrap"><div class="card">
    <h1>Check your email</h1>
    <p class="muted">We sent a 6-digit code to <strong data-testid="otp-sent-to">${esc(m.sentTo)}</strong>.</p>
    <p class="small"><a href="/mailbox?to=${encodeURIComponent(email)}" target="_blank" rel="noopener" data-testid="open-inbox">Open the test inbox ↗</a></p>
    <form id="otp-form" novalidate>
      <div data-form-alert hidden role="alert" data-testid="otp-error"></div>
      <fieldset style="border:0;padding:0;margin:0 0 16px"><legend class="label">Verification code</legend>
        <div class="row" style="gap:8px;flex-wrap:nowrap">${[1, 2, 3, 4, 5, 6].map(i => `<input inputmode="numeric" maxlength="1" aria-label="Digit ${i}" data-testid="otp-${i}" style="text-align:center;font-size:20px;font-weight:700;padding:10px 0" autocomplete="${i === 1 ? 'one-time-code' : 'off'}">`).join('')}</div>
      </fieldset>
      <button class="btn block" data-testid="otp-submit">Verify and sign in</button>
    </form>
    <p class="small" style="text-align:center;margin:14px 0 0"><a href="/login" data-testid="otp-back">Use a different account</a></p></div></div>`;
  const form = $('#otp-form', el);
  const boxes = $$('input', form);
  boxes.forEach((b, i) => {
    b.addEventListener('input', () => { b.value = b.value.replace(/\D/g, '').slice(-1); if (b.value && boxes[i + 1]) boxes[i + 1].focus(); });
    b.addEventListener('keydown', e => { if (e.key === 'Backspace' && !b.value && boxes[i - 1]) boxes[i - 1].focus(); });
    b.addEventListener('paste', e => {
      const digits = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6);
      if (!digits) return;
      e.preventDefault();
      digits.split('').forEach((d, k) => { if (boxes[k]) boxes[k].value = d; });
      (boxes[digits.length] || boxes[5]).focus();
    });
  });
  boxes[0].focus();
  form.onsubmit = async e => {
    e.preventDefault(); clearErrors(form);
    const code = boxes.map(b => b.value).join('');
    if (code.length !== 6) return formAlert(form, 'Enter all 6 digits');
    await busy($('[data-testid=otp-submit]', form), async () => {
      try {
        const r = await api('/login/mfa', { method: 'POST', body: { mfaToken: m.mfaToken, code } });
        ss.set('shoplab.mfa', null);
        setAuth(r.token, r.user);
        toast(`Welcome back, ${r.user.name}!`);
        navigate(m.returnTo || '/shop', { replace: true });
      } catch (err) {
        formAlert(form, err.data.attemptsLeft ? `${err.message}. ${err.data.attemptsLeft} attempt(s) left.` : err.message);
        boxes.forEach(b => (b.value = '')); boxes[0].focus();
        if (err.status === 401) { ss.set('shoplab.mfa', null); setTimeout(() => navigate('/login'), 1500); }
      }
    }, 'Verifying…');
  };
}

/* ================= REGISTER ================= */
export async function register(el) {
  if (isAuthed()) return navigate('/shop', { replace: true });
  setTitle('Create account');
  el.innerHTML = `<div class="auth-wrap"><div class="card">
    <h1>Create your account</h1>
    <form id="reg-form" novalidate data-testid="register-form">
      <div data-form-alert hidden role="alert" data-testid="register-error"></div>
      ${field({ name: 'name', label: 'Full name', testid: 'reg-name', attrs: 'autocomplete="name" autofocus' })}
      ${field({ name: 'username', label: 'Username', testid: 'reg-username', hint: '3–20 letters, numbers or underscore', attrs: 'autocomplete="username"' })}
      ${field({ name: 'email', label: 'Email', type: 'email', testid: 'reg-email', attrs: 'autocomplete="email"' })}
      ${pwField('password', 'Password', 'reg-password', 'autocomplete="new-password"')}
      <div id="pw-meter" style="margin:-6px 0 12px"></div>
      ${pwField('confirmPassword', 'Confirm password', 'reg-confirm', 'autocomplete="new-password"')}
      <div class="field" data-field="acceptTerms">
        <label class="check"><input type="checkbox" name="acceptTerms" data-testid="reg-terms"> I agree to the <a href="/terms" target="_blank" rel="noopener" data-testid="terms-link">terms of service ↗</a></label>
        <p class="field-error" data-testid="reg-terms-error"></p>
      </div>
      <button class="btn block" data-testid="register-btn">Create account</button>
    </form>
    <p class="small" style="margin:16px 0 0;text-align:center">Already have an account? <a href="/login">Sign in</a></p></div></div>`;
  const form = $('#reg-form', el);
  passwordToggle(form);
  strengthMeter(form.password, $('#pw-meter', el));
  form.onsubmit = async e => {
    e.preventDefault(); clearErrors(form);
    const d = formData(form);
    const body = { name: d.name, username: d.username.trim(), email: d.email.trim(), password: d.password, confirmPassword: d.confirmPassword, acceptTerms: !!d.acceptTerms };
    await busy($('[data-testid=register-btn]', form), async () => {
      try {
        await api('/register', { method: 'POST', body });
        const r = await api('/login', { method: 'POST', body: { username: body.username, password: body.password } });
        setAuth(r.token, r.user);
        toast('Account created — welcome to ShopLab!');
        navigate('/shop', { replace: true });
      } catch (err) {
        if (err.fields) showErrors(form, err.fields);
        formAlert(form, err.message);
      }
    }, 'Creating account…');
  };
}

/* ================= FORGOT / RESET ================= */
export async function forgot(el, { query }) {
  setTitle('Reset password');
  el.innerHTML = `<div class="auth-wrap"><div class="card" data-testid="forgot-card">
    <h1>Reset your password</h1>
    <form id="forgot-form" novalidate>
      <p class="muted">Enter the email on your account and we'll send you a reset code.</p>
      <div data-form-alert hidden role="alert"></div>
      ${field({ name: 'email', label: 'Email', type: 'email', value: query.get('email') || '', testid: 'forgot-email', attrs: 'autofocus' })}
      <button class="btn block" data-testid="send-code">Send reset code</button>
    </form>
    <form id="reset-form" novalidate hidden>
      <div class="alert success" data-testid="forgot-sent" role="status"></div>
      <p class="small"><a id="inbox-link" target="_blank" rel="noopener" data-testid="open-inbox">Open the test inbox ↗</a></p>
      <div data-form-alert hidden role="alert" data-testid="reset-error"></div>
      ${field({ name: 'code', label: '6-digit code', testid: 'reset-code', attrs: 'inputmode="numeric" maxlength="6"' })}
      ${pwField('password', 'New password', 'reset-password', 'autocomplete="new-password"')}
      <div id="pw-meter2" style="margin:-6px 0 12px"></div>
      <button class="btn block" data-testid="reset-btn">Update password</button>
    </form>
    <p class="small" style="margin:16px 0 0;text-align:center"><a href="/login">Back to sign in</a></p></div></div>`;
  const f1 = $('#forgot-form', el), f2 = $('#reset-form', el);
  passwordToggle(f2); strengthMeter(f2.password, $('#pw-meter2', el));
  let email = '';
  f1.onsubmit = async e => {
    e.preventDefault(); clearErrors(f1);
    email = f1.email.value.trim();
    await busy($('[data-testid=send-code]', f1), async () => {
      try {
        const r = await api('/password/forgot', { method: 'POST', body: { email } });
        f1.hidden = true; f2.hidden = false;
        $('[data-testid=forgot-sent]', f2).textContent = r.message;
        $('#inbox-link', el).href = `/mailbox?to=${encodeURIComponent(email)}`;
        f2.code.focus();
      } catch (err) { err.fields ? showErrors(f1, err.fields) : formAlert(f1, err.message); }
    }, 'Sending…');
  };
  f2.onsubmit = async e => {
    e.preventDefault(); clearErrors(f2);
    await busy($('[data-testid=reset-btn]', f2), async () => {
      try {
        await api('/password/reset', { method: 'POST', body: { email, code: f2.code.value.trim(), password: f2.password.value } });
        navigate('/login?reset=1', { replace: true });
      } catch (err) { if (err.fields) showErrors(f2, err.fields); formAlert(f2, err.message); }
    }, 'Updating…');
  };
}
export { refreshCounts };
