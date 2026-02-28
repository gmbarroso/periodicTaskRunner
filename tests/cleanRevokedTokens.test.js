const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const taskPath = path.resolve(__dirname, '../tasks/revokedTokens/cleanRevokedTokens.js');
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

  const cleanRevokedTokens = require(taskPath);
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
  return { cleanRevokedTokens, queryMock, infoMock, errorMock, restore };
}

test('deletes expired revoked-token entries (expirationDate <= NOW)', async (t) => {
  let capturedQuery = '';
  const { cleanRevokedTokens, restore } = loadTaskWithMocks({
    dbQueryImpl: async (query) => {
      capturedQuery = query;
      return { rowCount: 1 };
    },
  });
  t.after(restore);

  const deletedRows = await cleanRevokedTokens();

  assert.equal(deletedRows, 1);
  assert.match(capturedQuery, /DELETE FROM revoked_token/);
  assert.match(capturedQuery, /"expirationDate"\s*<=\s*NOW\(\)/);
});

test('preserves non-expired revoked-token entries (simulated by zero deletions)', async (t) => {
  let queryCalled = false;
  const { cleanRevokedTokens, restore } = loadTaskWithMocks({
    dbQueryImpl: async () => {
      queryCalled = true;
      return { rowCount: 0 };
    },
    errorHandlerImpl: () => {
      throw new Error('error handler should not be called for zero deletions');
    },
  });
  t.after(restore);

  const deletedRows = await cleanRevokedTokens();

  assert.equal(deletedRows, 0);
  assert.equal(queryCalled, true);
});

test('returns null and calls error handler when delete query fails', async (t) => {
  const expectedError = new Error('db down');
  let capturedTaskName = '';
  let capturedError = null;
  let capturedQuery = '';
  const { cleanRevokedTokens, restore } = loadTaskWithMocks({
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

  const deletedRows = await cleanRevokedTokens();

  assert.equal(deletedRows, null);
  assert.equal(capturedTaskName, 'cleanRevokedTokens');
  assert.equal(capturedError, expectedError);
  assert.match(capturedQuery, /DELETE FROM revoked_token/);
  assert.match(capturedQuery, /"expirationDate"\s*<=\s*NOW\(\)/);
});
