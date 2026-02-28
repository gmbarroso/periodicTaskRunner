const db = require('../../utils/db');
const logger = require('../../utils/logger');
const handleTaskError = require('../../utils/errorHandler');

const DELETE_OLD_INACTIVE_BOOKINGS_SQL = `
  DELETE FROM booking
  WHERE active = false
  AND "startTime" < NOW() - INTERVAL '6 months'
`;

async function cleanInactiveBookings() {
  try {
    const result = await db.query(DELETE_OLD_INACTIVE_BOOKINGS_SQL);
    logger.info(`Hard cleanup applied successfully. ${result.rowCount} booking rows deleted.`);
    return result.rowCount;
  } catch (error) {
    handleTaskError('cleanInactiveBookings', error, DELETE_OLD_INACTIVE_BOOKINGS_SQL);
    return null;
  }
}

module.exports = cleanInactiveBookings;
