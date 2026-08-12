# JSX → TSX 全面迁移计划

> 目标：将 `frontend/src` 全部 JS/JSX 迁移为 TS/TSX，补全类型。
> 核心原则：**任何时刻项目都可运行、可构建**。每阶段结束必须 `npm run build` 验证通过。
> 分支：`refactor/tsx-migration`（基于 main，不直接提交到 main）

---

## 安全红线（每阶段必须遵守）

1. **每阶段结束**：`npm run build` 通过 + 关键功能手动冒烟（dev 模式起应用）。
2. **每次提交**：只包含该阶段的改动，提交信息注明阶段号（`refactor(tsx): 阶段X ...`）。
3. **禁止**：在未转换完前删除任何 JS 文件 / 移除 `allowJs` / 打开 `checkJs` 全量检查。
4. **迁移顺序**：纯逻辑 → hooks → i18n → 小组件 → 巨兽组件 → 收尾。
5. 类型先「合理」后「严格」：不追求一步到位 100% 精确类型，优先保证可编译可运行。
6. 任何 `any` 的使用需注释说明原因（`// eslint-ignore` 风格或注释），收尾阶段统一清理。

---

## 现状统计（迁移前基线）

| 指标 | 数值 |
|---|---|
| JSX 文件 | 78 |
| JS 文件 | 88 |
| 总代码量 | 118,024 行 |
| 现有 TS/TSX | 0 |
| tsconfig / eslint | 无 |

### 巨型文件（单独攻坚）
- `components/FileManager.jsx` — 8,038 行
- `components/AIPanel.jsx` — 5,905 行
- `components/Terminal.jsx` — 4,382 行
- `components/SettingsModal.jsx` — 2,554 行
- `components/ai/AIProviderSelector.jsx` — 2,178 行
- `components/ai/AIProviderQuickEditOverlay.jsx` — 2,079 行
- `components/ai/AIComposer.jsx` — 1,972 行

### 既有类型资产（Wails 自动生成，直接复用）
- `frontend/wailsjs/go/wailsapp/App.d.ts` — 全部 Go 方法签名
- `frontend/wailsjs/go/wailsapp/AIBindings.d.ts` / `AIProviderBindings.d.ts`
- `frontend/wailsjs/go/models.ts` — Go 结构体模型（7 个 namespace）
- `frontend/wailsjs/runtime/runtime.d.ts` — 事件/窗口 API

---

## 阶段进度

| 阶段 | 内容 | 状态 |
|---|---|---|
| 0 | TS 骨架：tsconfig、vite TS、全局声明、i18n 类型模板 | ✅ 完成 |
| 1 | 纯逻辑转 TS：`utils/`(17) + `constants/`(2) + `config.js` | ✅ 完成 |
| 2 | hooks 转 TS：`hooks/`(17) | ✅ 完成 |
| 3 | i18n 类型化：28 个语言文件对齐 `zh-CN` 键 | ✅ 完成 |
| 4 | 小组件 JSX→TSX（批量） | ✅ 完成（66/76 + main.tsx） |
| 5 | 巨兽组件：FileManager / AIPanel / Terminal / SettingsModal / AI 系列 | ✅ 完成（12/12） |
| 6 | 收尾：移除 allowJs、严格模式全量通过、回归验证 | ✅ 完成 |

---

## 阶段 2：hooks 转 TS（17 个，全部完成 ✅）

