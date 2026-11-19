export function testId(challenge, id) {
  return challenge ? '' : ` data-testid="${id}"`;
}

export function removeTestIds(root) {
  for (const element of root.querySelectorAll('*')) {
    element.removeAttribute('data-testid');
    if (element.shadowRoot) removeTestIds(element.shadowRoot);
  }
}

export function later(signal, callback, delay) {
  const stop = () => clearTimeout(timer);
  const timer = setTimeout(() => {
    signal.removeEventListener('abort', stop);
    callback();
  }, delay);
  signal.addEventListener('abort', stop, { once: true });
  return timer;
}

export function repeat(signal, callback, delay) {
  const timer = setInterval(callback, delay);
  signal.addEventListener('abort', () => clearInterval(timer), { once: true });
  return timer;
}
