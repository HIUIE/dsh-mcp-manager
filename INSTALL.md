# 安装说明 · MCP 管理器

版本 1.3.1 · 适用于 DeepSeek Harness（Desktop / Web）

---

## 一、安装

### 方式 A：插件管理器（推荐）

1. 把 `dsh-mcp-manager-1.3.1` 整个文件夹解压到**固定位置**，例如：

   ```
   ~/Documents/dsh-mcp-manager
   ```

   > 插件以“目录链接”方式安装，移动或删除该目录会让插件失效。

2. 在 DeepSeek Harness 中打开 **设置 → 插件 → 添加插件**，选择本地目录安装。
   也可以直接让 Agent 执行：

   ```
   plugin_manager install_bundle target=/Users/你的用户名/Documents/dsh-mcp-manager
   ```

3. 安装完成后刷新页面，左侧导航栏会出现 **MCP 管理器** 图标。

### 方式 B：命令行（仅安装包，不注册 bundle）

```bash
dsh plugin --profile desktop add /绝对路径/dsh-mcp-manager
```

> 该命令只把包加入 profile 依赖，**不会**把它登记到 `dsh.profile.bundles`。
> 除非你手动在 profile 的 `package.json` 里补上 bundle 名，否则推荐用方式 A。

---

## 二、验证

- 左侧出现「MCP 管理器」入口
- 打开后概览页显示本机真实的服务器数量、已连接数量与工具数
- 若数据为空：到 **配置** 页确认能读到 `~/.dsh/cordis.patch.yml` 等文件

---

## 三、配置（可选）

插件行为在安装后写入 profile 的 `cordis.patch.yml`，可直接改：

```yaml
- id: local-dsh-mcp-manager
  name: '@local/dsh-mcp-manager'
  config:
    scanTtlMs: 15000        # 配置扫描缓存（毫秒）
    toolsTtlMs: 60000       # 工具清单缓存（毫秒）
    retainBackups: 20       # 每个配置文件保留的备份数
    includeOtherApps: true  # 是否列出其他应用的 MCP 服务器
```

---

## 四、卸载

在 **设置 → 插件** 中移除 `@local/dsh-mcp-manager`，或让 Agent 执行：

```
plugin_manager remove_bundle target=@local/dsh-mcp-manager
```

插件只读取/写入各应用的 MCP 配置文件，卸载不会删除这些配置。
它在 `~/.dsh/mcp-manager-backups/` 留下的备份可自行清理。

---

## 五、系统要求

| 项目 | 要求 |
| --- | --- |
| 宿主 | DeepSeek Harness（需要 `webServer` 与 Client 插槽能力） |
| 运行环境 | Node.js ≥ 18（使用 `Promise.all`、`fs` 同步 API） |
| 依赖 | **无**，不需要 `npm install`、无构建步骤 |
| 平台 | macOS / Linux / Windows（路径探测以 macOS 为主） |

---

## 六、它会读写哪些文件

默认探测以下位置，**只列出的才读**：

| 应用 | 路径 |
| --- | --- |
| DeepSeek Harness（当前 profile） | `$DSH_PROFILE_DIR/cordis.patch.yml` |
| DeepSeek Harness（全局） | `~/.dsh/cordis.patch.yml` |
| Claude Code | `~/.claude.json` |
| Claude Desktop | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Codex | `~/.codex/config.toml` |
| Cursor | `~/.cursor/mcp.json` |
| Gemini CLI | `~/.gemini/settings.json` |
| CodeBuddy | `~/.codebuddy/mcp.json` |
| Cline | `~/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json` |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` |
| Continue | `~/.continue/config.json` |

写入前一律：**校验 → 备份 → 写临时文件 → 原子重命名 → 回读再校验**，失败自动还原。

---

## 七、常见问题

**Q：改了配置但没生效？**
配置改动写的是文件，需要点「重新加载」让 profile 从磁盘重新组合。插件内置该按钮（`POST /api/dsh-mcp-manager/reload`）。

**Q：其他应用里改了，这里没变？**
点右上角「刷新」。扫描缓存默认 15 秒。

**Q：密钥显示成 `••••`？**
这是有意的。环境变量、请求头以及 URL 里的令牌在传给界面之前就已脱敏。保存时若未修改该字段，宿主会用磁盘上的原值写回，不会把星号写进配置。

**Q：能管理别的机器吗？**
不能。它只管理本机文件系统上的 MCP 配置。
