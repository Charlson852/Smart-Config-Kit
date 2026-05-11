/**
 * Normalize noisy node names without changing routing semantics.
 *
 * Arguments:
 *   stripFlag      Remove flag emoji. Default: false
 *   separator      Separator used to replace repeated separators. Default: " "
 *   stripBrackets  Strip empty/marketing brackets. Default: true
 */
function operator(proxies = []) {
  const args = (typeof $arguments === 'object' && $arguments) || {};
  const stripFlag = parseBoolean(args.stripFlag, false);
  const stripBrackets = parseBoolean(args.stripBrackets, true);
  const separator = String(args.separator || ' ');

  let changed = 0;

  for (const proxy of proxies) {
    const before = String(proxy.name || '');
    const after = normalizeName(before, { stripFlag, stripBrackets, separator });
    if (before !== after) {
      proxy.name = after;
      changed += 1;
    }
  }

  log('info', `[NormalizeNames] total=${proxies.length} changed=${changed}`);
  return proxies;
}

const FLAG_RE = /([\uD83C][\uDDE6-\uDDFF]){2}/g;

function normalizeName(name, options) {
  let value = String(name || '');

  if (options.stripFlag) value = value.replace(FLAG_RE, '');
  if (options.stripBrackets) {
    value = value
      .replace(/[【\[]\s*(官网|剩余|流量|到期|订阅|客服|通知)\s*[】\]]/gi, '')
      .replace(/[【\[]\s*[】\]]/g, '');
  }

  return value
    .replace(/[|｜]+/g, options.separator)
    .replace(/[·•]+/g, options.separator)
    .replace(/[_]+/g, options.separator)
    .replace(/\s*-\s*/g, options.separator)
    .replace(/\s+/g, ' ')
    .replace(/^[\s|｜·•_\-]+|[\s|｜·•_\-]+$/g, '')
    .trim();
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
  module.exports = { operator, normalizeName };
}

