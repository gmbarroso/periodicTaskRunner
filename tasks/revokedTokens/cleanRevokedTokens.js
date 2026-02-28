const db = require('../../utils/db');
const handleTaskError = require('../../utils/errorHandler');
const logger = require('../../utils/logger');

const DELETE_EXPIRED_REVOKED_TOKEN_SQL = `
  DELETE FROM revoked_token
  WHERE "expirationDate" <= NOW()
`;

async function cleanRevokedTokens() {
  try {
    const result = await db.query(DELETE_EXPIRED_REVOKED_TOKEN_SQL);
    logger.info(`revoked_token table cleaned successfully. ${result.rowCount} rows deleted.`);
    return result.rowCount;
  } catch (error) {
    handleTaskError('cleanRevokedTokens', error, DELETE_EXPIRED_REVOKED_TOKEN_SQL);
    return null;
  }
}

module.exports = cleanRevokedTokens;
