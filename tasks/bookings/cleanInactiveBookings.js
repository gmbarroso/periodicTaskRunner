const db = require('../../utils/db');
const logger = require('../../utils/logger');
const handleTaskError = require('../../utils/errorHandler');

const DELETE_OLD_INACTIVE_BOOKINGS_SQL = `
  DELETE FROM booking
  WHERE active = false
  AND "startTime" < NOW() - INTERVAL '6 months'
`;

const HAS_ORGANIZATION_COLUMN_SQL = `
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'booking'
      AND column_name = 'organizationId'
      AND table_schema = current_schema()
  ) AS "exists"
`;

const HARD_DELETE_PREVIEW_BY_ORGANIZATION_SQL = `
  SELECT "organizationId", COUNT(*)::int AS total
  FROM booking
  WHERE active = false
    AND "startTime" < NOW() - INTERVAL '6 months'
  GROUP BY "organizationId"
  ORDER BY total DESC
`;

async function cleanInactiveBookings() {
  try {
    const organizationColumnExists = await db.query(HAS_ORGANIZATION_COLUMN_SQL);
    const hasOrganizationColumn = organizationColumnExists?.rows?.[0]?.exists === true;
    if (hasOrganizationColumn) {
      const byOrganization = await db.query(HARD_DELETE_PREVIEW_BY_ORGANIZATION_SQL);
      logger.info(`Hard cleanup preview by organization: ${JSON.stringify(byOrganization.rows)}`);
    }

    const result = await db.query(DELETE_OLD_INACTIVE_BOOKINGS_SQL);
    logger.info(`Hard cleanup applied successfully. ${result.rowCount} booking rows deleted.`);
    return result.rowCount;
  } catch (error) {
    handleTaskError('cleanInactiveBookings', error, DELETE_OLD_INACTIVE_BOOKINGS_SQL);
    return null;
  }
}

module.exports = cleanInactiveBookings;
