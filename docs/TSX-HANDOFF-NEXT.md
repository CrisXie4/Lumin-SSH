# TSX 迁移 — 交接文档（给下一位接手人）

> **交接时间**：2026-08-11 ｜ **分支**：`refactor/tsx-migration`（基于 main，60+ commit）
> **前置阅读**：`docs/TSX-MIGRATION.md`（阶段进度）、`docs/TSX-MIGRATION-HANDOFF.md`（早期交接，部分已过期）、`docs/TSX-MIGRATION-FOLLOWUP.md`（后续工作清单）
> **项目**：Lumin-SSH（Wails 3 桌面 SSH 客户端，React 18 + Vite 5 前端，`frontend/src`）

---

## 1. 当前状态（交接时验证全绿 ✅）

```bash
cd frontend
npx tsc --noEmit      # ✅ 0 错误（strict）
npm run build         # ✅ 通过（~11s，仅 chunk 大小告警）
npm run i18n:check    # ✅ 28 语言 × 1817 键，missing=0
```

- `frontend/src`：170 文件（78 .tsx + 89 .ts + 3 .d.ts），**0 个 .js/.jsx**
- **0 个 `@ts-nocheck` 指令**（22 个桥接全部类型化）
- `allowJs` 关闭、vite 迁移插件已移除、import 后缀全扫（含补扫的 113 处 .jsx）

---

## 2. 已完成工作（两轮）

### 轮 1：迁移后审计修复（4 commit）
| Commit | 内容 |
|---|---|
| `07829de` | toast "Error: " 前缀修复（5 处：App.tsx + useServerCatalog.ts） |
| `aefe6de` | 27 个语言表 `satisfies I18nDict` 编译期键校验（基准 zh-CN 豁免防循环引用；负向测试验证 TS2353 生效） |
| `d1b7be7` | 补扫 113 处 `.jsx` 后缀 import → `.tsx`（阶段 6 漏扫）+ 18 处过期注释 |
| `3358025` | 文档更正（逃生计数 4→52、统计、any 措辞）+ 新增 FOLLOWUP |

### 轮 2：22 个桥接全部去 `@ts-nocheck`（8 commit）
| Commit | 覆盖 | 黑盒用例 |
|---|---|---|
| `b68df2d` | aiProviderBridge | 50 |
| `a0f95ab` | settingDefinitions（+ 8 Tab 断言清零、SettingsModal） | 5 常量深度相等 |
| `adb53f5` | aiMentions | 115 |
| `67280ba` | aiChatBridge + aiChatMessageTopology（any[] 清零） | 62 |
| `fa01731` | 批 1：8 个小桥接 + wails.d.ts 全局声明 | 142 ×3 稳定 |
| `c27e275` | **验证工具** `scripts/verify-bridge-semantics.mjs` | — |
| `e9f0fb3` | 批 2：4 个桥接 | 76 |
| `07f906d` | 批 3：4 个桥接（含 aiConversationBridge） | 103 ×2 稳定 |
| `3e58ce0` | mcpClientBridge（补漏） | 8 |

**累计 556 个黑盒用例**，每个桥接语义等价性都有硬验证。

---

## 3. 剩余工作（按优先级）

> **更新（2026-08-11 收尾会话）**：🟡2 逃生审计与 🟡3 any 收敛均已完成（详见 FOLLOWUP 第 3/4 节）；NetworkTab 注释与 HANDOFF 文档已更正。

### 🔴 1. 运行时冒烟测试（需 wails 桌面环境，唯一剩余的功能验证）

**2026-08-11 收尾会话已做的验证**：
- ✅ Go 后端编译 + wails bindings 生成 + 前端编译全部通过（`wails dev` 跑通到 "Development mode exited"，日志无错误）
- ⚠️ 本会话环境无 GUI 会话，桌面窗口无法常驻 → 窗口内交互验证需在本机桌面执行 `wails dev`
- 📝 **发现**：纯浏览器 `npm run dev` 会崩溃（`useUpdateChecker.ts:103` 无条件调用 wails `EventsOn`，无 wails 环境时抛 TypeError → React 错误边界显示"界面渲染出错"）——交接文档此前"npm run dev 可测纯 UI"的建议不准确；纯 UI 调试应使用 `wails dev` 的浏览器模式（http://localhost:34115），或后续给 useUpdateChecker 加 `window.go` 存在性守卫（非迁移回归，可选项）

**需在本机桌面验证的清单**：
- [ ] 服务器连接/保存/移动分组/重命名（验证 toast 修复：不应有 "Error: " 前缀）
- [ ] 终端：连接、分屏、cwd 标签高亮（`isCwdSystemPinnedTab` 修复激活了此前从未渲染的 UI）、搜索、命令历史
- [ ] 文件管理：上传/下载、FileEditor、系统固定 Tab
- [ ] AI 面板：provider 快照轮询（`defaultTokenStoreTitle` 修复点）、对话、mention/斜杠菜单、MCP、设置面板（备份恢复、协作模式、自动批准）
- [ ] 设置：搜索、各 Tab（含代理节点表单）、运行环境、同步（WebDAV/R2/FTP/SFTP）
- [ ] 28 语言切换（重点：本次新增的 9 个设置描述键在非中文语言下的显示，当前为中文占位待翻译）