- [x] `useToasts.ts` — Toast 管理（ToastItem/ToastAction）
- [x] `useWindowState.ts` — 窗口尺寸记忆（SavedWindowSize）
- [x] `usePanelLayout.ts` — 面板布局（ProbePanelPosition）
- [x] `usePortForwardDialog.ts` — 端口转发对话框（PortForwardInitialMapping）
- [x] `useServerPing.ts` — 服务器 ping（ServerPingResult/PingCounts）
- [x] `useDashboardPreferences.ts` — 仪表盘偏好（ServerListViewMode/DashboardHostPageMode）
- [x] `useWorkspaceSettings.ts` — 工作区设置（WorkspacePersistenceLevel）
- [x] `useSessionWorkspaceModel.ts` — 会话工作区模型
- [x] `useImportExport.ts` — 导入导出（ExportOptions）
- [x] `useServerCatalog.ts` — 服务器目录（ServerFormData）
- [x] `useUpdateChecker.ts` — 更新检查（UpdateCheckResult/compareVersions）
- [x] `useWorkspacePersistence.ts` — 工作区持久化（WorkspaceSessionSnapshot/SnapshotOverrides）
- [x] `useWorkspacePanelDocking.ts` — 面板停靠拖拽（DockRect/FileManagerDockPosition）
- [x] `useAIReview.ts` — AI 变更审查（AIChangeReview/ConversationDiffPanel）
- [x] `useTerminalSubTabs.ts` — 终端子标签滚动/停靠（TerminalDockDragPreview）
- [x] `useTerminalDocking.ts` — 终端分屏停靠
- [x] `useSessionConnections.ts` — 会话连接中枢（1408 行，ConnectingServer/SessionAuthPrompt/SshChannelUsage）

### 全局类型资产（阶段 2 新增）
- `src/types/luminDialog.d.ts` — window.luminDialog 全局 API
- `wails.d.ts` 补充 window.runtime 声明
- `recoveryPasswordSync.ts` 的 sync 参数改为可选（initialError 场景）

---

## 阶段 3：i18n 类型化（完成 ✅）

- [x] `i18n.js` → `i18n.ts`（git mv 保留历史），语言文件保持 `.js` 不动（28 个 × 1810 键）
- [x] `t()` key 参数类型化：`I18nKey`（`keyof typeof zh-CN/basic.js`，字面量 key 拼写错误直接 tsc 报错）
- [x] `setLanguage`/`loadLanguage`/`initializeI18n`/`getLanguage` 类型化：`LanguageCode`（28 语言代码联合类型，`src/i18n/types.ts` 新增）
- [x] `getAvailableLanguages` 返回 `{ code: LanguageCode; label: string }[]`
- [x] 动态 key 逃生：`t(raw as I18nKey)` 共 4 处（useUpdateChecker ×2、terminalCommandAutocompleteProviders ×2），`t()` 内部对未知 key 原样兜底
- [x] `useTranslation` 返回 `{ t: typeof t; lang: LanguageCode }`
- [x] 验证：`tsc --noEmit` 零错误 + `npm run i18n:check` 通过（28 语言 1810 键一致）+ `npm run build` 通过

---

## 阶段 0：TS 骨架（详细清单）

- [x] 安装 devDeps：`typescript@^5.9`、`@types/react@^18.3`、`@types/react-dom@^18.3`、`@types/node`
- [x] 创建 `frontend/tsconfig.json`（allowJs: true, checkJs: false, jsx: react-jsx, noEmit, strict）
- [x] 创建 `frontend/tsconfig.node.json`（vite.config.ts 用，独立配置不引用）
- [x] `vite.config.js` → `vite.config.ts`（git mv 保留历史）
- [x] 创建 `src/types/wails.d.ts`：全局 `window.go` 声明（引用 wailsjs d.ts）
- [x] 创建 `src/i18n/types.ts`：以 `zh-CN/basic.js` 推导的翻译键类型模板
- [x] 验证：`npx tsc --noEmit` 无错误 + `npm run build` 通过

> 备注：tsconfig include 仅 `src`，不包含 `wailsjs`（生成的 `.js` 带 `// @ts-check` 会覆盖 checkJs:false；src 内 import 均带 `.js` 后缀，TS 自动映射到同名 `.d.ts`）。

---

## 阶段 1：纯逻辑转 TS（详细清单）

