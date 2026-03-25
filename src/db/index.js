const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  console.error('Unexpected database error:', err);
});

async function initDb() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  try {
    await pool.query(schema);
    console.log('Database schema ready.');
  } catch (err) {
    console.error('Failed to initialize database schema:', err.message);
    process.exit(1);
  }
}

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
  initDb,
};
