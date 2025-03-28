const { Pool } = require('pg');
const logger = require('./logger');

const pool = new Pool({
  user: process.env.DATABASE_USER,
  host: process.env.DATABASE_HOST,
  database: process.env.DATABASE_NAME,
  password: process.env.DATABASE_PASSWORD,
  port: process.env.DATABASE_PORT || 5432,
  ssl: {
    rejectUnauthorized: false,
  },
});

pool.on('connect', () => logger.info('Database connection established.'));
pool.on('error', (err) => logger.error('Error in database connection:', err));

async function queryWithRetry(queryText, params, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await pool.query(queryText, params);
    } catch (err) {
      logger.error(`Query failed on attempt ${attempt} of ${retries}:`, err.message);
      if (attempt === retries) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
}

module.exports = {
  query: queryWithRetry,
};
