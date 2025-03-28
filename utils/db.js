const { Pool } = require('pg');
const logger = require('./logger');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
  ssl: {
    rejectUnauthorized: false,
  },
});

pool.on('connect', () => logger.info('Database connection established.'));
pool.on('error', (err) => logger.error('Error in database connection:', err));

module.exports = {
  query: (text, params) => pool.query(text, params),
};
