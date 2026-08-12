# JSX → TSX 迁移工程 — 交接文档

> 本文档供**下一位接手人**使用：包含已完成工作、关键决策、剩余计划与执行规范。
> 配合 `docs/TSX-MIGRATION.md`（进度清单）一起阅读。

---

## 1. 工程概览

**项目**：Lumin-SSH（Wails 3 桌面 SSH 客户端，React 18 + Vite 5 前端）

**任务**：将 `frontend/src` 全部 JS/JSX 迁移为 TS/TSX，补全类型。

**当前分支**：`refactor/tsx-migration`（基于 `main` 创建，**不要直接提交到 main**）

**迁移基线**（开始时）：
- 78 个 JSX + 88 个 JS，共 118,024 行，0 个 TS 文件

---

## 2. 已完成工作（阶段 0-2 ✅）

### 提交历史（6 个 commit，全部可构建）

| Commit | 内容 |
|---|---|
| `a528f54` | 阶段 0：TS 骨架 |
| `9cd8248` | 阶段 1：纯逻辑 20 文件转 TS |
| `27c4618` / `c6d3844` | 阶段 2：hooks 转 TS（12/17 → 16/17） |
| `b6a2533` | 阶段 2 完成：全部 17 个 hooks |
| `b6b81ea` | 阶段 3：i18n 类型化（i18n.js→i18n.ts，I18nKey/LanguageCode 接入） |

### 已转文件清单

**阶段 0 — 骨架**
- `frontend/tsconfig.json`（strict + allowJs + checkJs:false + noEmit）
- `frontend/tsconfig.node.json`（vite.config.ts 专用，独立配置不引用）
- `frontend/vite.config.js` → `vite.config.ts`（git mv 保留历史）
- `frontend/src/vite-env.d.ts`（`__APP_BUILD_TIME__` 全局声明）
- `frontend/src/types/wails.d.ts`（`window.go` 全局类型，复用 wailsjs 生成的 d.ts）
- `frontend/src/types/luminDialog.d.ts`（`window.luminDialog` 全局 API）
- `frontend/src/i18n/types.ts`（翻译键类型模板，阶段 3 接入）
- devDeps 新增：`typescript@^5.9`、`@types/react@^18.3`、`@types/react-dom@^18.3`、`@types/node`

**阶段 1 — 纯逻辑（20 个）**
- `utils/` 17 个全部：platform、contextMenu、menuPosition、quickCommandParams、fileTypeClassify、recoveryPasswordSync、dragOutClickGuard、terminalCommandAutocompleteParser（CommandInputContext 基础类型）、terminalCommandAutocompleteRegistry（命令树/计划）、terminalCommandAutocompleteProviders（补全候选）、terminalCommandAutocomplete（对外入口）、terminalPaneLayout、sessionWorkspace（SessionLike）、terminalKeywordHighlight、fileWorkbench（全局 store）、theme（1075 行）、programFonts
- `constants/` 2 个：terminalEncodings、zIndex（as const + ZIndexKey）
- `config.js` → `config.ts`

**阶段 2 — hooks（17 个全部）**
- useToasts、useWindowState、usePanelLayout、usePortForwardDialog、useServerPing、useDashboardPreferences、useWorkspaceSettings、useSessionWorkspaceModel、useImportExport、useServerCatalog、useUpdateChecker、useWorkspacePersistence（WorkspaceSessionSnapshot/SnapshotOverrides）、useWorkspacePanelDocking（DockRect）、useAIReview（AIChangeReview/ConversationDiffPanel）、useTerminalSubTabs、useTerminalDocking、useSessionConnections（1408 行，ConnectingServer/SessionAuthPrompt/SshChannelUsage）

**阶段 3 — i18n 类型化（1 个）**
- `src/i18n.js` → `src/i18n.ts`（git mv 保留历史）：`t()` key 参数改为 `I18nKey`，`setLanguage`/`loadLanguage` 等改用 `LanguageCode`
- `src/i18n/types.ts` 新增 `LanguageCode`（28 语言代码联合类型，新增语言目录时需同步）

