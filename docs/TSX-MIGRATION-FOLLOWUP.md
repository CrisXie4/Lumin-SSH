# TSX 迁移后续工作清单（Follow-up）

> 迁移主工程（阶段 0-6）已完成：`frontend/src` 0 个 .js/.jsx、allowJs 关闭、`tsc --noEmit` 零错误、build/i18n:check 全绿。
> 本文档列出**审查（2026-08-11）后遗留的长程事项**，按优先级排序，供后续接手人执行。
> 前置阅读：`docs/TSX-MIGRATION-HANDOFF.md`、`docs/TSX-MIGRATION.md`。

---

## 0. 当前健康度（审计基线，2026-08-11 会话后更新）

| 指标 | 数值 |
|---|---|
| src 文件 | 170 个（78 .tsx + 89 .ts + 3 .d.ts），0 个 .js/.jsx |
| `@ts-nocheck` | **0 个指令**（22 个桥接已全部类型化；此前"3 个组件遗留"为注释文本误判，已澄清） |
| 显式 any | **全部清零**（`BridgeData = any`、`Record<string, any>` ×6、`: any` ×3、`type X = any` 别名 —— 含 2026-08-11 补扫的 FileManager `BridgeData = any`（88 处，上轮统计漏了 `= any` 形式），仅 wailsjs 生成代码保留宽泛类型） |
| 逃生通道 | `as I18nKey` ×35（17 文件，均为运行时动态值且已注释）、`@ts-ignore` ×0 |

---

## 1. 运行时冒烟测试（最高优先，需 wails 环境）🔴

静态审查无法覆盖的部分，需在真实 wails 桌面环境验证：

- [ ] 服务器连接/保存/移动分组/重命名 —— 验证 toast 修复后的文案（应无 "Error: " 前缀）
- [ ] 终端：连接、分屏、cwd 标签高亮（`isCwdSystemPinnedTab` 修复激活了此前从未渲染的 UI）、搜索、命令历史
- [ ] 文件管理：上传/下载、FileEditor 打开、系统固定 Tab
- [ ] AI 面板：provider 快照轮询（`defaultTokenStoreTitle` 修复点）、对话、mention/斜杠菜单
- [ ] 设置：搜索、各 Tab 切换
- [ ] 主题切换、窗口状态、workspace 持久化恢复
- [ ] 28 语言切换（语言表加了 satisfies 后需确认动态加载无回归）

**验证方法**：`cd frontend && npm run dev`（纯浏览器可测 UI 部分）；完整桌面验证需 `wails dev`。

---

## 2. 去 `@ts-nocheck`：桥接文件类型化（✅ 22/22 全部完成）

**已完成（2026-08-11 会话）**：22 个桥接文件全部类型化，每个都有黑盒语义验证：

| 提交 | 覆盖 |
|---|---|
| `b68df2d` | aiProviderBridge（50 用例） |
| `a0f95ab` | settingDefinitions（5 常量深度相等 + 8 Tab 断言清零） |
| `adb53f5` | aiMentions（115 用例） |
| `67280ba` | aiChatBridge + aiChatMessageTopology（62 用例） |
| `fa01731` | 批 1：providerSpecialHosts/inputDragSelect/proxyNodesBridge/aiConversationBackupBridge/probeFormatting/aiExecutionContext/aiProviderPasteHandlers/runtimeEnvironmentBridge（142 用例 ×3 稳定） |
| `e9f0fb3` | 批 2：aiImageCompression/aiSlashCommands/messagesProvider/aiGlobalSettingsBridge（76 用例） |
| `07f906d` | 批 3：compatibleProvider/responsesProvider/providers/index/aiConversationBridge（103 用例 ×2 稳定） |
| `3e58ce0` | mcpClientBridge 补漏（8 用例） |

**验证工具**：`frontend/scripts/verify-bridge-semantics.mjs`（c27e275）——bundle 工作区 vs HEAD 版本，黑盒对比导出函数输出，内置 i18n/wails 桥 mock + 时间戳/随机 id 归一化。用法：`node scripts/verify-bridge-semantics.mjs <桥接路径>...`

**遗留（组件级，需独立评估）**：3 个组件文件仍有 `@ts-nocheck`（迁移阶段大组件转 TSX 时收编，非桥接）：
- `components/ai/AIComposer.tsx`（2000+ 行，mention/斜杠菜单状态机）
- `components/ai/AIProviderSelector.tsx`（1500+ 行，供应商选择）
- `components/settings/NetworkTab.tsx`（代理节点表单）

这三个的 `@ts-nocheck` 头移除需要组件级类型化（props/state/事件全量），建议独立会话按"先 NetworkTab（最小）→ AIProviderSelector → AIComposer"顺序推进，同样用黑盒验证兜底。

---

