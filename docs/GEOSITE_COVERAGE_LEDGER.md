# GEOSITE 覆盖台账

> 基线：Clash Party `v5.4.15` / Build `2026-05-20`。
> 目的：记录本仓库在原生 `geosite.dat` / `geoip.dat` 之外为什么还需要补充 rule-provider，以及哪些广告误伤白名单必须前置保护。

---

## 维护原则

1. **先查原生 GEOSITE/GEOIP**：如果 MetaCubeX / Loyalsoldier 已有稳定分类，优先使用原生标签，不重复造本地列表。
2. **再补 rule-provider**：只有当原生分类粒度不足、更新慢、地域语义不够明确，或客户端格式需要时，才保留补充 provider。
3. **误伤白名单一等化**：确认被广告、钓鱼或威胁情报源误杀的业务域名，必须进入 `AD_FALSE_POSITIVE_ALLOWLIST` 或对应静态产物的同名前置区块。
4. **不沉默跳过端侧差异**：某端无法表达完整语义时，在本台账和对应 CHANGELOG 中写明“不适用”或“降级表达”。

---

## 当前原生 GEOSITE 使用面

| 原生标签 | 主要去向 | 说明 |
|---|---|---|
| `category-ads-all` | `🛑 广告拦截` | 广告兜底。必须位于误伤白名单之后。 |
| `private` | `DIRECT` | 局域网、私有域名直连。 |
| `gfw` | `🚫 受限网站` | 受限站点基础兜底，叠加 Loyalsoldier / szkane 补充源。 |
| `category-dev` | `🔧 工具与服务` | 开发者工具兜底，细分服务仍由 GitHub / npm / JetBrains 等 provider 补齐。 |
| `category-games` | `🎮 国外游戏` | 游戏业务兜底，国内游戏另行直连。 |
| `tracker` | `🛰️ BT/PT Tracker` | Tracker 语义兜底，保留补充 tracker provider。 |

---

## 业务覆盖台账

| 业务层 | 原生 GEOSITE/GEOIP | 补充 provider | 本地/误伤白名单 | 当前结论 |
|---|---|---|---|---|
| `🛑 广告拦截` | `category-ads-all` | `anti-ad` / `sukka-phishing` / `hagezi-tif` / blackmatrix7 广告隐私源 / Accademia 安全源 | `AD_FALSE_POSITIVE_ALLOWLIST` | 必须先白名单、再拦截；新增误伤先补白名单，再考虑删源。 |
| `🚫 受限网站` | `gfw` | `loyalsoldier-gfw` / `loyalsoldier-greatfire` / `szkane-proxygfw` | 无 | 原生 + 补充并存，用于提高墙内命中率。 |
| `🌐 国外网站` | `geolocation-!cn` / `cloudflare` / `fastly` / `akamai` | 新闻、百科、邮件、CDN 补充源 | `cloudflarestorage.com -> 🌐 国外网站` | CDN/对象存储域容易被安全源误伤，确认后进入白名单。 |
| `🤖 AI 服务` | `openai` / `anthropic` / `gemini` / `copilot` | `szkane-ai` / `szkane-ciciai` / Accademia AI 源 | 无 | 原生覆盖主平台，补充源覆盖新服务和区域化入口。 |
| `📺/🎬/📹 流媒体` | `youtube` / `netflix` / `disney` / `hbo` / `hulu` / `primevideo` / `spotify` | blackmatrix7 / szkane Netflix IP / 区域媒体源 | 无 | 平台组优先，区域流媒体作为兜底。 |
| `🎮 游戏` | `category-games` | Steam / Epic / Nintendo / PlayStation / Xbox 等 provider | 无 | 国内游戏直连，国外游戏进业务组。 |
| `🔧 工具与服务` | `category-dev` | GitHub / npm / JetBrains / Docker / developer 补充源 | 本地工具进程白名单另管 | 域名与进程是两层语义，进程白名单不替代 GEOSITE。 |
| `🏦 金融支付` | `paypal` / `stripe` | `acc-bank-*` / Visa / Mastercard / Wise / Revolut | 无 | 金融语义按地区与服务拆分，避免落入普通国外网站。 |
| `🏠 国内网站` | `cn` / `geoip:cn` / `private` | 少量本地直连域名 | 小米核心服务 `DIRECT` | 国内直连不能放在广告拦截之后依赖兜底；误伤域名必须前置。 |
| `🛰️ BT/PT Tracker` | `tracker` | tracker 补充 provider | 无 | 保持独立业务组，便于用户选择限速或代理策略。 |

