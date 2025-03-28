require('dotenv').config();
const schedule = require('node-schedule');
const logger = require('./utils/logger');
const { cleanRevokedTokens, cleanBookings, cleanInactiveBookings } = require('./tasks/cleanTasks');

const requiredEnvVars = ['DATABASE_USER', 'DATABASE_HOST', 'DATABASE_NAME', 'DATABASE_PASSWORD', 'DATABASE_PORT'];
requiredEnvVars.forEach((varName) => {
  if (!process.env[varName]) {
    logger.error(`Missing required environment variable: ${varName}`);
    process.exit(1);
  }
});

schedule.scheduleJob('59 23 * * 5', async () => {
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

setInterval(() => {
  logger.info('Worker is running...');
}, 60 * 60 * 1000); 
