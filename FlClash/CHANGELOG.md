# FlClash — 变更日志

> FlClash 覆写脚本 `FlClash(mihomo).js`，使用标准 Mihomo 内核的 url-test 区域组。
> 基线：Clash Party Normal（规则与策略 100% 对齐）。

---

## v5.4.2-flclash.1 (2026-05-05)

- ★ FIX#41-P0：小米核心服务 DIRECT 白名单（跟随 Clash Party v5.4.2 基线）
  - 新增 11 条 DIRECT 规则前置广告拦截段，修复 miuiprivacy/advertisingmitv 误杀认证安全域名

## v5.4.1-flclash.2 (2026-05-05)

- ★ FIX#FlClash-Review-P0：恢复 FlClash 覆写脚本的有效 UTF-8 字符串字面量
  - 修复 `REGION_DB` / `SMART` / `BIZ` 被 mojibake 破坏后产生的 `SyntaxError`
  - 从 `ClashParty(mihomo).js` 重新同步干净规则逻辑，并保留 FlClash 的 QuickJS 日志包装与数组原地修改约束
- ★ FIX#FlClash-Review-P0：补回 `classifyAllNodes` 初始化 buckets
  - 样例 `TWN 01 AnyRoute IEPL x2.5` → 台湾，`SGP 01 AnyRoute IEPL x2.5` → 狮城，未知家宽节点 → 其他家宽
  - 同构审计：Clash Party Normal 同步修复；Smart 主线正常；其余静态/非 JS 产物无此初始化回归

## v5.4.0-flclash.1 (2026-05-05)

- ★ FEAT#SG：新增 🇸🇬 狮城节点 + 🏡 狮城家宽 独立区域组
  - 新加坡从 🌏 亚太节点 中拆分为独立区域
  - 区域组总数：18 → 20（10 全部 + 10 家宽），总组数：49 → 51
  - 跟随基线 Clash Party v5.4.0

## v5.3.2-flclash.1 (2026-05-03)

- 初始版本，基于 Clash Party Normal v5.3.2 完整移植
  - 18 url-test 区域组（9 全部 + 9 家宽）+ 31 业务策略组（含 13 流媒体平台组）
  - 371+ rule-providers，覆盖 AI/流媒体/游戏/金融/社交/开发等全部场景
  - word-boundary 正则节点分类（REGION_DB 同 Clash Party v5.3.2）
  - 家宽自动识别 + 信息节点过滤
  - 订阅垃圾 proxy-groups / rules / rule-providers 自动清理
  - TLS 指纹自动注入（client-fingerprint）
- 适配 FlClash 覆写脚本环境：
  - `console.log` → 条件包装（兼容 QuickJS 引擎）
  - 全局设置精简：移除 `geox-url`/`geodata-mode`/TUN/端口覆写（FlClash UI 托管）
  - 数组操作改用原地修改（splice/push），避免 QuickJS FFI 桥接层重赋值丢失
- **导入方式确认**：FlClash 覆写脚本需要两步操作——先在「覆写脚本」创建脚本，再在订阅「更多→覆写」关联
- 必改配置文档化：GeoX URL（外部资源）+ DNS（进阶配置）
- 与 CMFA YAML 并行提供
