const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FIXTURE_PATH = path.join(__dirname, 'fixtures', 'process-name-direct-tools.json');
const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));

const mihomoNames = fixture.mihomoDesktopProcessNames;
const mihomoWorkNames = fixture.mihomoWorkProcessNames || [];
const surgeNames = fixture.surgeMacProcessNames;
const surgeWorkNames = fixture.surgeWorkProcessNames || [];
const WORK_POLICY = '🧑‍💼 会议协作';

const mihomoTargets = [
  'Clash Party/ClashParty(mihomo-smart).js',
  'Clash Party/ClashParty(mihomo).js',
  'FlClash/FlClash(mihomo).js',
  'Clash Meta For Android/CMFA(mihomo).yaml',
  'OpenClash/OpenClash(mihomo).sh',
  'OpenClash/OpenClash(mihomo-smart).sh',
];

const unsupportedTargets = [
  'Shadowrocket/Shadowrocket.conf',
  'Loon/Loon.conf',
  'Quantumult X/QuantumultX.conf',
  'v2rayN/v2rayN(xray).json',
  'Passwall/Passwall(xray+sing-box)-apply.sh',
  'Passwall/Passwall(xray+sing-box).conf',
  'Passwall2/Passwall2(xray+sing-box)-apply.sh',
  'Passwall2/Passwall2(xray+sing-box).conf',
];

for (const dir of ['Passwall/shunt-rules', 'Passwall2/shunt-rules']) {
  for (const file of fs.readdirSync(path.join(ROOT, dir)).filter((name) => name.endsWith('.list'))) {
    unsupportedTargets.push(`${dir}/${file}`);
  }
}

const failures = [];

for (const target of mihomoTargets) {
  const text = read(target);
  const missing = mihomoNames.filter((name) => !hasMihomoProcessRule(text, name));
  if (missing.length > 0) {
    failures.push(`${target}: missing ${missing.length} desktop PROCESS-NAME rules: ${missing.join(', ')}`);
  }
  const missingWork = mihomoWorkNames.filter((name) => !hasMihomoWorkProcessRule(text, name));
  if (missingWork.length > 0) {
    failures.push(`${target}: missing ${missingWork.length} RustDesk WORK PROCESS-NAME rules: ${missingWork.join(', ')}`);
  }
}

{
  const target = 'Surge/Surge.conf';
  const text = read(target);
  const missing = surgeNames.filter((name) => !text.includes(`PROCESS-NAME,${name},DIRECT`));
  if (missing.length > 0) {
    failures.push(`${target}: missing ${missing.length} Surge Mac PROCESS-NAME rules: ${missing.join(', ')}`);
  }
  const missingWork = surgeWorkNames.filter((name) => !text.includes(`PROCESS-NAME,${name},${WORK_POLICY}`));
  if (missingWork.length > 0) {
    failures.push(`${target}: missing ${missingWork.length} Surge RustDesk WORK PROCESS-NAME rules: ${missingWork.join(', ')}`);
  }
}

{
  const target = 'SingBox/SingBox(sing-box)-full.json';
  const data = JSON.parse(read(target));
  const directProcessNames = new Set(
    (data.route?.rules || [])
      .filter((rule) => rule.action === 'route' && rule.outbound === 'DIRECT' && Array.isArray(rule.process_name))
      .flatMap((rule) => rule.process_name)
  );
  const workProcessNames = new Set(
    (data.route?.rules || [])
      .filter((rule) => rule.action === 'route' && rule.outbound === WORK_POLICY && Array.isArray(rule.process_name))
      .flatMap((rule) => rule.process_name)
  );
  const missing = mihomoNames.filter((name) => !directProcessNames.has(name));
  if (missing.length > 0) {
    failures.push(`${target}: missing ${missing.length} generated process_name route rules: ${missing.join(', ')}`);
  }
  const missingWork = mihomoWorkNames.filter((name) => !workProcessNames.has(name));
  if (missingWork.length > 0) {
    failures.push(`${target}: missing ${missingWork.length} generated RustDesk process_name WORK route rules: ${missingWork.join(', ')}`);
  }
}

for (const target of unsupportedTargets) {
  const text = read(target);
  const activeProcessRules = text
    .split(/\r?\n/)
    .filter((line) => /^\s*(PROCESS-NAME|process-name),/.test(line));
  if (activeProcessRules.length > 0) {
    failures.push(`${target}: unsupported artifact contains active process rules`);
  }
}

if (failures.length > 0) {
  console.error('PROCESS-NAME direct whitelist validation failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`PROCESS-NAME policy validation: OK (${mihomoNames.length} direct desktop names, ${mihomoWorkNames.length} RustDesk work names, ${surgeNames.length} Surge direct names)`);

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function hasMihomoProcessRule(text, name) {
  return (
    text.includes(`PROCESS-NAME,${name},DIRECT`) ||
    text.includes(`'${name}'`) ||
    text.includes(`"${name}"`)
  );
}

function hasMihomoWorkProcessRule(text, name) {
  return (
    text.includes(`PROCESS-NAME,${name},${WORK_POLICY}`) ||
    text.includes(`PROCESS-NAME,${name},\\U0001F9D1`) ||
    text.includes(`'${name}'`) ||
    text.includes(`"${name}"`)
  );
}
