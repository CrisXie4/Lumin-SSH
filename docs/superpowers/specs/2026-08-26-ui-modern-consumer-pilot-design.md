# UI 现代消费级试点设计 — Lumin SSH 仪表盘

> 分支：`refactor/ui-modern-consumer-pilot` 基于 `main 88513c0b`  
> 路径：路径 2 Token 体系化（推荐）  
> 状态：设计已确认，进入实现  
> 作者：Muse Spark / Hank  
> 日期：2026-08-26

## 1. 总览与目标

- **目标**：在仪表盘完成可感知的 B 风格 MVP，验证“大圆角 10-16px + 宽松留白 + 柔和阴影”在“功能多、卡片密集（4 列/多分组）”场景下的可读性与美观度。保留现有颜色体系共性（`--surface-* / --border / --text-* / --accent` 等）。
- **非目标**：不改动布局栅格（`dashboard-left 340px / server-grid auto-fill 220px`）、不引入毛玻璃/大面积渐变、不改动交互与数据流。
- **渐进策略**：试点仪表盘 7 文件 → 人工审美评估 → 通过则推广到文件管理/终端周边/设置/AI 面板；不通过则回退到专业工具型小圆角方案（仅改 token 数值）。

## 2. 背景与问题

- 当前 `frontend/src/index.css` 5 档圆角并存：`xs 3px / sm 5px / md 7px / lg 10px / xl 12px` 混用。顶部工具栏已改为 `lg 10px + h-8.5 34px`，而底部批量栏 `rounded-md 7px + 内按钮 rounded-sm 5px`、卡片 `server-card rounded-sm 5px`、弹窗 `rounded-md 7px`，视觉不一致（见截图顶部 vs 底部）。
- 存量 CSS 未分层覆盖 `utilities`（`index.css:9` 注释），如 `section-title-container .btn-ghost`、`server-card` 优先级高于 Tailwind，导致后续统一需治理层级。
- 颜色 token 深浅双主题已完善（`@theme inline` 映射），但阴影仍为纯黑 `0.22-0.44`，在深色大圆角下显脏。

## 3. Token 设计

### 3.1 圆角（单一来源 `@theme` + `:root`）

```css
--radius-xs: 4px;   /* 复选框、微徽标 */
--radius-sm: 8px;   /* 按钮、输入框、Segment 内按钮、批量栏内按钮 */
--radius-md: 12px;  /* 卡片 server-card、Segment 外容器、搜索框 */
--radius-lg: 16px;  /* 弹窗 Modal、批量操作外栏 batch-operation-bar */
--radius-xl: 20px;  /* 大空状态插画容器（试点不使用） */
--radius-full: 999px;
--radius-pill: 999px; /* alias */
```

> 现有 `5/7/10/12` → 新 `4/8/12/16/20`：同等放大一档但保持克制，避免 `lg 10` 在密集卡片中显笨重。

### 3.2 间距

新增 `--space-1.5: 6px`，试点将卡片 `gap 6px → 8px` 的可行性作为对比项保留，工具栏保持 `gap-3 (12px)`。

### 3.3 阴影（柔和化 + 深浅自适应）

```css
--shadow-sm: 0 1px 3px rgba(16,24,40,.06), 0 1px 2px rgba(16,24,40,.05);
--shadow-md: 0 4px 12px rgba(16,24,40,.08), 0 2px 6px rgba(16,24,40,.06);
```

深色模式通过 `color-mix` 在 `border-subtle` 上提亮 1px 高光，避免大圆角阴影在深色背景下发灰。`@theme` 中同步更新 `--shadow-xs/sm/md/lg/xl`。

## 4. 组件映射（试点内）

| 组件 | 文件 | 改造前 | 改造后（B） | 说明 |
|------|------|--------|-------------|------|
| Button | `frontend/src/components/ui/Button.tsx:8` | `rounded-sm` | `rounded-[var(--radius-sm)]`，`size icon` 统一 `h-8.5 w-8.5` | 所有按钮走同一 token |
| Input/Search | `DashboardHeaderActions.tsx:136` | `rounded-lg h-8.5 bg-sunken` 已试点 | 保持 `rounded-[var(--radius-md)] h-8.5` | 评估搜索框宽度 `max-w-[480px]` 是否足够 |
| Segment | `DashboardHeaderActions.tsx:76,205` | `h-8.5 p-1 rounded-lg` 内 `h-6` | 外 `rounded-[var(--radius-md)]` 内 `rounded-[var(--radius-sm)]` | 外 `h-8.5 p-1` 内 `h-6` 完美撑满 `24+8+2=34` |
| server-card | `frontend/src/index.css:1460` / `ServerCardItem.tsx:80` | `rounded-sm 5px` `padding 6/8` | `rounded-[var(--radius-md)] 12px` `padding 10/12` `shadow-sm` | 网格间隙 `server-grid gap 6px → 8px` 对比 |
| batch-operation-bar | `frontend/src/index.css:1505` | `rounded-md 7px` 外 `rounded-sm` 内 | 外 `rounded-[var(--radius-lg)]` 内 `rounded-[var(--radius-sm)]` | 与顶部工具栏同频 |
| Card/Modal | `Card.tsx:8` / `index.css:820` | `rounded-md 7px` | Card `rounded-[var(--radius-md)]` Modal `rounded-[var(--radius-lg)]` | 试点不改动 Modal 内部，仅外容器圆角 |