**当前统计**（阶段 0-6 + 迁移后审计 + 两轮收尾全部完成）：170 个文件 = 78 个 .tsx（组件）/ 92 个 .ts（89 .ts + 3 .d.ts），`frontend/src` 0 个 .js/.jsx。22 个桥接已全部去 `@ts-nocheck` 类型化（556 个黑盒用例验证语义等价），28 个语言表均以 `satisfies I18nDict` 编译期校验键集合，全项目（除 wailsjs 生成代码）0 处显式 `any`。详细口径见 `docs/TSX-MIGRATION-FOLLOWUP.md` 与 `docs/TSX-HANDOFF-NEXT.md`。

> 阶段 4 ✅ 完成（66/76 + main.tsx）；阶段 5 进行中：8/12 个巨兽已转（App/ProbePanel/FileEditor/QuickCommands/AIComposer/AIProviderSelector/AIProviderQuickEditOverlay/SessionWorkspace），剩余 SettingsModal/Terminal/AIPanel/FileManager，详细清单与转换模式见 `docs/TSX-MIGRATION.md` 阶段 5 章节

---

## 3. 关键决策与约定（接手人必读 ⚠️）

### 3.1 渐进式迁移策略（核心安全机制）
- `tsconfig.json`：**`allowJs: true` + `checkJs: false`** — JS 文件不被检查，应用混合状态下可运行
- `strict: true` 从一开始就开启 — 只影响新转的 TS 文件，保证新代码严格
- **转一个文件 → 跑一次 `npx tsc --noEmit` → 阶段结束跑 `npm run build`**

### 3.2 vite 扩展名回退插件（迁移期专用）
`vite.config.ts` 中的 `lumin-js-to-ts-extension-alias` 插件：
- 作用：存量 `import './foo.js'` 自动回退解析 `foo.ts`/`foo.tsx`
- 原因：vite 5 **没有** `resolve.extensionAlias`（vite 4 的功能已移除），不加此插件改名后构建直接失败
- **阶段 6 已移除**（全部转完后存量 import 已无 .js/.jsx；后续审计又补扫了 113 处 `.jsx` 后缀 import）

### 3.3 tsconfig include 只含 `src`
- **不包含 `wailsjs` 目录**：wailsjs 生成的 .js 首行带 `// @ts-check`，会覆盖 checkJs:false 强制检查导致几百个报错
- src 内对 wailsjs 的 import 均带 `.js` 后缀，TS 自动映射同名 `.d.ts`，类型正常
- wailsjs 的类型（App.d.ts、AIBindings.d.ts、models.ts 等）**不要手改**，是 wails 自动生成的

### 3.4 全局对象类型策略
| 全局对象 | 声明位置 | 说明 |
|---|---|---|
| `window.go` | `src/types/wails.d.ts` | 声明为**必选**（兼容直接调用）；纯浏览器 dev 由代码可选链守卫 |
| `window.luminDialog` | `src/types/luminDialog.d.ts` | GlobalDialog.jsx 挂载的对话框 API |
| `window.runtime` | `wails.d.ts` 内 | 部分场景挂在 window 上 |
| `__APP_BUILD_TIME__` | `src/vite-env.d.ts` | vite define 注入 |

### 3.5 类型风格约定
- `SessionLike`（`utils/sessionWorkspace.ts`）— 会话对象的宽松类型，带 `[key: string]: unknown` 索引签名。**注意**：索引签名导致 `session.serverId` 等未声明字段是 `unknown`，赋值给 string 字段需 `String(...)` 包装
- JSON.parse 结果：用显式接口断言（如 `RestoredSnapshotSession`），避免 any
- `t()` 翻译函数签名：`(key: string, vars?: Record<string, unknown>) => string`；`src/i18n.ts` 的 t 已收紧为 `(key: I18nKey, ...)`（字面量 key 拼错直接报错），动态 key 用 `t(raw as I18nKey)` 逃生；被注入的 t 参数（如 useAIReview 的 options.t）仍保持宽松 string 签名
- `addToast` 签名：`(message: string | Error, type?: string, duration?: number, actions?: unknown[]) => number`
- 任何 `any` 使用需注释说明（2026-08-11 收尾后：显式 `: any`、`Record<string, any>`、`type X = any` 别名**全部清零**，仅 wailsjs 生成代码保留宽泛类型；0 处 `as any`/`@ts-ignore`；`as unknown` 31 处均带注释）

