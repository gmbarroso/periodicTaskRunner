const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const taskPath = path.resolve(__dirname, '../tasks/messages/pollInboundEmailReplies.js');
const loggerPath = path.resolve(__dirname, '../utils/logger.js');
const errorHandlerPath = path.resolve(__dirname, '../utils/errorHandler.js');

const imapflowPath = require.resolve('imapflow', { paths: [path.resolve(__dirname, '..')] });
const mailparserPath = require.resolve('mailparser', { paths: [path.resolve(__dirname, '..')] });

const pathsToMock = [taskPath, loggerPath, errorHandlerPath, imapflowPath, mailparserPath];

function loadTaskWithMocks({
  searchResult = [],
  parsedByUid = {},
  fetchImpl = async () => ({ ok: true, json: async () => ({ created: true }) }),
}) {
  const previousCache = new Map(pathsToMock.map((cachePath) => [cachePath, require.cache[cachePath]]));
  pathsToMock.forEach((cachePath) => {
    delete require.cache[cachePath];
  });

  const flagsCalls = [];
  const fetchItems = searchResult.map((uid) => ({
    uid,
    source: Buffer.from(`mock-${uid}`),
    envelope: {},
    flags: [],
  }));

  class MockImapFlow {
    on() {}
    async connect() {}
    async mailboxOpen() {}
    async search() {
      return searchResult;
    }
    async *fetch() {
      for (const item of fetchItems) {
        yield item;
      }
    }
    async messageFlagsAdd(uid, flags, options) {
      flagsCalls.push({ uid, flags, options });
    }
    async logout() {}
  }

  require.cache[loggerPath] = {
    exports: {
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined,
    },
  };
  require.cache[errorHandlerPath] = { exports: () => undefined };
  require.cache[imapflowPath] = { exports: { ImapFlow: MockImapFlow } };
  require.cache[mailparserPath] = {
    exports: {
      simpleParser: async (source) => {
        const uid = Number(String(source).replace(/\D/g, ''));
        return parsedByUid[uid] || {};
      },
    },
  };

  const previousFetch = global.fetch;
  global.fetch = fetchImpl;

  const pollInboundEmailReplies = require(taskPath);
  const restore = () => {
    global.fetch = previousFetch;
    pathsToMock.forEach((cachePath) => {
      const previous = previousCache.get(cachePath);
      if (previous) {
        require.cache[cachePath] = previous;
      } else {
        delete require.cache[cachePath];
      }
    });
  };

  return { pollInboundEmailReplies, restore, flagsCalls };
}

function withBaseEnv() {
  process.env.INBOUND_EMAIL_ENABLED = 'true';
  process.env.INBOUND_EMAIL_IMAP_HOST = 'imap.gmail.com';
  process.env.INBOUND_EMAIL_IMAP_PORT = '993';
  process.env.INBOUND_EMAIL_IMAP_SECURE = 'true';
  process.env.INBOUND_EMAIL_IMAP_USER = 'faleconosco@example.com';
  process.env.INBOUND_EMAIL_IMAP_PASSWORD = 'app-password';
  process.env.INBOUND_EMAIL_IMAP_MAILBOX = 'INBOX';
  process.env.INBOUND_EMAIL_UNSEEN_ONLY = 'true';
  process.env.INBOUND_EMAIL_MAX_PER_RUN = '20';
  process.env.API_BASE_URL = 'http://localhost:3000';
  process.env.CONTACT_EMAIL_INBOUND_SECRET = 'secret';
}

test('returns 0 when inbound email worker is disabled', async () => {
  process.env.INBOUND_EMAIL_ENABLED = 'false';
  const { pollInboundEmailReplies, restore } = loadTaskWithMocks({});
  try {
    const result = await pollInboundEmailReplies();
    assert.equal(result, 0);
  } finally {
    restore();
  }
});

