require('dotenv').config();
const app = require('./src/app');
const { initDb } = require('./src/db');

const PORT = process.env.PORT || 3000;

initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`Workout Tracker running on port ${PORT}`);
  });
});
