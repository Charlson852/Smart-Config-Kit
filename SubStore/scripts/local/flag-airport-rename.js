/**
 * Sub-Store node rename script.
 *
 * Output:
 *   <flag> <airport><separator><clean original node name>
 *
 * Arguments:
 *   name        Airport/provider name. Default: "机场"
 *   separator   Separator between airport and original name. Default: " - "
 *   useOrigFlag Prefer an existing flag in the original name. Default: true
 *   stripFlag   Remove existing flags from the original name. Default: true
 *   fallback    Flag used when region cannot be inferred. Default: "🌐"
 *
 * Example:
 *   flag-airport-rename.js#name=Aurora&separator=%20-%20&fallback=🌐
 */
function operator(proxies = [], targetPlatform, context) {
  const args = (typeof $arguments === 'object' && $arguments) || {};
  const airport = String(args.name || '机场').trim();
  const separator = args.separator !== undefined ? String(args.separator) : ' - ';
  const useOrigFlag = parseBoolean(args.useOrigFlag, true);
  const stripFlag = parseBoolean(args.stripFlag, true);
  const fallback = String(args.fallback || '🌐');

  if (!airport) {
    log('error', '[Rename] missing argument: name');
    return proxies;
  }

  let hits = 0;
  let misses = 0;

  for (const proxy of proxies) {
    const originalName = String(proxy.name || '');
    let flag = useOrigFlag ? extractFlag(originalName) : '';
    if (!flag) flag = inferFlag(originalName);

    const matched = Boolean(flag);
    if (!flag) flag = fallback;

    const cleaned = cleanName(originalName, stripFlag);
    proxy.name = cleaned ? `${flag} ${airport}${separator}${cleaned}` : `${flag} ${airport}`;

    if (matched) hits += 1;
    else misses += 1;
  }

  log('info', `[Rename] airport=${airport} total=${proxies.length} matched=${hits} missed=${misses}`);
  return proxies;
}

const FLAG_RE = /([\uD83C][\uDDE6-\uDDFF]){2}/g;