## 5. 试点范围与文件清单

- `frontend/src/index.css` — `@theme` / `:root` token
- `frontend/src/components/ui/Button.tsx` — `BASE` radius
- `frontend/src/components/dashboard/DashboardHeaderActions.tsx` — 搜索与操作区（已试点宽松版，改 token 引用）
- `frontend/src/components/serverList/ServerCardItem.tsx` / `ServerGroupHeader.tsx` / `ServerTableItem.tsx`
- `frontend/src/components/dashboard/DashboardRecentTable.tsx` / `DashboardBatchOperationBar.tsx`
- `frontend/src/components/Dashboard.tsx` — 网格 gap

约 7-8 文件，`npm run build` + `oxlint` 验证。

## 6. Tailwind 约束与层级治理

- 颜色 token 完全保留，深浅主题仅阴影/边框色自适应，不新增颜色变量（满足“颜色配置共性”约束）。
- 治理 `index.css:9` 未分层覆盖：将 `section-title-container .btn-ghost.btn-icon`、`server-card` 等存量选择器迁移到 `@layer components` 或移除，改由 `Button` 的 `utilities` 层统一控制，避免后续 `!important` 对抗。试点仅针对仪表盘相关选择器。
- 所有圆角/阴影通过 `var(--radius-*)` / `var(--shadow-*)` 引用，禁止硬编码 `10px` / `12px`。

## 7. 主题与共性保持

- `@theme inline` 颜色映射（`--color-canvas/raised/sunken/line/primary/accent...`）不变。
- 深色 `color-scheme: dark` 与浅色 `body.theme-light` 的色板不变，仅阴影与 `border-subtle` 提亮逻辑调整。
- Tailwind 约束：所有样式通过 `tailwindcss/theme.css + utilities.css` + `var(--*)`，不手写异色。

## 8. 评估标准与回退

- **通过**：4 列/多分组下无拥挤感、搜索与批量栏圆角与卡片视觉同频、深浅主题阴影不脏、信息密度可接受；则推广到 `fileManager / terminal周边 / settings / AI面板`，进入全量重设计（路径 3）评估。
- **不通过**：信息密度下降或大圆角显“笨重”，则回退到专业工具型：`--radius-sm 5px / --radius-md 7px` 小圆角体系，仅改回 token 数值（`index.css` 6 行），无需重构颜色与布局。
- 评估方式：人工对比截图（深/浅各一）+ 10/20/40 卡片密度下的滚动与扫描效率主观评分。

## 9. 实施步骤（路径 2）

1. `index.css` 更新 `@theme` / `:root` token（radius/spacing/shadow）
2. `Button.tsx` / `Card.tsx` 基座组件半径收敛
3. `DashboardHeaderActions.tsx` 改为 `var(--radius-*)` 引用（复用已试点宽松版）
4. `server-card` / `batch-operation-bar` 半径与阴影更新
5. `DashboardRecentTable` / `ServerGroupHeader` 细节对齐
6. 构建验证 `npm run build` + `oxlint` + 深浅主题截图对比

## 10. 风险与对策

- **风险**：大圆角在卡片密集时占用视觉空间。对策：试点保留 `gap 6px vs 8px` 对比分支，必要时保持 6px。
- **风险**：Wails 透明窗口阴影性能。对策：阴影仅用两层 `rgba(16,24,40)`，禁用毛玻璃。
- **风险**：存量 CSS 优先级回退。对策：试点文件内 `!important` 仅作过渡，最终通过 `@layer` 治理消除。

## 11. 待确认

- 试点完成后的截图对比由用户主审，`spec` 评审通过后进入 `writing-plans` 产出详细实施计划。

## 12. 评估基线（2026-08-26 MVP）

> 详见独立评审文档：`2026-08-26-ui-pilot-review.md`  
> 分支 HEAD `5166ca61` / 标签 `ui-pilot-mvp-2026-08-26`

**构建**：`npm run build` ✓ `3633 modules transformed` (`built in 4.3s`)、`oxlint 0 warnings` (413 files)、`styles:check` `36/36` 通过、`frontend/dist` 112 文件完整。  
**视觉**：Token `4/8/12/16/20 + shadow-sm/md rgba(16,24,40)` 已在 6 文件全量收敛为 `var(--radius-*)`；顶部 `md 12 + sm 8 + h-8.5` 与底部 `lg 16 + sm 8` + 卡片 `md 12 + pad 10/12 + shadow-sm` **同频通过**，阴影深/浅均不脏。  
**密度**：10/20/40 卡片推演（220px 4 列、`gap 6px` 保留）均可接受，未现拥挤感；批量栏 `lg 16` 悬浮不遮挡末行。  
**层级**：`section-title-container .btn-ghost` 已迁移至 `@layer components` 空壳，`utilities` 不再对抗。  
**结论**：**通过（有条件推广）**—— 保留 `gap 6px`，浅色 `border-subtle 0.10→0.12` 与窄窗 `lg 16→md 12` 为观察项。待用户在 `npm run dev` 后补充深/浅截图至评审文档 §3.4 后即可进入全量推广（路径 3）评估。回退仅需 6 行 token 数值回退，无重构成本。