### utils/（17 个，全部完成 ✅）
- [x] `platform.ts` — 平台检测（getModKey/formatShortcut）
- [x] `contextMenu.ts` — 全局右键菜单事件（GlobalContextMenuDetail 类型化）
- [x] `menuPosition.ts` — 菜单位置夹取
- [x] `quickCommandParams.ts` — 快捷命令参数占位符
- [x] `fileTypeClassify.ts` — 文件类型分类
- [x] `recoveryPasswordSync.ts` — 恢复密码同步（泛型 syncWithRecoveryPassword）
- [x] `dragOutClickGuard.ts` — 拖拽失焦抑制
- [x] `terminalCommandAutocompleteParser.ts` — shell 分词器（CommandInputContext 基础类型）
- [x] `terminalCommandAutocompleteRegistry.ts` — 内置命令树（CommandNode/AutocompletePlan）
- [x] `terminalCommandAutocompleteProviders.ts` — 补全候选构建（AutocompleteItem/AutocompleteSources）
- [x] `terminalCommandAutocomplete.ts` — 自动补全入口（对外聚合导出）
- [x] `terminalPaneLayout.ts` — 分屏布局（TerminalPaneCellId 等）
- [x] `sessionWorkspace.ts` — 会话工作区工具
- [x] `terminalKeywordHighlight.ts` — 终端关键字高亮
- [x] `fileWorkbench.ts` — 文件管理器全局 store（事件订阅）
- [x] `theme.ts` — 主题系统（ThemePackage/终端主题，1075 行）
- [x] `programFonts.ts` — 程序字体加载

### constants/（2 个，完成 ✅）
- [x] `terminalEncodings.ts` — 编码分组（TerminalEncodingGroup/Option）
- [x] `zIndex.ts` — `Z` 常量 `as const` + ZIndexKey 类型

### config.js（完成 ✅）
- [x] `config.ts` + `src/vite-env.d.ts`（`__APP_BUILD_TIME__` 全局声明）

### 关键决策
- vite.config.ts 增加自定义 resolve 插件 `lumin-js-to-ts-extension-alias`：
  存量 `import './foo.js'` 自动回退解析 `foo.ts`/`foo.tsx`（vite 5 无 extensionAlias），
  ~~收尾阶段移除~~（**阶段 6 已移除，见下**）。`tsconfig.json` include 仅 `src`（wailsjs 生成的 .js 带 `// @ts-check`）。

---

## 阶段 4：小组件 JSX→TSX（完成 ✅ 66/76 + main.tsx）

**已转（66 个，均含 tsc + build 验证）**：
- 基础组件（18）：Tiptop、Toast、SyncFailureToast、ErrorBoundary、UpdateModal、ConnectingCard、SessionAuthCard、SearchableGroupedSelect、GlobalContextMenu、SerialConfigModal、CredentialsModal、CommandHistory、ImportExportDialog、ExportSelectedDialog、MCPServersView、AppTopbar、AppOverlays、GlobalDialog
- 面板/页面（8）：PortForwardDialog、AddServerModal、NetworkPage、ProcessPage、FileUploadQueuePanel、Dashboard、ServerList、main.tsx（入口）
- 设置（11）：SharedComponents、ShortcutsTab、RuntimeEnvironmentTab、GeneralTab、NetworkTab、ColorPicker、KeywordRulesPanel、SyncTab、AppTab、FileManagerTab、AppearanceTab
- AI 面板（29）：IconActionButton、AIPanelHeader、AIProviderListRow、AIChangeReviewWorkbench、MCPAccessView、AISlashCommandsSettings、AIChatMarkdown、AIChatErrorBlock、AIChatToolSessionPane、AIChatMessageActionBar、AIChatMessageActions、AIChatCompletionCard、AIChatContextCondenseCard、AIChatReasoningBlock、AIChatRequestStatusRow、AIChatMCPCard、AIChatCommandCard、AIChatUserMessage、AIChatAssistantTurn、AIChatAssistantBodyPane、AIChatFollowUpCard、AIChatToolCard、AIChatConversation、AIConversationBackupSettings、AIConversationDiffOverlay、AICollaborationPromptDropdown、AIAutoApproveDropdown、AIPanelSettingsOverlay、AIDiffViewerPair

