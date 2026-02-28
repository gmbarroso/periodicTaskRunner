const db = require('../../utils/db');
const logger = require('../../utils/logger');
const handleTaskError = require('../../utils/errorHandler');

const SOFT_DEACTIVATE_BOOKINGS_SQL = `
  UPDATE booking
  SET active = false
  WHERE "startTime" < NOW() - INTERVAL '3 months'
  AND active = true
`;

async function cleanBookings() {
  try {
    const result = await db.query(SOFT_DEACTIVATE_BOOKINGS_SQL);
    logger.info(`Soft cleanup applied successfully. ${result.rowCount} booking rows updated.`);
    return result.rowCount;
  } catch (error) {
    handleTaskError('cleanBookings', error, SOFT_DEACTIVATE_BOOKINGS_SQL);
    return null;
  }
}

module.exports = cleanBookings;
