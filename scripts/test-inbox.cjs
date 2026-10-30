require('dotenv').config({ path: require('node:path').join(__dirname, '../.env') });
const email = process.argv[2];
if (!email || !process.env.ORVILO_TEST_KEY) {
  console.error('Usage: npm run test:inbox -- user@example.test (requires local ORVILO_TEST_KEY)'); process.exitCode = 1;
} else {
  fetch((process.env.BASE_URL || 'http://localhost:3000') + '/api/v2/test/mailbox?to=' + encodeURIComponent(email), { headers: { 'X-Orvilo-Test-Key': process.env.ORVILO_TEST_KEY } })
    .then(async response => { if (!response.ok) throw Error(); console.log(JSON.stringify(await response.json(), null, 2)); })
    .catch(() => { console.error('Inbox unavailable. Check the server, recipient and local test key.'); process.exitCode = 1; });
}
