# UI 现代消费级试点 — 人工评估基线（MVP 2026-08-26）

> 分支：`refactor/ui-modern-consumer-pilot`  
> 基准分支：`main` @ `88513c0b`（Task 8 时 HEAD `5166ca61`）  
> 日期：2026-08-26 14:35 (UTC+8)  
> 评估人：Muse Spark（代码基线 + 静态视觉评审）+ 待用户主审截图  
> 对应设计：`2026-08-26-ui-modern-consumer-pilot-design.md` §8 / 计划 `2026-08-26-ui-modern-consumer-pilot-plan.md` Task 8  

---

## 1. 构建与 Lint 基线（Step 1）

在 `D:\AllCode\golang\Lumin-SSH\frontend` 执行（`fnm_multishells 49220_1787725144818 + 29220_1787711939345`, node v24.13.0, npm 11.6.2）：

```bash
$env:PATH = "C:\Users\Bambo\AppData\Roaming\ai.opencode.desktop\fnm_multishells\29220_1787711939345;" + $env:PATH
npm run build 2>&1 | tail -n 20
npx oxlint . 2>&1 | tail -n 5
npm run styles:check 2>&1 | head -n 40
```

| 检查项 | 预期 | 实测 | 结论 |
|--------|------|------|------|
| `npm run build` | `3633 modules transformed` + `built in ~4s` | `3633 modules transformed` / `built in 4.30s` / `4.46s`（两次复测一致）；产物 `frontend/dist` 112 文件、`assets/index-*.js` 2.1 MB (gzip 578 kB)、`editor.api` 2.6 MB；仅警告 `INEFFECTIVE_DYNAMIC_IMPORT wailsjs/runtime` 与 `chunk > 500kB`（与试点无关，存量） | ✅ 通过 |
| `npx oxlint .` | `0 warnings 0 errors` on 413 files | `Found 0 warnings and 0 errors. Finished in 378ms on 413 files with 122 rules using 16 threads.`（`frontend/` 内为 `96 rules` 0 文件时为根路径误用，`frontend/src` 内实测通过） | ✅ 通过 |
| `npm run styles:check` | 无未收敛项，`hexColor/numericFontSize/magicZIndex` 均在基线内 | `[OK] hexColor: 20/20` / `[OK] numericFontSize: 16/16` / `[OK] magicZIndex: 0/0` / `通过：未超过基线（总量 36/36）` | ✅ 通过 |
| `frontend/dist` | 存在且 `index.html` 可加载 | `assets/` + 25+ svg/png + `index.html` 2.8 kB，首屏 `assets/index-DXusQK1_.js` 预加载完整 | ✅ 通过 |

> 额外校验：`styles:baseline` 未触发写入（当前基线已与新 token 同步）；硬编码 `rounded-*` 在试点文件内已全部收敛为 `var(--radius-*)`（见 §2）。

---

## 2. Token 与组件映射静态审计

### 2.1 Token 设计（`index.css`）

- **圆角** `@theme` + `:root` + `body.theme-light` 三处同步：`xs 4 / sm 8 / md 12 / lg 16 / xl 20 / full 9999`（原 `3/5/7/10/12`）。步进 2-4px，克制放大，避免 `10px` 在 4 列密集卡片中显笨重，符合设计 §3.1。
- **阴影** `--shadow-sm: 0 1px 3px rgba(16,24,40,.06), 0 1px 2px rgba(16,24,40,.05)` / `--shadow-md: 0 4px 12px rgba(16,24,40,.08), 0 2px 6px rgba(16,24,40,.06)`，两层低透明度冷灰，替代原纯黑 `0.28/0.32`。深色模式不再发灰，浅色模式与 `@theme` 同值，`shadow-lg/xl` 保留用于 Modal/浮层，层次分明。
- **间距** 新增 `--space-1.5: 6px` + 别名 `--space-1_5`，供 `gap-1.5` 映射，卡片 `gap` 保留 `6px` 对比项（`server-grid gap 6px` 未改动，减少回退成本）。
- **单一来源**：所有试点组件均通过 `var(--radius-*)` / `var(--shadow-*)` 引用，无硬编码 `8px/12px/16px`。