**已确立的转换模式**（含本阶段新增）：
1. `git mv X.jsx X.tsx`（保留历史；`.jsx` import 在 tsc 下自动映射到 `.tsx`，vite 侧由回退插件兜底）
2. 定义 `interface XProps` 并导出（供父级引用）
3. 被 `.jsx` 子组件推断类型卡住时（`never[]`/`string|undefined`），连同子组件一起转
4. `settingDefinitions.js` 等未转 .js 数据源：调用处按实际结构断言（`settings as {...}`）
5. 动态 t() key 用 `as I18nKey` 逃生（附注释）；注入式 t 参数保持宽松 `(key: string)` 签名；helper 内 t 参数用严格 `(key: I18nKey)` 签名（与 useTranslation 返回一致，宽松签名反而不兼容）
6. 复用已转资产：SessionAuthPrompt/ConnectingServer（useSessionConnections）、KeywordRule（terminalKeywordHighlight）、config.Credential（wailsjs models）、GlobalContextMenuDetail（contextMenu）、TopbarSession（AppTopbar）、TabContextMenuState/TerminalTabContextMenuState（AppOverlays）
7. 未导出子组件类型：用 `Parameters<typeof X>[0]` 取 props 类型做断言（如 AIPanelSettingsOverlay 传参 MCPAccessView/MCPServersView）
8. `onSelectChange` 等多态回调：用宽联合类型 `(payload: string | string[] | Array<{id, selected}>) => void`
9. 转换时发现并修复潜在 i18n bug：PortForwardDialog 用不存在的键「本机目标地址」（改复用现有键「本地目标地址」）；FileManagerTab 短键「增大后可能提高同一会话内的 SFTP/SSH 通道占用」缺失（as I18nKey 逃生，留待收尾补 28 语言键）

**剩余（12 个 .jsx）**：App.jsx（1709 行，已开始转换后回退，状态声明区/帮助函数已类型化约 120 行，见 git stash 不可用——下次直接重做前 350 行）、ProbePanel、FileEditor、SessionWorkspace、QuickCommands、AIComposer、AIProviderSelector、AIProviderQuickEditOverlay、SettingsModal、Terminal、AIPanel、FileManager

**App.jsx 转换要点**（下次接手直接照做）：
- 前 350 行（imports + 状态声明 + 帮助函数）的类型化方案已完成并验证可编译（本次回退仅因会话余量不足，非技术障碍）
- 关键：`useToasts` 的 addToast 带 `ToastAction[]` 参数，传给 hooks/组件时需 cast 为 `actions?: unknown[]`；严格 t 传给组件/hooks 时 cast 为 `(key: string, vars?) => string`
- `useServerPing({ serversRef })` 需要 `serversRef as unknown as MutableRefObject<PingServerLike[] | null>`
- `SessionLike` 的索引签名使 `s.id`/`s.terminals` 为 optional，比较/长度判断需 `|| ''` / `(x?.length || 0)` 包装
- index.html 入口已改 `/src/main.tsx`

---

## 阶段 5：巨兽组件（完成 ✅ 12/12）

