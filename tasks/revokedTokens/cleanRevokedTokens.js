const db = require('../../utils/db');
const handleTaskError = require('../../utils/errorHandler');
const logger = require('../../utils/logger');

async function cleanRevokedTokens() {
  try {
    const query = `
      DELETE FROM revoked_token
      WHERE "expirationDate" <= NOW()
    `;
    const result = await db.query(query);
    logger.info(`revoked_token table cleaned successfully. ${result.rowCount} rows deleted.`);
    return result.rowCount;
  } catch (error) {
    handleTaskError('cleanRevokedTokens', error, 'DELETE FROM revoked_token WHERE "expirationDate" <= NOW()');
    return 0;
  }
}

module.exports = cleanRevokedTokens;