### ✅ 2. `as I18nKey` 逃生审计（已完成）
52 → 35 处：17 处静态定义字段治本（编译期校验），35 处动态值保留并注释。附带修复：9 个从未入表的设置键补齐 28 语言表 + check-i18n.mjs 对 TS 格式的解析修复（此前"28 语言全绿"从未成立）。

### ✅ 3. `any` 收敛（已完成）
AIPanel `BridgeData = any`（55 处）、SettingsModal `Record<string, any>` ×6 全部消除；全项目（除 wailsjs）显式 any 归零。

### 🟢 4. 收尾
- [x] `NetworkTab.tsx:21` 注释清理（本会话完成）
- [x] `docs/TSX-MIGRATION-HANDOFF.md` 过期内容更正（本会话完成）
- [ ] 运行时冒烟测试通过后合并回 main（PR 或 ff）

### 👀 5. 长期观察项
- 主 bundle 4.4MB（28 语言表 eager 打入主包，预存权衡）
- `App.tsx:325` `getEffectiveTerminals` 契约收紧（`term.id || ''`）
- `AIProviderQuickEditOverlay.tsx:193` `draft.` 直取（当前 null 不可能）
- `i18n:check` 的 `englishCandidates=3` 告警（base 时代即有）
- 9 个新补语言键在 27 个非中文表为中文占位，待翻译（搜索设置 Tab 的描述文案）
- ~~`NetworkTab.tsx:326` / `AIPanel.tsx:229` 的 `String(undefined)` → `"undefined"` 风险位~~ 已核实虚惊（normalizeProxyNode 保证 host/port 非空；pad 调用处全传数字）

---

## 4. 验证工具（可复用，新增桥接/组件改动时跑）

```bash
cd frontend
node scripts/verify-bridge-semantics.mjs <相对路径> [更多路径...]
# 例：node scripts/verify-bridge-semantics.mjs src/components/ai/aiMentions.ts
```

**原理**：esbuild 把工作区版本与 `git show HEAD:` 版本分别 bundle 成 CJS（mock i18n + wails 桥），对导出函数喂相同输入、断言输出 `deepStrictEqual`。内置：
- 时间戳归一化（>1e12 数字 → 'TS'）
- 随机 id 处理（用例设计时避开或手动归一化）
- 统一 window mock（`installWindowMock`，按桥补方法即可扩用例）

**新增测试用例的位置**：`scripts/verify-bridge-semantics.mjs` 里按 `idx === '<文件名>'` 分支添加。

---

## 5. 本轮确立的关键模式（接手人必读）

1. **`type` 别名 vs `interface`**：桥接导出的"形状类型"用 `type` 而非 `interface`——type 可隐式匹配消费方的索引签名（`AIProviderLike`、`GlobalAISettingsLike` 等带 `[key: string]: unknown` 的接口），interface 不行（TS 会报 "Index signature missing"）。已应用：`AIProvider`、`AIConversationBackup`、`ModelCapability`、`AIGlobalSettings`、`AIConversationSnapshot` 等。
2. **桥接宽松边界风格**：入参 `unknown` + `typeof` 守卫；`(x ?? {}) as Record<string, unknown>` 断言后访问；回调注入（listDir/readFile 等）保持宽松签名。
3. **wailsjs 返回类型**：`bridge.XXX()` 返回 wails 生成的 models 类（无索引签名）→ 需 `as unknown as Record<string, unknown>` 才能断言访问。
4. **黑盒语义验证优先于逐行比对**：重写桥接后先跑 verify 工具；发现等价别名（`const p = x as T`、`?? {}` 替代 `?.`）不用纠结——黑盒输出一致即证明等价。真正要防的是**行为改变**（如把 `payload.storage` 误写成 `apiKeyField.storage`——曾靠逐行复查抓出）。
5. **ES2020 lib 限制**：不能用 `replaceAll`（ES2021），用 `replace(/x/g, ...)`。
6. **组件适配涟漪**：桥接类型化后，消费方的 `useState` 推断会收窄（如 `useState(DEFAULT.environmentType)` 从 any 变 `'uv'`）→ 需显式 `useState<string>`；本地接口字段过窄（如 `role: 'user'|'assistant'`）→ 放宽为 `string`。

## 6. 环境与坑（Git Bash / Windows）

- **heredoc 折叠**：`cat > file <<'EOF'` 会把 `\\` 折叠成 `\`——写含反斜杠的脚本用 Write 工具或 `String.fromCharCode(92)` 构造
- **CRLF/autocrlf**：`core.autocrlf=true`，工作区 CRLF；sed 会把文件变 LF（git 自动规范化，无 diff 噪音，warning 无害）
- **esbuild**：`transformSync` 无插件支持（用 `build`）；入口文件需在项目内（相对 import 解析）
- **require 缓存**：黑盒测试输出文件用唯一名（`b1n-<模块名>.tmp.cjs`），否则缓存旧模块
- **`@ts-nocheck` 文本残留**：grep 时会匹配注释里的字样，判断真指令用 `^// @ts-nocheck`

---

## 7. 提交规范

- 格式：`refactor(tsx): ...` / `fix(tsx): ...` / `docs(tsx): ...` / `tools(tsx): ...`
- 每批独立 commit，黑盒验证通过后再提交
- 提交前：`npx tsc --noEmit` + `npm run build` + `npm run i18n:check`

接手人加油！💪 剩余主要是运行时冒烟 + 逃生审计 + BridgeData 收敛，类型体系已全部就位。