**已转（12 个，均含 tsc + build 验证，12 个独立提交）**：
- `App.tsx`（1709 行，前置契约）— 17 处边界桥接：looseAddToast/looseT（`actions?: unknown[]` / `(key: string, vars?)`）、setContentTabLoose、serversRef 经 unknown 桥接 PingServerLike、enqueueChangeReview/setSyncFailed/setTabContextMenu 等 Dispatch 协变桥接、`sessionTerminals={... as never[]}`（AIPanel 未转时的临时断言）
- `ProbePanel.tsx`（1137 行）— 导出 ProbeSnapshot/ProbeInfo/ProbePanelProps；App 的 probeSnapshots 状态随之类型化
- `FileEditor.tsx`（1178 行）— CodeMirror 语言映射用 `Extension`（StreamLanguage.define 返回 Language 而非 LanguageSupport）；导出 FileEditorFile/FileEditorProps
- `QuickCommands.tsx`（1811 行）— 导出 QuickCommandsHandle/QuickCommandItem/QuickCommandsProps；App 复用导出的句柄类型（删除本地结构接口）
- `AIComposer.tsx`（1972 行）— mention/斜杠菜单状态类型化；`window.__luminFileManagerPaths` 全局声明（theme.ts 同款 declare global 模式）；发现缺失 i18n 键「AI 输入框」→ `as I18nKey` 逃生
- `AIProviderSelector.tsx`（2178 行）— 导出 `AIProviderLike`（宽松接口 + 索引签名）；修复未定义的 `defaultTokenStoreTitle`（原 .jsx 潜在 ReferenceError）；`.js` 默认值推断 selectedType: null 需桥接
- `AIProviderQuickEditOverlay.tsx`（2079 行）— ProviderDraft/ModelCapabilityLike 类型化；providers JSDoc 未声明 getPromptCacheStrategyOptions 按结构断言；移除 AIProviderSelector 的 never[] 断言
- `SessionWorkspace.tsx`（1310 行，承上启下）— 7 组分 props 契约化（dashboard/session/fileManager/terminalTabs/ai/quickCommands/shared）；函数类型参数必须**精确匹配 App 侧**（contravariance，宽松 unknown 反而报错）
- `SettingsModal.tsx`（2554 行）— ProviderDefinition<F> 泛型契约化（`{ [K in ProviderKey]: ProviderDefinition<ProviderFormMap[K]]> }` mapped type + makeTestHandler/makeSaveHandler/makeSecureTestHandler 泛型化）；summaryFields 参数加宽到 `F | Record<string, string | number>` 兼容 SyncTab 宽松形状（内部 `form as XxxForm` 收窄）；providerState 四份同构 state 映射类型注解；ftp/sftp summaryFields 端口 String(f.port)（SyncTab 的 SummaryField.value 是 string）；发现缺失 i18n 键「搜索结果」
- `Terminal.tsx`（4382 行）— refs 全量类型化（XTerm/FitAddon/SearchAddon/HTML 元素/`ReturnType<typeof setTimeout>` timer refs）；tsRingRef/cbBlocksRef 用 `null!` 惰性初始化惯用法；`lineToTextAndCols` 用 `IBufferLine | undefined`（xterm 导出）；右键菜单 union 因字面量拓宽（`type: 'action'` → string）无法收窄 → 显式 `TerminalContextMenuItem` 判别联合 + `as TerminalContextMenuItem[]`；CustomEvent 监听器改 `(e: Event)` + 内部 `as CustomEvent<X>` 收窄（EventListener 严格逆变，方法式接口不豁免）；`useRef` 窄化分支内赋值改用局部变量；移除 SessionWorkspace 两处 `as never[]`（TerminalProps.connectedSessions 放宽为 `Array<{ id?: string }>`）；发现缺失 i18n 键「终端输出搜索」「搜索命令历史」
- `AIPanel.tsx`（5905 行）— 全量类型化（props 契约即 App 调用处，见下）；发现并修复 3 个潜在 bug：AIPanelHeader 的 `.jsx` 残留传参 `conversationTitle/showRenameConversationButton/onRenameConversation`（组件已不使用，直接删除）；TS 5.9 `typeof any === 'object'` 会把参数收窄为 `object` 导致属性链回调查参 TS7006（局部变量接住或 `as BridgeData` 桥接）；`new Map()` 推断 `Map<unknown, unknown>` 导致 sort/flatMap 回调查参 TS7006（显式 `Map<string, BridgeData>()` 或标注回调查参）
- `FileManager.tsx`（8038 行，最后的巨兽）— 复用 fileWorkbench.ts 现成类型资产（FileManagerTab/FileManagerTabLike/FileManagerPaneState/FileManagerWorkspaceState/FileManagerPathItem）；`FileManagerProps` 契约即 App 的 renderSessionFileManagers 调用处（sessionId/sessionGroupId 需 `String(x ?? '')` 桥接 + looseAddToast）；发现并修复潜在 bug：`isCwdSystemPinnedTab` 用 `getFileManagerSystemTabType(tab) === 'cwd'` 恒 false（该函数把 cwd 场景返回 ''），改直接检查 `tab.systemPinnedType === 'cwd'`；发现缺失 i18n 键「当前目录路径」「清空输入」

