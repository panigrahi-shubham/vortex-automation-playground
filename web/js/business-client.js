// Keep the original command when a response is lost, including across reloads.
// Replaying its request ID lets the server confirm it without a second debit.
const pendingCommands = new Map();

export function createBusinessClient({ base, token, userKey, onUnauthorized }) {
  const key = `vortex.business.pending:${base}:${userKey}`;
  let pending = pendingCommands.get(key);
  if (!pending) {
    try {
      const saved = JSON.parse(sessionStorage.getItem(key) || 'null');
      if (saved && typeof saved.requestId === 'string' && typeof saved.type === 'string' && Number.isSafeInteger(saved.version)) pending = saved;
    } catch { /* A blocked browser store still permits in-memory retries. */ }
  }
  function remember(command) {
    pending = command;
    if (command) pendingCommands.set(key, command); else pendingCommands.delete(key);
    try { if (command) sessionStorage.setItem(key, JSON.stringify(command)); else sessionStorage.removeItem(key); } catch { /* memory fallback */ }
  }
  async function request(path = '', body) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(base + path, {
        method: body ? 'POST' : 'GET', signal: controller.signal,
        headers: { Authorization: `Bearer ${token()}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {})
      });
      if (response.status === 401) onUnauthorized();
      const data = await response.json().catch(() => null);
      if (!response.ok || !data) {
        const error = new Error(data?.error || 'The server could not confirm your request. Refresh to check its status.');
        error.status = response.ok ? 0 : response.status; error.code = data?.code;
        throw error;
      }
      return data;
    } catch (error) {
      if (error.status !== undefined) throw error;
      const failure = new Error('Connection interrupted. Refresh to check your previous action before submitting another.');
      failure.status = 0; throw failure;
    } finally { clearTimeout(timeout); }
  }
  async function submit(command) {
    remember(command);
    try {
      const result = await request('/actions', command);
      remember(null);
      return result;
    } catch (error) {
      // A definite rejection has no side effects. Network/5xx failures remain
      // pending until the exact same command is confirmed by the server.
      if (error.status >= 400 && error.status < 500) remember(null);
      throw error;
    }
  }
  return {
    request,
    async action(type, payload, version) {
      if (pending && JSON.stringify({ type, payload }) !== JSON.stringify({ type: pending.type, payload: pending.payload })) {
        throw new Error('A previous action is awaiting confirmation. Refresh the workspace before starting another.');
      }
      return submit(pending || { type, payload, version, requestId: crypto.randomUUID() });
    },
    async recover(record) {
      if (!pending) return null;
      if (record.state.requests.includes(pending.requestId)) { remember(null); return { message: 'Your previous action was saved successfully' }; }
      return submit(pending);
    }
  };
}
