/**
 * Drop nodes that are obviously unusable after subscription conversion.
 *
 * Arguments:
 *   dropEmptyServer          Default: true
 *   dropEmptyPort            Default: true
 *   dropUnsupportedCipher    Default: true
 */
function operator(proxies = []) {
  const args = (typeof $arguments === 'object' && $arguments) || {};
  const dropEmptyServer = parseBoolean(args.dropEmptyServer, true);
  const dropEmptyPort = parseBoolean(args.dropEmptyPort, true);
  const dropUnsupportedCipher = parseBoolean(args.dropUnsupportedCipher, true);
  const unsupportedCiphers = new Set(['rc4', 'rc4-md5', 'table', 'bf-cfb']);

  let dropped = 0;
  const kept = proxies.filter((proxy) => {
    if (dropEmptyServer && !proxy.server) {
      dropped += 1;
      return false;
    }

    if (dropEmptyPort && !proxy.port) {
      dropped += 1;
      return false;
    }

    const type = String(proxy.type || '').toLowerCase();
    const cipher = String(proxy.cipher || '').toLowerCase();
    if (dropUnsupportedCipher && ['ss', 'ssr'].includes(type) && unsupportedCiphers.has(cipher)) {
      dropped += 1;
      return false;
    }

    return true;
  });

  log('info', `[DropInvalid] total=${proxies.length} kept=${kept.length} dropped=${dropped}`);
  return kept;
}

function parseBoolean(value, defaultValue) {
  if (value === undefined || value === null || value === '') return defaultValue;
  if (value === false || value === 0) return false;
  const normalized = String(value).trim().toLowerCase();
  if (['false', '0', 'off', 'no'].includes(normalized)) return false;
  if (['true', '1', 'on', 'yes'].includes(normalized)) return true;
  return defaultValue;
}

function log(level, message) {
  if (typeof $ === 'undefined') return;
  const fn = $[level];
  if (typeof fn === 'function') fn(message);
}

if (typeof module !== 'undefined') {
  module.exports = { operator };
}