**已确立的新转换模式**（阶段 5 新增）：
1. 函数类型参数方向：接收方 props 的参数类型必须 ≥ 调用方参数类型（contravariance）——宽松 `(x: unknown) => void` 接收 `(x: Specific) => void` 会报错，需精确匹配调用方
2. `.js` 未转数据源（aiProviderBridge/providers）的**默认值推断**会把参数收窄（如 `selectedType = null` → `null`），调用处按实际语义桥接
3. `.jsx` 子组件 `connectedSessions = []` 默认 → 推断 `never[]`，调用处 `as never[]` + 注释，待子组件转 TSX 后移除（Terminal/AIPanel 两处）
4. 严格 t() 动态 key：`t(raw as I18nKey)` 逃生（provider 标签键、reasoningEffort 标签、缺失键）
5. `declare global { interface Window }` 局部全局声明（__luminFileManagerPaths 等）
6. git mv 后 Write 需先 Read 新路径（工具要求）

**剩余（0 个 .jsx）**：阶段 5 全部完成，可进入阶段 6（收尾）。

**FileManager 转换记录**（已随提交落地，要点保留备查）：
- props 契约（App 的 renderSessionFileManagers 调用处）：`sessionId: string`、`sessionGroupId: string`、`addToast`（宽松）、`isActive?: boolean`、`initialPath?: string`；App 侧 `sessionId={String(t.id ?? '')}` / `sessionGroupId={String(s.id ?? '')}` 桥接 + `addToast={looseAddToast}`
- 类型资产：`FileManagerFileItem`（ListDir 返回项 + 本地占位统一形状）、`FileManagerVirtualRow`、`FileManagerPaneEffectState/ViewState`、`DownloadConflictSettings`、`ChmodPerms`、`IdentityOption`、`RowEffectState`、`PanePlaceholderEntry`、`LoadDirOptions`、`SyncTabOverrides`、`ContextMenuState`（含 tab 菜单扩展字段）；`declare global` 补 `window.__luminClipboards/__luminEditorStates`
- 内嵌子组件 props 契约化：ChmodDialog / RenameInput / ContextMenu（ContextMenu 30+ 回调）；`suppressDragOutClick` 是原生 MouseEvent 签名，RenameInput 里包 `onMouseDown={(event) => suppressDragOutClick(event.nativeEvent)}`
- 大文件高效路径：先脚本批量替换纯函数签名（60 个）+ 组件主体 hooks 签名（76 个），再按 tsc 错误清单迭代（1015 → 0，约 20 轮）；`useState<BridgeData>(null)` 的 setter 函数式更新回调查参仍报 TS7006（any 别名不豁免），需显式标注 `(current: BridgeData)`
- 潜在 bug 修复：`isCwdSystemPinnedTab` 恒 false 比较（改直接检查 systemPinnedType）

