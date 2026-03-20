const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const logger = require('../../utils/logger');
const db = require('../../utils/db');
const handleTaskError = require('../../utils/errorHandler');
const { collectThreadMessageIds, extractPlainReply, normalizeMessageId } = require('./inboundEmailUtils');

function boolFromEnv(name, defaultValue = false) {
  const raw = process.env[name];
  if (raw === undefined || raw === null || raw === '') return defaultValue;
  const normalized = String(raw).trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

function parseRequiredPort(name) {
  const raw = (process.env[name] || '').trim();
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error(`${name} must be a valid integer port between 1 and 65535`);
  }
  return parsed;
}

function parsePositiveInt(name, defaultValue) {
  const raw = (process.env[name] || '').trim();
  if (!raw) return defaultValue;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

async function resolveMessageThreadByProviderIds(providerIds) {
  if (!providerIds.length) return null;

  const { rows } = await db.query(
    `
      with normalized_candidates as (
        select unnest($1::text[]) as candidate
      ),
      direct_match as (
        select
          m.id as "messageId",
          m."organizationId" as "organizationId",
          m."senderEmail" as "senderEmail",
          1 as priority
        from message m
        join normalized_candidates c
          on regexp_replace(lower(coalesce(m."adminEmailProviderMessageId", '')), '[<>]', '', 'g') = c.candidate
      ),
      reply_match as (
        select
          m.id as "messageId",
          m."organizationId" as "organizationId",
          m."senderEmail" as "senderEmail",
          2 as priority
        from message_reply mr
        join message m on m.id = mr."messageId"
        join normalized_candidates c
          on regexp_replace(lower(coalesce(mr."emailProviderMessageId", '')), '[<>]', '', 'g') = c.candidate
      )
      select "messageId", "organizationId", "senderEmail"
      from (
        select * from direct_match
        union all
        select * from reply_match
      ) matches
      order by priority asc
      limit 1
    `,
    [providerIds],
  );

  return rows[0] || null;
}

async function ingestInboundReply(payload) {
  const apiBaseUrl = (process.env.API_BASE_URL || '').trim();
  const inboundSecret = (process.env.CONTACT_EMAIL_INBOUND_SECRET || '').trim();

  if (!apiBaseUrl || !inboundSecret) {
    throw new Error('API_BASE_URL and CONTACT_EMAIL_INBOUND_SECRET are required for inbound email ingestion');
  }

  const response = await fetch(`${apiBaseUrl.replace(/\/+$/, '')}/messages/inbound/email`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-contact-inbound-secret': inboundSecret,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Inbound email ingest failed (${response.status}) ${String(response.statusText || '').trim()}`);
  }

  return response.json();
}

function validateConfig() {
  const required = [
    'INBOUND_EMAIL_IMAP_HOST',
    'INBOUND_EMAIL_IMAP_PORT',
    'INBOUND_EMAIL_IMAP_USER',
    'INBOUND_EMAIL_IMAP_PASSWORD',
    'API_BASE_URL',
    'CONTACT_EMAIL_INBOUND_SECRET',
  ];
  const missing = required.filter((name) => !(process.env[name] || '').trim());
  if (missing.length) {
    throw new Error(`Missing required inbound email env vars: ${missing.join(', ')}`);
  }
}

async function pollInboundEmailReplies() {
  if (!boolFromEnv('INBOUND_EMAIL_ENABLED', false)) {
    return 0;
  }

  validateConfig();

  const imapHost = process.env.INBOUND_EMAIL_IMAP_HOST.trim();
  const imapPort = parseRequiredPort('INBOUND_EMAIL_IMAP_PORT');
  const imapSecure = boolFromEnv('INBOUND_EMAIL_IMAP_SECURE', true);
  const imapUser = process.env.INBOUND_EMAIL_IMAP_USER.trim();
  const imapPassword = process.env.INBOUND_EMAIL_IMAP_PASSWORD.trim();
  const imapConnectTimeoutMs = parsePositiveInt('INBOUND_EMAIL_IMAP_CONNECT_TIMEOUT_MS', 30000);
  const imapSocketTimeoutMs = parsePositiveInt('INBOUND_EMAIL_IMAP_SOCKET_TIMEOUT_MS', 45000);
  const mailbox = (process.env.INBOUND_EMAIL_IMAP_MAILBOX || 'INBOX').trim();
  const unseenOnly = boolFromEnv('INBOUND_EMAIL_UNSEEN_ONLY', true);
  const maxPerRun = Math.max(1, Number(process.env.INBOUND_EMAIL_MAX_PER_RUN || 20));

  const client = new ImapFlow({
    host: imapHost,
    port: imapPort,
    secure: imapSecure,
    auth: {
      user: imapUser,
      pass: imapPassword,
    },
    connectionTimeout: imapConnectTimeoutMs,
    socketTimeout: imapSocketTimeoutMs,
    logger: false,
  });

  client.on('error', (error) => {
    logger.error(
      JSON.stringify({
        event: 'inbound_email_imap_error',
        errorMessage: error?.message || 'Unknown IMAP error',
        errorCode: error?.code || null,
      }),
    );
  });

  let ingestedCount = 0;

  try {
    await client.connect();
    await client.mailboxOpen(mailbox);

    const searchCriteria = unseenOnly ? { seen: false } : { all: true };
    const uids = await client.search(searchCriteria);
    if (!uids.length) {
      return 0;
    }

    // Process oldest unseen messages first to avoid starving older emails.
    const targetUids = [...uids].sort((a, b) => a - b).slice(0, maxPerRun);
    const fetchIterator = client.fetch(targetUids, {
      uid: true,
      envelope: true,
      source: true,
      flags: true,
    });

    for await (const message of fetchIterator) {
      try {
        const parsed = await simpleParser(message.source);
        const fromEmail = parsed?.from?.value?.[0]?.address?.trim().toLowerCase() || null;
        const normalizedExternalMessageId = normalizeMessageId(parsed?.messageId);
        const threadProviderIds = collectThreadMessageIds(parsed);
        const resolved = await resolveMessageThreadByProviderIds(threadProviderIds);

        if (!resolved || !fromEmail) {
          logger.warn(
            JSON.stringify({
              event: 'inbound_email_skipped',
              uid: message.uid,
              reason: !resolved ? 'thread_not_found' : 'missing_from_email',
              providerMessageId: normalizedExternalMessageId,
            }),
          );
          await client.messageFlagsAdd(message.uid, ['\\Seen'], { uid: true });
          continue;
        }

        const cleanContent = extractPlainReply(parsed.text || parsed.html || '');
        if (!cleanContent) {
          logger.warn(
            JSON.stringify({
              event: 'inbound_email_skipped',
              uid: message.uid,
              reason: 'empty_content_after_cleanup',
              providerMessageId: normalizedExternalMessageId,
              messageId: resolved.messageId,
            }),
          );
          await client.messageFlagsAdd(message.uid, ['\\Seen'], { uid: true });
          continue;
        }

        const payload = {
          organizationId: resolved.organizationId,
          messageId: resolved.messageId,
          fromEmail,
          content: cleanContent,
          externalMessageId: normalizedExternalMessageId,
          subject: parsed.subject || null,
          receivedAt: parsed.date ? parsed.date.toISOString() : undefined,
        };

        await ingestInboundReply(payload);
        ingestedCount += 1;

        logger.info(
          JSON.stringify({
            event: 'inbound_email_ingested',
            uid: message.uid,
            providerMessageId: normalizedExternalMessageId,
            messageId: resolved.messageId,
            organizationId: resolved.organizationId,
          }),
        );

        await client.messageFlagsAdd(message.uid, ['\\Seen'], { uid: true });
      } catch (error) {
        handleTaskError('pollInboundEmailReplies.message', error);
      }
    }
  } catch (error) {
    handleTaskError('pollInboundEmailReplies', error);
    return null;
  } finally {
    try {
      await client.logout();
    } catch (logoutError) {
      logger.warn(`IMAP logout warning: ${logoutError.message}`);
    }
  }

  return ingestedCount;
}

module.exports = pollInboundEmailReplies;
