export default {
  id: 'otp',
  title: 'Split OTP fields',
  tag: 'pressSequentially() · toBeFocused()',
  level: 2,
  task: 'Enter the practice code 246810. Verify focus advances and the code is accepted.',
  body: `<div class="row vortex-otp" role="group" aria-label="Practice code">
    ${Array.from({ length: 6 }, (_, i) => `<input aria-label="Digit ${i + 1}" inputmode="numeric" maxlength="1" data-testid="vortex-otp-${i + 1}">`).join('')}
    </div><p role="status" data-testid="vortex-otp-result">Enter six digits</p>`,
  mount(el) {
    const digits = [...el.querySelectorAll('input')];
    const status = el.querySelector('[role=status]');
    function showResult() {
      const code = digits.map(input => input.value).join('');
      status.textContent = code.length < digits.length ? 'Enter six digits' : code === '246810' ? 'Code accepted' : 'Incorrect practice code';
    }
    digits.forEach((input, index) => {
      input.oninput = () => {
        input.value = input.value.replace(/\D/g, '').slice(0, 1);
        if (input.value) digits[index + 1]?.focus();
        showResult();
      };
      input.onkeydown = event => {
        if (event.key === 'Backspace' && !input.value) digits[index - 1]?.focus();
      };
      input.onpaste = event => {
        event.preventDefault();
        const code = event.clipboardData.getData('text').replace(/\D/g, '');
        const values = code.slice(0, digits.length - index);
        [...values].forEach((value, offset) => { digits[index + offset].value = value; });
        digits[Math.min(digits.length - 1, index + values.length)].focus();
        showResult();
      };
    });
  },
};