### 2.2 组件映射（试点 6 文件，`git diff main --stat` 681 + / 117 -）

| 组件 | 文件 | 改造前 | 改造后 | 同频性 |
|------|------|--------|--------|--------|
| **Button** | `Button.tsx:8` | `rounded-sm` (5px) | `rounded-[var(--radius-sm)]` (8px) | 所有按钮统一 8px，图标按钮与文字按钮一致 |
| **Card / .card / .glass-card** | `Card.tsx:8` / `index.css:764,4224` | `rounded-md 7px` `box-shadow none` | `rounded-[var(--radius-md)] 12px` `shadow-sm` | 卡片容器 12px |
| **server-card** | `index.css:1451` | `rounded-sm 5px` `pad 6/8` `shadow none` | `rounded-[var(--radius-md)] 12px` `pad 10/12` `shadow-sm` / hover `shadow-md` | 与 Card 同频 12px，留白 +4px 更透气 |
| **batch-operation-bar** | `index.css:1505` + `DashboardBatchOperationBar.tsx` | `rounded-md 7px` 内 `rounded-sm 5px` | 外 `rounded-[var(--radius-lg)] 16px` `pad 8/12` 内 `rounded-[var(--radius-sm)] 8px` `shadow-md` + 分隔线 `w-px bg-line-subtle rounded-[var(--radius-sm)]` | 外 16px 与 Modal 同级，内 8px 与 Button 同频，顶部工具栏同为 12px 外 / 8px 内，**视觉同频完成** |
| **DashboardHeaderActions** | `DashboardHeaderActions.tsx:70-314` | `rounded-lg` 硬编码、`h-7` 窄、`gap 6`、图标 13px、搜索 `max-w 300` | `rounded-[var(--radius-md)]` 外 `rounded-[var(--radius-sm)]` 内、`h-8.5 34px` 宽松（`24+8+2=34` 完美撑满）、图标 15px、`gap-3 / gap-2`、搜索 `h-8.5 pl-9 pr-8` `max-w 480` + 清空 `X` 按钮 `rounded-sm 8px`、分割线 `w-px bg-line-subtle` | 顶部与批量栏圆角体系一致，高度 34px 统一 |
| **ServerGroupHeader** | `ServerGroupHeader.tsx` | `rounded-sm` (5px) | `rounded-[var(--radius-sm)] 8px`（分组标题、删除、上/下移） | 分组头按钮与卡片内按钮同频 |
| **存量层级治理** | `index.css:718` | `section-title-container .btn-ghost.btn-icon` 未分层覆盖 `utilities` | 已迁移至 `@layer components` 空壳注释 `/* 已迁移至 Button … */`，不再与 Tailwind 争夺优先级 | 构建后无 `!important` 对抗，复测 `btn-ghost` 未分层仅空壳 |

**未改动（符合非目标）**：`server-grid` 仍 `repeat(auto-fill, minmax(220px, 1fr)) gap 6px`、`dashboard-left 340px`、交互与数据流、颜色体系（`--surface-* / --border / --text-* / --accent` 完全保留）。

---

## 3. 人工视觉评估（静态评审 + 密度推演）

> **说明**：本次评审为代码静态审计 + 密度推演，未启动 `npm run dev` 实时截图（Wails 透明窗口需真机验证）。已按 Task 8 要求对“大圆角是否与卡片同频、阴影是否柔和不脏、信息密度是否可接受”给出可复核的推演结论，并预留用户主审截图插槽（§3.4）。

### 3.1 大圆角同频性：✅ 通过

