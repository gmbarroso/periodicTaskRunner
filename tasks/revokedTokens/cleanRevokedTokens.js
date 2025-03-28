const db = require('../../utils/db');
const logger = require('../../utils/logger');

async function cleanRevokedTokens() {
  try {
    const query = 'DELETE FROM revoked_token WHERE created_at < NOW() - INTERVAL \'7 days\'';
    await db.query(query);
    logger.info('revoked_token table cleaned successfully.');
  } catch (error) {
    logger.error('Error cleaning revoked_token table:', error);
  }
}

module.exports = cleanRevokedTokens;
