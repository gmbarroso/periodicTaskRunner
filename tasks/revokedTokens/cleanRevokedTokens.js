const db = require('../../utils/db');
const handleTaskError = require('../../utils/errorHandler');
const logger = require('../../utils/logger');

const DELETE_EXPIRED_REVOKED_TOKEN_SQL = `
  DELETE FROM revoked_token
  WHERE "expirationDate" <= NOW()
`;

const HAS_ORGANIZATION_COLUMN_SQL = `
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'revoked_token'
      AND column_name = 'organizationId'
      AND table_schema = current_schema()
  ) AS "exists"
`;

const EXPIRED_REVOKED_TOKEN_COUNT_BY_ORGANIZATION_SQL = `
  SELECT "organizationId", COUNT(*)::int AS total
  FROM revoked_token
  WHERE "expirationDate" <= NOW()
  GROUP BY "organizationId"
  ORDER BY total DESC
`;

async function cleanRevokedTokens() {
  try {
    const organizationColumnExists = await db.query(HAS_ORGANIZATION_COLUMN_SQL);
    const hasOrganizationColumn = organizationColumnExists?.rows?.[0]?.exists === true;
    if (hasOrganizationColumn) {
      const byOrganization = await db.query(EXPIRED_REVOKED_TOKEN_COUNT_BY_ORGANIZATION_SQL);
      logger.info(`revoked_token cleanup preview by organization: ${JSON.stringify(byOrganization.rows)}`);
    }

    const result = await db.query(DELETE_EXPIRED_REVOKED_TOKEN_SQL);
    logger.info(`revoked_token table cleaned successfully. ${result.rowCount} rows deleted.`);
    return result.rowCount;
  } catch (error) {
    handleTaskError('cleanRevokedTokens', error, DELETE_EXPIRED_REVOKED_TOKEN_SQL);
    return null;
  }
}

module.exports = cleanRevokedTokens;
