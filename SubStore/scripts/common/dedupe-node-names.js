/**
 * Make duplicate node names stable by appending an incrementing suffix.
 *
 * Arguments:
 *   separator   Default: " "
 *   pad         Default: 2
 *   startAt     Default: 1
 */
function operator(proxies = []) {
  const args = (typeof $arguments === 'object' && $arguments) || {};
  const separator = String(args.separator || ' ');
  const pad = Math.max(1, Number(args.pad || 2));
  const startAt = Math.max(0, Number(args.startAt || 1));

  const totals = new Map();
  const seen = new Map();

  for (const proxy of proxies) {
    const key = String(proxy.name || '');
    totals.set(key, (totals.get(key) || 0) + 1);
  }

  let changed = 0;
  for (const proxy of proxies) {
    const key = String(proxy.name || '');
    if ((totals.get(key) || 0) <= 1) continue;

    const index = (seen.get(key) || 0) + 1;
    seen.set(key, index);
    proxy.name = `${key}${separator}${String(index + startAt - 1).padStart(pad, '0')}`;
    changed += 1;
  }

  log('info', `[DedupeNames] total=${proxies.length} changed=${changed}`);
  return proxies;
}

function log(level, message) {
  if (typeof $ === 'undefined') return;
  const fn = $[level];
  if (typeof fn === 'function') fn(message);
}

if (typeof module !== 'undefined') {
  module.exports = { operator };
}

