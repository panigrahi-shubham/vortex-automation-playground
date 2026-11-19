const cookie = 'vortex_lab_member';
const preference = 'vortex.lab.offer';

export default {
  id: 'storage',
  title: 'Cookies and local storage',
  tag: 'context.cookies() · storageState()',
  level: 2,
  task: 'Set the member cookie and save the offer preference. Reload and verify the offer remains available.',
  body: `<div class="row">
    <button type="button" class="btn secondary sm" data-testid="vortex-storage-cookie">Set member cookie</button>
    <button type="button" class="btn secondary sm" data-testid="vortex-storage-preference">Save offer preference</button>
    </div><p role="status" data-testid="vortex-storage-result"></p>`,
  reset() {
    document.cookie = cookie + '=; Max-Age=0; Path=/lab; SameSite=Lax';
    localStorage.removeItem(preference);
  },
  mount(el) {
    const [member, offer] = el.querySelectorAll('button');
    const status = el.querySelector('[role=status]');
    function draw() {
      const isMember = document.cookie.split(';').some(value => value.trim() === cookie + '=yes');
      const wantsOffer = localStorage.getItem(preference) === 'enabled';
      status.textContent = isMember && wantsOffer ? 'Member offer available' : 'Set both the cookie and offer preference';
    }
    member.onclick = () => {
      document.cookie = cookie + '=yes; Path=/lab; SameSite=Lax';
      draw();
    };
    offer.onclick = () => {
      localStorage.setItem(preference, 'enabled');
      draw();
    };
    draw();
  },
};