### 3.6 git 约定
- 提交信息格式：`refactor(tsx): 阶段X ...`
- 每阶段至少 1 个 commit，阶段中途可 checkpoint 提交
- `git mv` 重命名保留历史（已用）

---

## 4. 剩余工作（阶段 3-6）

### 阶段 3：i18n 类型化（28 个语言文件）✅ 已完成

**完成内容**：
- `i18n.js` → `i18n.ts`（git mv），`t()` 的 key 参数改为 `I18nKey`（1810 个中文键字面量联合，拼写错误直接被 tsc 捕获）
- 新增 `LanguageCode` 联合类型（28 语言代码），`setLanguage`/`loadLanguage`/`initializeI18n`/`getLanguage`/`useTranslation` 全部类型化
- 语言文件本身保持 .js 不动（28 个 × 1800+ 行），用 `npm run i18n:check` 验证键一致性（全部通过）
- 动态 key 逃生：`t(raw as I18nKey)` 共 **35 处（17 个文件）**（2026-08-11 审计后：52 → 35，17 处静态定义字段治本为 I18nKey 类型；剩余 35 处均为运行时动态值——AI/后端返回、主题包名等，t() 内部对未知 key 有原样兜底，逃生为设计意图且已逐处注释）。审计过程还发现 9 个从未入表的设置键并补齐 28 语言表、修复 check-i18n.mjs 对 TS 语言表格式的解析（此前 27 个非 zh-CN 表全部解析失败）。详见 `docs/TSX-MIGRATION-FOLLOWUP.md`
- 验证：`tsc --noEmit` 零错误 + `npm run i18n:check` 通过 + `npm run build` 通过

### 阶段 4：小组件 JSX→TSX（批量）✅ 已完成（66/76 + main.tsx）

### 阶段 5：巨兽组件 🔄 进行中（8/12 已转，剩 SettingsModal/Terminal/AIPanel/FileManager）

> 转换要点、新模式与剩余 4 个文件的交接细节见 `docs/TSX-MIGRATION.md` 阶段 5 章节（SettingsModal 已完整读完，要点已记录）

**已转 42 个**（含 Tiptop/Toast/GlobalContextMenu/SessionAuthCard/CommandHistory/MCPServersView 及全部 AI 对话卡片、settings 共享组件与 4 个 Tab），清单见进度文档。

**剩余**：AppTopbar、AppOverlays、GlobalDialog、AddServerModal、Dashboard、ServerList、SessionWorkspace、NetworkPage、PortForwardDialog、SyncTab/AppTab/FileManagerTab/AppearanceTab、ProcessPage、FileUploadQueuePanel、AIDiffViewerPair、AI 系列（FollowUpCard/ToolCard/Conversation/AutoApprove/PanelSettingsOverlay/CollaborationPromptDropdown/ConversationBackupSettings/ConversationDiffOverlay）+ 巨兽（FileManager/AIPanel/Terminal/SettingsModal/QuickCommands/ProbePanel/FileEditor/AIProviderSelector/AIProviderQuickEditOverlay/AIComposer）

**转换模板**：
```tsx
interface MyComponentProps {
  sessionId: string;
  onClose: () => void;
  // ...
}
export default function MyComponent({ sessionId, onClose }: MyComponentProps) {
  // ...
}
```

### 阶段 5：巨兽组件攻坚（单独进行，每个单独 commit）

| 文件 | 行数 | 策略 |
|---|---|---|
| `FileManager.jsx` | 8,038 | 可先拆 `git mv` 后分多次小提交，每部分 tsc 验证 |
| `AIPanel.jsx` | 5,905 | 同上 |
| `Terminal.jsx` | 4,382 | 同上 |
| `SettingsModal.jsx` | 2,554 | 同上 |
| `ai/AIProviderSelector.jsx` 等 | 2,000+ | 同上 |

**策略**：不追求一次转完——TSX 转换是机械的（改名+补类型），但大文件一次写完容易遗漏。建议：每次改完跑 `tsc --noEmit`，让类型错误当"检查清单"。

