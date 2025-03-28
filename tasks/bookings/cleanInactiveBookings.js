const db = require('../../utils/db');
const logger = require('../../utils/logger');

async function cleanInactiveBookings() {
  try {
    const query = `
      DELETE FROM booking
      WHERE active = false
      AND "startTime" < NOW() - INTERVAL \'6 months\'
    `;
    await db.query(query);
    logger.info('Inactive booking records older than 6 months deleted successfully.');
  } catch (error) {
    logger.error('Error deleting inactive booking records:', error);
  }
}

module.exports = cleanInactiveBookings;
