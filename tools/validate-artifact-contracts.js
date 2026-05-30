#!/usr/bin/env node
'use strict';

const childProcess = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');

const REPO_ROOT = path.resolve(__dirname, '..');
const EXPECTED_GROUPS = 54;
const EXPECTED_BUSINESS_GROUPS = 32;
const EXPECTED_SINGBOX_GROUPS = 53;
const EXPECTED_PASSWALL_RULES = 32;
const MIN_FULL_PROVIDERS = 380;
const MIN_FULL_RULES = 900;
const RESTRICTED_SITE = '\u{1F6AB} \u53D7\u9650\u7F51\u7AD9';
const RESTRICTED_SITE_RUBY = '\\U0001F6AB \u53D7\u9650\u7F51\u7AD9';
const CLOUD_CDN = '\u2601\uFE0F \u4E91\u4E0ECDN';
// v5.4.21 #4: DoH-over-IP bootstrap + 1 plaintext fallback
const DNS_BOOTSTRAP_DOH_OVER_IP = ['https://223.5.5.5/dns-query', 'https://223.6.6.6/dns-query', 'https://8.8.8.8/dns-query', 'https://1.1.1.1/dns-query'];
const DNS_BOOTSTRAP_IPS = [...DNS_BOOTSTRAP_DOH_OVER_IP, '223.5.5.5'];
const DNS_BOOTSTRAP_PLAINTEXT = ['223.5.5.5', '119.29.29.29', '1.1.1.1', '8.8.8.8'];
const DNS_DOMESTIC_DOH = ['https://dns.alidns.com/dns-query', 'https://doh.pub/dns-query'];
const DNS_FOREIGN_DOH = ['https://cloudflare-dns.com/dns-query', 'https://dns.google/dns-query'];
const DNS_PROXY_DOH = [...DNS_FOREIGN_DOH, ...DNS_DOMESTIC_DOH];
const STUN_DIRECT_PORTS = [3478, 3479, 5349, 19302, 19305, 19307];
const STUN_FAKE_IP_FILTER_ENTRIES = [
  '+.stun.*.*',
  '+.stun.*.*.*',
  '+.turn.*.*',
  '+.turn.*.*.*',
  'stun.l.google.com',
  'stun1.l.google.com',
  'stun2.l.google.com',
  'stun3.l.google.com',
  'stun4.l.google.com',
  'global.turn.twilio.com',
];

const ARTIFACT_FILES = [
  'Clash Party/ClashParty(mihomo-smart).js',
  'Clash Party/ClashParty(mihomo).js',
  'FlClash/FlClash(mihomo).js',
  'Clash Meta For Android/CMFA(mihomo).yaml',
  'OpenClash/OpenClash(mihomo).conf',
  'OpenClash/OpenClash(mihomo).sh',
  'OpenClash/OpenClash(mihomo-smart).sh',
  'Shadowrocket/Shadowrocket.conf',
  'Surge/Surge.conf',
  'Loon/Loon.conf',
  'Quantumult X/QuantumultX.conf',
  'SingBox/SingBox(sing-box)-full.json',
  'v2rayN/v2rayN(xray).json',
  'Passwall/Passwall(xray+sing-box)-apply.sh',
  'Passwall/Passwall(xray+sing-box).conf',
  'Passwall2/Passwall2(xray+sing-box)-apply.sh',
  'Passwall2/Passwall2(xray+sing-box).conf',
];

function usage() {
  return [
    'Usage: node tools/validate-artifact-contracts.js [--json] [--verbose]',
    '       [--write-manifest <path>] [--strict-ruby]',
    '',
    'Validates cross-client artifact contracts without changing published files.',
  ].join('\n');
}