**AIPanel 转换记录**（已随提交落地，要点保留备查）：
- props 契约（App.tsx 调用处）：`width: string`、`side: 'left' | 'right'`、`sessionId: string`、`terminalId: string`、`sessionTerminals?: Array<{ id: string; label?: string }>`、`addToast`（宽松，同 SettingsModalProps）、`onDevilModeChange?: (enabled: boolean) => void`
- `sessionTerminals` 契约即 App 的 `getEffectiveTerminals(s)` 返回形状；App 调用处断言已移除（改回直接传）；`sessionId={String(s.id ?? '')}` 桥接（SessionLike 索引签名 unknown）；`addToast` 改传 `looseAddToast`（App 的 ToastAction[] 参数与宽松 unknown[] 逆变不兼容）
- 类型资产：`BridgeData = any` 别名（外部数据桥接，带注释）、`AIPanelProps`/`PanelState`/`AIMessage`/`APIHistoryMessage`/`ConversationSummary`/`AIQueuedSubmission`/`TokenLedger` 等接口；`createEmptyPanelState(): PanelState` 返回类型标注后，`setPanelState(panelKey, updater: ((current: PanelState) => PanelState) | Partial<PanelState>)` 让事件流中大量 `(current) => ...` 回调查参自动类型化
- 关键坑（TS 5.9）：`typeof any === 'object'` 收窄为 `object` → 后续 `obj.prop.filter(cb)` 回调查参报 TS7006；`Array.isArray(obj?.prop)` 后再写 `obj.prop` 同理 → **局部变量先接住**（`const raw = obj?.prop`）或 `as BridgeData` 桥接；`new Map()` 推断 `Map<unknown, unknown>` → sort/flatMap 回调报 TS7006 → 显式 `Map<string, X>()`
- 转换后 App.tsx 的 `as never[]` 断言清零；被 AIPanel 引用的子组件均为已转 TSX（props 契约已在各子组件导出），AIPanelHeader 的 3 个残留 props（conversationTitle/showRenameConversationButton/onRenameConversation）组件已不使用，直接删除

**FileManager.jsx 转换提示**：被 App 的 renderSessionFileManagers 严格调用（sessionId/sessionGroupId/addToast/isActive/initialPath）；其内部还用 FileEditor（已转，FileEditorFile 可直接复用）、FileUploadQueuePanel（已转）。

**已发现缺失 i18n 键**：~~`AI 输入框`（AIComposer）、`搜索结果`（SettingsModal）、`终端输出搜索` + `搜索命令历史`（Terminal）、`当前目录路径` + `清空输入`（FileManager）~~ —— **阶段 6 已全部补齐**（含 FileManagerTab 的 `增大后可能提高同一会话内的 SFTP/SSH 通道占用`，共 7 键 × 28 语言，见下）。

---

## 阶段 6：收尾（完成 ✅）

**目标达成：`frontend/src` 0 个 .js/.jsx，allowJs 关闭，严格模式全量通过。**
（注：文件层面 100% TS，但 22 个 `@ts-nocheck` 桥接 + 28 个语言表合计约 44% 的行数无类型标注，详见「遗留事项」与 `TSX-MIGRATION-FOLLOWUP.md`。）

