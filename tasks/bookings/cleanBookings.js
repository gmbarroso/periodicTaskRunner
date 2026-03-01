const db = require('../../utils/db');
const logger = require('../../utils/logger');
const handleTaskError = require('../../utils/errorHandler');

const SOFT_DEACTIVATE_BOOKINGS_SQL = `
  UPDATE booking
  SET active = false
  WHERE "startTime" < NOW() - INTERVAL '3 months'
  AND active = true
`;

const HAS_ORGANIZATION_COLUMN_SQL = `
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'booking'
      AND column_name = 'organizationId'
  ) AS "exists"
`;

const SOFT_DEACTIVATE_PREVIEW_BY_ORGANIZATION_SQL = `
  SELECT "organizationId", COUNT(*)::int AS total
  FROM booking
  WHERE "startTime" < NOW() - INTERVAL '3 months'
    AND active = true
  GROUP BY "organizationId"
  ORDER BY total DESC
`;

async function cleanBookings() {
  try {
    const organizationColumnExists = await db.query(HAS_ORGANIZATION_COLUMN_SQL);
    const hasOrganizationColumn = organizationColumnExists?.rows?.[0]?.exists === true;
    if (hasOrganizationColumn) {
      const byOrganization = await db.query(SOFT_DEACTIVATE_PREVIEW_BY_ORGANIZATION_SQL);
      logger.info(`Soft cleanup preview by organization: ${JSON.stringify(byOrganization.rows)}`);
    }

    const result = await db.query(SOFT_DEACTIVATE_BOOKINGS_SQL);
    logger.info(`Soft cleanup applied successfully. ${result.rowCount} booking rows updated.`);
    return result.rowCount;
  } catch (error) {
    handleTaskError('cleanBookings', error, SOFT_DEACTIVATE_BOOKINGS_SQL);
    return null;
  }
}

module.exports = cleanBookings;
