import { setAuth } from './core.js';

const code = new URLSearchParams(location.search).get('code');
history.replaceState(null, '', location.pathname);
const status = document.querySelector('#vortex-sso-status');
try {
  const response = await fetch('/mock-idp/exchange', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  if (!response.ok) throw new Error('Exchange rejected');
  const { token, user } = await response.json();
  setAuth(token, user);
  location.replace('/shop');
} catch {
  status.textContent = 'The practice authorization code could not be exchanged. Start again from the lab.';
}
