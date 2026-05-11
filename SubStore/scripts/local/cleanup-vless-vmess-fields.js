/**
 * Remove VMess-only residue fields from VLESS nodes.
 *
 * Some converters leave `alterId` or `cipher` on VLESS entries. Mihomo does
 * not need them, and strict importers may reject mixed schema nodes.
 */
function operator(proxies = []) {
  let changed = 0;

  for (const proxy of proxies) {
    if (String(proxy.type || '').toLowerCase() !== 'vless') continue;

    if ('alterId' in proxy) {
      delete proxy.alterId;
      changed += 1;
    }

    if ('cipher' in proxy) {
      delete proxy.cipher;
      changed += 1;
    }
  }

  log('info', `[CleanVLESS] nodes=${proxies.length} removedFields=${changed}`);
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

