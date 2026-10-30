const app = require('./src/app');
const port = process.env.PORT || 3000;
app.listen(port, () => console.log('Orvilo running on http://localhost:' + port));
