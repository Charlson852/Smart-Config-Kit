/**
 * Merge subscription-userinfo headers for a Sub-Store collection.
 *
 * Use this only as a Script Operator on a collection. It sums upload/download
 * and total from member subscriptions, and uses the earliest future expiry.
 */
async function operator(proxies = [], targetPlatform, context) {
  if (typeof $substore === 'undefined' || typeof flowUtils === 'undefined') {
    throw new Error('This script requires Sub-Store runtime helpers: $substore and flowUtils');
  }

  const SUBS_KEY = 'subs';
  const COLLECTIONS_KEY = 'collections';
  const store = $substore;
  const { source } = context || {};
  const { _collection: collection } = source || {};

  if (!collection || Object.keys(source || {}).length > 1) {
    throw new Error('请仅在“组合订阅”中使用此脚本');
  }

  const allSubs = store.read(SUBS_KEY) || [];
  const subnames = expandCollectionSubscriptions(collection, allSubs);
  const { parseFlowHeaders, getFlowHeaders, normalizeFlowHeader } = flowUtils;

  let uploadSum = 0;
  let downloadSum = 0;
  let totalSum = 0;
  let expire;

  for (const sub of allSubs) {
    if (!subnames.includes(sub.name)) continue;

    let subInfo;
    let flowInfo;

    if (sub.source !== 'local' || ['localFirst', 'remoteFirst'].includes(sub.mergeSources)) {
      try {
        const remoteInfo = await readRemoteFlowInfo(sub, getFlowHeaders, normalizeFlowHeader);
        flowInfo = remoteInfo.flowInfo;
        subInfo = remoteInfo.subInfo;
      } catch (err) {
        log('error', `订阅 ${sub.name} 获取流量信息失败: ${JSON.stringify(err)}`);
      }
    }

    if (sub.subUserinfo) {
      try {
        subInfo = await readCustomSubUserinfo(sub, flowInfo, getFlowHeaders, normalizeFlowHeader);
      } catch (err) {
        log('error', `订阅 ${sub.name} 自定义流量信息获取失败: ${JSON.stringify(err)}`);
      }
    }

    if (!subInfo) continue;

    try {
      const parsed = parseFlowHeaders(subInfo);
      const upload = parsed?.usage?.upload;
      const download = parsed?.usage?.download;
      const total = parsed?.total;
      const expires = parsed?.expires;

      if (Number.isFinite(upload) && upload > 0) uploadSum += upload;
      if (Number.isFinite(download) && download > 0) downloadSum += download;
      if (Number.isFinite(total) && total > 0) totalSum += total;
      if (expires && expires * 1000 > Date.now()) expire = expire ? Math.min(expire, expires) : expires;
    } catch (err) {
      log('error', `订阅 ${sub.name} 解析 subscription-userinfo 失败: ${JSON.stringify(err)}`);
    }
  }

  const subUserInfo = [
    `upload=${Math.floor(uploadSum)}`,
    `download=${Math.floor(downloadSum)}`,
    `total=${Math.floor(totalSum)}`,
    expire ? `expire=${expire}` : '',
  ].filter(Boolean).join('; ');

  persistCollectionUserinfo(store, COLLECTIONS_KEY, collection.name, subUserInfo);

  if (typeof $options !== 'undefined' && $options) {
    $options._res = {
      headers: {
        'subscription-userinfo': subUserInfo,
      },
    };
  }

  log('info', `[MergeUserinfo] collection=${collection.name} subs=${subnames.length}`);
  return proxies;
}

function expandCollectionSubscriptions(collection, allSubs) {
  const subnames = [...(collection.subscriptions || [])];
  const tags = collection.subscriptionTags;

  if (Array.isArray(tags) && tags.length > 0) {
    for (const sub of allSubs) {
      if (!Array.isArray(sub.tag) || sub.tag.length === 0) continue;
      if (subnames.includes(sub.name)) continue;
      if (sub.tag.some((tag) => tags.includes(tag))) subnames.push(sub.name);
    }
  }

  return subnames;
}

async function readRemoteFlowInfo(sub, getFlowHeaders, normalizeFlowHeader) {
  let url = String(sub.url || '')
    .split(/[\r\n]+/)
    .map((item) => item.trim())
    .filter(Boolean)[0] || '';

  const rawArgs = url.split('#');
  url = rawArgs[0];
  const localArgs = parseHashArguments(rawArgs[1]);

  if (localArgs.noFlow || !/^https?:\/\//.test(url)) {
    return { flowInfo: undefined, subInfo: undefined };
  }

  const flowInfo = await getFlowHeaders(
    localArgs.insecure ? `${url}#insecure` : url,
    localArgs.flowUserAgent,
    undefined,
    sub.proxy,
    localArgs.flowUrl
  );

  if (!flowInfo) return { flowInfo, subInfo: undefined };

  const headers = normalizeFlowHeader(flowInfo, true);
  return {
    flowInfo,
    subInfo: headers?.['subscription-userinfo'],
  };
}

async function readCustomSubUserinfo(sub, flowInfo, getFlowHeaders, normalizeFlowHeader) {
  let customSubUserInfo = sub.subUserinfo;

  if (/^https?:\/\//.test(sub.subUserinfo)) {
    customSubUserInfo = await getFlowHeaders(undefined, undefined, undefined, sub.proxy, sub.subUserinfo);
  }

  const headers = normalizeFlowHeader([customSubUserInfo, flowInfo].filter(Boolean).join(';'), true);
  return headers?.['subscription-userinfo'];
}

function parseHashArguments(raw) {
  if (!raw) return {};

  try {
    return JSON.parse(decodeURIComponent(raw));
  } catch (err) {
    const args = {};
    for (const pair of raw.split('&')) {
      if (!pair) continue;
      const index = pair.indexOf('=');
      const key = index >= 0 ? pair.slice(0, index) : pair;
      const value = index >= 0 ? pair.slice(index + 1) : true;
      args[key] = value == null || value === '' ? true : decodeURIComponent(value);
    }
    return args;
  }
}

function persistCollectionUserinfo(store, key, collectionName, subUserInfo) {
  const allCollections = store.read(key) || [];
  for (const collection of allCollections) {
    if (collection.name !== collectionName) continue;
    collection.subUserinfo = subUserInfo;
    break;
  }
  store.write(allCollections, key);
}

function log(level, message) {
  if (typeof $substore === 'undefined') return;
  const fn = $substore[level];
  if (typeof fn === 'function') fn(message);
}

if (typeof module !== 'undefined') {
  module.exports = {
    operator,
    expandCollectionSubscriptions,
    parseHashArguments,
  };
}

