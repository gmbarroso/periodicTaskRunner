const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const taskPath = path.resolve(__dirname, '../tasks/bookings/cleanInactiveBookings.js');
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

  const cleanInactiveBookings = require(taskPath);
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
  return { cleanInactiveBookings, restore };
}

test('deletes old inactive bookings and returns deleted row count', async (t) => {
  const queries = [];
  let callIndex = 0;
  const { cleanInactiveBookings, restore } = loadTaskWithMocks({
    dbQueryImpl: async (query) => {
      queries.push(query);
      callIndex += 1;
      if (callIndex === 1) {
        return { rows: [{ exists: true }] };
      }
      if (callIndex === 2) {
        return { rows: [{ organizationId: 'org-1', total: 2 }] };
      }
      return { rowCount: 2 };
    },
  });
  t.after(restore);

  const deletedRows = await cleanInactiveBookings();

  assert.equal(deletedRows, 2);
  assert.equal(queries.length, 3);
  assert.match(queries[0], /FROM information_schema\.columns/);
  assert.match(queries[0], /table_schema = current_schema\(\)/);
  assert.match(queries[1], /SELECT "organizationId", COUNT\(\*\)::int AS total/);
  assert.match(queries[2], /DELETE FROM booking/);
  assert.match(queries[2], /active = false/);
  assert.match(queries[2], /INTERVAL '6 months'/);
});

test('skips organization preview query when organizationId column does not exist', async (t) => {
  const queries = [];
  const { cleanInactiveBookings, restore } = loadTaskWithMocks({
    dbQueryImpl: async (query) => {
      queries.push(query);
      if (queries.length === 1) {
        return { rows: [{ exists: false }] };
      }
      return { rowCount: 0 };
    },
    errorHandlerImpl: () => {
      throw new Error('error handler should not be called for zero deletions');
    },
  });
  t.after(restore);

  const deletedRows = await cleanInactiveBookings();
  assert.equal(deletedRows, 0);
  assert.equal(queries.length, 2);
  assert.match(queries[0], /table_schema = current_schema\(\)/);
  assert.doesNotMatch(queries[1], /SELECT "organizationId", COUNT\(\*\)::int AS total/);
});

test('returns null and calls error handler when delete query fails', async (t) => {
  const expectedError = new Error('query timeout');
  let capturedTaskName = '';
  let capturedError = null;
  let capturedQuery = '';
  let callIndex = 0;
  const { cleanInactiveBookings, restore } = loadTaskWithMocks({
    dbQueryImpl: async () => {
      callIndex += 1;
      if (callIndex === 1) {
        return { rows: [{ exists: true }] };
      }
      if (callIndex === 2) {
        return { rows: [{ organizationId: 'org-1', total: 2 }] };
      }
      throw expectedError;
    },
    errorHandlerImpl: (taskName, error, query) => {
      capturedTaskName = taskName;
      capturedError = error;
      capturedQuery = query;
    },
  });
  t.after(restore);

  const deletedRows = await cleanInactiveBookings();

  assert.equal(deletedRows, null);
  assert.equal(capturedTaskName, 'cleanInactiveBookings');
  assert.equal(capturedError, expectedError);
  assert.match(capturedQuery, /DELETE FROM booking/);
  assert.match(capturedQuery, /INTERVAL '6 months'/);
});