---

## Anti-ad 误伤白名单

这些条目是“规则安全阀”，所有可表达顺序的产物必须放在广告 / 钓鱼 / TIF / 隐私规则之前。

| 条目 | 目标策略 | 来源/原因 |
|---|---|---|
| `account.xiaomi.com` | `DIRECT` | 小米账号认证被 `miuiprivacy` 类规则误伤。 |
| `passport.xiaomi.com` | `DIRECT` | 小米账号认证链路。 |
| `micloud.xiaomi.com` | `DIRECT` | 小米云服务。 |
| `i.mi.com` | `DIRECT` | 小米云服务入口。 |
| `auth.be.sec.miui.com` | `DIRECT` | MIUI 安全认证误伤。 |
| `idm.api.io.mi.com` | `DIRECT` | MIUI 认证 API 误伤。 |
| `api.installer.xiaomi.com` | `DIRECT` | MIUI 安装器服务误伤。 |
| `flash.sec.miui.com` | `DIRECT` | MIUI 安全服务误伤。 |
| `mazu.sec.miui.com` | `DIRECT` | MIUI 安全服务误伤。 |
| `ccc.sys.miui.com` | `DIRECT` | MIUI 系统服务误伤。 |
| `register.xmpush.xiaomi.com` | `DIRECT` | 小米推送注册被 `advertisingmitv` 类规则误伤。 |
| `cloudflarestorage.com` | `🌐 国外网站` | Sukka phishing 当前包含 Cloudflare R2 存储域。 |

### 端侧映射

| 产物 | 表达方式 |
|---|---|
| Clash Party Smart / Normal | `AD_FALSE_POSITIVE_ALLOWLIST` 常量，注入到 `injectRules()` 顶部。 |
| FlClash | 同名 `AD_FALSE_POSITIVE_ALLOWLIST` 常量，跟随 Clash Party Normal。 |
| CMFA / OpenClash | `rules:` 顶部的 `Anti-ad false-positive allowlist` 前置区块。 |
| Shadowrocket / Surge / Loon / Quantumult X | 本地规则区顶部的同名前置区块；Loon 本地规则天然优先于远程规则。 |
| SingBox Full | 由 `SingBox(sing-box)-generator.js` 从 Clash Party 规则生成，`route.rules` 顶部保留同序白名单。 |
| v2rayN Xray | Xray 路由 JSON 仅保留可表达的前置域名规则；mihomo / sing-box 路径直接复用对应产物。 |
| Passwall / Passwall2 | 降级参考产物，不消费 Sukka phishing 源；Cloudflare R2 在国外网站列表显式补齐。 |

---

## 新增 provider / 规则时的审查清单

- 是否已有原生 `geosite:` 或 `geoip:` 标签可以覆盖？
- 补充 provider 相比原生标签多解决了什么：更新速度、语义粒度、地域归属，还是客户端格式？
- 是否会与 `category-ads-all`、钓鱼、TIF、隐私规则发生首匹配误伤？
- 如有误伤样例，是否已进入 `AD_FALSE_POSITIVE_ALLOWLIST` 并同步到静态产物？
- 是否更新根 README、对应子目录 README、CHANGELOG，并跑完当前可用的静态验证？