test('ingests one inbound email and marks seen with uid mode', async () => {
  withBaseEnv();
  const fetchCalls = [];
  const { pollInboundEmailReplies, restore, flagsCalls } = loadTaskWithMocks({
    searchResult: [100],
    parsedByUid: {
      100: {
        from: { value: [{ address: 'resident@example.com' }] },
        to: { value: [{ address: 'faleconosco+grillrent.token@example.com' }] },
        messageId: '<ext-100@example.com>',
        inReplyTo: '<admin-root@example.com>',
        text: 'Resposta do morador',
        subject: 'Re: assunto',
        date: new Date('2026-03-20T10:00:00.000Z'),
        headers: new Map([
          ['delivered-to', 'faleconosco+grillrent.token@example.com'],
          ['x-original-to', 'faleconosco+grillrent.token@example.com'],
        ]),
      },
    },
    fetchImpl: async (_url, init) => {
      fetchCalls.push(JSON.parse(init.body));
      return { ok: true, json: async () => ({ created: true, reason: null, replyId: 'reply-1' }) };
    },
  });

  try {
    const result = await pollInboundEmailReplies();
    assert.equal(result, 1);
    assert.equal(fetchCalls.length, 1);
    assert.deepEqual(fetchCalls[0].threadMessageIds, ['admin-root@example.com']);
    assert.deepEqual(fetchCalls[0].toRecipients, ['faleconosco+grillrent.token@example.com']);
    assert.deepEqual(fetchCalls[0].deliveredToRecipients, ['faleconosco+grillrent.token@example.com']);
    assert.deepEqual(fetchCalls[0].xOriginalToRecipients, ['faleconosco+grillrent.token@example.com']);
    assert.equal(flagsCalls.length, 1);
    assert.deepEqual(flagsCalls[0], {
      uid: 100,
      flags: ['\\Seen'],
      options: { uid: true },
    });
  } finally {
    restore();
  }
});

test('forwards recipient address even without thread headers (plus-token path)', async () => {
  withBaseEnv();
  const fetchCalls = [];
  const { pollInboundEmailReplies, restore, flagsCalls } = loadTaskWithMocks({
    searchResult: [200],
    parsedByUid: {
      200: {
        from: { value: [{ address: 'resident@example.com' }] },
        to: { value: [{ address: 'faleconosco+grillrent.plus_token@example.com' }] },
        messageId: '<ext-200@example.com>',
        text: 'Resposta com token de endereco',
      },
    },
    fetchImpl: async (_url, init) => {
      fetchCalls.push(JSON.parse(init.body));
      return { ok: true, json: async () => ({ created: true, reason: null, replyId: 'reply-2' }) };
    },
  });

  try {
    const result = await pollInboundEmailReplies();
    assert.equal(result, 1);
    assert.equal(fetchCalls.length, 1);
    assert.deepEqual(fetchCalls[0].threadMessageIds, []);
    assert.deepEqual(fetchCalls[0].toRecipients, ['faleconosco+grillrent.plus_token@example.com']);
    assert.equal(flagsCalls.length, 1);
    assert.equal(flagsCalls[0].uid, 200);
    assert.deepEqual(flagsCalls[0].options, { uid: true });
  } finally {
    restore();
  }
});

test('marks as seen and does not count ingestion when API returns invalid_reply_token', async () => {
  withBaseEnv();
  const { pollInboundEmailReplies, restore, flagsCalls } = loadTaskWithMocks({
    searchResult: [300],
    parsedByUid: {
      300: {
        from: { value: [{ address: 'resident@example.com' }] },
        to: { value: [{ address: 'faleconosco+grillrent.invalid@example.com' }] },
        messageId: '<ext-300@example.com>',
        text: 'Resposta com token invalido',
      },
    },
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ created: false, reason: 'invalid_reply_token', replyId: null }),
    }),
  });

  try {
    const result = await pollInboundEmailReplies();
    assert.equal(result, 0);
    assert.equal(flagsCalls.length, 1);
    assert.equal(flagsCalls[0].uid, 300);
    assert.deepEqual(flagsCalls[0].options, { uid: true });
  } finally {
    restore();
  }
});
