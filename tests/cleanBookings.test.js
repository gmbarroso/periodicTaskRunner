const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const taskPath = path.resolve(__dirname, '../tasks/bookings/cleanBookings.js');
const dbPath = path.resolve(__dirname, '../utils/db.js');
const loggerPath = path.resolve(__dirname, '../utils/logger.js');
const errorHandlerPath = path.resolve(__dirname, '../utils/errorHandler.js');
const pathsToMock = [taskPath, dbPath, loggerPath, errorHandlerPath];

function loadTaskWithMocks({ dbQueryImpl, loggerInfoImpl, errorHandlerImpl }) {
  const previousCache = new Map(pathsToMock.map((cachePath) => [cachePath, require.cache[cachePath]]));
  pathsToMock.forEach((cachePath) => {
    delete require.cache[cachePath];
  });

  const queryMock = dbQueryImpl || (async () => ({ rowCount: 0 }));
  const infoMock = loggerInfoImpl || (() => undefined);
  const errorMock = errorHandlerImpl || (() => undefined);

  require.cache[dbPath] = { exports: { query: queryMock } };
  require.cache[loggerPath] = { exports: { info: infoMock, error: () => undefined } };
  require.cache[errorHandlerPath] = { exports: errorMock };

  const cleanBookings = require(taskPath);
  const restore = () => {
    pathsToMock.forEach((cachePath) => {
      const previous = previousCache.get(cachePath);
      if (previous) {
        require.cache[cachePath] = previous;
      } else {
        delete require.cache[cachePath];
      }
    });
  };
  return { cleanBookings, restore };
}

test('updates old active bookings and returns updated row count', async (t) => {
  let capturedQuery = '';
  const { cleanBookings, restore } = loadTaskWithMocks({
    dbQueryImpl: async (query) => {
      capturedQuery = query;
      return { rowCount: 3 };
    },
  });
  t.after(restore);

  const updatedRows = await cleanBookings();

  assert.equal(updatedRows, 3);
  assert.match(capturedQuery, /UPDATE booking/);
  assert.match(capturedQuery, /SET active = false/);
  assert.match(capturedQuery, /INTERVAL '3 months'/);
});

test('returns zero when there are no qualifying bookings', async (t) => {
  const { cleanBookings, restore } = loadTaskWithMocks({
    dbQueryImpl: async () => ({ rowCount: 0 }),
    errorHandlerImpl: () => {
      throw new Error('error handler should not be called for zero updates');
    },
  });
  t.after(restore);

  const updatedRows = await cleanBookings();
  assert.equal(updatedRows, 0);
});

test('returns null and calls error handler when update query fails', async (t) => {
  const expectedError = new Error('db unavailable');
  let capturedTaskName = '';
  let capturedError = null;
  let capturedQuery = '';
  const { cleanBookings, restore } = loadTaskWithMocks({
    dbQueryImpl: async () => {
      throw expectedError;
    },
    errorHandlerImpl: (taskName, error, query) => {
      capturedTaskName = taskName;
      capturedError = error;
      capturedQuery = query;
    },
  });
  t.after(restore);

  const updatedRows = await cleanBookings();

  assert.equal(updatedRows, null);
  assert.equal(capturedTaskName, 'cleanBookings');
  assert.equal(capturedError, expectedError);
  assert.match(capturedQuery, /UPDATE booking/);
  assert.match(capturedQuery, /INTERVAL '3 months'/);
});
