import { removeTestIds } from './support.js';

if (new URLSearchParams(location.search).get('challenge') === '1') {
  removeTestIds(document.body);
  const innerFrame = document.querySelector('iframe');
  if (innerFrame) {
    const url = new URL(innerFrame.src);
    url.searchParams.set('challenge', '1');
    innerFrame.src = url;
  }
}
