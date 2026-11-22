const { cpSync, mkdirSync } = require('node:fs');
const { join } = require('node:path');

// Express serves HTML so each response gets a fresh CSP nonce.
const output = join(__dirname, '../.vortex-static');
mkdirSync(output, { recursive: true });
for (const directory of ['assets', 'css', 'js']) {
  cpSync(join(__dirname, '../web', directory), join(output, directory), { recursive: true });
}
