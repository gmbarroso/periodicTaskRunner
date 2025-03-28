const db = require('../../utils/db');
const logger = require('../../utils/logger');

async function cleanBookings() {
  try {
    const query = `
      UPDATE booking 
      SET active = false 
      WHERE startTime < NOW() - INTERVAL '3 months' 
      AND active = true
    `;
    await db.query(query);
    logger.info('Soft delete applied to booking records older than 3 months based on startTime successfully.');
  } catch (error) {
    logger.error('Error applying soft delete to booking records:', error);
  }
}

module.exports = cleanBookings;