### 阶段 6：收尾

1. 移除 `vite.config.ts` 中的 `lumin-js-to-ts-extension-alias` 插件
2. `tsconfig.json`：`allowJs: false` + `checkJs: true`
3. 全量 `tsc --noEmit` 严格模式通过（此时应无 JS 文件）
4. 全量回归：`npm run build` + dev 模式冒烟（连接、文件管理、终端、AI 面板、主题切换、设置）
5. 把分支合并回 main（用 PR 或 ff）

---

## 5. 验证与安全红线（每阶段必须）

```bash
cd frontend
npx tsc --noEmit          # 类型检查（增量阶段应零错误）
npm run build             # 生产构建（每阶段必跑）
npm run dev               # dev 冒烟（可选，改动大时）
npm run i18n:check        # i18n 键完整性（阶段 3 用）
```

1. **每阶段结束必须 `npm run build` 通过**
2. 转换顺序：纯逻辑 → hooks → i18n → 小组件 → 巨兽（已完成前两步）
3. 禁止在全部转完前：删 JS 文件、移除 allowJs、开 checkJs 全量检查
4. 类型先合理后严格：不追求一步到位，优先保证可编译可运行
5. 遇到 wailsjs 生成的代码报错：检查是否 include 了 wailsjs 目录（应排除）

---

## 6. 常见坑速查

| 坑 | 解决 |
|---|---|
| tsc 报 `wailsjs/go/wailsapp/*.js` 错误 | include 里混入了 wailsjs（应只有 `src`） |
| 改名后构建报 `Could not resolve './foo.js'` | vite 插件 `lumin-js-to-ts-extension-alias` 被移除或未生效 |
| `session.serverId` 报类型错误 | SessionLike 索引签名，用 `String(session.serverId)` |
| `filter(Boolean)` 后仍报 possibly undefined | 加 type guard：`.filter((x): x is T => !!x)` |
| React 事件 `event.currentTarget` 报错 | 参数类型用 `React.MouseEvent<HTMLElement>` |
| `setX((prev) => ...)` 回调参数 implicit any | 检查 setter 类型是否为 `Dispatch<SetStateAction<T>>` |
| `unknown || ''` 类型是 `{}` | 用 `String(x || '')` |
| JSON.parse 结果访问属性报错 | 定义接口断言（如 `as RestoredSnapshotSession`） |
| npm install 后 `@types/react` 装成 19.x | 项目是 React 18，必须 `@types/react@^18.3` |
| 安装 typescript 装成 7.x（原生版） | 用 `typescript@^5.9`（稳定版） |
| 块注释里写 `src/i18n/*/basic.js` | `*/` 会提前终止块注释导致语法错误，改用 `src/i18n/<lang>/basic.js` |
| useEffect 清理函数 `return () => set.delete(x)` | `Set.delete` 返回 boolean，与 React Destructor 类型不符，改花括号块体 |

---

## 7. 环境信息

- Windows + Git Bash，工作目录 `D:\AllCode\golang\Lumin-SSH`
- 三个 remote：`origin`（github bamboostrip）、`upstream`（github wmwlwmwl）、`gitea-lumin`
- main 分支与 upstream 同步（v1.2.7）
- 之前的会话遗留：wails3 分支有一个 stash（`wails3 package-lock 本地修改`）—— 与本分支无关，可忽略

---

## 8. 建议的下一步

1. **先跑一遍验证**：`cd frontend && npx tsc --noEmit && npm run build` 确认接手时环境健康
2. 读一遍 `docs/TSX-MIGRATION.md`（进度清单）确认状态一致
3. 继续**阶段 5：巨兽组件**（按 `docs/TSX-MIGRATION.md` 阶段 5 章节：先 SettingsModal——转换要点已记录，再 Terminal/AIPanel/FileManager，每个单独提交）
4. 之后按阶段 5 → 6 顺序推进，每阶段一个 commit

接手人加油！💪 剩余组件虽多（98 个），但基础类型体系已经全部就位（纯逻辑 + hooks + i18n），剩下的主要是机械转换 + 逐个补 props 类型。
