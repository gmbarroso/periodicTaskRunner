const test = require('node:test');
const assert = require('node:assert/strict');
const {
  collectRecipientAddresses,
  collectThreadMessageIds,
  extractPlainReply,
  normalizeMessageId,
} = require('../tasks/messages/inboundEmailUtils');

test('normalizeMessageId strips angle brackets and lowercases', () => {
  assert.equal(normalizeMessageId('<ABC@Example.com>'), 'abc@example.com');
});

test('collectThreadMessageIds merges in-reply-to and references', () => {
  const parsed = {
    inReplyTo: '<one@example.com>',
    references: '<one@example.com> <two@example.com>',
    headers: new Map([
      ['in-reply-to', '<three@example.com>'],
    ]),
  };

  const ids = collectThreadMessageIds(parsed);
  assert.deepEqual(ids, ['one@example.com', 'two@example.com', 'three@example.com']);
});

test('extractPlainReply removes quoted section', () => {
  const text = [
    'Minha resposta',
    '',
    'On Tue, Mar 19, 2026 at 10:00 AM Admin <admin@example.com> wrote:',
    '> mensagem antiga',
  ].join('\n');

  assert.equal(extractPlainReply(text), 'Minha resposta');
});

test('collectRecipientAddresses returns to/deliveredTo/xOriginalTo recipients', () => {
  const parsed = {
    to: { value: [{ address: 'faleconosco+grillrent.abc@example.com' }] },
    headers: new Map([
      ['delivered-to', 'faleconosco+grillrent.abc@example.com'],
      ['x-original-to', '<faleconosco+grillrent.abc@example.com>'],
    ]),
  };

  const recipients = collectRecipientAddresses(parsed);
  assert.deepEqual(recipients.toRecipients, ['faleconosco+grillrent.abc@example.com']);
  assert.deepEqual(recipients.deliveredToRecipients, ['faleconosco+grillrent.abc@example.com']);
  assert.deepEqual(recipients.xOriginalToRecipients, ['faleconosco+grillrent.abc@example.com']);
});
