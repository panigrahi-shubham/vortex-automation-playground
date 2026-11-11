const app = require('./src/app');
const port = process.env.PORT || 3000;
const server = app.listen(port, () => console.log('Orvilo running on http://localhost:' + port));
if (!require('./src/test-hooks/guard').productionLocked() && !process.env.VERCEL) {
  require('./src/practice/live-socket').attachPracticeSocket(server);
}
