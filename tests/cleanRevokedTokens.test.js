const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const taskPath = path.resolve(__dirname, '../tasks/revokedTokens/cleanRevokedTokens.js');
const dbPath = path.resolve(__dirname, '../utils/db.js');
const loggerPath = path.resolve(__dirname, '../utils/logger.js');
const errorHandlerPath = path.resolve(__dirname, '../utils/errorHandler.js');

function loadTaskWithMocks({ dbQueryImpl, loggerInfoImpl, errorHandlerImpl }) {
  delete require.cache[taskPath];
  delete require.cache[dbPath];
  delete require.cache[loggerPath];
  delete require.cache[errorHandlerPath];

  const queryMock = dbQueryImpl || (async () => ({ rowCount: 0 }));
  const infoMock = loggerInfoImpl || (() => undefined);
  const errorMock = errorHandlerImpl || (() => undefined);

  require.cache[dbPath] = { exports: { query: queryMock } };
  require.cache[loggerPath] = { exports: { info: infoMock, error: () => undefined } };
  require.cache[errorHandlerPath] = { exports: errorMock };

  const cleanRevokedTokens = require(taskPath);
  return { cleanRevokedTokens, queryMock, infoMock, errorMock };
}

test('deletes expired revoked-token entries (expirationDate <= NOW)', async () => {
  let capturedQuery = '';
  const { cleanRevokedTokens } = loadTaskWithMocks({
    dbQueryImpl: async (query) => {
      capturedQuery = query;
      return { rowCount: 1 };
    },
  });

  const deletedRows = await cleanRevokedTokens();

  assert.equal(deletedRows, 1);
  assert.match(capturedQuery, /DELETE FROM revoked_token/);
  assert.match(capturedQuery, /"expirationDate"\s*<=\s*NOW\(\)/);
});

test('preserves non-expired revoked-token entries (simulated by zero deletions)', async () => {
  const { cleanRevokedTokens } = loadTaskWithMocks({
    dbQueryImpl: async () => ({ rowCount: 0 }),
  });

  const deletedRows = await cleanRevokedTokens();

  assert.equal(deletedRows, 0);
});

