# PROCESS-NAME 兼容清单与测试集

本清单用于维护“本地工具直连白名单”，覆盖远程控制、内网穿透、DDNS、P2P Mesh、数据库客户端等工具。参考来源是 YaNet 的 `global_script.js` 本地工具直连段：

- https://github.com/dahaha-365/YaNet/blob/main/Mihomo/global_script.js#L162-L186

## 设计原则

- 主规则只使用精确 `PROCESS-NAME`，不照搬宽泛 `PROCESS-NAME-REGEX,(?i).*vpn.*` / `.*vnc.*`。
- PC / 桌面端优先：Windows 使用 `.exe`，macOS / Linux 使用无扩展名进程名。
- 移动端包名暂不进入主规则，除非对应客户端路径已验证不会导入报错且确实能匹配。
- 路由器端 Passwall / Passwall2 不承载本清单，因为它们看不到局域网客户端进程名。

## 官方兼容依据

- Mihomo `PROCESS-NAME` 支持进程名；Android 平台可匹配包名：https://wiki.metacubex.one/en/config/rules/#process-name
- sing-box `process_name` 仅支持 Linux / Windows / macOS；Android 应使用独立的 `package_name` 字段，本轮不混写：https://sing-box.sagernet.org/configuration/route/rule/#process_name
- Surge `PROCESS-NAME` 仅 Surge Mac 可用，Surge iOS 会忽略该规则：https://manual.nssurge.com/rule/process.html

## 已同步的产物

| 产物 | 同步方式 | 说明 |
| --- | --- | --- |
| Clash Party / Mihomo Party / Clash Verge Rev | `PROCESS-NAME,<name>,DIRECT` | 桌面端主承载 |
| FlClash | `PROCESS-NAME,<name>,DIRECT` | Windows/macOS/Linux 可命中；Android 不依赖本清单 |
| CMFA YAML / ClashMi | `PROCESS-NAME,<name>,DIRECT` | Android 导入不报错；桌面 ClashMi 可命中 |
| OpenClash Normal / Smart | 语法同步 | 路由器端通常无实际命中，仅保持规则形态一致 |
| sing-box Full | 生成器转换为 `process_name` | 仅 Linux / Windows / macOS 支持进程名匹配 |
| Surge | `PROCESS-NAME,<name>,DIRECT` | Surge Mac 可命中；Surge iOS 会忽略进程规则 |

## 未同步为主规则的产物

| 产物 | 原因 |
| --- | --- |
| Shadowrocket | iOS 路径，不支持本仓库需要的进程匹配 |
| Loon | 本仓库 Loon 产物面向 iOS，没有桌面端进程匹配承载面 |
| Quantumult X | 本仓库 QX 产物面向 iOS，没有桌面端进程匹配承载面 |
| v2rayN(xray) | 当前维护的 Xray 路由 JSON 不包含进程名字段 |
| Passwall / Passwall2 | OpenWrt 路由器无法看见局域网客户端进程名 |

## 维护入口

- 清单：`tools/fixtures/process-name-direct-tools.json`
- 验证：`node tools/validate-process-name-direct.js`

验证脚本会检查：

- Mihomo 系桌面清单是否进入 Clash Party / FlClash / CMFA / OpenClash；
- Surge Mac 清单是否进入 Surge；
- SingBox Full 是否由生成器输出 `process_name -> DIRECT`；
- Shadowrocket / Loon / QX / v2rayN 是否没有误加入主动进程规则。