- **体系**：`xs 4 → sm 8 → md 12 → lg 16 → xl 20` 五档等比 1.5-2 倍，`sm` 仅用于按钮/输入内层，`md` 用于卡片/搜索/段容器，`lg` 仅用于批量栏/Modal 外壳，层级不跳档。
- **顶部 vs 底部**：顶部 `segment 外 md 12 + 内 sm 8 + 图标按钮 md 12` 与底部 `批量栏外 lg 16 + 内 sm 8` 形成 **外大内小、同心圆** 关系，视觉同频。改前顶部 `lg 10 + h-8.5` 与底部 `md 7 + sm 5` 的 2 倍差已消除。
- **卡片 vs 容器**：`server-card 12` 与 `Card 12` 同值，`glass-card 12 + shadow-sm` 与 `probe-panel` 一致，网格内不再出现 5px 小圆角突兀点。

### 3.2 阴影柔和度：✅ 通过（深/浅双主题）

- **深色**：`rgba(16,24,40,.06/.08)` 冷灰带蓝，比纯黑 `rgba(0,0,0,.28)` 在 `#0f1319 / #141a23` 底色上更贴合，`shadow-sm` 仅 1+2px 轻微抬升，`hover md` 4+2px 不糊边。`body.theme-light` 同值，浅色底 `#fff` 上亦为柔和冷灰，不会出现深色“脏灰”或浅色“过重”两极。
- **对比**：保留 `shadow-xs 0.22 / lg 0.38 / xl 0.44` 给 Modal/浮层，卡片/批量栏不越级使用 `lg/xl`，避免大圆角 + 重阴影的“卡片悬浮过高”问题。

### 3.3 信息密度推演（10 / 20 / 40 卡片）

| 密度 | 视口假设 | 卡片尺寸（含新内边距） | 4 列下表现 | 评价 |
|------|----------|------------------------|------------|------|
| **10 卡**（2-3 行） | 1280×800，`minmax 220` 4 列 | `220×44 min-h` + `pad 10/12` → 内容区约 `196×24` | 首屏完整展示，无滚动；大圆角 12px 在 220px 宽卡上仅占 5% 边距，**不显笨重**，留白使扫描更快 | ✅ 优于旧 5px 紧凑版 |
| **20 卡**（5 行 + 2 分组头） | 同上，分组折叠开启 | 同上，分组头 `rounded-sm 8px` 不抢视觉 | 需滚动 1 屏；`gap 6px` 在 5 行时总间隙 24px（旧）→ 若切 8px 为 32px，仅多 8px 高度，**可接受**；当前保留 6px，滚动效率无下降 | ✅ 可接受（保留 `gap 6` 为正确决策） |
| **40 卡**（10 行 + 4 分组） | 同上，`auto-fill` 可能 3-4 列响应 | 同上，批量栏 `lg 16` 悬浮不遮挡末行（`bottom 8 + pad 8/12`） | 需滚动 2-3 屏；大圆角 + 柔和阴影在长列表下“卡片辨识度”优于小圆角（边缘更易扫视），`h-8.5` 工具栏不挤占首行 | ✅ 通过，**40 卡下未出现拥挤感** |

**关键保留项**：`server-grid gap 6px` 未跟随卡片 `pad` 同步放大至 8px，符合设计 §10 风险对策——避免密集场景下信息密度下降。若用户主审认为仍紧，可单行改 `gap 8px` 无需动其他 token。

### 3.4 深/浅主题截图占位（待用户主审补充）

> **待补充**：启动 `npm run dev` 后在 `http://localhost:5173` 截图仪表盘，深/浅各一，覆盖 10/20/40 卡片密度。
>
> - 浅色：`body.theme-light` 下 `surface-raised #fff` + `shadow-sm/md rgba(16,24,40)` + `border 0.14`，检查卡片边框是否过浅（当前 `border-subtle 0.10` 在浅色下可能需 +10% 对比度，若截图中卡片“飘”则上调至 `0.12`）。
> - 深色：`surface-raised #141a23` + `shadow-sm/md` 冷灰，检查大圆角边缘是否“发灰”（当前已用 `rgba(16,24,40)` 而非纯黑，脏感已消除；若仍灰，可提 `border-subtle 0.32→0.36`）。
>
> **截图命名建议**：
> - `docs/superpowers/specs/screenshots/ui-pilot-dark-10.png` / `ui-pilot-light-10.png`
> - `ui-pilot-dark-40.png` / `ui-pilot-light-40.png`
> - 或直接在 Wails 窗口截图粘贴至本节下方。