## 3. `as I18nKey` 逃生审计 ✅（已完成 2026-08-11）

阶段 3 声称 4 处、阶段 6 后实际 52 处（21 文件）。审计结论：**52 → 35 处（17 文件）**。

- **治本 17 处**：设置树/提供方定义字段类型化（`settingDefinitions.ts` 的 `titleKey/descriptionKey/breadcrumbTitleKeys` 等改 `I18nKey | ''`、`SettingsModal` 的 `TAB_LABELS`/`ProviderDefinition`、AI 组件 label 映射表 `Record<string, I18nKey>`）——静态定义键从此编译期校验存在性，拼错即报错
- **保留 35 处**：均为运行时动态值（AI/后端返回文案、主题包名、用户消息、动态拼接键），t() 对未知 key 原样兜底，逃生是设计意图；已逐处补注释说明
- **额外发现与修复**：9 个设置描述键（探测方式/代理节点/同步服务等）从未进入任何语言表（非中文语言一直显示中文原文）——28 语言表补齐（非中文表暂用原文占位，行为不变，待翻译）；`check-i18n.mjs` 的 babel parse 从未适配 TS 语言表格式（缺 typescript 插件 + satisfies 包装未展开），27 个非 zh-CN 表全部解析失败——"28 语言全绿"实为从未成立，已修复（28 × 1826 键真全绿，exit 0）
- 复查结果：`useUpdateChecker.ts`、`terminalCommandAutocompleteProviders.ts` 的动态 key 均为后端返回文案，保留合理

---

## 4. `any` 收敛 ✅（已完成 2026-08-11）

- `AIPanel.tsx` `type BridgeData = any`（55 处使用）→ **已消除**：按语义拆为局部接口（`AIEventPayloadShape`/`AIMetricsPayload`/`AIPanelSettings`/`AIAPIHistoryMessageLike`），复用已类型化形状（`AIConversationSnapshot`/`AIProviderLike`/`AIProviderState`/`AIGlobalSettings`/`AIConversationMessageSearchResult`/`AIMessage`），事件回调改 `unknown` + 守卫断言
- `SettingsModal.tsx` `Record<string, any>` ×6 → **已消除**：`Record<string, unknown>` + 使用处守卫/断言
- 结果：全项目（除 wailsjs 生成代码）显式 `any` **归零**（tsc strict 验证）
- 已核实的"风险位"（2026-08-11 复查，均虚惊）：`NetworkTab.tsx:321` `${String(node?.host)}:${String(node?.port)}` —— `normalizeProxyNode` 保证 host 字符串兜底（空串）、port 有效数字（默认 1080），不会出现 `"undefined"`；`AIPanel.tsx:259` `String(value).padStart(2,'0')` —— 调用处均传数字（`date.getMonth()+1` 等），永不 undefined

---

## 5. 收尾与合并 🟢

- [ ] 全部 22 桥接类型化后：删除 `TSX-MIGRATION-FOLLOWUP.md` 的对应条目
- [ ] `npm run dev` 冒烟通过后，将 `refactor/tsx-migration` 合并回 `main`（PR 或 ff，见 HANDOFF 3.6 提交规范）
- [ ] 合并前更新 HANDOFF/进度文档中的统计数字

---

## 6. 长期观察项（不需要立即处理）

- **主 bundle 4.4MB**：28 个语言表（51k 行）被 `i18n.ts` 的 eager glob 静态打入主包 —— 预存设计权衡，如需优化可改 dynamic import（非本次迁移引入）
- **`getEffectiveTerminals` 契约收紧**（App.tsx:325-327）：`term.id || ''` 兜底 —— 当前所有会话构造点都产生字符串 id，等价；若未来出现 falsy 非字符串 id 需注意
- **`draft?.` → `draft.`**（AIProviderQuickEditOverlay.tsx:193）：draft 永不为 null（useState 初始化），当前安全；若未来允许 null 需还原 `?.`
- **`i18n:check` 的 `englishCandidates=3` 告警**：base 时代即存在（文件打开相关 3 键），与迁移无关

---

## 7. 本次审计已修复项（存档）

| 事项 | 修复 |
|---|---|
| toast "Error: " 前缀漂移（5 处：App.tsx:1412、useServerCatalog.ts:94/167/212/140） | `err instanceof Error ? err : String(err)` 模式 |
| 阶段 6 遗漏：113 处 `.jsx` 后缀 import（静态 112 + 动态 1）| 补扫为 `.tsx`，消除对 Vite 隐式扩展名替换的依赖 |
| 语言表键一致性仅靠外部脚本 | 27 个语言表（除基准 zh-CN）加 `satisfies I18nDict`，编译期强制（负向测试验证 TS2353 生效）|
| 文档过期（逃生计数 4→52、统计、any 措辞、11 处代码注释）| 已更正 |
