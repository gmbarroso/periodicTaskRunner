const db = require('../../utils/db');
const logger = require('../../utils/logger');

async function cleanRevokedTokens() {
  try {
    const query = `
      DELETE FROM revoked_token
      WHERE "expirationDate" < NOW()
    `;
    const result = await db.query(query);
    logger.info(`revoked_token table cleaned successfully. ${result.rowCount} rows deleted.`);
  } catch (error) {
    logger.error('Error cleaning revoked_token table:', {
      message: error.message,
      stack: error.stack,
      query: 'DELETE FROM revoked_token WHERE "expirationDate" < NOW()',
    });
  }
}

module.exports = cleanRevokedTokens;
