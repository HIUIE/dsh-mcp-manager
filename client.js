/**
 * Browser half of the MCP Manager bundle.
 *
 * Two registrations on the root scope:
 *
 *  - `sidebar.panellist` — the entry in the global panel rail;
 *  - `main` keyed `mcp-manager` — the dashboard page.
 *
 * Every fact shown here comes from the Host routes under
 * `/api/dsh-mcp-manager`; this module formats and draws. Visible copy comes from
 * the shared dictionary below, Chinese by default, and the choice is remembered
 * in `localStorage`.
 *
 * @module @local/dsh-mcp-manager/client
 */

window.__ModuleLoader__.load({
  id: '@local/dsh-mcp-manager',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useState, useEffect, useMemo, useRef, useCallback } = React

    const PANEL_ID = 'mcp-manager'
    const API = '/api/dsh-mcp-manager'
    const STYLE_ID = 'dsh-mcp-manager-style'
    const LANG_KEY = 'dsh-mcp-manager.lang'

    /* ------------------------------------------------------------------ */
    /* Copy (mirrors lib/i18n.js)                                          */
    /* ------------------------------------------------------------------ */

    const TEXT = {
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

    /** Read the remembered language; Chinese is the default. */
    function initialLang() {
      try {
        const saved = window.localStorage?.getItem(LANG_KEY)
        if (saved === 'zh' || saved === 'en') return saved
      } catch {
        /* blocked storage must not break the page */
      }
      return 'zh'
    }

    /* ------------------------------------------------------------------ */
    /* Formatting                                                          */
    /* ------------------------------------------------------------------ */

    function relative(at, dict) {
      if (!at) return dict.common.none
      const zh = dict === TEXT.zh
      const delta = Date.now() - Number(at)
      if (delta < 45_000) return zh ? '刚刚' : 'just now'
      if (delta < 3_600_000) {
        const n = Math.round(delta / 60_000)
        return zh ? `${n} 分钟前` : `${n} min ago`
      }
      if (delta < 86_400_000) {
        const n = Math.round(delta / 3_600_000)
        return zh ? `${n} 小时前` : `${n} h ago`
      }
      const n = Math.round(delta / 86_400_000)
      return zh ? `${n} 天前` : `${n} d ago`
    }

    function fmtCount(value) {
      return (Number(value) || 0).toLocaleString()
    }

    /* ------------------------------------------------------------------ */
    /* Styles                                                              */
    /* ------------------------------------------------------------------ */

    const CSS = `
.mm-root{width:100%;min-width:0;height:100%;min-height:0;display:flex;flex-direction:column;
 color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base);font-size:14px;line-height:1.6;
 -webkit-font-smoothing:antialiased}
.mm-body{flex:1;min-height:0;display:flex}

/* --- 左侧导航：更轻、更安静 --- */
.mm-nav{width:176px;flex:0 0 176px;padding:calc(18px + var(--dsh-frame-top-clearance,0px)) 10px 14px;
 border-right:.5px solid var(--dsw-alias-border-l1);display:flex;flex-direction:column;gap:1px}
.mm-brand{display:flex;align-items:center;gap:9px;padding:0 8px 16px}
.mm-brand b{font-size:13px;font-weight:600;letter-spacing:-.01em}
.mm-brand span{display:block;font-size:10.5px;color:var(--dsw-alias-label-secondary);font-weight:400;margin-top:1px}
.mm-navitem{display:flex;align-items:center;gap:8px;height:32px;padding:0 10px;border:0;border-radius:8px;
 background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:13px;cursor:pointer;
 text-align:left;width:100%;position:relative;transition:color .12s ease}
.mm-navitem:hover{color:var(--dsw-alias-label-primary)}
.mm-navitem[aria-current="page"]{background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font-weight:500}
.mm-navitem[aria-current="page"]::before{content:"";position:absolute;left:0;top:8px;bottom:8px;width:2.5px;
 border-radius:2px;background:var(--dsw-alias-brand-primary)}
.mm-navitem .mm-count{margin-left:auto;font-size:11px;color:var(--dsw-alias-label-secondary);
 font-variant-numeric:tabular-nums;font-weight:400}
.mm-navfoot{margin-top:auto;padding:10px 2px 0;border-top:.5px solid var(--dsw-alias-border-l1)}
.mm-langs{display:flex;gap:2px;padding:2px;border-radius:8px;background:var(--dsw-alias-bg-layer-1)}
.mm-langs button{flex:1;height:25px;border:0;border-radius:6px;background:transparent;
 color:var(--dsw-alias-label-secondary);font:inherit;font-size:11.5px;cursor:pointer;transition:all .12s ease}
.mm-langs button:hover{color:var(--dsw-alias-label-primary)}
.mm-langs button[aria-pressed="true"]{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 15%,transparent);
 color:var(--dsw-alias-brand-primary);font-weight:500}

/* --- 主区 --- */
.mm-main{flex:1;min-width:0;overflow:auto;scrollbar-gutter:stable}
.mm-inner{max-width:960px;margin:0 auto;padding:0 clamp(24px,4vw,44px) 64px}
.mm-head{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:12px;
 padding-top:calc(28px + var(--dsh-frame-top-clearance,0px));margin-bottom:22px}
.mm-head h1{margin:0;font-size:21px;font-weight:650;line-height:28px;letter-spacing:-.02em}
.mm-head p{margin:4px 0 0;font-size:12.5px;color:var(--dsw-alias-label-secondary)}
.mm-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}

/* --- 按钮：默认更安静 --- */
.mm-btn{height:30px;padding:0 13px;border-radius:8px;border:.5px solid var(--dsw-alias-border-l2);
 background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;
 cursor:pointer;display:inline-flex;align-items:center;gap:6px;white-space:nowrap;
 transition:background .12s ease,opacity .12s ease}
.mm-btn:hover:not(:disabled){background:var(--dsw-alias-bg-layer-1)}
.mm-btn:disabled{opacity:.45;cursor:default}
.mm-btn.primary{background:var(--dsw-alias-brand-primary);border-color:transparent;
 color:var(--dsw-alias-bg-base);font-weight:600}
.mm-btn.primary:hover:not(:disabled){filter:brightness(1.07);background:var(--dsw-alias-brand-primary)}
.mm-btn.primary:disabled{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);
 opacity:1;border-color:var(--dsw-alias-border-l1)}
.mm-btn.danger{color:var(--dsw-alias-state-error-primary)}
.mm-btn.sm{height:25px;padding:0 9px;font-size:12px;border-radius:7px}
.mm-btn.ghost{background:transparent;border-color:transparent}
.mm-btn.ghost:hover:not(:disabled){background:var(--dsw-alias-bg-layer-1)}
.mm-btn:focus-visible,.mm-input:focus-visible,.mm-tab:focus-visible,.mm-switch:focus-visible,
.mm-navitem:focus-visible,.mm-ta:focus-visible,.mm-langs button:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}

/* --- 输入 --- */
.mm-input,.mm-ta{width:100%;box-sizing:border-box;border:.5px solid var(--dsw-alias-border-l2);border-radius:8px;
 background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;
 padding:0 11px;height:30px;transition:border-color .12s ease}
.mm-input:hover,.mm-ta:hover{border-color:var(--dsw-alias-label-secondary)}
.mm-ta{height:auto;min-height:200px;padding:11px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
 font-size:12px;line-height:1.6;resize:vertical;tab-size:2}

/* --- 统计栏：一条卡片，内部分隔，不再是一排小盒子 --- */
.mm-stats{display:flex;flex-wrap:wrap;align-items:stretch;border:.5px solid var(--dsw-alias-border-l1);
 border-radius:12px;background:var(--dsw-alias-bg-layer-1);margin-bottom:20px;overflow:hidden}
.mm-stat{flex:1 1 0;min-width:104px;padding:14px 18px 13px;position:relative}
.mm-stat + .mm-stat::before{content:"";position:absolute;left:0;top:14px;bottom:13px;width:.5px;
 background:var(--dsw-alias-border-l1)}
.mm-stat .v{font-size:24px;font-weight:650;line-height:1.1;font-variant-numeric:tabular-nums;letter-spacing:-.02em}
.mm-stat .v.mm-accent{color:var(--dsw-alias-brand-primary)}
.mm-stat .k{font-size:11.5px;color:var(--dsw-alias-label-secondary);margin-top:3px}

/* --- 卡片 --- */
.mm-card{border:.5px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-1);
 overflow:hidden}
.mm-card + .mm-card{margin-top:14px}
.mm-cardhead{display:flex;align-items:baseline;justify-content:space-between;gap:10px;padding:13px 18px 11px;
 border-bottom:.5px solid var(--dsw-alias-border-l1)}
.mm-cardhead h2{margin:0;font-size:13.5px;font-weight:600;letter-spacing:-.01em}
.mm-cardhead .sub{font-size:11.5px;color:var(--dsw-alias-label-secondary);font-weight:400}

/* --- 表格：无竖线、行间呼吸感 --- */
.mm-table{width:100%;border-collapse:collapse;font-size:13px;table-layout:fixed}
.mm-table th{text-align:left;font-weight:500;font-size:11px;color:var(--dsw-alias-label-secondary);
 padding:8px 14px;background:color-mix(in srgb,var(--dsw-alias-label-secondary) 4%,transparent);white-space:nowrap}
.mm-table td{padding:9px 14px;border-bottom:.5px solid var(--dsw-alias-border-l1);vertical-align:middle;
 white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mm-table tr:last-child td{border-bottom:0}
.mm-table tbody tr{cursor:pointer;transition:background .1s ease}
.mm-table tbody tr:hover{background:var(--dsw-alias-bg-layer-2)}
.mm-name{font-weight:500;display:flex;align-items:center;gap:7px;min-width:0}
.mm-name code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px;overflow:hidden;
 text-overflow:ellipsis;white-space:nowrap}
.mm-muted{color:var(--dsw-alias-label-secondary)}
.mm-mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px}
.mm-tag{display:inline-flex;align-items:center;height:20px;padding:0 8px;border-radius:999px;font-size:11px;line-height:1;
 background:color-mix(in srgb,var(--dsw-alias-label-secondary) 8%,transparent);
 color:var(--dsw-alias-label-secondary);white-space:nowrap}
.mm-tag.host{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 10%,transparent);color:var(--dsw-alias-brand-primary)}
.mm-dot{width:6px;height:6px;border-radius:50%;flex:0 0 auto}
.mm-dot.on{background:var(--dsw-alias-state-success-primary);box-shadow:0 0 0 2.5px color-mix(in srgb,var(--dsw-alias-state-success-primary) 18%,transparent)}
.mm-dot.off{background:var(--dsw-alias-state-idle-primary)}

/* --- 开关 --- */
.mm-switch{position:relative;width:34px;height:19px;border-radius:999px;border:0;padding:0;cursor:pointer;
 background:var(--dsw-alias-border-l2);transition:background .15s ease;flex:0 0 auto}
.mm-switch[aria-checked="true"]{background:var(--dsw-alias-state-success-primary)}
.mm-switch::after{content:"";position:absolute;top:2.5px;left:2.5px;width:14px;height:14px;border-radius:50%;
 background:#fff;transition:transform .15s cubic-bezier(.3,.7,.4,1.2);box-shadow:0 1px 3px rgba(0,0,0,.25)}
.mm-switch[aria-checked="true"]::after{transform:translateX(15px)}
.mm-switch:disabled{opacity:.45;cursor:default}

/* --- 分段控件 --- */
.mm-seg{display:inline-flex;gap:1px;padding:2px;border:.5px solid var(--dsw-alias-border-l1);border-radius:9px;
 background:var(--dsw-alias-bg-layer-1)}
.mm-seg button{height:24px;padding:0 10px;border:0;border-radius:7px;background:transparent;
 color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;cursor:pointer;transition:all .12s ease}
.mm-seg button:hover{color:var(--dsw-alias-label-primary)}
.mm-seg button[aria-pressed="true"]{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 15%,transparent);
 color:var(--dsw-alias-brand-primary);font-weight:500}

/* --- 提示条 --- */
.mm-empty{padding:40px 20px;text-align:center;color:var(--dsw-alias-label-secondary);font-size:13px}
.mm-err,.mm-ok,.mm-warnbox{padding:10px 14px;border-radius:10px;font-size:12.5px;margin-bottom:12px;display:flex}
.mm-err{border:.5px solid var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary);
 background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 7%,transparent)}
.mm-ok{border:.5px solid var(--dsw-alias-state-success-primary);color:var(--dsw-alias-state-success-primary);
 background:color-mix(in srgb,var(--dsw-alias-state-success-primary) 7%,transparent)}
.mm-warnbox{border:.5px solid var(--dsw-alias-state-warn-primary);color:var(--dsw-alias-state-warn-primary);
 background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 7%,transparent)}

/* --- 抽屉 --- */
.mm-panel{position:fixed;inset:0;z-index:60;display:flex;justify-content:flex-end}
.mm-scrim{position:absolute;inset:0;background:rgba(0,0,0,.32);backdrop-filter:blur(1px)}
.mm-drawer{position:relative;width:min(620px,94vw);height:100%;background:var(--dsw-alias-bg-base);
 border-left:.5px solid var(--dsw-alias-border-l2);display:flex;flex-direction:column;
 box-shadow:-16px 0 48px rgba(0,0,0,.14)}
.mm-drawerhead{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:16px 20px;
 border-bottom:.5px solid var(--dsw-alias-border-l1)}
.mm-drawerbody{flex:1;min-height:0;overflow:auto;padding:18px 20px 36px}

/* --- 表单 --- */
.mm-field{margin-bottom:14px}
.mm-field label{display:block;font-size:11.5px;color:var(--dsw-alias-label-secondary);margin-bottom:4px;font-weight:500}
.mm-field .hint{font-size:11px;color:var(--dsw-alias-label-secondary);margin-top:4px;opacity:.85}
.mm-field .hint.mm-bad{color:var(--dsw-alias-state-error-primary);opacity:1}
.mm-kv{display:grid;grid-template-columns:1fr 1fr auto;gap:6px;align-items:center;margin-bottom:6px}
.mm-grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}

/* --- 页签 --- */
.mm-tabs{display:flex;gap:2px;border-bottom:.5px solid var(--dsw-alias-border-l1);margin-bottom:16px}
.mm-tab{height:32px;padding:0 12px;border:0;background:transparent;color:var(--dsw-alias-label-secondary);
 font:inherit;font-size:13px;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-.5px;
 transition:color .12s ease}
.mm-tab:hover{color:var(--dsw-alias-label-primary)}
.mm-tab[aria-selected="true"]{color:var(--dsw-alias-label-primary);border-bottom-color:var(--dsw-alias-brand-primary);font-weight:500}

/* --- 工具条目 --- */
.mm-tool{padding:12px 16px;border-bottom:.5px solid var(--dsw-alias-border-l1)}
.mm-tool:last-child{border-bottom:0}
.mm-tool .top{display:flex;align-items:center;gap:8px}
.mm-tool code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px;font-weight:500}
.mm-tool .desc{font-size:12px;color:var(--dsw-alias-label-secondary);margin-top:3px;max-width:72ch}
.mm-pre{margin:8px 0 0;padding:10px 11px;border-radius:8px;background:var(--dsw-alias-bg-layer-2);
 font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;line-height:1.55;
 overflow:auto;max-height:240px;white-space:pre}
.mm-param{display:flex;gap:7px;padding:4px 0;font-size:12px;border-bottom:.5px dashed var(--dsw-alias-border-l1)}
.mm-param:last-child{border-bottom:0}
.mm-param code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px;flex:0 0 auto}
.mm-param .t{color:var(--dsw-alias-label-secondary);flex:0 0 auto;font-size:11px}

/* --- 键值行 --- */
.mm-kvline{display:flex;gap:10px;padding:6px 0;font-size:12.5px;border-bottom:.5px solid var(--dsw-alias-border-l1)}
.mm-kvline:last-child{border-bottom:0}
.mm-kvline .k{flex:0 0 148px;color:var(--dsw-alias-label-secondary)}
.mm-kvline .v{flex:1;min-width:0;overflow-wrap:anywhere}

/* --- 导入列表 --- */
.mm-src{display:flex;align-items:center;gap:10px;padding:10px 16px;border-bottom:.5px solid var(--dsw-alias-border-l1)}
.mm-src:last-child{border-bottom:0}
.mm-src .meta{min-width:0;flex:1}
.mm-src .meta b{font-size:13px;font-weight:500}
.mm-src .meta span{display:block;font-size:11px;color:var(--dsw-alias-label-secondary);
 overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:1px}
.mm-pad{padding:14px 18px}
.mm-more{padding:9px 18px;border-top:.5px solid var(--dsw-alias-border-l1);
 font-size:11.5px;color:var(--dsw-alias-label-secondary)}
@media (max-width:760px){
 .mm-nav{width:52px;flex-basis:52px}
 .mm-navitem span.lbl,.mm-brand b,.mm-brand span,.mm-navitem .mm-count,.mm-langs{display:none}
 .mm-grid2{grid-template-columns:1fr}
 .mm-stat{min-width:calc(50% - 1px)}
 .mm-stat:nth-child(3)::before{display:none}
}
`

    function ensureStyle() {
      if (typeof document === 'undefined') return
      if (document.querySelector('style[data-mcp-manager]') !== null) return
      const tag = document.createElement('style')
      tag.dataset.mcpManager = STYLE_ID
      tag.textContent = CSS
      document.head.appendChild(tag)
    }

    /* ------------------------------------------------------------------ */
    /* Data access                                                         */
    /* ------------------------------------------------------------------ */

    async function getRoute(route, signal) {
      const res = await fetch(`${API}${route}`, { signal, headers: { accept: 'application/json' } })
      const body = await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }))
      if (!res.ok || !body?.ok) throw new Error(body?.error ?? `HTTP ${res.status}`)
      return body.data
    }

    async function postRoute(route, payload, signal) {
      const res = await fetch(`${API}${route}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(payload ?? {}),
        signal,
      })
      const body = await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }))
      if (!res.ok || !body?.ok) throw new Error(body?.error ?? `HTTP ${res.status}`)
      return body.data
    }

    /* ------------------------------------------------------------------ */
    /* Shared controls                                                     */
    /* ------------------------------------------------------------------ */

    function Switch({ checked, onChange, disabled, label }) {
      return h('button', {
        type: 'button',
        className: 'mm-switch',
        role: 'switch',
        'aria-checked': checked ? 'true' : 'false',
        'aria-label': label,
        disabled: Boolean(disabled),
        onClick: (event) => {
          event.stopPropagation()
          if (!disabled) onChange(!checked)
        },
      })
    }

    function Seg({ value, options, onChange }) {
      return h('div', { className: 'mm-seg', role: 'group' },
        options.map((option) => h('button', {
          key: option.value,
          type: 'button',
          'aria-pressed': value === option.value ? 'true' : 'false',
          onClick: () => onChange(option.value),
        }, option.label)))
    }

    function Field({ label, hint, children }) {
      return h('div', { className: 'mm-field' },
        h('label', null, label),
        children,
        hint ? h('div', { className: 'hint' }, hint) : null)
    }

    /** One label/value row. */
    function Kv({ label, value }) {
      return h('div', { className: 'mm-kvline' },
        h('div', { className: 'k' }, label),
        h('div', { className: 'v' }, value))
    }

    /** Key/value editor used for env and headers. */
    function KvEditor({ rows, onChange, addLabel, keyLabel, valueLabel }) {
      const list = Array.isArray(rows) ? rows : []
      const update = (index, patch) => {
        onChange(list.map((row, i) => (i === index ? { ...row, ...patch } : row)))
      }
      return h('div', null,
        list.map((row, index) => h('div', { className: 'mm-kv', key: index },
          h('input', {
            className: 'mm-input', value: row.name ?? '', placeholder: keyLabel,
            'aria-label': `${keyLabel} ${index + 1}`,
            onChange: (event) => update(index, { name: event.target.value }),
          }),
          h('input', {
            className: 'mm-input', value: row.value ?? '', placeholder: valueLabel,
            'aria-label': `${valueLabel} ${index + 1}`,
            onChange: (event) => update(index, { value: event.target.value }),
          }),
          h('button', {
            type: 'button', className: 'mm-btn sm ghost danger', 'aria-label': `${keyLabel} ${index + 1}`,
            onClick: () => onChange(list.filter((_, i) => i !== index)),
          }, '×'))),
        h('button', {
          type: 'button', className: 'mm-btn sm',
          onClick: () => onChange([...list, { name: '', value: '' }]),
        }, addLabel))
    }

    /** Render a JSON Schema's top-level parameters as compact rows. */
    function ParamList({ schema, dict }) {
      if (!schema || typeof schema !== 'object') {
        return h('div', { className: 'mm-muted', style: { fontSize: 11.5 } }, dict.detail.paramsNone)
      }
      const properties = schema.properties && typeof schema.properties === 'object' ? schema.properties : null
      if (!properties) return h('pre', { className: 'mm-pre' }, JSON.stringify(schema, null, 2))
      const required = Array.isArray(schema.required) ? schema.required : []
      return h('div', null,
        Object.entries(properties).map(([name, node]) => {
          const type = node?.type ?? (node?.anyOf || node?.oneOf ? 'union' : 'any')
          return h('div', { className: 'mm-param', key: name },
            h('code', null, name),
            h('span', { className: 't' }, `${type}${required.includes(name) ? ' *' : ''}`),
            h('span', { className: 'mm-muted', style: { marginLeft: 'auto', textAlign: 'right' } }, node?.description ?? ''))
        }))
    }

    function Drawer({ title, subtitle, onClose, children, dict }) {
      const ref = useRef(null)
      useEffect(() => {
        const onKey = (event) => {
          if (event.key === 'Escape') {
            event.stopPropagation()
            onClose()
          }
        }
        document.addEventListener('keydown', onKey, true)
        return () => document.removeEventListener('keydown', onKey, true)
      }, [onClose])
      return h('div', { className: 'mm-panel' },
        h('div', { className: 'mm-scrim', onClick: onClose, 'aria-hidden': 'true' }),
        h('div', {
          className: 'mm-drawer', role: 'dialog', 'aria-modal': 'true', 'aria-label': title, tabIndex: -1, ref,
        },
        h('div', { className: 'mm-drawerhead' },
          h('div', null,
            h('div', { style: { fontSize: 13.5, fontWeight: 600 } }, title),
            subtitle ? h('div', { className: 'mm-muted', style: { fontSize: 11 } }, subtitle) : null),
          h('button', {
            type: 'button', className: 'mm-btn sm ghost', onClick: onClose, 'aria-label': dict.common.close,
          }, '✕')),
        h('div', { className: 'mm-drawerbody' }, children)))
    }

    /* ------------------------------------------------------------------ */
    /* Server detail                                                       */
    /* ------------------------------------------------------------------ */

    function ServerPanel({ uid, inventory, dict, onClose, onChanged, notify }) {
      const [tab, setTab] = useState('overview')
      const [detail, setDetail] = useState(null)
      const [loading, setLoading] = useState(true)
      const [error, setError] = useState(null)
      const [busy, setBusy] = useState(false)
      const [draft, setDraft] = useState(null)
      const [toolQuery, setToolQuery] = useState('')

      const load = useCallback(async (signal) => {
        setLoading(true)
        try {
          const data = await getRoute(`/server?uid=${encodeURIComponent(uid)}`, signal)
          if (signal?.aborted) return
          setDetail(data)
          setError(null)
        } catch (err) {
          if (!signal?.aborted) setError(String(err?.message ?? err))
        } finally {
          if (!signal?.aborted) setLoading(false)
        }
      }, [uid])

      useEffect(() => {
        const controller = new AbortController()
        load(controller.signal)
        return () => controller.abort()
      }, [load])

      const server = detail?.server ?? inventory?.servers?.find((item) => item.uid === uid) ?? null
      const declaration = detail?.declaration ?? {}
      const isStdio = (declaration.transport ?? declaration.type ?? (declaration.command ? 'stdio' : 'streamable-http')) === 'stdio'

      useEffect(() => {
        if (draft !== null || detail === null) return
        const isMasked = (value) => typeof value === 'string' && value.includes('\u2022')
        const toRows = (map) => Object.entries(map ?? {}).map(([name, value]) => ({
          name, value: String(value), masked: isMasked(value),
        }))
        setDraft({
          name: server?.name ?? '',
          transport: isStdio ? 'stdio' : 'streamable-http',
          command: declaration.command ?? '',
          argsText: Array.isArray(declaration.args) ? declaration.args.join('\n') : '',
          url: declaration.url ?? '',
          cwd: declaration.cwd ?? '',
          env: toRows(declaration.env),
          headers: toRows(declaration.headers),
        })
      }, [detail, draft, server, declaration, isStdio])

      const tools = detail?.tools ?? []
      const filteredTools = useMemo(() => {
        const query = toolQuery.trim().toLowerCase()
        if (!query) return tools
        return tools.filter((tool) => tool.name.toLowerCase().includes(query) || (tool.description ?? '').toLowerCase().includes(query))
      }, [tools, toolQuery])

      const reloadProfile = async () => {
        setBusy(true)
        try {
          const result = await postRoute('/reload', { ids: [] })
          notify({ kind: result?.restartRequired ? 'warn' : 'ok', message: result?.restartRequired ? dict.msg.reloadedRestart : dict.msg.reloaded })
          onChanged()
          await load()
        } catch (err) {
          notify({ kind: 'err', message: String(err?.message ?? err) })
        } finally {
          setBusy(false)
        }
      }

      const runMutation = async (payload, successMessage) => {
        setBusy(true)
        try {
          const result = await postRoute('/mutate', payload)
          onChanged()
          notify({
            kind: result?.reloadRequired ? 'warn' : 'ok',
            message: successMessage,
            action: result?.reloadRequired ? { label: dict.common.reloadNow, run: reloadProfile } : undefined,
          })
          await load()
        } catch (err) {
          notify({ kind: 'err', message: String(err?.message ?? err) })
        } finally {
          setBusy(false)
        }
      }

      const save = async () => {
        if (!draft) return
        const payload = { op: 'update', uid, server: {} }
        if (draft.transport === 'stdio') {
          payload.server.command = draft.command.trim()
          payload.server.transport = 'stdio'
          payload.server.args = draft.argsText.split('\n').map((line) => line.trim()).filter(Boolean)
          const env = {}
          for (const row of draft.env) if (row.name.trim()) env[row.name.trim()] = row.value
          payload.server.env = env
          if (draft.cwd.trim()) payload.server.cwd = draft.cwd.trim()
        } else {
          payload.server.transport = 'streamable-http'
          payload.server.url = draft.url.trim()
          const headers = {}
          for (const row of draft.headers) if (row.name.trim()) headers[row.name.trim()] = row.value
          payload.server.headers = headers
        }
        await runMutation(payload, dict.msg.saved)
      }

      if (loading && detail === null) {
        return h(Drawer, { dict, title: server?.name ?? dict.common.loading, onClose },
          h('div', { className: 'mm-empty' }, dict.common.loading))
      }
      if (error !== null && detail === null) {
        return h(Drawer, { dict, title: server?.name ?? '', onClose },
          h('div', { className: 'mm-err' }, error),
          h('button', { className: 'mm-btn', type: 'button', onClick: () => load() }, dict.common.retry))
      }

      const overviewRows = [
        h(Kv, {
          key: 'state',
          label: dict.detail.stateInFile,
          value: server?.declared ? dict.state.enabled : dict.state.disabled,
        }),
        h(Kv, {
          key: 'conn',
          label: dict.detail.connectedNow,
          value: detail?.connected ? dict.detail.connectedYes : dict.detail.connectedNo,
        }),
        h(Kv, {
          key: 'src',
          label: dict.detail.source,
          value: `${server?.app ?? ''} — ${server?.sourceLabel ?? ''}`,
        }),
        h(Kv, {
          key: 'tp',
          label: dict.detail.transport,
          value: dict.transport[server?.transport] ?? server?.transport ?? dict.common.none,
        }),
        server?.patchId ? h(Kv, { key: 'row', label: dict.detail.loaderRow, value: server.patchId }) : null,
      ]

      const secretRows = (map, heading, key) => {
        const entries = Object.entries(map ?? {})
        if (entries.length === 0) return null
        return h('div', { key },
          h('div', { className: 'mm-muted', style: { fontSize: 10.5, margin: '7px 0 2px' } }, heading),
          entries.map(([name, value]) => h('div', { className: 'mm-kvline', key: name },
            h('div', { className: 'k mm-mono' }, name),
            h('div', { className: 'v mm-mono' }, String(value)))))
      }

      const commandText = isStdio
        ? `${declaration.command ?? dict.common.none}${Array.isArray(declaration.args) && declaration.args.length ? ` ${declaration.args.join(' ')}` : ''}`
        : (declaration.url ?? dict.common.none)

      const connectionCard = h('div', { className: 'mm-card', style: { marginTop: 11 } },
        h('div', { className: 'mm-cardhead' }, h('h2', null, dict.detail.connection)),
        h('div', { className: 'mm-pad' },
          h(Kv, { key: 'cmd', label: isStdio ? dict.detail.command : dict.detail.url, value: commandText }),
          secretRows(declaration.env, dict.detail.environment, 'env'),
          secretRows(declaration.headers, dict.detail.headers, 'hdr')))

      const actionButtons = [
        h('button', {
          key: 'toggle', type: 'button', className: 'mm-btn', disabled: busy,
          onClick: () => runMutation(
            { op: 'toggle', uid, enabled: !server?.declared },
            server?.declared ? dict.msg.disabledFile : dict.msg.enabledFile,
          ),
        }, server?.declared ? dict.servers.disable : dict.servers.enable),
        server?.patchId
          ? h('button', {
            key: 'reload', type: 'button', className: 'mm-btn', disabled: busy, onClick: reloadProfile,
          }, dict.common.reload)
          : null,
        h('button', {
          key: 'remove', type: 'button', className: 'mm-btn danger', disabled: busy,
          onClick: () => runMutation({ op: 'delete', uid }, dict.msg.removed),
        }, dict.detail.removeEntry),
      ]

      const tabBar = h('div', { className: 'mm-tabs', role: 'tablist' },
        [['overview', dict.detail.tabOverview], ['tools', dict.detail.tabTools(tools.length)], ['edit', dict.detail.tabEdit]]
          .map(([id, label]) => h('button', {
            key: id, type: 'button', className: 'mm-tab', role: 'tab',
            'aria-selected': tab === id ? 'true' : 'false', onClick: () => setTab(id),
          }, label)))

      let body
      if (tab === 'overview') {
        body = h('div', null,
          detail?.parseErrors?.length ? h('div', { className: 'mm-err' }, detail.parseErrors.join('; ')) : null,
          h('div', { className: 'mm-card' }, h('div', { className: 'mm-pad' }, overviewRows)),
          connectionCard,
          h('div', { className: 'mm-row', style: { marginTop: 12 } }, actionButtons))
      } else if (tab === 'tools') {
        const toolRows = filteredTools.length === 0
          ? h('div', { className: 'mm-empty' }, detail?.connected ? dict.detail.noToolsMatch : dict.detail.noTools)
          : filteredTools.map((tool) => h('div', { className: 'mm-tool', key: tool.wireName ?? tool.name },
            h('div', { className: 'top' }, h('code', null, tool.name)),
            tool.description ? h('div', { className: 'desc' }, tool.description) : null,
            h('details', { style: { marginTop: 5 } },
              h('summary', { className: 'mm-muted', style: { fontSize: 11, cursor: 'pointer' } }, dict.detail.params),
              h(ParamList, { schema: tool.parameters, dict }),
              h('pre', { className: 'mm-pre' }, JSON.stringify(tool.parameters ?? {}, null, 2)))))
        body = h('div', null,
          h('div', { className: 'mm-field' },
            h('input', {
              className: 'mm-input', placeholder: dict.detail.toolSearch, value: toolQuery,
              'aria-label': dict.detail.toolSearch,
              onChange: (event) => setToolQuery(event.target.value),
            })),
          detail?.connected ? null : h('div', { className: 'mm-warnbox' }, dict.detail.toolNotConnected),
          h('div', { className: 'mm-card' }, toolRows))
      } else {
        const stdioFields = h('div', null,
          h(Field, { label: dict.detail.commandLabel, hint: dict.detail.commandHint },
            h('input', {
              className: 'mm-input', value: draft?.command ?? '',
              onChange: (event) => setDraft({ ...draft, command: event.target.value }),
            })),
          h(Field, { label: dict.detail.argsLabel, hint: dict.detail.argsHint },
            h('textarea', {
              className: 'mm-ta', style: { minHeight: 78 }, value: draft?.argsText ?? '',
              onChange: (event) => setDraft({ ...draft, argsText: event.target.value }),
            })),
          h(Field, { label: dict.detail.envLabel },
            h(KvEditor, {
              rows: draft?.env ?? [],
              keyLabel: dict.add.nameLabel,
              valueLabel: dict.detail.envLabel,
              addLabel: dict.add.addVariable,
              onChange: (rows) => setDraft({ ...draft, env: rows }),
            })),
          h(Field, { label: dict.detail.cwdLabel },
            h('input', {
              className: 'mm-input', value: draft?.cwd ?? '',
              onChange: (event) => setDraft({ ...draft, cwd: event.target.value }),
            })))
        const httpFields = h('div', null,
          h(Field, { label: dict.detail.urlLabel, hint: dict.detail.urlHint },
            h('input', {
              className: 'mm-input', value: draft?.url ?? '',
              onChange: (event) => setDraft({ ...draft, url: event.target.value }),
            })),
          h(Field, { label: dict.detail.headersLabel },
            h(KvEditor, {
              rows: draft?.headers ?? [],
              keyLabel: dict.detail.headersLabel,
              valueLabel: dict.detail.headersLabel,
              addLabel: dict.add.addHeader,
              onChange: (rows) => setDraft({ ...draft, headers: rows }),
            })))
        body = h('div', null,
          h('div', { className: 'mm-warnbox' }, dict.detail.editWarning(server?.sourceLabel ?? '', server?.app ?? '')),
          h('div', { className: 'mm-grid2' },
            h(Field, { label: dict.detail.nameLabel },
              h('input', { className: 'mm-input', value: draft?.name ?? '', disabled: true })),
            h(Field, { label: dict.detail.transportLabel },
              h('select', {
                className: 'mm-input', value: draft?.transport ?? 'stdio',
                onChange: (event) => setDraft({ ...draft, transport: event.target.value }),
              },
              h('option', { value: 'stdio' }, dict.add.stdio),
              h('option', { value: 'streamable-http' }, dict.add.http)))),
          draft?.transport === 'stdio' ? stdioFields : httpFields,
          h('div', { className: 'mm-row', style: { marginTop: 14 } },
            h('button', { type: 'button', className: 'mm-btn primary', disabled: busy, onClick: save },
              busy ? dict.common.saving : dict.common.save),
            h('button', {
              type: 'button', className: 'mm-btn', disabled: busy,
              onClick: () => { setDraft(null); load() },
            }, dict.common.cancel)))
      }

      return h(Drawer, {
        dict,
        title: server?.name ?? '',
        subtitle: `${server?.app ?? ''} · ${server?.sourceLabel ?? ''}`,
        onClose,
      }, tabBar, body)
    }

    /* ------------------------------------------------------------------ */
    /* Add server                                                          */
    /* ------------------------------------------------------------------ */

    function AddPanel({ inventory, dict, onClose, onChanged, notify }) {
      const hosts = (inventory?.sources ?? []).filter((source) => source.exists || source.kind === 'host')
      const [mode, setMode] = useState('form')
      const [busy, setBusy] = useState(false)
      const [draft, setDraft] = useState({
        name: '', transport: 'stdio', command: '', argsText: '', url: '', cwd: '', env: [], headers: [],
      })
      const [target, setTarget] = useState(hosts[0]?.id ?? 'dsh-profile')
      const [jsonText, setJsonText] = useState('')
      const [jsonError, setJsonError] = useState(null)

      const reload = async () => {
        try {
          const result = await postRoute('/reload', { ids: [] })
          notify({ kind: result?.restartRequired ? 'warn' : 'ok', message: result?.restartRequired ? dict.msg.reloadedRestart : dict.msg.reloaded })
          onChanged()
        } catch (err) {
          notify({ kind: 'err', message: String(err?.message ?? err) })
        }
      }

      const parseJson = (text) => {
        let parsed
        try {
          parsed = JSON.parse(text)
        } catch (error) {
          throw new Error(dict.config.invalid(String(error?.message ?? error)))
        }
        const bucket = parsed.mcpServers ?? parsed.mcp_servers ?? parsed
        if (!bucket || typeof bucket !== 'object' || Array.isArray(bucket)) {
          throw new Error(dict.config.invalid('mcpServers'))
        }
        const items = []
        for (const [name, raw] of Object.entries(bucket)) {
          if (!raw || typeof raw !== 'object') continue
          const stdio = Boolean(raw.command)
          items.push({
            name,
            transport: stdio ? 'stdio' : (raw.type === 'sse' ? 'sse' : 'streamable-http'),
            command: raw.command ?? '',
            args: Array.isArray(raw.args) ? raw.args.map(String) : [],
            url: raw.url ?? '',
            env: Object.entries(raw.env ?? {}).map(([k, v]) => ({ name: k, value: String(v) })),
            headers: Object.entries(raw.headers ?? {}).map(([k, v]) => ({ name: k, value: String(v) })),
          })
        }
        if (items.length === 0) throw new Error(dict.config.invalid('mcpServers'))
        return items
      }

      const submitForm = async () => {
        setBusy(true)
        try {
          const server = {
            name: draft.name.trim(),
            transport: draft.transport,
            args: draft.argsText.split('\n').map((line) => line.trim()).filter(Boolean),
          }
          if (draft.transport === 'stdio') {
            server.command = draft.command.trim()
            const env = {}
            for (const row of draft.env) if (row.name.trim()) env[row.name.trim()] = row.value
            server.env = env
            if (draft.cwd.trim()) server.cwd = draft.cwd.trim()
          } else {
            server.url = draft.url.trim()
            const headers = {}
            for (const row of draft.headers) if (row.name.trim()) headers[row.name.trim()] = row.value
            server.headers = headers
          }
          await postRoute('/mutate', { op: 'add', sourceId: target, server })
          notify({ kind: 'ok', message: dict.msg.added(server.name), action: { label: dict.common.reloadNow, run: reload } })
          onChanged()
          onClose()
        } catch (err) {
          notify({ kind: 'err', message: String(err?.message ?? err) })
        } finally {
          setBusy(false)
        }
      }

      const submitJson = async () => {
        setBusy(true)
        try {
          const servers = parseJson(jsonText)
          await postRoute('/mutate', { op: 'import', sourceId: target, servers })
          notify({ kind: 'ok', message: dict.msg.imported(servers.length), action: { label: dict.common.reloadNow, run: reload } })
          onChanged()
          onClose()
        } catch (err) {
          setJsonError(String(err?.message ?? err))
        } finally {
          setBusy(false)
        }
      }

      const copyServer = async (item) => {
        try {
          const data = await getRoute(`/server?uid=${encodeURIComponent(item.uid)}`)
          const declaration = data?.declaration ?? {}
          await postRoute('/mutate', {
            op: 'add',
            sourceId: target,
            server: {
              name: item.name,
              transport: declaration.command ? 'stdio' : 'streamable-http',
              command: declaration.command,
              args: declaration.args ?? [],
              url: declaration.url,
              env: declaration.env ?? {},
              headers: declaration.headers ?? {},
              cwd: declaration.cwd,
            },
          })
          notify({ kind: 'ok', message: dict.msg.added(item.name), action: { label: dict.common.reloadNow, run: reload } })
          onChanged()
          onClose()
        } catch (err) {
          notify({ kind: 'err', message: String(err?.message ?? err) })
        }
      }

      const isStdio = draft.transport === 'stdio'
      const importable = (inventory?.servers ?? []).filter((item) => item.sourceId !== target)

      // Mirror the Host's rule so a bad name is caught before a request.
      const trimmedName = draft.name.trim()
      const nameValid = /^[A-Za-z0-9_-]{1,32}$/.test(trimmedName)
      const nameTaken = (inventory?.servers ?? []).some(
        (item) => item.sourceId === target && item.name === trimmedName,
      )
      const nameHint = trimmedName === '' ? dict.add.nameHint
        : !nameValid ? dict.add.nameInvalid
          : nameTaken ? dict.add.nameTaken
            : dict.add.nameOk

      const formSection = mode !== 'form' ? null : h('div', null,
        h('div', { className: 'mm-grid2' },
          h('div', { className: 'mm-field' },
            h('label', null, dict.add.nameLabel),
            h('input', {
              className: 'mm-input', value: draft.name, placeholder: 'my-server',
              'aria-invalid': trimmedName !== '' && !nameValid ? 'true' : 'false',
              onChange: (event) => setDraft({ ...draft, name: event.target.value }),
            }),
            h('div', {
              className: `hint${trimmedName !== '' && (!nameValid || nameTaken) ? ' mm-bad' : ''}`,
            }, nameHint)),
          h(Field, { label: dict.add.transportLabel },
            h('select', {
              className: 'mm-input', value: draft.transport,
              onChange: (event) => setDraft({ ...draft, transport: event.target.value }),
            },
            h('option', { value: 'stdio' }, dict.add.stdio),
            h('option', { value: 'streamable-http' }, dict.add.http)))),
        isStdio
          ? h('div', null,
            h(Field, { label: dict.add.commandLabel },
              h('input', {
                className: 'mm-input', value: draft.command, placeholder: 'npx',
                onChange: (event) => setDraft({ ...draft, command: event.target.value }),
              })),
            h(Field, { label: dict.add.argsLabel, hint: dict.add.argsHint },
              h('textarea', {
                className: 'mm-ta', style: { minHeight: 74 }, value: draft.argsText,
                placeholder: '-y\n@some/mcp-server@latest',
                onChange: (event) => setDraft({ ...draft, argsText: event.target.value }),
              })),
            h(Field, { label: dict.add.envLabel },
              h(KvEditor, {
                rows: draft.env,
                keyLabel: dict.add.nameLabel,
                valueLabel: dict.add.envLabel,
                addLabel: dict.add.addVariable,
                onChange: (rows) => setDraft({ ...draft, env: rows }),
              })))
          : h('div', null,
            h(Field, { label: dict.add.urlLabel },
              h('input', {
                className: 'mm-input', value: draft.url, placeholder: 'https://example.com/mcp',
                onChange: (event) => setDraft({ ...draft, url: event.target.value }),
              })),
            h(Field, { label: dict.add.headersLabel },
              h(KvEditor, {
                rows: draft.headers,
                keyLabel: dict.add.headersLabel,
                valueLabel: dict.add.headersLabel,
                addLabel: dict.add.addHeader,
                onChange: (rows) => setDraft({ ...draft, headers: rows }),
              }))),
        h('div', { className: 'mm-row', style: { marginTop: 14 } },
          h('button', {
            type: 'button', className: 'mm-btn primary',
            disabled: busy || !nameValid || nameTaken,
            onClick: submitForm,
          }, busy ? dict.add.submitting : dict.add.submit)))

      const jsonSection = mode !== 'json' ? null : h('div', null,
        h(Field, { label: dict.add.jsonLabel, hint: dict.add.jsonHint },
          h('textarea', {
            className: 'mm-ta', value: jsonText,
            placeholder: '{\n  "mcpServers": {\n    "example": {\n      "command": "npx",\n      "args": ["-y", "@example/mcp@latest"]\n    }\n  }\n}',
            onChange: (event) => { setJsonText(event.target.value); setJsonError(null) },
          })),
        jsonError ? h('div', { className: 'mm-err' }, jsonError) : null,
        h('div', { className: 'mm-row', style: { marginTop: 10 } },
          h('button', {
            type: 'button', className: 'mm-btn primary',
            disabled: busy || !jsonText.trim(),
            onClick: submitJson,
          }, busy ? dict.add.jsonSubmitting : dict.add.jsonSubmit)))

      const importSection = mode !== 'import' ? null : h('div', null,
        h('div', { className: 'mm-warnbox' }, dict.add.importHint),
        importable.length === 0
          ? h('div', { className: 'mm-empty' }, dict.add.importEmpty)
          : h('div', { className: 'mm-card' },
            importable.map((item) => h('div', { className: 'mm-src', key: item.uid },
              h('div', { className: 'meta' },
                h('b', null, item.name),
                h('span', null, `${item.app} · ${item.sourceLabel} · ${dict.transport[item.transport] ?? item.transport}`)),
              h('button', {
                type: 'button', className: 'mm-btn sm', disabled: busy, onClick: () => copyServer(item),
              }, dict.common.copy)))))

      return h(Drawer, { dict, title: dict.add.title, subtitle: dict.add.subtitle, onClose },
        h('div', { className: 'mm-tabs', role: 'tablist' },
          [['form', dict.add.tabManual], ['json', dict.add.tabJson], ['import', dict.add.tabImport]]
            .map(([id, label]) => h('button', {
              key: id, type: 'button', className: 'mm-tab', role: 'tab',
              'aria-selected': mode === id ? 'true' : 'false', onClick: () => setMode(id),
            }, label))),
        h(Field, { label: dict.add.target, hint: dict.add.targetHint },
          h('select', {
            className: 'mm-input', value: target, onChange: (event) => setTarget(event.target.value),
          }, hosts.map((source) => h('option', { key: source.id, value: source.id },
            `${source.app} — ${source.label}${source.exists ? '' : ` ${dict.add.newFile}`}`)))),
        formSection,
        jsonSection,
        importSection)
    }

    /* ------------------------------------------------------------------ */
    /* Pages                                                              */
    /* ------------------------------------------------------------------ */

    /** One quiet strip of numbers instead of a row of boxes. */
    function StatStrip({ totals, dict }) {
      const stats = [
        { k: dict.home.statServers(totals.hostServers, totals.otherServers), v: fmtCount(totals.servers) },
        { k: dict.home.statEnabled, v: fmtCount(totals.enabled) },
        { k: dict.home.statDisabled, v: fmtCount(totals.disabled), dim: totals.disabled === 0 },
        { k: dict.home.statConnected, v: fmtCount(totals.connected), accent: true },
        { k: dict.home.statTools, v: fmtCount(totals.tools) },
      ]
      return h('div', { className: 'mm-stats' },
        stats.map((stat) => h('div', { className: 'mm-stat', key: stat.k },
          h('div', { className: `v${stat.accent ? ' mm-accent' : ''}`, style: stat.dim ? { opacity: 0.45 } : undefined },
            stat.v),
          h('div', { className: 'k' }, stat.k))))
    }

    /** Two independent facts shown as two independent marks. */
    function StateCell({ server, dict }) {
      const line = (on, label, size, color) => h('div', {
        style: {
          display: 'flex', alignItems: 'center', gap: 5, fontSize: size, color,
          lineHeight: 1.45, whiteSpace: 'nowrap',
        },
      },
      h('span', { className: `mm-dot ${on ? 'on' : 'off'}` }),
      h('span', null, label))
      return h('div', null,
        line(server.declared, server.declared ? dict.state.enabled : dict.state.disabled, 12, null),
        line(server.reachable, server.reachable ? dict.state.connected : dict.state.notConnected, 10.5,
          'var(--dsw-alias-label-secondary)'))
    }

    function ServerTable({ inventory, dict, onOpen, onToggle, busyUid }) {
      const [query, setQuery] = useState('')
      const [scope, setScope] = useState('all')
      const [status, setStatus] = useState('all')
      const [selected, setSelected] = useState(() => new Set())

      const filtered = useMemo(() => {
        const q = query.trim().toLowerCase()
        let rows = inventory.servers
        if (scope !== 'all') rows = rows.filter((item) => item.sourceId === scope)
        if (status === 'enabled') rows = rows.filter((item) => item.declared)
        if (status === 'disabled') rows = rows.filter((item) => !item.declared)
        if (status === 'connected') rows = rows.filter((item) => item.reachable)
        if (q) {
          rows = rows.filter((item) =>
            item.name.toLowerCase().includes(q)
            || item.app.toLowerCase().includes(q)
            || (item.command ?? '').toLowerCase().includes(q)
            || (item.url ?? '').toLowerCase().includes(q))
        }
        return [...rows].sort((a, b) => a.name.localeCompare(b.name))
      }, [inventory.servers, query, scope, status])

      const allChecked = filtered.length > 0 && filtered.every((item) => selected.has(item.uid))

      const bulk = async (enabled) => {
        await onToggle([...selected], enabled)
        setSelected(new Set())
      }

      const header = h('thead', null, h('tr', null,
        h('th', { style: { width: 30 } },
          h('input', {
            type: 'checkbox', checked: allChecked, 'aria-label': dict.servers.selectAll,
            onChange: (event) => {
              const next = new Set(selected)
              if (event.target.checked) filtered.forEach((item) => next.add(item.uid))
              else filtered.forEach((item) => next.delete(item.uid))
              setSelected(next)
            },
          })),
        h('th', null, dict.servers.colServer),
        h('th', { style: { width: 78 } }, dict.servers.colTransport),
        h('th', { style: { width: 98 } }, dict.servers.colState),
        h('th', { style: { width: 56 } }, dict.servers.colTools),
        h('th', { style: { width: 158 } }, dict.servers.colConfig),
        h('th', { style: { width: 46 } }, '')))

      const rows = filtered.map((server) => h('tr', {
        key: server.uid,
        onClick: () => onOpen(server.uid),
        tabIndex: 0,
        onKeyDown: (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onOpen(server.uid)
          }
        },
      },
      h('td', { onClick: (event) => event.stopPropagation() },
        h('input', {
          type: 'checkbox', checked: selected.has(server.uid), 'aria-label': server.name,
          onChange: (event) => {
            const next = new Set(selected)
            if (event.target.checked) next.add(server.uid)
            else next.delete(server.uid)
            setSelected(next)
          },
        })),
      h('td', null,
        h('div', { className: 'mm-name' },
          h('code', null, server.name),
          server.patchId ? h('span', { className: 'mm-tag host' }, 'host') : null),
        h('div', {
          className: 'mm-muted',
          style: { fontSize: 10.5, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
        }, server.command ?? server.url ?? dict.common.none)),
      h('td', null, h('span', { className: 'mm-tag' }, dict.transport[server.transport] ?? server.transport)),
      h('td', null, h(StateCell, { server, dict })),
      h('td', null, server.reachable ? fmtCount(server.toolCount) : h('span', { className: 'mm-muted' }, dict.common.none)),
      h('td', null,
        h('div', { style: { fontSize: 11.5 } }, server.app),
        h('div', { className: 'mm-muted', style: { fontSize: 10.5 } }, server.sourceLabel)),
      h('td', { onClick: (event) => event.stopPropagation() },
        h(Switch, {
          checked: Boolean(server.declared),
          disabled: busyUid === server.uid,
          label: `${server.declared ? dict.servers.disable : dict.servers.enable} ${server.name}`,
          onChange: (next) => onToggle([server.uid], next),
        }))))

      const bulkBar = selected.size > 0
        ? h('div', { className: 'mm-row', style: { marginLeft: 'auto' } },
          h('span', { className: 'mm-muted', style: { fontSize: 11.5 } }, dict.servers.selected(selected.size)),
          h('button', { type: 'button', className: 'mm-btn sm', disabled: Boolean(busyUid), onClick: () => bulk(true) }, dict.servers.enable),
          h('button', { type: 'button', className: 'mm-btn sm', disabled: Boolean(busyUid), onClick: () => bulk(false) }, dict.servers.disable))
        : null

      const tableCard = filtered.length === 0
        ? h('div', { className: 'mm-empty' }, inventory.servers.length === 0 ? dict.servers.empty : dict.servers.noMatch)
        : h('table', { className: 'mm-table' }, header, h('tbody', null, rows))

      return h('div', null,
        h('div', { className: 'mm-row', style: { marginBottom: 9 } },
          h('input', {
            className: 'mm-input', style: { width: 190 }, placeholder: dict.servers.searchPlaceholder,
            value: query, 'aria-label': dict.servers.searchPlaceholder,
            onChange: (event) => setQuery(event.target.value),
          }),
          h('select', {
            className: 'mm-input', style: { width: 170 }, value: scope, 'aria-label': dict.servers.filterConfig,
            onChange: (event) => setScope(event.target.value),
          },
          h('option', { value: 'all' }, dict.common.all),
          (inventory.sources ?? []).filter((source) => source.exists).map((source) =>
            h('option', { key: source.id, value: source.id }, `${source.app} — ${source.label}`))),
          h(Seg, {
            value: status,
            onChange: setStatus,
            options: [
              { value: 'all', label: dict.common.all },
              { value: 'enabled', label: dict.state.enabled },
              { value: 'disabled', label: dict.state.disabled },
              { value: 'connected', label: dict.state.connected },
            ],
          }),
          bulkBar),
        h('div', { className: 'mm-card' }, tableCard))
    }

    function HomePage({ inventory, dict, onOpen }) {
      const connectedHost = inventory.servers.filter((item) => item.kind === 'host' && item.reachable)
      const notConnected = inventory.servers.filter((item) => item.declared && !item.reachable)
      const broken = (inventory.sources ?? []).filter((source) => source.errors.length > 0)

      const connectedRows = connectedHost.length === 0
        ? h('div', { className: 'mm-empty' }, dict.home.connectedEmpty)
        : h('table', { className: 'mm-table' },
          h('tbody', null, connectedHost.map((server) => h('tr', {
            key: server.uid, onClick: () => onOpen(server.uid),
          },
          h('td', null, h('div', { className: 'mm-name' }, h('code', null, server.name))),
          h('td', { style: { width: 92 }, className: 'mm-muted' }, dict.msg.toolCount(server.toolCount)),
          h('td', { style: { width: 84 } },
            h('span', { className: 'mm-tag' }, dict.transport[server.transport] ?? server.transport))))))

      const connectedCard = h('div', { className: 'mm-card' },
        h('div', { className: 'mm-cardhead' },
          h('h2', null, dict.home.connectedTitle),
          h('span', { className: 'sub' }, dict.home.connectedSub(connectedHost.length))),
        connectedRows)

      const notConnectedCard = notConnected.length === 0 ? null : h('div', { className: 'mm-card' },
        h('div', { className: 'mm-cardhead' },
          h('h2', null, dict.home.notConnectedTitle),
          h('span', { className: 'sub' }, dict.home.notConnectedSub)),
        h('table', { className: 'mm-table' },
          h('tbody', null, notConnected.slice(0, 5).map((server) => h('tr', {
            key: server.uid, onClick: () => onOpen(server.uid),
          },
          h('td', null,
            h('div', { className: 'mm-name' }, h('code', null, server.name)),
            h('div', { className: 'mm-muted', style: { fontSize: 10.5 } }, `${server.app} · ${server.sourceLabel}`)),
          h('td', { style: { width: 130 }, className: 'mm-muted' },
            server.kind === 'host' ? dict.home.reloadHint : dict.home.otherApp))))),
        notConnected.length > 5
          ? h('div', { className: 'mm-more' }, dict.home.moreNotConnected(notConnected.length - 5))
          : null)

      const sourceRows = (inventory.sources ?? []).map((source) => h('tr', { key: source.id },
        h('td', null,
          h('div', null, source.app),
          source.errors.length > 0
            ? h('div', { style: { color: 'var(--dsw-alias-state-error-primary)', fontSize: 10.5 } }, source.errors[0])
            : null),
        h('td', { className: 'mm-muted' },
          h('div', { className: 'mm-mono' }, source.path),
          h('div', { style: { fontSize: 10.5 } },
            source.exists ? `${source.label} · ${relative(source.mtime, dict)}` : dict.home.notPresent)),
        h('td', null, source.exists ? fmtCount(source.serverCount) : h('span', { className: 'mm-muted' }, dict.common.none))))

      const sourcesCard = h('div', { className: 'mm-card' },
        h('div', { className: 'mm-cardhead' }, h('h2', null, dict.home.sourcesTitle)),
        h('table', { className: 'mm-table' },
          h('thead', null, h('tr', null,
            h('th', null, dict.home.colApp),
            h('th', null, dict.home.colFile),
            h('th', { style: { width: 64 } }, dict.home.colServers))),
          h('tbody', null, sourceRows)))

      const brokenBox = broken.length > 0
        ? h('div', { className: 'mm-err' },
          dict.home.brokenSources(broken.length, broken.map((item) => `${item.app} (${item.errors[0]})`).join('; ')))
        : null

      return h('div', null,
        h(StatStrip, { totals: inventory.totals, dict }),
        brokenBox,
        connectedCard,
        notConnectedCard,
        sourcesCard)
    }

    function ToolsPage({ inventory, dict, onOpen }) {
      const [query, setQuery] = useState('')
      const [serverFilter, setServerFilter] = useState('all')
      const [toolIndex, setToolIndex] = useState(null)
      const connected = inventory.servers.filter((item) => item.reachable)

      useEffect(() => {
        const controller = new AbortController()
        let cancelled = false
        ;(async () => {
          // Ask every server at once; one failure must not blank the list.
          const lists = await Promise.all(connected.map(async (server) => {
            try {
              const data = await getRoute(`/server?uid=${encodeURIComponent(server.uid)}`, controller.signal)
              return (data?.tools ?? []).map((tool) => ({ ...tool, serverName: server.name, serverUid: server.uid }))
            } catch {
              return []
            }
          }))
          const rows = lists.flat().sort((a, b) => a.serverName.localeCompare(b.serverName) || a.name.localeCompare(b.name))
          if (!cancelled) setToolIndex(rows)
        })()
        return () => {
          cancelled = true
          controller.abort()
        }
      }, [inventory.generatedAt])

      const filtered = useMemo(() => {
        if (toolIndex === null) return []
        const q = query.trim().toLowerCase()
        return toolIndex.filter((tool) => {
          if (serverFilter !== 'all' && tool.serverUid !== serverFilter) return false
          if (!q) return true
          return tool.name.toLowerCase().includes(q)
            || (tool.description ?? '').toLowerCase().includes(q)
            || tool.serverName.toLowerCase().includes(q)
        })
      }, [toolIndex, query, serverFilter])

      const rows = toolIndex === null
        ? h('div', { className: 'mm-empty' }, dict.common.loading)
        : filtered.length === 0
          ? h('div', { className: 'mm-empty' }, dict.detail.noToolsMatch)
          : filtered.map((tool) => h('div', { className: 'mm-tool', key: tool.wireName },
            h('div', { className: 'top' },
              h('code', null, tool.name),
              h('span', { className: 'mm-tag' }, tool.serverName),
              h('button', {
                type: 'button', className: 'mm-btn sm ghost', style: { marginLeft: 'auto' },
                onClick: () => onOpen(tool.serverUid),
              }, dict.common.edit)),
            tool.description ? h('div', { className: 'desc' }, tool.description) : null,
            h('details', { style: { marginTop: 5 } },
              h('summary', { className: 'mm-muted', style: { fontSize: 11, cursor: 'pointer' } }, dict.detail.params),
              h(ParamList, { schema: tool.parameters, dict }))))

      const counter = toolIndex === null
        ? dict.common.loading
        : `${filtered.length} / ${toolIndex.length}`

      return h('div', null,
        h('div', { className: 'mm-row', style: { marginBottom: 9 } },
          h('input', {
            className: 'mm-input', style: { width: 250 }, placeholder: dict.detail.toolSearch,
            value: query, 'aria-label': dict.detail.toolSearch,
            onChange: (event) => setQuery(event.target.value),
          }),
          h('select', {
            className: 'mm-input', style: { width: 180 }, value: serverFilter, 'aria-label': dict.servers.colServer,
            onChange: (event) => setServerFilter(event.target.value),
          },
          h('option', { value: 'all' }, dict.common.all),
          connected.map((server) => h('option', { key: server.uid, value: server.uid }, server.name))),
          h('span', { className: 'mm-muted', style: { fontSize: 11.5 } }, counter)),
        connected.length === 0
          ? h('div', { className: 'mm-card' }, h('div', { className: 'mm-empty' }, dict.home.connectedEmpty))
          : h('div', { className: 'mm-card' }, rows))
    }

    function ConfigPage({ inventory, dict, notify, onChanged }) {
      const present = (inventory.sources ?? []).filter((source) => source.exists)
      const [activeId, setActiveId] = useState(present[0]?.id ?? '')
      const [file, setFile] = useState(null)
      const [text, setText] = useState('')
      const [validation, setValidation] = useState(null)
      const [busy, setBusy] = useState(false)
      const [error, setError] = useState(null)
      const [backups, setBackups] = useState([])
      const [view, setView] = useState('editor')

      const active = present.find((source) => source.id === activeId) ?? present[0] ?? null

      const loadFile = useCallback(async (sourceId, signal) => {
        if (!sourceId) return
        setBusy(true)
        try {
          const data = await getRoute(`/file?source=${encodeURIComponent(sourceId)}`, signal)
          if (signal?.aborted) return
          setFile(data)
          setText(data.text ?? '')
          setValidation(data.validation ?? null)
          setError(null)
        } catch (err) {
          if (!signal?.aborted) setError(String(err?.message ?? err))
        } finally {
          if (!signal?.aborted) setBusy(false)
        }
      }, [])

      useEffect(() => {
        const controller = new AbortController()
        loadFile(activeId, controller.signal)
        return () => controller.abort()
      }, [activeId, loadFile])

      useEffect(() => {
        const controller = new AbortController()
        getRoute('/backups', controller.signal).then((data) => setBackups(data.items ?? [])).catch(() => {})
        return () => controller.abort()
      }, [inventory.generatedAt])

      const dirty = file !== null && text !== (file.text ?? '')

      const validate = async () => {
        if (!active) return
        try {
          const result = await postRoute('/validate', { sourceId: active.id, text })
          setValidation(result)
          notify({
            kind: result.ok ? 'ok' : 'err',
            message: result.ok ? dict.config.valid(result.servers.length) : dict.config.invalid(result.errors.join('; ')),
          })
        } catch (err) {
          notify({ kind: 'err', message: String(err?.message ?? err) })
        }
      }

      const save = async () => {
        if (!active) return
        setBusy(true)
        try {
          const result = await postRoute('/save-file', { sourceId: active.id, text, reason: 'editor' })
          notify({
            kind: 'ok',
            message: result.backup ? dict.msg.saved : dict.msg.savedNoBackup,
            action: {
              label: dict.common.reloadNow,
              run: async () => {
                try {
                  await postRoute('/reload', { ids: [] })
                  notify({ kind: 'ok', message: dict.msg.reloaded })
                  onChanged()
                } catch (err) {
                  notify({ kind: 'err', message: String(err?.message ?? err) })
                }
              },
            },
          })
          await loadFile(active.id)
          onChanged()
        } catch (err) {
          notify({ kind: 'err', message: String(err?.message ?? err) })
        } finally {
          setBusy(false)
        }
      }

      const restore = async (name) => {
        setBusy(true)
        try {
          const result = await postRoute('/restore', { name })
          notify({ kind: 'ok', message: dict.config.restored(result.restoredTo) })
          await loadFile(active?.id)
          onChanged()
        } catch (err) {
          notify({ kind: 'err', message: String(err?.message ?? err) })
        } finally {
          setBusy(false)
        }
      }

      if (present.length === 0) {
        return h('div', { className: 'mm-card' }, h('div', { className: 'mm-empty' }, dict.config.noFile))
      }

      const pathLine = active
        ? h('div', { className: 'mm-muted', style: { fontSize: 11, marginBottom: 7 } }, h('span', { className: 'mm-mono' }, active.path))
        : null

      const statusBox = validation && !validation.ok
        ? h('div', { className: 'mm-err' }, dict.config.invalid(validation.errors.join('; ')))
        : validation
          ? h('div', { className: 'mm-ok' }, dict.config.valid(validation.servers.length))
          : null

      const editorView = h('div', null,
        pathLine,
        statusBox,
        h('textarea', {
          className: 'mm-ta', style: { minHeight: 380 }, value: text, spellCheck: false,
          'aria-label': dict.config.textLabel,
          onChange: (event) => { setText(event.target.value); setValidation(null) },
        }),
        h('div', { className: 'mm-row', style: { marginTop: 9 } },
          h('button', { type: 'button', className: 'mm-btn primary', disabled: busy || !dirty, onClick: save },
            busy ? dict.common.saving : dict.common.save),
          h('button', { type: 'button', className: 'mm-btn', disabled: busy, onClick: validate }, dict.common.validate),
          h('button', {
            type: 'button', className: 'mm-btn', disabled: busy || !dirty,
            onClick: () => { setText(file?.text ?? ''); setValidation(file?.validation ?? null) },
          }, dict.common.discard),
          h('button', {
            type: 'button', className: 'mm-btn', disabled: busy,
            onClick: () => {
              try {
                const blob = new Blob([text], { type: 'text/plain' })
                const url = URL.createObjectURL(blob)
                const anchor = document.createElement('a')
                anchor.href = url
                anchor.download = `${active?.app ?? 'mcp'}-${active?.label ?? 'config'}`.replace(/[^\w.-]+/g, '-') + (active?.format === 'json' ? '.json' : '.yml')
                anchor.click()
                URL.revokeObjectURL(url)
              } catch (err) {
                notify({ kind: 'err', message: String(err?.message ?? err) })
              }
            },
          }, dict.common.export)))

      const backupRows = backups.length === 0
        ? h('div', { className: 'mm-empty' }, dict.config.backupsEmpty)
        : h('table', { className: 'mm-table' },
          h('thead', null, h('tr', null,
            h('th', null, dict.config.backupsTitle),
            h('th', { style: { width: 96 } }, dict.config.backupWhen),
            h('th', { style: { width: 70 } }, ''))),
          h('tbody', null, backups.map((backup) => h('tr', { key: backup.name },
            h('td', { className: 'mm-mono' }, backup.name),
            h('td', { className: 'mm-muted' }, relative(backup.mtime, dict)),
            h('td', null, h('button', {
              type: 'button', className: 'mm-btn sm', disabled: busy, onClick: () => restore(backup.name),
            }, dict.config.restore))))))

      const backupsView = h('div', { className: 'mm-card' },
        h('div', { className: 'mm-cardhead' },
          h('h2', null, dict.config.backupsTitle),
          h('span', { className: 'sub' }, inventory.backupDir)),
        backupRows)

      return h('div', null,
        h('div', { className: 'mm-row', style: { marginBottom: 9 } },
          h('select', {
            className: 'mm-input', style: { width: 360, maxWidth: '100%' }, value: activeId, 'aria-label': dict.config.pickFile,
            onChange: (event) => setActiveId(event.target.value),
          }, present.map((source) => h('option', { key: source.id, value: source.id },
            `${source.app} — ${source.label}`))),
          h(Seg, {
            value: view,
            onChange: setView,
            options: [{ value: 'editor', label: dict.config.editor }, { value: 'backups', label: dict.config.backups }],
          }),
          dirty ? h('span', { className: 'mm-tag' }, dict.common.unsaved) : null),
        error ? h('div', { className: 'mm-err' }, error) : null,
        view === 'editor' ? editorView : backupsView)
    }

    function SettingsPage({ inventory, dict, lang, setLang, notify, onChanged }) {
      const [reloading, setReloading] = useState(false)
      const [backups, setBackups] = useState(null)

      const loadBackups = async () => {
        try {
          setBackups(await getRoute('/backups'))
        } catch (err) {
          notify({ kind: 'err', message: String(err?.message ?? err) })
        }
      }

      const reload = async () => {
        setReloading(true)
        try {
          const result = await postRoute('/reload', { ids: [] })
          notify({ kind: result?.restartRequired ? 'warn' : 'ok', message: result?.restartRequired ? dict.msg.reloadedRestart : dict.msg.reloaded })
          onChanged()
        } catch (err) {
          notify({ kind: 'err', message: String(err?.message ?? err) })
        } finally {
          setReloading(false)
        }
      }

      const langSeg = h(Seg, {
        value: lang,
        onChange: setLang,
        options: [{ value: 'zh', label: '中文' }, { value: 'en', label: 'English' }],
      })

      const backupNote = backups
        ? h('div', { className: 'mm-muted', style: { fontSize: 11.5, marginTop: 8 } },
          dict.settings.backupCount(backups.items.length, backups.dir))
        : null

      return h('div', null,
        h('div', { className: 'mm-card' },
          h('div', { className: 'mm-cardhead' }, h('h2', null, dict.settings.hostTitle)),
          h('div', { className: 'mm-pad' },
            h(Kv, { label: dict.settings.application, value: inventory.host?.app ?? dict.common.none }),
            h(Kv, { label: dict.settings.profile, value: inventory.host?.profile ?? dict.common.none }),
            h(Kv, { label: dict.settings.dshHome, value: inventory.host?.dshHome ?? dict.common.none }),
            h(Kv, { label: dict.settings.reloadSupport, value: dict.settings.reloadSupportValue }),
            h(Kv, { label: dict.settings.language, value: langSeg }))),
        h('div', { className: 'mm-card' },
          h('div', { className: 'mm-cardhead' },
            h('h2', null, dict.settings.actionsTitle),
            h('span', { className: 'sub' }, dict.settings.actionsSub)),
          h('div', { className: 'mm-pad' },
            h('div', { className: 'mm-row' },
              h('button', { type: 'button', className: 'mm-btn', disabled: reloading, onClick: reload },
                reloading ? dict.common.reloading : dict.common.reload),
              h('button', { type: 'button', className: 'mm-btn', onClick: loadBackups }, dict.settings.checkBackups)),
            backupNote)),
        h('div', { className: 'mm-card' },
          h('div', { className: 'mm-cardhead' }, h('h2', null, dict.settings.safetyTitle)),
          h('div', { className: 'mm-pad' },
            h('p', { className: 'mm-muted', style: { fontSize: 12, margin: '0 0 7px' } }, dict.settings.safetyBody),
            h(Kv, { label: dict.settings.backupDir, value: inventory.backupDir }),
            h(Kv, {
              label: dict.settings.backupsRetained,
              value: dict.settings.backupsRetainedValue(inventory.config?.retainBackups ?? 20),
            }),
            h(Kv, { label: dict.settings.scanCache, value: `${Math.round((inventory.config?.scanTtlMs ?? 15000) / 1000)}s` }),
            h(Kv, { label: dict.settings.secrets, value: dict.settings.secretsValue }))))
    }

    /* ------------------------------------------------------------------ */
    /* Shell                                                              */
    /* ------------------------------------------------------------------ */

    function ManagerPage() {
      const [inventory, setInventory] = useState(null)
      const [error, setError] = useState(null)
      const [busy, setBusy] = useState(false)
      const [page, setPage] = useState('home')
      const [openUid, setOpenUid] = useState(null)
      const [adding, setAdding] = useState(false)
      const [toast, setToast] = useState(null)
      const [busyUid, setBusyUid] = useState(null)
      const [lang, setLangState] = useState(initialLang)
      const toastTimer = useRef(null)

      const dict = TEXT[lang] ?? TEXT.zh

      const setLang = useCallback((next) => {
        setLangState(next)
        try {
          window.localStorage?.setItem(LANG_KEY, next)
        } catch {
          /* the choice still applies for this view */
        }
      }, [])

      const notify = useCallback((notice) => {
        setToast(notice)
        if (toastTimer.current !== null) clearTimeout(toastTimer.current)
        if (!notice?.action) toastTimer.current = setTimeout(() => setToast(null), 5000)
      }, [])

      useEffect(() => () => {
        if (toastTimer.current !== null) clearTimeout(toastTimer.current)
      }, [])

      const load = useCallback(async (refresh = false, signal) => {
        setBusy(true)
        try {
          const data = await getRoute(`/inventory${refresh ? '?refresh=1' : ''}`, signal)
          if (signal?.aborted) return
          setInventory(data)
          setError(null)
        } catch (err) {
          if (!signal?.aborted) setError(String(err?.message ?? err))
        } finally {
          if (!signal?.aborted) setBusy(false)
        }
      }, [])

      useEffect(() => {
        ensureStyle()
        const controller = new AbortController()
        load(false, controller.signal)
        return () => controller.abort()
      }, [load])

      const reload = useCallback(async () => {
        try {
          const result = await postRoute('/reload', { ids: [] })
          notify({ kind: result?.restartRequired ? 'warn' : 'ok', message: result?.restartRequired ? dict.msg.reloadedRestart : dict.msg.reloaded })
          await load(true)
        } catch (err) {
          notify({ kind: 'err', message: String(err?.message ?? err) })
        }
      }, [dict, load, notify])

      const toggle = useCallback(async (uids, enabled) => {
        // Every toggle edits a different entry; fire them together.
        setBusyUid(uids.length === 1 ? uids[0] : 'batch')
        const results = await Promise.all(uids.map(async (uid) => {
          try {
            const result = await postRoute('/mutate', { op: 'toggle', uid, enabled })
            return { uid, ok: true, reloadRequired: result?.reloadRequired }
          } catch (err) {
            return { uid, ok: false, error: String(err?.message ?? err) }
          }
        }))
        setBusyUid(null)
        const failed = results.filter((item) => !item.ok)
        const changed = results.length - failed.length
        if (failed.length > 0) {
          notify({ kind: 'err', message: dict.msg.failed(failed.length, failed[0].error) })
        } else if (changed > 0) {
          const needsReload = results.some((item) => item.reloadRequired)
          notify({
            kind: needsReload ? 'warn' : 'ok',
            message: dict.msg.savedReload(changed),
            action: needsReload ? { label: dict.common.reloadNow, run: reload } : undefined,
          })
        }
        await load(true)
      }, [dict, load, notify, reload])

      const nav = [
        ['home', dict.nav.home, null],
        ['servers', dict.nav.servers, inventory ? fmtCount(inventory.totals.servers) : null],
        ['tools', dict.nav.tools, inventory ? fmtCount(inventory.totals.tools) : null],
        ['config', dict.nav.config, null],
        ['settings', dict.nav.settings, null],
      ]

      const title = nav.find(([id]) => id === page)?.[1] ?? dict.appTitle
      const subtitle = inventory
        ? dict.home.subtitle(fmtCount(inventory.totals.servers), fmtCount(inventory.totals.connected), fmtCount(inventory.totals.tools))
        : dict.common.loading

      let content
      if (inventory === null) {
        content = error !== null
          ? h('div', { className: 'mm-err' }, dict.msg.loadFailed(error))
          : h('div', { className: 'mm-empty' }, dict.common.loading)
      } else if (page === 'home') {
        content = h(HomePage, { inventory, dict, onOpen: setOpenUid })
      } else if (page === 'servers') {
        content = h(ServerTable, { inventory, dict, onOpen: setOpenUid, onToggle: toggle, busyUid })
      } else if (page === 'tools') {
        content = h(ToolsPage, { inventory, dict, onOpen: setOpenUid })
      } else if (page === 'config') {
        content = h(ConfigPage, { inventory, dict, notify, onChanged: () => load(true) })
      } else {
        content = h(SettingsPage, { inventory, dict, lang, setLang, notify, onChanged: () => load(true) })
      }

      const toastBox = toast === null ? null : h('div', {
        className: toast.kind === 'err' ? 'mm-err' : toast.kind === 'warn' ? 'mm-warnbox' : 'mm-ok',
        style: { display: 'flex', alignItems: 'center', gap: 8 },
      },
      h('span', { style: { flex: 1 } }, toast.message),
      toast.action
        ? h('button', {
          type: 'button', className: 'mm-btn sm', onClick: () => { toast.action.run(); setToast(null) },
        }, toast.action.label)
        : null,
      h('button', {
        type: 'button', className: 'mm-btn sm ghost', 'aria-label': dict.common.dismiss,
        onClick: () => setToast(null),
      }, '✕'))

      const navItems = nav.map(([id, label, count]) => h('button', {
        key: id,
        type: 'button',
        className: 'mm-navitem',
        'aria-current': page === id ? 'page' : undefined,
        onClick: () => setPage(id),
      },
      h('span', { className: 'lbl' }, label),
      count !== null ? h('span', { className: 'mm-count' }, count) : null))

      const langPick = h('div', { className: 'mm-langs' },
        [['zh', '中文'], ['en', 'EN']].map(([code, label]) => h('button', {
          key: code,
          type: 'button',
          'aria-pressed': lang === code ? 'true' : 'false',
          onClick: () => setLang(code),
        }, label)))

      return h('section', {
        className: 'mm-root',
        'aria-label': dict.appTitle,
        lang: lang === 'zh' ? 'zh-CN' : 'en',
      },
      h('div', { className: 'mm-body' },
        h('nav', { className: 'mm-nav', 'aria-label': dict.appTitle },
          h('div', { className: 'mm-brand' },
            h(BrandMark, { size: 22 }),
            h('div', null, h('b', null, dict.appTitle), h('span', null, dict.appSubtitle))),
          navItems,
          h('div', { className: 'mm-navfoot' }, langPick)),

        h('div', { className: 'mm-main' },
          h('div', { className: 'mm-inner' },
            h('div', { className: 'mm-head' },
              h('div', null, h('h1', null, title), h('p', null, subtitle)),
              h('div', { className: 'mm-row' },
                h('button', {
                  type: 'button', className: 'mm-btn', disabled: busy, onClick: () => load(true),
                }, busy ? dict.common.refreshing : dict.common.refresh),
                h('button', {
                  type: 'button', className: 'mm-btn primary', onClick: () => setAdding(true),
                }, `+ ${dict.common.add}`))),
            toastBox,
            content))),

      openUid !== null
        ? h(ServerPanel, {
          uid: openUid, inventory, dict,
          onClose: () => setOpenUid(null),
          onChanged: () => load(true),
          notify,
        })
        : null,
      adding
        ? h(AddPanel, { inventory, dict, onClose: () => setAdding(false), onChanged: () => load(true), notify })
        : null)
    }

    /** The sidebar glyph: a hub with four attached nodes. */
    function BrandMark({ size = 20 }) {
      return h('svg', {
        width: size, height: size, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': 'true',
        style: { display: 'block', flex: '0 0 auto' },
      },
      h('path', {
        d: 'M12 4.6v4M12 15.4v4M4.9 9.4l3.5 2M15.6 12.6l3.5 2M19.1 9.4l-3.5 2M8.4 12.6l-3.5 2',
        stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', opacity: 0.85,
      }),
      h('circle', { cx: 12, cy: 12, r: 3, stroke: 'currentColor', strokeWidth: 1.5 }),
      h('circle', { cx: 12, cy: 4.6, r: 1.5, fill: 'currentColor' }),
      h('circle', { cx: 12, cy: 19.4, r: 1.5, fill: 'currentColor' }),
      h('circle', { cx: 4.7, cy: 9.4, r: 1.5, fill: 'currentColor', opacity: 0.85 }),
      h('circle', { cx: 19.3, cy: 9.4, r: 1.5, fill: 'currentColor', opacity: 0.85 }),
      h('circle', { cx: 4.7, cy: 14.6, r: 1.5, fill: 'currentColor', opacity: 0.7 }),
      h('circle', { cx: 19.3, cy: 14.6, r: 1.5, fill: 'currentColor', opacity: 0.7 }))
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        ctx.effect(() => {
          ensureStyle()
          return () => {
            const tag = document.querySelector('style[data-mcp-manager]')
            if (tag !== null) tag.remove()
          }
        })
        ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main',
          key: PANEL_ID,
        }, ManagerPage))
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: PANEL_ID,
          order: 21,
          label: 'MCP Manager',
        }, BrandMark))
      },
    }
  },
})
