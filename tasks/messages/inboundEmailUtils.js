function normalizeMessageId(value) {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.replace(/^<+|>+$/g, '').toLowerCase();
}

function extractMessageIds(value) {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.flatMap((item) => extractMessageIds(item));
  }

  if (typeof value !== 'string') {
    return [];
  }

  const ids = [];
  const angleMatches = value.match(/<[^>]+>/g) || [];
  if (angleMatches.length > 0) {
    for (const match of angleMatches) {
      const normalized = normalizeMessageId(match);
      if (normalized) ids.push(normalized);
    }
    return ids;
  }

  const normalized = normalizeMessageId(value);
  return normalized ? [normalized] : [];
}

function collectThreadMessageIds(parsed) {
  const values = [
    parsed?.inReplyTo,
    parsed?.references,
    parsed?.headers?.get?.('in-reply-to'),
    parsed?.headers?.get?.('references'),
  ];

  const collected = values.flatMap((entry) => extractMessageIds(entry));
  return Array.from(new Set(collected));
}

function extractPlainReply(text) {
  if (!text || typeof text !== 'string') return '';
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) return '';

  const delimiters = [
    /\nOn .+ wrote:\n/i,
    /\nEm .+ escreveu:\n/i,
    /\nDe:.+\nEnviada em:.+\n/i,
    /\nFrom:.+\nSent:.+\n/i,
    /\n-----Original Message-----\n/i,
  ];

  let earliestCut = normalized.length;
  for (const pattern of delimiters) {
    const match = normalized.match(pattern);
    if (match && typeof match.index === 'number' && match.index < earliestCut) {
      earliestCut = match.index;
    }
  }

  return normalized.slice(0, earliestCut).trim();
}

module.exports = {
  normalizeMessageId,
  collectThreadMessageIds,
  extractPlainReply,
};
