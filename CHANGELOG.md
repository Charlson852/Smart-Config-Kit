# Smart-Config-Kit — 变更日志

> 仓库级变更摘要。各产物的详细变更见对应子目录 `CHANGELOG.md`。
>
> 主版本号由 `Clash Party/ClashParty(mihomo-smart).js` 内 `const VERSION` 唯一决定，其余产物跟随并对齐。

---

## v5.4.24 (2026-06-03)

**CLEAN：清除全产物冗余规则（深度审查验证）**

- 下载上游原始规则集文件（blackmatrix7 / Accademia / MetaCubeX）逐条 grep 对比，100% 确认以下规则为冗余（显式 DOMAIN-SUFFIX 是对应 RULE-SET 的严格子集，且指向同一目标组）
- 删除 21 条冗余规则 + 3 个未引用 provider：Binance ×4 / Google 子 RULE-SET ×3 / ProtonMail ×3 / 音乐流媒体 ×6 / 社交媒体 ×2 / 流媒体 ×2 / GEOIP 重复 ×1
- 验证确认 Apple 子 RULE-SET（11 个）**非冗余**：Apple.yaml 元集仅含 IP-CIDR + PROCESS-NAME，零 DOMAIN-SUFFIX
- 同步全部 14 个文件（Clash Party ×2 / FlClash / CMFA / OpenClash ×2 / SR / Surge / Loon / QX / SingBox generator+JSON / Passwall / Passwall2 / v2rayN）
- 根 README 移除 changelog 内容（保留纯介绍）+ 大幅精简客户端速查段落

详见 `Clash Party/CHANGELOG.md`。

---

## v5.4.23 (2026-06-02)

- FIX#161：知乎图片 CDN `zhimg.com` + 短链 `zhihu.co` → 国内网站直连
- FIX#162：SR/Surge/Loon/QX 修复失效 HaGeZi / Sukka 远程规则 URL + RemoteDesktop 上游已删除
- Sync：全产物联动（详见各子目录 CHANGELOG）

---

## v5.4.22 (2026-05-31)

- 借鉴 Proxy-override 批 C：QUIC 精细化（AND 规则白名单豁免 + sniffer QUIC 嗅探）
- GeTui(个推)推送 SDK 直连白名单
- Sync：全产物联动

---

## v5.4.21 (2026-05-31)

- 借鉴 Proxy-override 批 D：DoH-over-IP bootstrap + 明文兜底
- Sync：全产物联动

---

## v5.4.20 (2026-05-30)

- 借鉴 Proxy-override 批 B：节点过滤 junk 关键词补充（免费/试用/应急/Sign/Login/Register/Help/FAQ）
- Sync：6 mihomo 产物联动

---

## v5.4.19 (2026-05-30)

- 借鉴 Proxy-override 批 A：国内 SDK/CDN 直连前置 + fake-ip-filter 远控/游戏/P2P 补全 + `direct-nameserver-follow-policy`
- Sync：全产物联动

---

> 更早版本见 `Clash Party/CHANGELOG.md`。
