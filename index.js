require('dotenv').config();
const schedule = require('node-schedule');
const logger = require('./utils/logger');
const { cleanRevokedTokens, cleanBookings, cleanInactiveBookings } = require('./tasks/cleanTasks');

// Schedule cleanRevokedTokens to run 5 seconds from now
const date = new Date(Date.now() + 5 * 1000); // Current time + 5 seconds
schedule.scheduleJob(date, async () => {
  logger.info('Starting cleanup of the revoked_token table...');
  await cleanRevokedTokens();
});

schedule.scheduleJob('0 0 1 1,4,7,10 *', async () => {
  logger.info('Starting cleanup of the booking table...');
  await cleanBookings();
});

schedule.scheduleJob('0 0 1 1,7 *', async () => {
  logger.info('Starting cleanup of inactive booking records...');
  await cleanInactiveBookings();
});

logger.info('Tasks successfully scheduled.');