const FLAG_MAP = {
  '中国香港': '🇭🇰',
  '中国台湾': '🇹🇼',
  '中国澳门': '🇲🇴',
  '香港': '🇭🇰',
  '深港': '🇭🇰',
  'HongKong': '🇭🇰',
  'Hong Kong': '🇭🇰',
  'HKG': '🇭🇰',
  'HK': '🇭🇰',
  '台湾': '🇹🇼',
  '台灣': '🇹🇼',
  '台北': '🇹🇼',
  '台中': '🇹🇼',
  '高雄': '🇹🇼',
  'Taiwan': '🇹🇼',
  'TWN': '🇹🇼',
  'TW': '🇹🇼',
  '澳门': '🇲🇴',
  '澳門': '🇲🇴',
  'Macao': '🇲🇴',
  'Macau': '🇲🇴',
  'MO': '🇲🇴',

  '日本': '🇯🇵',
  '东京': '🇯🇵',
  '東京': '🇯🇵',
  '大阪': '🇯🇵',
  '名古屋': '🇯🇵',
  '埼玉': '🇯🇵',
  'Japan': '🇯🇵',
  'Tokyo': '🇯🇵',
  'Osaka': '🇯🇵',
  'JPN': '🇯🇵',
  'JP': '🇯🇵',
  '韩国': '🇰🇷',
  '韓國': '🇰🇷',
  '首尔': '🇰🇷',
  '首爾': '🇰🇷',
  'Korea': '🇰🇷',
  'Seoul': '🇰🇷',
  'KOR': '🇰🇷',
  'KR': '🇰🇷',

  '新加坡': '🇸🇬',
  '狮城': '🇸🇬',
  '獅城': '🇸🇬',
  'Singapore': '🇸🇬',
  'SGP': '🇸🇬',
  'SG': '🇸🇬',
  '马来西亚': '🇲🇾',
  '馬來西亞': '🇲🇾',
  '吉隆坡': '🇲🇾',
  'Malaysia': '🇲🇾',
  'MY': '🇲🇾',
  '泰国': '🇹🇭',
  '泰國': '🇹🇭',
  '曼谷': '🇹🇭',
  'Thailand': '🇹🇭',
  'TH': '🇹🇭',
  '越南': '🇻🇳',
  'Vietnam': '🇻🇳',
  'VN': '🇻🇳',
  '菲律宾': '🇵🇭',
  '菲律賓': '🇵🇭',
  'Philippines': '🇵🇭',
  'PH': '🇵🇭',
  '印度尼西亚': '🇮🇩',
  '印度尼西亞': '🇮🇩',
  '印尼': '🇮🇩',
  '雅加达': '🇮🇩',
  '巴淡': '🇮🇩',
  'Indonesia': '🇮🇩',
  'Jakarta': '🇮🇩',
  'Batam': '🇮🇩',
  'ID': '🇮🇩',
  '柬埔寨': '🇰🇭',
  'Cambodia': '🇰🇭',
  'KH': '🇰🇭',

  '美国': '🇺🇸',
  '美國': '🇺🇸',
  '洛杉矶': '🇺🇸',
  '洛杉磯': '🇺🇸',
  '硅谷': '🇺🇸',
  '纽约': '🇺🇸',
  '紐約': '🇺🇸',
  '西雅图': '🇺🇸',
  '芝加哥': '🇺🇸',
  '圣何塞': '🇺🇸',
  '达拉斯': '🇺🇸',
  '凤凰城': '🇺🇸',
  'United States': '🇺🇸',
  'America': '🇺🇸',
  'USA': '🇺🇸',
  'US': '🇺🇸',
  '加拿大': '🇨🇦',
  '多伦多': '🇨🇦',
  'Canada': '🇨🇦',
  'CAN': '🇨🇦',
  'CA': '🇨🇦',

  '英国': '🇬🇧',
  '英國': '🇬🇧',
  '伦敦': '🇬🇧',
  'United Kingdom': '🇬🇧',
  'Britain': '🇬🇧',
  'England': '🇬🇧',
  'London': '🇬🇧',
  'GBR': '🇬🇧',
  'UK': '🇬🇧',
  'GB': '🇬🇧',
  '德国': '🇩🇪',
  '德國': '🇩🇪',
  '法兰克福': '🇩🇪',
  'Germany': '🇩🇪',
  'DEU': '🇩🇪',
  'DE': '🇩🇪',
  '法国': '🇫🇷',
  '法國': '🇫🇷',
  '巴黎': '🇫🇷',
  'France': '🇫🇷',
  'FRA': '🇫🇷',
  'FR': '🇫🇷',
  '荷兰': '🇳🇱',
  '荷蘭': '🇳🇱',
  '阿姆斯特丹': '🇳🇱',
  'Netherlands': '🇳🇱',
  'NL': '🇳🇱',
  '俄罗斯': '🇷🇺',
  '俄羅斯': '🇷🇺',
  '莫斯科': '🇷🇺',
  'Russia': '🇷🇺',
  'RU': '🇷🇺',
  '意大利': '🇮🇹',
  'Italy': '🇮🇹',
  'IT': '🇮🇹',
  '西班牙': '🇪🇸',
  'Spain': '🇪🇸',
  'ES': '🇪🇸',
  '瑞士': '🇨🇭',
  'Switzerland': '🇨🇭',
  'CH': '🇨🇭',
  '瑞典': '🇸🇪',
  'Sweden': '🇸🇪',
  'SE': '🇸🇪',
  '土耳其': '🇹🇷',
  'Turkey': '🇹🇷',
  'TR': '🇹🇷',
  '乌克兰': '🇺🇦',
  'Ukraine': '🇺🇦',
  'UA': '🇺🇦',

  '澳大利亚': '🇦🇺',
  '澳大利亞': '🇦🇺',
  '澳洲': '🇦🇺',
  '悉尼': '🇦🇺',
  '墨尔本': '🇦🇺',
  'Australia': '🇦🇺',
  'Sydney': '🇦🇺',
  'AUS': '🇦🇺',
  'AU': '🇦🇺',
  '新西兰': '🇳🇿',
  'New Zealand': '🇳🇿',
  'NZ': '🇳🇿',

  '巴西': '🇧🇷',
  'Brazil': '🇧🇷',
  'BR': '🇧🇷',
  '阿根廷': '🇦🇷',
  'Argentina': '🇦🇷',
  'AR': '🇦🇷',
  '智利': '🇨🇱',
  'Chile': '🇨🇱',
  'CL': '🇨🇱',

  '印度': '🇮🇳',
  'India': '🇮🇳',
  'IN': '🇮🇳',
  '阿联酋': '🇦🇪',
  '阿聯酋': '🇦🇪',
  '迪拜': '🇦🇪',
  'Dubai': '🇦🇪',
  'UAE': '🇦🇪',
  'AE': '🇦🇪',
  '以色列': '🇮🇱',
  'Israel': '🇮🇱',
  'IL': '🇮🇱',
  '伊朗': '🇮🇷',
  'Iran': '🇮🇷',
  'IR': '🇮🇷',

  '南非': '🇿🇦',
  'South Africa': '🇿🇦',
  'ZA': '🇿🇦',
  '埃及': '🇪🇬',
  'Egypt': '🇪🇬',
  'EG': '🇪🇬',

  '中国': '🇨🇳',
  '中國': '🇨🇳',
  '上海': '🇨🇳',
  '北京': '🇨🇳',
  '广州': '🇨🇳',
  '深圳': '🇨🇳',
  'China': '🇨🇳',
  'CHN': '🇨🇳',
  'CN': '🇨🇳',
};

const SORTED_FLAG_KEYS = Object.keys(FLAG_MAP).sort((a, b) => b.length - a.length);

function parseBoolean(value, defaultValue) {
  if (value === undefined || value === null || value === '') return defaultValue;
  if (value === false || value === 0) return false;
  const normalized = String(value).trim().toLowerCase();
  if (['false', '0', 'off', 'no'].includes(normalized)) return false;
  if (['true', '1', 'on', 'yes'].includes(normalized)) return true;
  return defaultValue;
}

function extractFlag(value) {
  const match = String(value || '').match(FLAG_RE);
  return match ? match[0] : '';
}

function inferFlag(name) {
  const text = String(name || '');
  const upper = text.toUpperCase();

  for (const key of SORTED_FLAG_KEYS) {
    if (/[\u4e00-\u9fa5]/.test(key)) {
      if (text.includes(key)) return FLAG_MAP[key];
      continue;
    }

    const escaped = escapeRegExp(key.toUpperCase());
    const re = new RegExp(`(^|[^A-Z0-9])${escaped}([^A-Z0-9]|$)`);
    if (re.test(upper)) return FLAG_MAP[key];
  }

  return '';
}

function cleanName(name, stripFlag) {
  let value = String(name || '');
  if (stripFlag) value = value.replace(FLAG_RE, '');
  return value
    .replace(/\s+/g, ' ')
    .replace(/^[\s|·_\-]+|[\s|·_\-]+$/g, '')
    .trim();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function log(level, message) {
  if (typeof $ === 'undefined') return;
  const fn = $[level];
  if (typeof fn === 'function') fn(message);
}

if (typeof module !== 'undefined') {
  module.exports = { operator, inferFlag, cleanName };
}

