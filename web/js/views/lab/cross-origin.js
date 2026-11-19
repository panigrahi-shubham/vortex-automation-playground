const frameOrigin = 'http://127.0.0.1:3101';
const localHosts = ['localhost', '127.0.0.1', '[::1]'];

export default {
  id: 'cross-origin',
  title: 'Cross-origin iframe',
  tag: 'frameLocator() · postMessage()',
  level: 3,
  task: 'Send a message from the frame and verify the parent displays it. Inspect the frame origin and port.',
  body: `<p role="status" data-testid="vortex-frame-status"></p>`,
  mount(el, { signal }) {
    const status = el.querySelector('[role=status]');
    if (!localHosts.includes(location.hostname)) {
      status.textContent = 'Available when run locally on port 3101.';
      return;
    }
    status.textContent = 'Waiting for a message from the frame';
    const frame = document.createElement('iframe');
    frame.title = 'Cross-origin practice frame';
    frame.className = 'vortex-cross-frame';
    frame.src = frameOrigin + '/vortex-frame';
    el.prepend(frame);
    window.addEventListener('message', event => {
      if (event.origin === frameOrigin && event.source === frame.contentWindow && event.data?.type === 'vortex-frame-message') {
        status.textContent = 'Frame says: ' + event.data.text;
      }
    }, { signal });
  },
};
