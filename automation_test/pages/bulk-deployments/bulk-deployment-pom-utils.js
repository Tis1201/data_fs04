function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/[—–]/g, '-')
    .trim();
}

function extractMacAddress(value) {
  return String(value || '').match(/[0-9a-f]{2}(?::[0-9a-f]{2}){5}/i)?.[0] || '';
}

module.exports = {
  escapeRegExp,
  normalizeText,
  extractMacAddress,
};
