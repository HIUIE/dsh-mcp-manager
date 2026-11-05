# MCP 管理器（MCP Manager）

面向 DeepSeek Harness 的 MCP 管理面板：统一管理本机所有已配置的 MCP（Model Context Protocol）服务器，以及它们向宿主暴露的工具。

**中文界面（默认）**，左下角可一键切换 English。

## 界面

左侧五个入口，顶部一行是该页摘要：

| 页面 | 内容 |
| --- | --- |
| **概览** | 五个指标卡（服务器 / 已启用 / 已禁用 / 已连接 / 工具）；当前已连接列表；已启用但未连接列表；已发现的配置源 |
| **MCP 服务器** | 表格：名称、连接方式、状态、工具数、配置来源、开关；支持搜索、按来源筛选、按状态筛选、多选批量启停 |
| **工具** | 全部已连接服务器的工具，可按服务器筛选、搜索，展开查看参数 Schema |
| **配置** | 可视化编辑任意配置文件，带格式校验、导出、备份与恢复 |
| **设置** | 宿主信息、重载配置、语言、写入安全说明 |

状态列同时显示两件事，互不替代：**配置中是否启用**（读文件）与**当前是否连接**（只认宿主实际注册的工具）。

## 功能

- **自动发现**：读取本机各应用真实存在的 MCP 配置文件，不使用任何模拟数据。
  - DeepSeek Harness：当前 profile 的 `cordis.patch.yml` 与用户级 `~/.dsh/cordis.patch.yml`
  - Claude Code、Claude Desktop、Codex（`config.toml`）、Cursor、Gemini CLI、CodeBuddy、Cline、Windsurf、Continue
- **增删改**：手动添加（stdio / Streamable HTTP）、粘贴 MCP JSON 自动解析、从其他应用导入、编辑地址 / 命令 / 参数 / 环境变量、启用停用、删除条目。
- **配置管理**：可视化编辑器 + 原始文本、格式校验、导出、备份与恢复。
- **安全写入**：每次修改前自动备份 → 写入临时文件 → 原子重命名 → 回读再校验；校验失败自动还原。
- **密钥保护**：环境变量、请求头中形似凭据的值，以及 URL 路径里的令牌，在传给浏览器前一律脱敏；保存未改动的脱敏字段时宿主用磁盘原值写回，不会把掩码写进配置。
- **即时生效**：改完可直接「重新加载」，从磁盘重组配置（`hmr.reconcileProfile`），无需重启应用。

## 工作方式

浏览器侧只负责展示与交互，所有事实来自宿主路由 `/api/dsh-mcp-manager/*`：

| 路由 | 说明 |
| --- | --- |
| `GET /inventory` | 全量清单：服务器、工具数、连接状态、配置源、统计 |
| `GET /server?uid=` | 单个服务器的声明、解析结果与工具 |
| `GET /file?source=` | 某个配置文件的全文与校验结果 |
| `GET /backups` | 备份列表 |
| `POST /validate` | 校验任意候选文本 |
| `POST /save-file` | 安全保存配置文件全文 |
| `POST /mutate` | `toggle` / `update` / `delete` / `add` / `import` |
| `POST /restore` | 从备份恢复 |
| `POST /reload` | 从磁盘重组 profile，使改动生效 |

## 配置

在 `cordis.patch.yml` 的行里调整：

```yaml
config:
  scanTtlMs: 15000      # 配置扫描缓存
  toolsTtlMs: 60000     # 工具清单缓存
  retainBackups: 20     # 每个文件保留的备份数
  includeOtherApps: true # 是否列出其他应用的 MCP 服务器
```

## 边界

- 本插件**不修改**其他应用的运行状态，只读写它们的配置文件。
- 非 DeepSeek Harness 的配置改动，需要目标应用自行重新加载才会生效。
- Codex 的 TOML 配置支持查看与整体编辑；新增条目请在配置页直接编辑文本。
- 禁用 / 启用写入的是配置声明，要让改动生效需执行「重新加载」。
- 无依赖、无构建脚本；以目录形式链接安装。

## 测试

```bash
node lib/i18n.test.mjs   # 校验中英文字典键位一致、中文默认生效
```

## 结构

```
index.js           宿主侧：发现、写入、HTTP 路由
client.js          浏览器侧：界面与交互（内嵌中英文字典）
lib/sources.js     配置源目录、YAML / TOML / JSON 解析与归一化
lib/writer.js      校验、备份、原子写入
lib/i18n.js        中英文文案（可读版本）
lib/i18n.test.mjs  字典一致性测试
locale/*.json      插件列表中的显示名称与描述
icon.svg           面板图标
```