function parseArgs(argv) {
  const options = {
    json: false,
    verbose: false,
    strictRuby: false,
    manifestPath: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      console.log(usage());
      process.exit(0);
    }
    if (arg === '--json') {
      options.json = true;
      continue;
    }
    if (arg === '--verbose') {
      options.verbose = true;
      continue;
    }
    if (arg === '--strict-ruby') {
      options.strictRuby = true;
      continue;
    }
    if (arg === '--write-manifest') {
      options.manifestPath = argv[i + 1];
      if (!options.manifestPath) throw new Error('--write-manifest requires a path');
      i += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}\n${usage()}`);
  }
  return options;
}

function relPath(...parts) {
  return path.join(REPO_ROOT, ...parts);
}

function readText(relativePath) {
  return fs.readFileSync(relPath(relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function sha256(relativePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(relPath(relativePath))).digest('hex');
}

function countMatches(source, regex) {
  const matches = source.match(regex);
  return matches ? matches.length : 0;
}

function checkNeedleBefore(record, id, source, beforeNeedle, afterNeedle) {
  const beforeIndex = source.indexOf(beforeNeedle);
  const afterIndex = source.indexOf(afterNeedle);
  record.check(`${id}.exists`, beforeIndex !== -1, failureMessage(beforeIndex !== -1, `missing ${beforeNeedle}`));
  record.check(`${id}.guard-order`, beforeIndex !== -1 && afterIndex !== -1 && beforeIndex < afterIndex, {
    message: afterIndex === -1 ? `missing ${afterNeedle}` : `${beforeNeedle} must appear before ${afterNeedle}`,
  });
}

function countLiteral(source, literal) {
  return source.split(literal).length - 1;
}

function extractJsVersion(source) {
  const match = source.match(/const\s+VERSION\s*=\s*['"]([^'"]+)['"]/);
  return match ? match[1] : null;
}

function extractVersionPrefix(version) {
  const match = String(version || '').match(/^(v\d+\.\d+\.\d+)/);
  return match ? match[1] : null;
}

function compileJs(relativePath) {
  const source = readText(relativePath);
  new vm.Script(source, { filename: relativePath });
  return source;
}

function extractYamlBlock(source, key) {
  const lines = source.split(/\r?\n/);
  const output = [];
  let inBlock = false;
  for (const line of lines) {
    if (line === `${key}:`) {
      inBlock = true;
      continue;
    }
    if (inBlock && /^[A-Za-z0-9_.-]+:/.test(line)) break;
    if (inBlock) output.push(line);
  }
  return output.join('\n');
}

function extractOpenClashOverride(relativePath) {
  const source = readText(relativePath);
  const output = [];
  let inBlock = false;
  for (const line of source.split(/\r?\n/)) {
    if (/^cat (?:>|>>) "\$OVERRIDE_YAML" << '?OVERRIDE_EOF'?/.test(line)) {
      inBlock = true;
      continue;
    }
    if (line === 'OVERRIDE_EOF') {
      inBlock = false;
      continue;
    }
    if (inBlock) output.push(line);
  }
  return `${output.join('\n')}\n`;
}

function extractIndentedListBlock(source, key) {
  const lines = source.split(/\r?\n/);
  const output = [];
  let inBlock = false;
  const keyPattern = new RegExp(`^\\s*${key}:\\s*$`);
  for (const line of lines) {
    if (keyPattern.test(line)) {
      inBlock = true;
      continue;
    }
    if (inBlock && /^\s*[A-Za-z0-9_.-]+:/.test(line)) break;
    if (inBlock) output.push(line.trim());
  }
  return output.join('\n');
}

function extractYamlListItems(source, key) {
  return extractIndentedListBlock(source, key)
    .split(/\r?\n/)
    .map((line) => {
      const match = line.trim().match(/^-\s+(.+?)\s*$/);
      return match ? match[1].replace(/^['"]|['"]$/g, '') : null;
    })
    .filter(Boolean);
}

function checkExactList(record, id, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  record.check(id, ok, failureMessage(ok, `expected ${JSON.stringify(expected)} got ${JSON.stringify(actual)}`));
}

function listFiles(relativeDir) {
  return fs.readdirSync(relPath(relativeDir), { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(relativeDir, entry.name).replace(/\\/g, '/'))
    .sort();
}

function findRuby() {
  const candidates = [];
  if (process.env.RUBY) candidates.push(process.env.RUBY);
  candidates.push('ruby');
  if (process.platform === 'win32') {
    candidates.push('C:\\Ruby33-x64\\bin\\ruby.exe');
    candidates.push('C:\\Ruby34-x64\\bin\\ruby.exe');
    candidates.push('C:\\Ruby32-x64\\bin\\ruby.exe');
  }
  for (const candidate of candidates) {
    try {
      const result = childProcess.spawnSync(candidate, ['-v'], { encoding: 'utf8' });
      if (result.status === 0) return candidate;
    } catch {
      // Try the next candidate.
    }
  }
  return null;
}

function rubyOpenClashProbe(yamlText, rubyPath) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scki-openclash-'));
  const yamlPath = path.join(tempDir, 'override.yaml');
  fs.writeFileSync(yamlPath, yamlText, 'utf8');
  const rubyScript = [
    'require "yaml"',
    'require "json"',
    'path = ARGV.fetch(0)',
    'raw = File.read(path, encoding: "UTF-8")',
    'data = YAML.load_file(path, permitted_classes: [Symbol], aliases: true)',
    'puts JSON.generate({',
    '  top_providers: raw.scan(/^rule-providers:$/).length,',
    '  top_rules: raw.scan(/^rules:$/).length,',
    '  providers: (data["rule-providers"] || {}).size,',
    '  rules: (data["rules"] || []).size,',
    '  groups: (data["proxy-groups"] || []).size',
    '})',
  ].join('\n');
  const result = childProcess.spawnSync(rubyPath, ['-e', rubyScript, yamlPath], { encoding: 'utf8' });
  fs.rmSync(tempDir, { recursive: true, force: true });
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || 'Ruby YAML probe failed').trim());
  }
  return JSON.parse(result.stdout);
}

function makeRecorder() {
  const checks = [];
  const failures = [];
  const warnings = [];
  return {
    checks,
    failures,
    warnings,
    check(id, condition, details = {}) {
      checks.push({ id, ok: Boolean(condition), ...details });
      if (!condition) failures.push(`${id}${details.message ? `: ${details.message}` : ''}`);
    },
    warn(id, message) {
      warnings.push(`${id}: ${message}`);
    },
  };
}

function failureMessage(condition, message) {
  return condition ? {} : { message };
}

function validateJsProducts(record) {
  const smart = compileJs('Clash Party/ClashParty(mihomo-smart).js');
  const normal = compileJs('Clash Party/ClashParty(mihomo).js');
  const flclash = compileJs('FlClash/FlClash(mihomo).js');
  const baselineVersion = extractJsVersion(smart);
  const baselinePrefix = extractVersionPrefix(baselineVersion);
  const normalVersion = extractJsVersion(normal);
  const flclashVersion = extractJsVersion(flclash);

  record.check('js.smart.version', /^v\d+\.\d+\.\d+$/.test(String(baselineVersion)), { value: baselineVersion, message: `got ${baselineVersion}` });
  record.check('js.normal.version-prefix', Boolean(baselinePrefix && normalVersion && normalVersion.startsWith(`${baselinePrefix}-normal`)), { value: normalVersion });
  record.check('js.flclash.version-prefix', Boolean(baselinePrefix && flclashVersion && flclashVersion.startsWith(`${baselinePrefix}-flclash`)), { value: flclashVersion });
  return { baselineVersion, baselinePrefix };
}

function validateClashYaml(record, baselineVersion) {
  const file = 'Clash Meta For Android/CMFA(mihomo).yaml';
  const source = readText(file);
  const providersBlock = extractYamlBlock(source, 'rule-providers');
  const rulesBlock = extractYamlBlock(source, 'rules');
  const groupCount = countMatches(source, /^- name: |^  name: /gm);
  const providerCount = countMatches(providersBlock, /^  [^ #][^:]+:\s*$/gm);
  const ruleCount = countMatches(rulesBlock, /^- /gm);

  record.check('cmfa.group-count', groupCount === EXPECTED_GROUPS, { value: groupCount });
  record.check('cmfa.provider-count', providerCount >= MIN_FULL_PROVIDERS, { value: providerCount });
  record.check('cmfa.rule-count', ruleCount >= MIN_FULL_RULES, { value: ruleCount });
  const hasBaselineHeader = source.includes(`Clash Party ${baselineVersion}`);
  record.check('cmfa.baseline-header', hasBaselineHeader, failureMessage(hasBaselineHeader, `missing Clash Party ${baselineVersion}`));
  record.check('cmfa.rule-provider-singleton', countMatches(source, /^rule-providers:$/gm) === 1, { value: countMatches(source, /^rule-providers:$/gm) });
  record.check('cmfa.rules-singleton', countMatches(source, /^rules:$/gm) === 1, { value: countMatches(source, /^rules:$/gm) });
  record.check('cmfa.no-direct-provider-downloads', !/proxy:\s*['"]?DIRECT['"]?/.test(source));
  record.check('cmfa.no-cloud-cdn-provider-downloads', !source.includes(CLOUD_CDN));
  record.check('cmfa.restricted-provider-downloads', countLiteral(source, RESTRICTED_SITE) >= MIN_FULL_PROVIDERS, {
    value: countLiteral(source, RESTRICTED_SITE),
  });
  const fakeIpFilterBlock = extractIndentedListBlock(source, 'fake-ip-filter');
  record.check('cmfa.fake-ip-filter-blacklist-mode', /fake-ip-filter-mode:\s*blacklist/.test(source));
  const hasNoFakeIpRuleSetRefs = !/RULE-SET,/.test(fakeIpFilterBlock);
  record.check(
    'cmfa.fake-ip-filter-no-ruleset-references',
    hasNoFakeIpRuleSetRefs,
    failureMessage(hasNoFakeIpRuleSetRefs, 'fake-ip blacklist mode must not contain rule-mode RULE-SET entries'),
  );
  for (const entry of STUN_FAKE_IP_FILTER_ENTRIES) {
    const hasEntry = fakeIpFilterBlock.includes(entry);
    record.check(`cmfa.fake-ip-filter.${entry}`, hasEntry, failureMessage(hasEntry, `missing ${entry}`));
  }
  for (const entry of ['+.msftconnecttest.com', '+.msftncsi.com', '+.in-addr.arpa', '+.ip6.arpa']) {
    const hasEntry = fakeIpFilterBlock.includes(entry);
    record.check(`cmfa.fake-ip-filter.${entry}`, hasEntry, failureMessage(hasEntry, `missing ${entry}`));
  }
  record.check('cmfa.dns.prefer-h3-disabled-with-respect-rules', /prefer-h3:\s*false/.test(source));
  record.check('cmfa.dns.respect-rules-enabled', /respect-rules:\s*true/.test(source));
  record.check('cmfa.dns.cache-arc', /cache-algorithm:\s*arc/.test(source));
  // v5.4.22 review (FIX#HOSTS-DEDUP 防复发)：dns 块标量键不得重复（YAML last-wins 静默覆盖）
  for (const dnsKey of ['use-hosts', 'use-system-hosts', 'enhanced-mode', 'prefer-h3', 'respect-rules']) {
    const dupN = countMatches(source, new RegExp(`^\\s+${dnsKey}:`, 'gm'));
    if (dupN >= 1) record.check(`cmfa.dns.singleton.${dnsKey}`, dupN === 1, { value: dupN, message: `dns 块标量键 ${dnsKey} 出现 ${dupN} 次（重复键 → YAML last-wins 静默覆盖）` });
  }
  record.check('cmfa.dns.githubusercontent-policy', /['"]?\+\.githubusercontent\.com['"]?:/.test(source));
  record.check('cmfa.dns.fallback-geosite-gfw', /fallback-filter:[^]*?geosite:[^]*?-\s*gfw/.test(source));
  record.check('cmfa.dns.fallback-geosite-not-cn', /fallback-filter:[^]*?geosite:[^]*?-\s*geolocation-!cn/.test(source));
  checkExactList(record, 'cmfa.dns.default-nameserver-exact', extractYamlListItems(source, 'default-nameserver'), DNS_BOOTSTRAP_IPS);
  checkExactList(record, 'cmfa.dns.nameserver-exact', extractYamlListItems(source, 'nameserver'), DNS_DOMESTIC_DOH);
  checkExactList(record, 'cmfa.dns.direct-nameserver-exact', extractYamlListItems(source, 'direct-nameserver'), DNS_DOMESTIC_DOH);
  checkExactList(record, 'cmfa.dns.proxy-server-nameserver-exact', extractYamlListItems(source, 'proxy-server-nameserver'), DNS_PROXY_DOH);
  checkExactList(record, 'cmfa.dns.fallback-exact', extractYamlListItems(source, 'fallback'), DNS_FOREIGN_DOH);
  for (const port of STUN_DIRECT_PORTS) {
    const hasPortRule = source.includes(`DST-PORT,${port},DIRECT`);
    record.check(`cmfa.stun-port.${port}`, hasPortRule, failureMessage(hasPortRule, `missing DST-PORT,${port},DIRECT`));
  }
  checkNeedleBefore(
    record,
    'cmfa.cloudflarestorage-before-ads',
    source,
    "'DOMAIN-SUFFIX,cloudflarestorage.com,🌐 国外网站'",
    "'RULE-SET,anti-ad,🛑 广告拦截'",
  );
}

function validateOpenClash(record, baselineVersion, options) {
  const conf = readText('OpenClash/OpenClash(mihomo).conf');
  if (!conf.includes(baselineVersion)) {
    record.warn('openclash.conf.baseline', `OpenClash(mihomo).conf does not advertise ${baselineVersion}; primary .sh artifacts remain authoritative`);
  }

  const rubyPath = findRuby();
  if (!rubyPath) {
    const message = 'Ruby not found; exact OpenClash heredoc YAML parsing skipped';
    if (options.strictRuby) record.check('openclash.ruby-available', false, { message });
    else record.warn('openclash.ruby-available', message);
  } else if (options.verbose && !options.json) {
    console.log(`Ruby probe: ${rubyPath}`);
  }

  for (const spec of [
    { id: 'normal', file: 'OpenClash/OpenClash(mihomo).sh', minProviders: 130, minRules: MIN_FULL_RULES },
    { id: 'smart', file: 'OpenClash/OpenClash(mihomo-smart).sh', minProviders: MIN_FULL_PROVIDERS, minRules: MIN_FULL_RULES },
  ]) {
    const source = readText(spec.file);
    const yaml = extractOpenClashOverride(spec.file);
    const staticBizGroups = countMatches(source, /^- name: /gm);
    const topProviders = countMatches(yaml, /^rule-providers:$/gm);
    const topRules = countMatches(yaml, /^rules:$/gm);
    const restrictedCount = countLiteral(source, RESTRICTED_SITE_RUBY);

    record.check(`openclash.${spec.id}.static-business-groups`, staticBizGroups === EXPECTED_BUSINESS_GROUPS, { value: staticBizGroups });
    const hasBaselineHeader = source.includes(`Clash Party ${baselineVersion}`);
    record.check(`openclash.${spec.id}.baseline-header`, hasBaselineHeader, failureMessage(hasBaselineHeader, `missing Clash Party ${baselineVersion}`));
    record.check(`openclash.${spec.id}.rule-provider-singleton`, topProviders === 1, { value: topProviders });
    record.check(`openclash.${spec.id}.rules-singleton`, topRules === 1, { value: topRules });
    record.check(`openclash.${spec.id}.no-direct-provider-downloads`, !/proxy:\s*['"]?DIRECT['"]?/.test(source));
    record.check(`openclash.${spec.id}.restricted-provider-downloads`, restrictedCount >= spec.minProviders, { value: restrictedCount });
    for (const entry of STUN_FAKE_IP_FILTER_ENTRIES) {
      const hasEntry = yaml.includes(entry);
      record.check(`openclash.${spec.id}.fake-ip-filter.${entry}`, hasEntry, failureMessage(hasEntry, `missing ${entry}`));
    }
    for (const entry of ['+.msftconnecttest.com', '+.msftncsi.com', '+.in-addr.arpa', '+.ip6.arpa']) {
      const hasEntry = yaml.includes(entry);
      record.check(`openclash.${spec.id}.fake-ip-filter.${entry}`, hasEntry, failureMessage(hasEntry, `missing ${entry}`));
    }
    record.check(`openclash.${spec.id}.dns.prefer-h3-disabled-with-respect-rules`, /prefer-h3:\s*false/.test(yaml));
    record.check(`openclash.${spec.id}.dns.respect-rules-enabled`, /respect-rules:\s*true/.test(yaml));
    record.check(`openclash.${spec.id}.dns.cache-arc`, /cache-algorithm:\s*arc/.test(yaml));
    // v5.4.22 review (FIX#HOSTS-DEDUP 防复发)：dns 块标量键不得重复——YAML last-wins 会静默覆盖前者，
    //   #159(#4) 曾用重复 `use-hosts: false` 回退 #156 的 `use-hosts: true`，validator 此前未覆盖嵌套层重复键。
    for (const dnsKey of ['use-hosts', 'use-system-hosts', 'enhanced-mode', 'prefer-h3', 'respect-rules']) {
      const dupN = countMatches(source, new RegExp(`^\\s+${dnsKey}:`, 'gm'));
      if (dupN >= 1) record.check(`openclash.${spec.id}.dns.singleton.${dnsKey}`, dupN === 1, { value: dupN, message: `dns 块标量键 ${dnsKey} 出现 ${dupN} 次（重复键 → YAML last-wins 静默覆盖；见 FIX#HOSTS-DEDUP）` });
    }
    record.check(`openclash.${spec.id}.dns.githubusercontent-policy`, /['"]?\+\.githubusercontent\.com['"]?:/.test(yaml));
    record.check(`openclash.${spec.id}.dns.fallback-geosite-gfw`, /fallback-filter:[^]*?geosite:[^]*?-\s*gfw/.test(yaml));
    record.check(`openclash.${spec.id}.dns.fallback-geosite-not-cn`, /fallback-filter:[^]*?geosite:[^]*?-\s*geolocation-!cn/.test(yaml));
    checkExactList(record, `openclash.${spec.id}.dns.default-nameserver-exact`, extractYamlListItems(yaml, 'default-nameserver'), DNS_BOOTSTRAP_IPS);
    checkExactList(record, `openclash.${spec.id}.dns.nameserver-exact`, extractYamlListItems(yaml, 'nameserver'), DNS_DOMESTIC_DOH);
    checkExactList(record, `openclash.${spec.id}.dns.direct-nameserver-exact`, extractYamlListItems(yaml, 'direct-nameserver'), DNS_DOMESTIC_DOH);
    checkExactList(record, `openclash.${spec.id}.dns.proxy-server-nameserver-exact`, extractYamlListItems(yaml, 'proxy-server-nameserver'), DNS_PROXY_DOH);
    checkExactList(record, `openclash.${spec.id}.dns.fallback-exact`, extractYamlListItems(yaml, 'fallback'), DNS_FOREIGN_DOH);
    for (const port of STUN_DIRECT_PORTS) {
      const hasPortRule = yaml.includes(`DST-PORT,${port},DIRECT`);
      record.check(`openclash.${spec.id}.stun-port.${port}`, hasPortRule, failureMessage(hasPortRule, `missing DST-PORT,${port},DIRECT`));
    }
    checkNeedleBefore(
      record,
      `openclash.${spec.id}.cloudflarestorage-before-ads`,
      source,
      'DOMAIN-SUFFIX,cloudflarestorage.com,🌐 国外网站',
      'RULE-SET,anti-ad,\\U0001F6D1 广告拦截',
    );

    if (rubyPath) {
      try {
        const parsed = rubyOpenClashProbe(yaml, rubyPath);
        record.check(`openclash.${spec.id}.ruby-top-provider-singleton`, parsed.top_providers === 1, { value: parsed.top_providers });
        record.check(`openclash.${spec.id}.ruby-top-rules-singleton`, parsed.top_rules === 1, { value: parsed.top_rules });
        record.check(`openclash.${spec.id}.ruby-provider-count`, parsed.providers >= spec.minProviders, { value: parsed.providers });
        record.check(`openclash.${spec.id}.ruby-rule-count`, parsed.rules >= spec.minRules, { value: parsed.rules });
        record.check(`openclash.${spec.id}.ruby-business-group-count`, parsed.groups === EXPECTED_BUSINESS_GROUPS, { value: parsed.groups });
      } catch (error) {
        record.check(`openclash.${spec.id}.ruby-parse`, false, { message: error.message });
      }
    }
  }
}