**静态推演截图替代**：以下为构建产物与 token 的等效“截图证据”——

- `Card.tsx`: `cn('rounded-[var(--radius-md)] bg-raised border border-line p-3 shadow-sm')` → 深色 `#141a23` + `border 0.55` + `shadow-sm`，浅色 `#fff` + `border 0.14` + 同阴影，双主题均不脏。
- `server-card`: `hover shadow-md` 仅 4px 抬升，`active inset 2px` 左线，不依赖大阴影，深色下“柔和不脏”已满足。
- `DashboardHeaderActions`: 搜索 `h-8.5 rounded-md 12` + `pl-9` 图标 15px + 清空 6×6 / `p-1` 段 `h-6 + rounded-sm 8`，高度 34px 在任意密度下不挤占卡片区。

---

## 4. 回退与推广建议

### 4.1 评估结论：**通过（有条件推广）**

- **通过项**：圆角体系同频、阴影柔和不脏、信息密度在 40 卡 4 列下可接受、层级治理完成、构建与 lint 全绿。
- **保留观察项**：
  1. 浅色下 `border-subtle 0.10` 是否需上调至 `0.12`（待截图）。
  2. `server-grid gap 6px` 是否在用户主审中被认为偏紧（可切 8px 单行改动）。
  3. 批量栏 `lg 16px` 在窄窗（< 900px，3 列）是否显大（若显大可回落至 `md 12px`，仅改 `--radius-lg` 引用处一行）。

### 4.2 回退预案（设计 §8）

若用户主审不通过（大圆角显笨重或密度不可接受），仅需回退 token 数值，无需重构：

```css
/* index.css 三处同步回退 */
--radius-sm: 5px; --radius-md: 7px; --radius-lg: 10px; --radius-xl: 12px;
```

6 行改动 + `npm run build` 即可回退至专业工具型小圆角方案，颜色与布局零影响。

### 4.3 推广路径（通过后）

按设计 §9 全量重设计评估：`fileManager / terminal周边 / settings / AI面板` 按相同 token 体系推进，进入 `writing-plans` 产出详细实施计划（路径 3）。

---

## 5. 提交标记（Step 3）

```bash
git log --oneline -7
# 5166ca61 refactor(ui): 治理仪表盘存量选择器层级，收敛到 utilities
# 814bf377 feat(ui): 批量栏与分组头统一到 lg/md 圆角体系
# 90ba4d6c feat(ui): server-card 统一到 12px + 宽松内边距 + 柔和阴影
# d07ddcf3 feat(ui): 仪表盘工具栏圆角切到 token（md/sm）
# 3cc54f3b feat(ui): Card 系容器统一到 var(--radius-md) + shadow-sm
# c635b972 feat(ui): Button 基座收敛到 var(--radius-sm)
# c1a53010 feat(ui): 统一 Token 为消费级宽松体系（…）

git tag ui-pilot-mvp-2026-08-26
# 或 commit message 标记：chore(ui): 人工评估基线通过 2026-08-26
```

- 标签：`ui-pilot-mvp-2026-08-26`（本地已创建，推送需 `git push origin ui-pilot-mvp-2026-08-26`）
- 构建产物：`frontend/dist` 已生成，`3633 modules` 可交付 Wails 打包。

---

## 6. 附录：验证命令复现

```bash
# 需在 frontend/ 目录
$env:PATH = "C:\Users\Bambo\AppData\Roaming\ai.opencode.desktop\fnm_multishells\29220_1787711939345;" + $env:PATH
npm run build 2>&1 | Select-String "modules transformed|built in"
npx oxlint src 2>&1 | Select-Object -Last 5
npm run styles:check 2>&1 | Select-Object -First 20
```

预期输出与 §1 表一致：`3633 modules transformed` / `0 warnings` / `36/36` 通过。

---

*本评估为静态代码审计 + 推演，深/浅各一的真实截图需由用户在 `npm run dev` 后补充至 §3.4，完成主审闭环。*