- [x] **i18n 缺失键补齐（7 键 × 28 语言，1810 → 1817）**：`AI 输入框` / `搜索结果` / `终端输出搜索` / `搜索命令历史` / `当前目录路径` / `清空输入` / `增大后可能提高同一会话内的 SFTP/SSH 通道占用`；逐语种译文（zh-Hant/HK/MO/TW 共用繁体文案）；`i18n:check` missing/extra/duplicate/placeholders 全 0；对应 7 处 `as I18nKey` 逃生与「缺失键」注释一并移除
- [x] **28 个语言表 `basic.js` → `basic.ts`**（git mv 100% 保留历史，内容零改动即过严格检查）：`i18n.ts` 的 `import.meta.glob` 与路径正则、`i18n/types.ts` 类型模板 import、`scripts/check-i18n.mjs` 同步为 `.ts`
- [x] **22 个桥接模块 `.js` → `.ts`**（git mv + `@ts-nocheck` 头注释收编，见「遗留事项」）：AI 系列 bridge / providers / aiMentions / aiSlashCommands / probeFormatting / settingDefinitions 等；内部 import 后缀同步
- [x] **全量 import 后缀清扫（205 处 `.js` → `.ts`/`.tsx`）**：目标已转换者统一改写；wailsjs 生成模块（App.js/runtime.js，.d.ts 同置）与 `luminDialog.d.ts` 的 type-only import 保持 `.js` 后缀（前者是真实 .js 文件，后者不参与运行时解析且显式 `.ts` 无法回退 .d.ts）
- [x] **补扫 `.jsx` 后缀 import（113 处，阶段 6 遗漏，迁移后审计发现）**：静态 112 处 `from '...jsx'` + 动态 1 处 `import('./FileEditor.jsx')` → `.tsx`（此前靠 Vite 隐式扩展名替换解析，属未文档化隐式依赖）
- [x] **移除 vite 迁移期插件 `lumin-js-to-ts-extension-alias`**（vite.config.ts 还原为纯 react 插件）
- [x] **关闭 `allowJs`**（tsconfig 移除 allowJs/checkJs；strict 保持开启）
- [x] **验证**：`tsc --noEmit` 零错误 + `npm run build` 通过 + `npm run i18n:check` 全绿 + `npm run dev` 冒烟（页面 200，main.tsx/App.tsx/桥接 .ts/语言表 .ts 均正常解析，无解析告警）

**本次确立的模式**：
1. `.js` → `.ts` 后 `= []` 默认值推断从 `any`（JS 模式）变为 `never[]`（TS 模式），调用方报 TS2345 —— 需显式标注 `: any[] = []`（3 处：groupConversationMessages / getConversationBranchAnchor / resolveAIChatFollowup）
2. `.js` 模式允许少传参（参数隐式 any），`.ts` 模式参数必填 —— 实际可选参数需补 `?`（processRemoteFileMentions 的 readFile）
3. `@ts-nocheck` 只抑制文件内错误，**推断出的签名仍作用于调用方**，签名级差异需在桥接侧修复
4. type-only import 指向 .d.ts 的 `.js` 后缀必须保留（显式 `.ts` 后缀不会回退 .d.ts）

**遗留事项**：22 个桥接模块以 `@ts-nocheck` 收编，运行语义与 .js 时代完全一致，但尚未严格类型化 —— 后续可按 `aiProviderBridge`（normalizeProvider 返回形状）→ `settingDefinitions` → `aiMentions` 的顺序逐个去注释补类型。

> SettingsModal/Terminal/AIPanel 的转换要点已随各自提交落地（c80f66b / f651462 / 本次提交），历史要点不再赘述。

---

## 验证命令速查

```bash
cd frontend
npx tsc --noEmit          # 类型检查（增量阶段应无错误）
npm run build             # 生产构建（每阶段必跑）
npm run dev               # 开发模式冒烟（手动验证 UI）
npm run i18n:check        # i18n 键完整性检查
```

---

## 风险与对策记录

| 风险 | 对策 |
|---|---|
| 巨兽文件 8k 行迁移出错 | 拆分为多次小提交，每部分独立验证；保持 allowJs 混合运行 |
| `window.go` 在 dev 模式（纯浏览器 vite）下不存在 | 已有可选链/守卫用法（`window.go?.`），迁移时保留，类型用 optional 声明 |
| i18n 28 语言键不一致 | 以 zh-CN 为基准类型；其他 27 语言表已加 `satisfies I18nDict` 编译期强制（键拼错 tsc 报 TS2353/TS2322）+ `i18n:check` 脚本双保险 |
| `use-stick-to-bottom` 等无类型依赖 | 在 `src/types/` 下补充 module 声明 |
| 事件/消息系统无类型 | 从 Go 侧结构体（models.ts）推导，集中定义消息类型 |
