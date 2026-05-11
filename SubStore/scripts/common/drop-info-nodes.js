/**
 * Drop provider status/info nodes from a subscription.
 *
 * Arguments:
 *   mode        drop | mark. Default: drop
 *   markPrefix  Prefix used in mark mode. Default: [INFO]
 *   keep        Regex string. Matching info nodes will be kept.
 */
function operator(proxies = []) {
  const args = (typeof $arguments === 'object' && $arguments) || {};
  const mode = String(args.mode || 'drop').toLowerCase();
  const markPrefix = String(args.markPrefix || '[INFO]');
  const keepRe = args.keep ? new RegExp(String(args.keep), 'i') : null;

  let matched = 0;
  const output = [];

  for (const proxy of proxies) {
    const name = String(proxy.name || '');
    const isInfo = INFO_PATTERNS.some((pattern) => pattern.test(name));

    if (!isInfo || (keepRe && keepRe.test(name))) {
      output.push(proxy);
      continue;
    }

    matched += 1;

    if (mode === 'mark') {
      proxy.name = `${markPrefix} ${name}`.trim();
      output.push(proxy);
    }
  }

  log('info', `[DropInfo] total=${proxies.length} output=${output.length} matched=${matched} mode=${mode}`);
  return output;
}

const INFO_PATTERNS = [
  /剩余|流量|已用|总量|重置|到期|过期|套餐|官网|订阅|续费|工单|用户/i,
  /traffic|expire|expired|reset|remain|remaining|used|total|quota|renew|dashboard|portal|official|website|subscribe|subscription/i,
  /(\d+(\.\d+)?\s*(gb|mb|tb)\s*\/\s*\d+(\.\d+)?\s*(gb|mb|tb))/i,
  /(expire|到期).*(\d{4}[-/]\d{1,2}[-/]\d{1,2})/i,
];

function log(level, message) {
  if (typeof $ === 'undefined') return;
  const fn = $[level];
  if (typeof fn === 'function') fn(message);
}

if (typeof module !== 'undefined') {
  module.exports = { operator, INFO_PATTERNS };
}
