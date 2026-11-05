/**
 * UI copy for MCP Manager, in Chinese and English.
 *
 * This module is the readable source of the dictionary; `client.js` embeds an
 * identical literal because the browser half is a single self-contained module.
 * `lib/i18n.test.mjs` asserts the two stay in step, so an edit here must be
 * mirrored there (and vice versa) before shipping.
 *
 * @module dsh-mcp-manager/lib/i18n
 */

/** Both dictionaries, keyed by language code. */
export const TEXT =   {
        zh: {
          appTitle: 'MCP 管理器',
          appSubtitle: '服务器与工具',
          nav: { home: '概览', servers: 'MCP 服务器', tools: '工具', config: '配置', settings: '设置' },
          common: {
            refresh: '刷新', refreshing: '刷新中…', add: '添加服务器', save: '保存', saving: '保存中…',
            cancel: '取消', close: '关闭', retry: '重试', loading: '加载中…', none: '—', dismiss: '关闭提示',
            all: '全部', edit: '编辑',
            unsaved: '未保存', copy: '复制到此处', export: '导出', validate: '校验', discard: '放弃修改',
            reload: '重新加载', reloadNow: '立即重新加载', reloading: '重新加载中…',
          },
          state: { enabled: '已启用', disabled: '已禁用', connected: '已连接', notConnected: '未连接' },
          home: {
            subtitle: (s, c, t) => `共 ${s} 个服务器 · ${c} 个已连接 · ${t} 个工具`,
            statServers: (host, other) => `服务器 · 本机 ${host} / 其他 ${other}`,
            statEnabled: '已启用',
            statDisabled: '已禁用',
            statConnected: '当前已连接',
            statTools: '已注册工具',
            connectedTitle: '当前已连接', connectedSub: (n) => `${n} 个服务器正在提供工具`,
            connectedEmpty: '当前没有已连接的 MCP 服务器。启用后重新加载即可连接。',
            notConnectedTitle: '已启用但未连接', notConnectedSub: '配置中已启用，但当前无法连接',
            reloadHint: '重新加载可尝试启动', otherApp: '其他应用',
            moreNotConnected: (n) => `另有 ${n} 个未连接，可在「MCP 服务器」中查看全部。`,
            sourcesTitle: '已发现的配置', colApp: '应用', colFile: '文件', colServers: '服务器',
            notPresent: '不存在',
            brokenSources: (n, detail) => `${n} 个配置文件无法解析：${detail}`,
          },
          servers: {
            searchPlaceholder: '搜索服务器…', filterConfig: '按配置来源筛选',
            colServer: '服务器', colTransport: '方式', colState: '状态', colTools: '工具', colConfig: '配置来源',
            empty: '未在本机任何配置中找到 MCP 服务器。', noMatch: '没有符合筛选条件的服务器。',
            selected: (n) => `已选 ${n} 个`, enable: '启用', disable: '禁用', selectAll: '全选',
          },
          detail: {
            tabOverview: '概览', tabTools: (n) => `工具${n ? ` (${n})` : ''}`, tabEdit: '编辑',
            stateInFile: '配置状态', connectedNow: '当前连接',
            connectedYes: '已连接 — 宿主已暴露其工具', connectedNo: '未连接 — 当前未注册任何工具',
            loaderRow: '加载器条目', transport: '连接方式', source: '配置来源',
            connection: '连接信息', command: '命令', url: '地址',
            environment: '环境变量', headers: '请求头', removeEntry: '移除条目',
            toolSearch: '搜索工具…', noToolsMatch: '没有符合条件的工具。', noTools: '未注册工具。',
            toolNotConnected: '该服务器当前未连接，宿主不会暴露它的工具。服务器启动并重新加载后，这里会显示工具信息。',
            params: '参数', paramsNone: '没有声明的参数。',
            editWarning: (source, app) => `编辑将写入 ${source}（${app}）。写入前自动备份，写入后重新校验；校验失败自动还原。`,
            nameLabel: '名称', transportLabel: '连接方式', commandLabel: '命令',
            commandHint: '宿主启动的可执行文件，例如 npx 或绝对路径。',
            argsLabel: '参数', argsHint: '每行一个。', envLabel: '环境变量', cwdLabel: '工作目录',
            urlLabel: '地址', urlHint: 'Streamable HTTP 端点，例如 https://host/mcp', headersLabel: '请求头',
          },
          add: {
            title: '添加 MCP 服务器', subtitle: '写入一个配置文件',
            tabManual: '手动', tabJson: '粘贴 JSON', tabImport: '从现有导入',
            target: '写入配置', targetHint: '仅列出可接收新条目的配置源。', newFile: '（新建文件）',
            nameLabel: '服务器名称', nameHint: '仅限字母、数字、- 和 _，最长 32 位。',
            nameOk: '名称可用。', nameInvalid: '名称只能用字母、数字、- 和 _，且不超过 32 位。',
            nameTaken: '该名称在所选配置中已存在。',
            transportLabel: '连接方式', stdio: 'stdio（本地命令）', http: 'Streamable HTTP',
            commandLabel: '命令', argsLabel: '参数', argsHint: '每行一个。', envLabel: '环境变量',
            addVariable: '+ 添加变量', addHeader: '+ 添加请求头', urlLabel: '地址', headersLabel: '请求头',
            submit: '添加', submitting: '添加中…',
            jsonLabel: 'MCP JSON',
            jsonHint: '粘贴形如 {"mcpServers": {"名称": {"command": "npx", ...}}} 的配置。解析后写入目标文件，写入前会校验。',
            jsonSubmit: '解析并添加', jsonSubmitting: '导入中…',
            importHint: '把已经配置在其他应用里的服务器复制到所选目标。声明从该应用自己的配置文件读取。',
            importEmpty: '本机没有其他可用配置。',
          },
          config: {
            title: '配置', pickFile: '配置文件', editor: '编辑', backups: '备份',
            valid: (n) => `格式有效 · 识别到 ${n} 个 MCP 服务器`,
            invalid: (detail) => `格式无效：${detail}`,
            textLabel: '配置内容', noFile: '本机未找到 MCP 配置文件。',
            backupsTitle: '备份', backupsEmpty: '暂无备份。每次修改本面板操作前都会自动备份。',
            backupWhen: '时间', restore: '恢复', restored: (path) => `已恢复到 ${path}。`,
          },
          settings: {
            hostTitle: '宿主', application: '应用', profile: '配置文件集', dshHome: 'DSH 目录',
            reloadSupport: '配置重载', reloadSupportValue: '从磁盘重组配置（无需重启应用）',
            actionsTitle: '操作', actionsSub: '修改配置文件后需重新加载才会生效', checkBackups: '查看备份',
            backupCount: (n, dir) => `共 ${n} 个备份，位于 ${dir}`,
            safetyTitle: '写入安全',
            safetyBody: '每次写入都遵循同一流程：读取当前文件 → 校验新内容 → 备份原文件 → 写入临时文件 → 原子重命名 → 回读再次校验。若回读校验失败，自动还原备份。',
            backupDir: '备份目录', backupsRetained: '保留份数',
            backupsRetainedValue: (n) => `每个文件 ${n} 份`, scanCache: '扫描缓存',
            secrets: '密钥保护', secretsValue: '形似凭据的环境变量、请求头与 URL 中的令牌一律脱敏',
            language: '语言',
          },
          msg: {
            saved: '已保存，原文件已备份。', savedNoBackup: '已保存。',
            savedReload: (n) => `已更新 ${n} 个服务器。重新加载后生效。`,
            enabledFile: '已在配置中启用。', disabledFile: '已在配置中禁用。',
            removed: '已从配置中移除该条目。',
            added: (name) => `已添加「${name}」。重新加载后启动。`,
            imported: (n) => `已导入 ${n} 个服务器。重新加载后启动。`,
            reloaded: '已从磁盘重新加载配置。',
            reloadedRestart: '已重新加载，但部分改动需重启 DeepSeek Harness 才能生效。',
            reloadUnavailable: '当前宿主不支持重载配置，请重启 DeepSeek Harness 使改动生效。',
            failed: (n, err) => `${n} 项修改失败：${err}`,
            loadFailed: (err) => `无法读取 MCP 配置：${err}`,
            toolCount: (n) => `${n} 个工具`,
          },
          transport: { stdio: 'stdio', 'streamable-http': 'HTTP', sse: 'SSE', http: 'HTTP', unknown: '未知' },
        },
        en: {
          appTitle: 'MCP Manager',
          appSubtitle: 'Servers & tools',
          nav: { home: 'Overview', servers: 'Servers', tools: 'Tools', config: 'Config', settings: 'Settings' },
          common: {
            refresh: 'Refresh', refreshing: 'Refreshing…', add: 'Add server', save: 'Save', saving: 'Saving…',
            cancel: 'Cancel', close: 'Close', retry: 'Retry', loading: 'Loading…', none: '—', dismiss: 'Dismiss',
            all: 'All', edit: 'Edit',
            unsaved: 'unsaved', copy: 'Copy here', export: 'Export', validate: 'Validate', discard: 'Discard',
            reload: 'Reload', reloadNow: 'Reload now', reloading: 'Reloading…',
          },
          state: { enabled: 'Enabled', disabled: 'Disabled', connected: 'Connected', notConnected: 'Not connected' },
          home: {
            subtitle: (s, c, t) => `${s} servers · ${c} connected · ${t} tools`,
            statServers: (host, other) => `Servers · ${host} here / ${other} apps`,
            statEnabled: 'Enabled',
            statDisabled: 'Disabled',
            statConnected: 'Connected now',
            statTools: 'Registered tools',
            connectedTitle: 'Connected', connectedSub: (n) => `${n} server(s) exposing tools`,
            connectedEmpty: 'No MCP server is connected. Enable one and reload.',
            notConnectedTitle: 'Enabled but not connected', notConnectedSub: 'Declared enabled, yet no tools are registered',
            reloadHint: 'reload may start it', otherApp: 'other app',
            moreNotConnected: (n) => `${n} more not connected — see all under Servers.`,
            sourcesTitle: 'Configurations found', colApp: 'Application', colFile: 'File', colServers: 'Servers',
            notPresent: 'not present',
            brokenSources: (n, detail) => `${n} configuration file(s) failed to parse: ${detail}`,
          },
          servers: {
            searchPlaceholder: 'Search servers…', filterConfig: 'Filter by configuration',
            colServer: 'Server', colTransport: 'Transport', colState: 'State', colTools: 'Tools', colConfig: 'Configuration',
            empty: 'No MCP server found in any configuration on this machine.', noMatch: 'No servers match these filters.',
            selected: (n) => `${n} selected`, enable: 'Enable', disable: 'Disable', selectAll: 'Select all',
          },
          detail: {
            tabOverview: 'Overview', tabTools: (n) => `Tools${n ? ` (${n})` : ''}`, tabEdit: 'Edit',
            stateInFile: 'State in file', connectedNow: 'Currently connected',
            connectedYes: 'yes — the host exposes its tools', connectedNo: 'no — no tools are registered',
            loaderRow: 'Loader row', transport: 'Transport', source: 'Configuration',
            connection: 'Connection', command: 'Command', url: 'URL',
            environment: 'Environment', headers: 'Headers', removeEntry: 'Remove entry',
            toolSearch: 'Search tools…', noToolsMatch: 'No tools match.', noTools: 'No tools registered.',
            toolNotConnected: 'This server is not connected, so the host exposes no tools for it.',
            params: 'Parameters', paramsNone: 'No declared parameters.',
            editWarning: (source, app) => `Editing writes to ${source} (${app}). A backup is taken first and the result re-validated.`,
            nameLabel: 'Name', transportLabel: 'Transport', commandLabel: 'Command',
            commandHint: 'The executable the host spawns, e.g. npx.',
            argsLabel: 'Arguments', argsHint: 'One per line.', envLabel: 'Environment', cwdLabel: 'Working directory',
            urlLabel: 'URL', urlHint: 'Streamable HTTP endpoint.', headersLabel: 'Headers',
          },
          add: {
            title: 'Add MCP server', subtitle: 'Writes one configuration file',
            tabManual: 'Manual', tabJson: 'Paste JSON', tabImport: 'Import',
            target: 'Target configuration', targetHint: 'Only sources that can receive a new entry are listed.',
            newFile: '(new file)', nameLabel: 'Server name', nameHint: 'Letters, digits, - and _ only (max 32).',
            nameOk: 'Name is available.', nameInvalid: 'Use letters, digits, - and _ only, max 32.',
            nameTaken: 'This name already exists in the chosen configuration.',
            transportLabel: 'Transport', stdio: 'stdio (local command)', http: 'Streamable HTTP',
            commandLabel: 'Command', argsLabel: 'Arguments', argsHint: 'One per line.', envLabel: 'Environment',
            addVariable: '+ Add variable', addHeader: '+ Add header', urlLabel: 'URL', headersLabel: 'Headers',
            submit: 'Add server', submitting: 'Adding…', jsonLabel: 'MCP JSON',
            jsonHint: 'Paste a configuration such as {"mcpServers": {"name": {"command": "npx", ...}}}.',
            jsonSubmit: 'Parse and add', jsonSubmitting: 'Importing…',
            importHint: 'Copy a server configured in another application into the selected target.',
            importEmpty: 'No other configurations found.',
          },
          config: {
            title: 'Config', pickFile: 'Configuration file', editor: 'Editor', backups: 'Backups',
            valid: (n) => `Valid · ${n} MCP server(s)`,
            invalid: (detail) => `Invalid: ${detail}`,
            textLabel: 'Configuration text', noFile: 'No MCP configuration file was found.',
            backupsTitle: 'Backups', backupsEmpty: 'No backups yet.',
            backupWhen: 'When', restore: 'Restore', restored: (path) => `Restored to ${path}.`,
          },
          settings: {
            hostTitle: 'Host', application: 'Application', profile: 'Profile', dshHome: 'DSH home',
            reloadSupport: 'Config reload', reloadSupportValue: 'Recompose from disk (no restart)',
            actionsTitle: 'Actions', actionsSub: 'Changes take effect after a reload', checkBackups: 'Check backups',
            backupCount: (n, dir) => `${n} backup(s) in ${dir}`,
            safetyTitle: 'Write safety',
            safetyBody: 'Every write validates, backs up, writes a temporary file, renames it atomically, then reads back and validates again.',
            backupDir: 'Backup directory', backupsRetained: 'Backups retained',
            backupsRetainedValue: (n) => `${n} per file`, scanCache: 'Scan cache',
            secrets: 'Secret protection', secretsValue: 'Credential-like env values, headers and URL tokens are masked',
            language: 'Language',
          },
          msg: {
            saved: 'Saved. The previous version was backed up.', savedNoBackup: 'Saved.',
            savedReload: (n) => `${n} server(s) updated. Reload to apply.`,
            enabledFile: 'Enabled in the configuration file.', disabledFile: 'Disabled in the configuration file.',
            removed: 'Entry removed from the configuration file.',
            added: (name) => `Added "${name}". Reload to start it.`,
            imported: (n) => `Imported ${n} server(s). Reload to start them.`,
            reloaded: 'Configuration reloaded from disk.',
            reloadedRestart: 'Reloaded, but some changes need a restart.',
            reloadUnavailable: 'This host cannot reload configuration; restart to apply changes.',
            failed: (n, err) => `${n} change(s) failed: ${err}`,
            loadFailed: (err) => `Could not read MCP configuration: ${err}`,
            toolCount: (n) => `${n} tools`,
          },
          transport: { stdio: 'stdio', 'streamable-http': 'HTTP', sse: 'SSE', http: 'HTTP', unknown: 'unknown' },
        },
      }

/** Chinese copy (the default). */
export const zh = TEXT.zh

/** English copy. */
export const en = TEXT.en

/**
 * Pick a dictionary for a language code.
 *
 * @param {string} [code] - 'zh' or 'en'.
 * @returns {object} the dictionary.
 */
export function dictFor(code) {
  return TEXT[code] ?? TEXT.zh
}
