export default {
  id: 'websocket',
  title: 'WebSocket ticker and echo chat',
  tag: 'waitForEvent() · toHaveText()',
  level: 3,
  task: 'Connect, observe a price update, then send a message and verify its echo.',
  body: `<div class="row"><button type="button" class="btn secondary sm" data-testid="vortex-socket-connect">Connect</button>
    <p role="status" data-testid="vortex-socket-status">Disconnected</p></div>
    <p>Price <output aria-label="Latest price" data-testid="vortex-socket-price">—</output></p>
    <form><label for="vortex-echo-message">Chat message</label>
    <input id="vortex-echo-message" maxlength="120" required><button class="btn sm" disabled>Send</button></form>
    <p aria-live="polite" data-testid="vortex-socket-echo"></p>`,
  mount(el, { signal }) {
    const [connect, send] = el.querySelectorAll('button');
    const form = el.querySelector('form');
    const input = form.querySelector('input');
    const status = el.querySelector('[role=status]');
    const price = el.querySelector('output');
    const echo = el.querySelector('[aria-live=polite]');
    if (location.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) {
      status.textContent = 'Available when run locally.';
      connect.disabled = true;
      return;
    }
    let socket;
    connect.onclick = () => {
      socket = new WebSocket('ws://' + location.host + '/vortex-lab/socket');
      connect.disabled = true;
      status.textContent = 'Connecting';
      socket.onopen = () => {
        status.textContent = 'Connected';
        send.disabled = false;
      };
      socket.onclose = () => {
        status.textContent = 'Disconnected';
        connect.disabled = false;
        send.disabled = true;
      };
      socket.onmessage = event => {
        const { type, value } = JSON.parse(event.data);
        if (type === 'price') price.textContent = '$' + Number(value).toFixed(2);
        if (type === 'echo') echo.textContent = 'Echo: ' + value;
      };
    };
    form.onsubmit = event => {
      event.preventDefault();
      if (socket?.readyState === WebSocket.OPEN) socket.send(input.value);
    };
    signal.addEventListener('abort', () => socket?.close(), { once: true });
  },
};
