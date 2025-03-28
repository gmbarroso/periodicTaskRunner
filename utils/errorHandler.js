const logger = require('./logger');

function handleTaskError(taskName, error, query = null) {
  logger.error(`Error in task "${taskName}":`, {
    message: error.message,
    stack: error.stack,
    query,
  });
}

module.exports = handleTaskError;
