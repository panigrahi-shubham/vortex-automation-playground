const { test } = require('node:test');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

test('production entry and authenticator work without synchronous require of ES modules', () => {
  execFileSync(process.execPath, ['--no-experimental-require-module', '-e', `
    const assert = require('node:assert/strict');
    require('dotenv').config = () => ({ parsed: {} });
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgresql://unused:unused@127.0.0.1:59999/unused?schema=orvilo';
    delete process.env.SHOPLAB_STORAGE;
    assert.equal(typeof require('./api/index.js'), 'function');
    require('./server/otp.cjs').loadOtp().then(otp => {
      const secret = otp.generateSecret();
      const token = otp.generateSync({ secret });
      assert.equal(otp.verifySync({ secret, token }).valid, true);
    }).catch(() => { process.exitCode = 1; });
  `], { cwd: path.join(__dirname, '../..'), stdio: 'pipe' });
});