function validateConfProducts(record, baselineVersion) {
  const specs = [
    { id: 'shadowrocket', file: 'Shadowrocket/Shadowrocket.conf', regex: / = select,|= url-test,/g },
    { id: 'surge', file: 'Surge/Surge.conf', regex: / = select,|= url-test,/g },
    { id: 'loon', file: 'Loon/Loon.conf', regex: / = select,|= url-test,/g },
    { id: 'qx', file: 'Quantumult X/QuantumultX.conf', regex: /^(url-latency-benchmark|static)=/gm },
  ];
  for (const spec of specs) {
    const source = readText(spec.file);
    const groupCount = countMatches(source, spec.regex);
    record.check(`${spec.id}.group-count`, groupCount === EXPECTED_GROUPS, { value: groupCount });
    const hasBaselineHeader = source.includes(`Clash Party ${baselineVersion}`);
    record.check(`${spec.id}.baseline-header`, hasBaselineHeader, failureMessage(hasBaselineHeader, `missing Clash Party ${baselineVersion}`));
    record.check(`${spec.id}.changelog-reference`, source.includes('CHANGELOG.md'));
  }

  const shadowrocket = readText('Shadowrocket/Shadowrocket.conf');
  const surge = readText('Surge/Surge.conf');
  const loon = readText('Loon/Loon.conf');
  const qx = readText('Quantumult X/QuantumultX.conf');
  // v5.4.18: normalize whitespace around commas to avoid false failures on cosmetic formatting changes
  const srNorm = (s) => s.replace(/\s*,\s*/g, ',');
  // v5.4.21 #4: DoH-over-IP — all DoH URLs use IP host to eliminate bootstrap leak
  record.check('shadowrocket.dns.nameserver-doh-over-ip', srNorm(shadowrocket).includes('dns-server = https://223.5.5.5/dns-query,https://223.6.6.6/dns-query,https://8.8.8.8/dns-query,https://1.1.1.1/dns-query'));
  record.check('shadowrocket.dns.proxy-server-doh-over-ip', srNorm(shadowrocket).includes('proxy-dns-server = https://8.8.8.8/dns-query,https://1.1.1.1/dns-query,https://223.5.5.5/dns-query,https://223.6.6.6/dns-query'));
  record.check('shadowrocket.dns.fallback-doh-over-ip', srNorm(shadowrocket).includes('fallback-dns-server = https://8.8.8.8/dns-query,https://1.1.1.1/dns-query'));
  record.check('surge.dns.bootstrap-plaintext-fallback', surge.includes('dns-server = 223.5.5.5, 119.29.29.29, 1.1.1.1, 8.8.8.8'));
  record.check('surge.dns.encrypted-doh-over-ip', surge.includes('encrypted-dns-server = https://223.5.5.5/dns-query, https://223.6.6.6/dns-query, https://8.8.8.8/dns-query, https://1.1.1.1/dns-query'));
  record.check('surge.dns.fallback-doh-over-ip', surge.includes('fallback-dns-server = https://8.8.8.8/dns-query, https://1.1.1.1/dns-query'));
  record.check('loon.dns.bootstrap-plaintext-fallback', loon.includes('dns-server = 223.5.5.5, 119.29.29.29, 1.1.1.1, 8.8.8.8'));
  record.check('loon.dns.doh-over-ip', loon.includes('doh-server = https://223.5.5.5/dns-query, https://223.6.6.6/dns-query, https://8.8.8.8/dns-query, https://1.1.1.1/dns-query'));
  for (const server of DNS_BOOTSTRAP_PLAINTEXT) record.check(`qx.dns.server.${server}`, qx.includes(`server=${server}`));
  for (const server of DNS_BOOTSTRAP_DOH_OVER_IP) record.check(`qx.dns.doh-server.${server}`, qx.includes(`doh-server=${server}`));
  for (const port of STUN_DIRECT_PORTS) {
    const srHasPortRule = shadowrocket.includes(`DST-PORT,${port},DIRECT`);
    const surgeHasPortRule = surge.includes(`DEST-PORT,${port},DIRECT`);
    const loonHasPortRule = loon.includes(`DEST-PORT,${port},DIRECT`);
    const qxHasPortRule = qx.includes(`dst-port, ${port}, DIRECT`);
    record.check(`shadowrocket.stun-port.${port}`, srHasPortRule, failureMessage(srHasPortRule, `missing DST-PORT,${port},DIRECT`));
    record.check(`surge.stun-port.${port}`, surgeHasPortRule, failureMessage(surgeHasPortRule, `missing DEST-PORT,${port},DIRECT`));
    record.check(`loon.stun-port.${port}`, loonHasPortRule, failureMessage(loonHasPortRule, `missing DEST-PORT,${port},DIRECT`));
    record.check(`qx.stun-port.${port}`, qxHasPortRule, failureMessage(qxHasPortRule, `missing dst-port, ${port}, DIRECT`));
  }

  const loonHasNoDstPortPrefix = !loon.split(/\r?\n/).some((line) => /^DST-PORT,/.test(line));
  record.check(
    'loon.no-dst-port-prefix',
    loonHasNoDstPortPrefix,
    failureMessage(loonHasNoDstPortPrefix, 'Loon must use DEST-PORT, not DST-PORT'),
  );

  const surgeHasNoDstPortPrefix = !surge.split(/\r?\n/).some((line) => /^DST-PORT,/.test(line));
  record.check(
    'surge.no-dst-port-prefix',
    surgeHasNoDstPortPrefix,
    failureMessage(surgeHasNoDstPortPrefix, 'Surge must use DEST-PORT, not DST-PORT'),
  );

  const qxHasNoDohUrlInServerField = !qx.split(/\r?\n/).some((line) => /^server=https:\/\//.test(line));
  record.check(
    'qx.no-doh-url-in-server-field',
    qxHasNoDohUrlInServerField,
    failureMessage(qxHasNoDohUrlInServerField, 'QX DoH URLs must use doh-server='),
  );
  const qxHasValidRunningModeTrigger = !/^running_mode_trigger=.*\bfilter\b/m.test(qx);
  record.check(
    'qx.running-mode-trigger-values',
    qxHasValidRunningModeTrigger,
    failureMessage(qxHasValidRunningModeTrigger, 'QX running_mode_trigger cannot use filter'),
  );
  checkNeedleBefore(
    record,
    'shadowrocket.cloudflarestorage-before-ads',
    shadowrocket,
    'DOMAIN-SUFFIX,cloudflarestorage.com,🌐 国外网站',
    'RULE-SET,https://fastly.jsdelivr.net/gh/privacy-protection-tools/anti-AD@master/anti-ad-surge.txt,🛑 广告拦截',
  );
  checkNeedleBefore(
    record,
    'surge.cloudflarestorage-before-ads',
    surge,
    'DOMAIN-SUFFIX,cloudflarestorage.com,🌐 国外网站',
    'RULE-SET,https://fastly.jsdelivr.net/gh/privacy-protection-tools/anti-AD@master/anti-ad-surge.txt,🛑 广告拦截',
  );
  const loonLocalRule = /^DOMAIN-SUFFIX,cloudflarestorage\.com,🌐 国外网站$/m.test(loon);
  record.check('loon.cloudflarestorage-local-rule', loonLocalRule, failureMessage(loonLocalRule, 'missing local Cloudflare R2 override rule'));
  checkNeedleBefore(
    record,
    'qx.cloudflarestorage-before-ads',
    qx,
    'host-suffix, cloudflarestorage.com, 🌐 国外网站',
    'https://fastly.jsdelivr.net/gh/privacy-protection-tools/anti-AD@master/anti-ad-surge.txt, tag=surge, force-policy=🛑 广告拦截',
  );
}

function validateJsonProducts(record, baselineVersion) {
  const singbox = readJson('SingBox/SingBox(sing-box)-full.json');
  const selectorCount = (singbox.outbounds || []).filter((outbound) => outbound.type === 'selector' || outbound.type === 'urltest').length;
  const ruleSetCount = ((singbox.route || {}).rule_set || []).length;
  const routeRuleCount = ((singbox.route || {}).rules || []).length;
  const dnsRules = ((singbox.dns || {}).rules || []);
  const dnsServers = ((singbox.dns || {}).servers || []);
  const dnsServerByTag = Object.fromEntries(dnsServers.filter((server) => server && server.tag).map((server) => [server.tag, server]));
  record.check('singbox.baseline-meta', singbox._meta && singbox._meta.baseline === `Clash Party ${baselineVersion}`, { value: singbox._meta && singbox._meta.baseline });
  record.check('singbox.selector-urltest-count', selectorCount === EXPECTED_SINGBOX_GROUPS, { value: selectorCount });
  record.check('singbox.rule-set-count', ruleSetCount >= 30, { value: ruleSetCount });
  record.check('singbox.route-rule-count', routeRuleCount >= 600, { value: routeRuleCount });
  record.check('singbox.dns.bootstrap-doh-over-ip', dnsServerByTag.dns_bootstrap && dnsServerByTag.dns_bootstrap.address === 'https://223.5.5.5/dns-query' && dnsServerByTag.dns_bootstrap.tls && dnsServerByTag.dns_bootstrap.tls.server_name === 'dns.alidns.com', {
    value: dnsServerByTag.dns_bootstrap && dnsServerByTag.dns_bootstrap.address,
  });
  record.check('singbox.dns.direct-doh', dnsServerByTag.dns_direct && dnsServerByTag.dns_direct.address === 'https://dns.alidns.com/dns-query', {
    value: dnsServerByTag.dns_direct && dnsServerByTag.dns_direct.address,
  });
  record.check('singbox.dns.proxy-doh', dnsServerByTag.dns_proxy && dnsServerByTag.dns_proxy.address === 'https://cloudflare-dns.com/dns-query', {
    value: dnsServerByTag.dns_proxy && dnsServerByTag.dns_proxy.address,
  });
  record.check('singbox.dns.direct-bootstrap-resolver', dnsServerByTag.dns_direct && dnsServerByTag.dns_direct.address_resolver === 'dns_bootstrap');
  record.check('singbox.dns.proxy-bootstrap-resolver', dnsServerByTag.dns_proxy && dnsServerByTag.dns_proxy.address_resolver === 'dns_bootstrap');
  record.check('singbox.dns.proxy-detour-main-selector', dnsServerByTag.dns_proxy && dnsServerByTag.dns_proxy.detour === '🚀 节点选择', {
    value: dnsServerByTag.dns_proxy && dnsServerByTag.dns_proxy.detour,
  });
  // v5.4.18: verify DNS redundancy — bootstrap/direct/proxy each have backup servers
  record.check('singbox.dns.bootstrap-redundancy', dnsServers.filter((s) => s.tag && s.tag.startsWith('dns_bootstrap')).length >= 2, {
    value: dnsServers.filter((s) => s.tag && s.tag.startsWith('dns_bootstrap')).map((s) => s.tag),
  });
  record.check('singbox.dns.direct-redundancy', dnsServers.filter((s) => s.tag && s.tag.startsWith('dns_direct')).length >= 2, {
    value: dnsServers.filter((s) => s.tag && s.tag.startsWith('dns_direct')).map((s) => s.tag),
  });
  record.check('singbox.dns.proxy-redundancy', dnsServers.filter((s) => s.tag && s.tag.startsWith('dns_proxy')).length >= 2, {
    value: dnsServers.filter((s) => s.tag && s.tag.startsWith('dns_proxy')).map((s) => s.tag),
  });
  const singboxPrivateDnsDirect = dnsRules.some((rule) => (
    Array.isArray(rule.rule_set) && rule.rule_set.includes('geosite-private') && rule.server === 'dns_direct'
  ));
  record.check('singbox.dns.private-direct', singboxPrivateDnsDirect, failureMessage(singboxPrivateDnsDirect, 'geosite-private DNS must use dns_direct'));
  const singboxCnDnsDirect = dnsRules.some((rule) => (
    Array.isArray(rule.rule_set)
      && rule.rule_set.includes('cn')
      && rule.rule_set.includes('cn-ip')
      && rule.server === 'dns_direct'
  ));
  record.check('singbox.dns.cn-direct', singboxCnDnsDirect, failureMessage(singboxCnDnsDirect, 'cn and cn-ip DNS must use dns_direct'));
  record.check('singbox.dns.final-proxy', (singbox.dns || {}).final === 'dns_proxy', { value: (singbox.dns || {}).final });
  for (const port of STUN_DIRECT_PORTS) {
    const hasPortRule = ((singbox.route || {}).rules || []).some((rule) => (
      Array.isArray(rule.port) && rule.port.includes(port) && rule.outbound === 'DIRECT'
    ));
    record.check(`singbox.stun-port.${port}`, hasPortRule, failureMessage(hasPortRule, `missing route rule for port ${port} -> DIRECT`));
  }
  const singboxRules = (singbox.route || {}).rules || [];
  const singboxCloudflareR2Index = singboxRules.findIndex((rule) => (
    Array.isArray(rule.domain_suffix) && rule.domain_suffix.includes('cloudflarestorage.com') && rule.outbound === '🌐 国外网站'
  ));
  const singboxAntiAdIndex = singboxRules.findIndex((rule) => (
    Array.isArray(rule.rule_set) && rule.rule_set.includes('anti-ad') && rule.action === 'reject'
  ));
  record.check('singbox.cloudflarestorage-before-ads', singboxCloudflareR2Index !== -1 && singboxAntiAdIndex !== -1 && singboxCloudflareR2Index < singboxAntiAdIndex, {
    value: { cloudflarestorage: singboxCloudflareR2Index, antiAd: singboxAntiAdIndex },
  });

  const v2rayn = readJson('v2rayN/v2rayN(xray).json');
  const allowedTags = new Set(['proxy', 'direct', 'block']);
  record.check('v2rayn.top-level-array', Array.isArray(v2rayn));
  record.check('v2rayn.rule-count', Array.isArray(v2rayn) && v2rayn.length >= 30, { value: Array.isArray(v2rayn) ? v2rayn.length : null });
  record.check('v2rayn.baseline-remarks', Array.isArray(v2rayn) && String(v2rayn[0] && v2rayn[0].remarks).includes(`Clash Party ${baselineVersion}`));
  record.check('v2rayn.outbound-tags', Array.isArray(v2rayn) && v2rayn.every((rule) => allowedTags.has(rule.outboundTag)), {
    value: Array.isArray(v2rayn) ? Array.from(new Set(v2rayn.map((rule) => rule.outboundTag))).sort() : null,
  });
  for (const port of STUN_DIRECT_PORTS) {
    const hasPortRule = Array.isArray(v2rayn) && v2rayn.some((rule) => (
      rule.outboundTag === 'direct' && String(rule.port || '').split(',').map((item) => item.trim()).includes(String(port))
    ));
    record.check(`v2rayn.stun-port.${port}`, hasPortRule, failureMessage(hasPortRule, `missing port ${port} -> direct`));
  }
  const v2CloudflareR2Index = Array.isArray(v2rayn) ? v2rayn.findIndex((rule) => (
    rule.outboundTag === 'proxy' && Array.isArray(rule.domain) && rule.domain.includes('domain:cloudflarestorage.com')
  )) : -1;
  const v2AdsIndex = Array.isArray(v2rayn) ? v2rayn.findIndex((rule) => rule.id === 'scki-001-ads') : -1;
  record.check('v2rayn.cloudflarestorage-before-ads', v2CloudflareR2Index !== -1 && v2AdsIndex !== -1 && v2CloudflareR2Index < v2AdsIndex, {
    value: { cloudflarestorage: v2CloudflareR2Index, ads: v2AdsIndex },
  });
}

function validatePasswall(record, baselineVersion) {
  for (const spec of [
    { id: 'passwall', file: 'Passwall/Passwall(xray+sing-box)-apply.sh', reference: 'Passwall/Passwall(xray+sing-box).conf', dir: 'Passwall/shunt-rules' },
    { id: 'passwall2', file: 'Passwall2/Passwall2(xray+sing-box)-apply.sh', reference: 'Passwall2/Passwall2(xray+sing-box).conf', dir: 'Passwall2/shunt-rules' },
  ]) {
    const source = readText(spec.file);
    const reference = readText(spec.reference);
    const shuntFiles = listFiles(spec.dir).filter((file) => file.endsWith('.list'));
    const ruleAdds = countMatches(source, /uci add \$\{CONFIG_NAME\} shunt_rules/g);
    const hasBaselineHeader = source.includes(baselineVersion);
    record.check(`${spec.id}.baseline-header`, hasBaselineHeader, failureMessage(hasBaselineHeader, `missing ${baselineVersion}`));
    record.check(`${spec.id}.script-rule-count`, ruleAdds === EXPECTED_PASSWALL_RULES, { value: ruleAdds });
    record.check(`${spec.id}.list-file-count`, shuntFiles.length === EXPECTED_PASSWALL_RULES, { value: shuntFiles.length });
    if (!reference.includes(baselineVersion)) {
      record.warn(`${spec.id}.reference-conf.baseline`, `${spec.reference} does not advertise ${baselineVersion}; apply script plus shunt-rules are authoritative`);
    }
    record.check(`${spec.id}.cloudflarestorage-script-rule`, source.includes("domain_list='domain:cloudflarestorage.com'"));
    record.check(`${spec.id}.cloudflarestorage-reference-rule`, reference.includes('domain:cloudflarestorage.com'));
    for (const file of shuntFiles) {
      const badLine = readText(file).split(/\r?\n/).find((line) => !/^\s*#/.test(line) && /^(DOMAIN|DOMAIN-SUFFIX|DOMAIN-KEYWORD|IP-CIDR|IP-CIDR6|RULE-SET),/.test(line));
      record.check(`${spec.id}.${path.basename(file)}.passwall-syntax`, !badLine, { message: badLine ? `Clash-style prefix: ${badLine}` : undefined });
    }
    const intlSiteList = readText(path.join(spec.dir, '29-intl-site.list'));
    record.check(`${spec.id}.cloudflarestorage-list-rule`, intlSiteList.includes('domain:cloudflarestorage.com'));
  }
}

function buildManifest(baselineVersion) {
  return {
    generatedAt: new Date().toISOString(),
    baselineVersion,
    expectations: {
      groups: EXPECTED_GROUPS,
      businessGroups: EXPECTED_BUSINESS_GROUPS,
      singBoxSelectorUrltestGroups: EXPECTED_SINGBOX_GROUPS,
      passwallShuntRules: EXPECTED_PASSWALL_RULES,
    },
    artifacts: ARTIFACT_FILES.map((file) => {
      const stat = fs.statSync(relPath(file));
      return {
        path: file,
        bytes: stat.size,
        sha256: sha256(file),
      };
    }),
  };
}

function printHuman(result) {
  const ok = result.failures.length === 0;
  console.log(`${ok ? 'PASS' : 'FAIL'} artifact contracts baseline=${result.manifest.baselineVersion}`);
  for (const check of result.checks) {
    if (!check.ok) console.log(`  - ${check.id}${check.message ? `: ${check.message}` : ''}`);
  }
  for (const warning of result.warnings) console.log(`  ! ${warning}`);
  console.log(`checks=${result.checks.length} artifacts=${result.manifest.artifacts.length}`);
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const record = makeRecorder();
  const { baselineVersion } = validateJsProducts(record);
  validateClashYaml(record, baselineVersion);
  validateOpenClash(record, baselineVersion, options);
  validateConfProducts(record, baselineVersion);
  validateJsonProducts(record, baselineVersion);
  validatePasswall(record, baselineVersion);
  const manifest = buildManifest(baselineVersion);
  const result = {
    ok: record.failures.length === 0,
    checks: record.checks,
    failures: record.failures,
    warnings: record.warnings,
    manifest,
  };

  if (options.manifestPath) {
    const target = path.resolve(REPO_ROOT, options.manifestPath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  }

  if (options.json) console.log(JSON.stringify(result, null, 2));
  else printHuman(result);
  if (!result.ok) process.exit(1);
}

try {
  main();
} catch (error) {
  console.error(error && error.stack ? error.stack : String(error));
  process.exit(1);
}
