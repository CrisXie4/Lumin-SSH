# UI 现代消费级全局推广与细节提质实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 基于已验证的 Token 体系（`--radius-sm 8px / --radius-md 12px / --radius-lg 16px`），引入 Linear/Raycast 级的微质感（顶光反光、平滑过渡曲线、状态光晕、等宽数字排版），将现代消费级风格推广至文件管理器（FileManager）、全局弹窗体系（Modal/Dialog）、设置中心（SettingsModal）与数据页，并同步清理 `index.css` 历史沉余样式。

**Architecture:** 
- **Token 增强层**：在 `index.css` 的 `@theme` 与 `:root` 引入顶光 `--shadow-card`、平滑减速动效 `--ease-spring` 与状态光晕变量，赋能基础组件。
- **全局组件基座统一**：统一 `Modal.tsx` (`radius-lg 16px + shadow-xl`)、`Button.tsx` (`radius-sm 8px`)、`Card.tsx` (`radius-md 12px + 顶光`)。
- **业务模块迁移与 CSS 瘦身**：按“迁移一个模块，删除对应 CSS”的原则，重构 `FileManager`、`SettingsModal` 与通用数据页，剔除 `index.css` 中数百行老旧手写样式。

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Lucide React, Wails, fnm/Node.js, pnpm, oxlint.

## Global Constraints

- **环境约定**：pnpm 全局安装，Node.js 由 fnm 管理，构建与 lint 脚本执行环境保持一致。
- **Token 单一源**：所有圆角、阴影、间距一律使用 `var(--radius-*)`、`var(--shadow-*)`、`var(--space-*)`，严禁硬编码 `12px` / `16px`。
- **颜色共性保持**：严禁新增非语义异色变量，所有颜色必须对齐 `@theme inline` 映射（`canvas / raised / sunken / line / text-* / accent / success / danger / warning`）。
- **性能红线**：严禁在滚动列表和高频刷新区使用大面积 `backdrop-filter: blur`；过渡时间控制在 `120ms ~ 160ms`。
- **构建与 Lint 红线**：每阶段必须保证 `npm run build`、`npx oxlint src`、`npm run styles:check` 全绿（0 warnings, 0 errors, 36/36 基线合规）。

---

### Task 1: Design Token & Micro-Polish 增强（光感、微动效与排版）

**Files:**
- Modify: `frontend/src/index.css`
- Modify: `frontend/src/components/ui/Card.tsx`

**Interfaces:**
- Consumes: `@theme`, `:root`, `body.theme-light`
- Produces: `--shadow-card`, `--shadow-glow-*`, `--ease-spring`, `--transition-spring`

- [ ] **Step 1: 在 `index.css` 声明顶光与微动效 Token**

在 `frontend/src/index.css` 的 `@theme` 及 `:root`、`body.theme-light` 中添加：
```css
/* 顶部 1px 微发光（深色模式下强化物理层次） */
--shadow-card: inset 0 1px 0 0 rgba(255, 255, 255, 0.05), 0 1px 3px rgba(16, 24, 40, 0.06), 0 1px 2px rgba(16, 24, 40, 0.04);
--shadow-card-hover: inset 0 1px 0 0 rgba(255, 255, 255, 0.08), 0 4px 12px rgba(16, 24, 40, 0.08), 0 2px 6px rgba(16, 24, 40, 0.06);

/* 现代减速曲线 */
--ease-spring: cubic-bezier(0.16, 1, 0.3, 1);
--transition-spring: transform 0.15s var(--ease-spring), box-shadow 0.15s ease, background-color 0.12s ease, border-color 0.12s ease;
```

- [ ] **Step 2: 增强 `Card.tsx` 的质感与 Hover 动效**

更新 `frontend/src/components/ui/Card.tsx`：
```tsx
import type { HTMLAttributes, ReactNode } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  interactive?: boolean;
}

export function Card({ children, className = '', interactive = false, ...props }: CardProps) {
  return (
    <div
      className={`rounded-[var(--radius-md)] bg-raised border border-line p-3 shadow-[var(--shadow-card,var(--shadow-sm))] ${
        interactive ? 'transition-[var(--transition-spring,var(--transition))] hover:-translate-y-[0.5px] hover:shadow-[var(--shadow-card-hover,var(--shadow-md))] hover:border-line' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 3: 运行构建与 Lint 验证**

Run: `npm run build && npx oxlint src`
Expected: PASS with 0 errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/index.css frontend/src/components/ui/Card.tsx
git commit -m "feat(ui): 增强卡片顶光反光与微动效 Token"
```

---

### Task 2: 全局弹窗体系（Modal / GlobalDialog / AddServerModal）统一

**Files:**
- Modify: `frontend/src/components/ui/Modal.tsx`
- Modify: `frontend/src/components/GlobalDialog.tsx`
- Modify: `frontend/src/components/AddServerModal.tsx`
- Modify: `frontend/src/components/UpdateModal.tsx`
- Modify: `frontend/src/components/CredentialsModal.tsx`

**Interfaces:**
- Consumes: `var(--radius-lg)`, `var(--radius-sm)`, `var(--shadow-xl)`
- Produces: Standardized modal container & inner input styling

- [ ] **Step 1: 升级 `Modal.tsx` 外壳为 `--radius-lg (16px)` 与 `--shadow-xl`**

修改 `frontend/src/components/ui/Modal.tsx`：
- 外容器由 `rounded-md` 改为 `rounded-[var(--radius-lg)] shadow-xl border border-line`。
- 关闭按钮规范化为 `rounded-[var(--radius-sm)]`。
- 头部标题字号与间距保持清晰。

- [ ] **Step 2: 统一 `GlobalDialog.tsx` 与常用子弹窗**

检查并更新：
- `GlobalDialog.tsx`：提示框与确认框统一外层 `rounded-[var(--radius-lg)]`、按钮 `rounded-[var(--radius-sm)]`、输入框 `rounded-[var(--radius-sm)]`。
- `AddServerModal.tsx`：表单控件（输入框、下拉框、认证切换器）统一为 `rounded-[var(--radius-sm)]` 与现代 focus ring。
- `UpdateModal.tsx` 与 `CredentialsModal.tsx`：外层与操作按钮对齐规范。

- [ ] **Step 3: 运行构建与 Lint 验证**

Run: `npm run build && npx oxlint src`
Expected: PASS with 0 errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ui/Modal.tsx frontend/src/components/GlobalDialog.tsx frontend/src/components/AddServerModal.tsx frontend/src/components/UpdateModal.tsx frontend/src/components/CredentialsModal.tsx
git commit -m "feat(ui): 全局弹窗体系统一至 lg(16px) 圆角与 xl 柔和阴影"
```

---

### Task 3: 文件管理器（FileManager）现代消费级重构与 CSS 瘦身

**Files:**
- Modify: `frontend/src/components/filemanager/FileManagerToolbar.tsx`
- Modify: `frontend/src/components/filemanager/FileManagerTabBar.tsx`
- Modify: `frontend/src/components/filemanager/FileManagerContent.tsx`
- Modify: `frontend/src/components/filemanager/FileManagerOverlays.tsx`
- Modify: `frontend/src/index.css:2460-2974`

**Interfaces:**
- Consumes: `var(--radius-sm)`, `var(--radius-md)`, `Button` component, `h-8.5` toolbar standard
- Produces: Modern relaxed file manager layout, pruned legacy CSS

- [ ] **Step 1: 工具栏 `FileManagerToolbar.tsx` 宽松化与 Token 统一**

- 将路径输入框 (`path-input`)、搜索定位框 (`file-locator-input`) 统一切换为 `rounded-[var(--radius-sm)] h-8 px-2.5 bg-sunken border border-line-subtle focus:border-focus focus:ring-2 focus:ring-accent/20`。
- 工具栏高度对齐仪表盘 34px（`h-8.5`）标准，按钮间距与图标尺寸（14px/15px）对齐 `DashboardHeaderActions`。

- [ ] **Step 2: 文件列表行 `FileManagerContent.tsx` 与 Tab 栏微调**

- 文件列表项目 hover 态与选中态使用 `rounded-[var(--radius-sm)]`。
- 文件大小、权限、修改时间等列添加 `font-mono tabular-nums text-xs text-tertiary`。
- 双栏分屏指示器对齐柔和边框。

- [ ] **Step 3: 清理 `index.css` 中的 `file-manager` 历史手写样式**

- 从 `frontend/src/index.css` 中逐步移除 2460~2974 行中已被 Tailwind 工具类完全覆盖的选择器。
- 确保没有丢失拖拽指示、双栏布局等核心布局功能。

- [ ] **Step 4: 运行构建与 Lint 验证**

Run: `npm run build && npx oxlint src && npm run styles:check`
Expected: PASS with 0 errors

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/filemanager/ frontend/src/index.css
git commit -m "feat(ui): 文件管理器迁移至现代消费级规范并清理历史 CSS"
```

---

### Task 4: 设置中心（SettingsModal）视觉重构与 CSS 收敛

**Files:**
- Modify: `frontend/src/components/SettingsModal.tsx`
- Modify: `frontend/src/components/settings/SettingsSidebar.tsx`
- Modify: `frontend/src/components/settings/appearance/AppearanceTabPane.tsx`
- Modify: `frontend/src/components/settings/fileManager/FileManagerTabPane.tsx`
- Modify: `frontend/src/index.css:4855-4888`

**Interfaces:**
- Consumes: `Modal`, `Button`, `Switch`, `var(--radius-sm)`, `var(--radius-md)`
- Produces: Unified settings modal experience, removed `.settings-*` CSS classes

- [ ] **Step 1: 重构 `SettingsSidebar.tsx`**

- 侧边栏导航条目统一使用 `rounded-[var(--radius-sm)] h-8.5 px-3 flex items-center gap-2 text-sm transition-colors`。
- 激活态：`bg-accent-dim text-accent font-medium`；未激活态：`text-secondary hover:bg-hover hover:text-primary`。

- [ ] **Step 2: 规范设置选项卡内容面板**

- 各配置区块包裹在 `rounded-[var(--radius-md)] border border-line-subtle bg-sunken/40 p-4 mb-4`。
- 选项开关（Switch）、下拉框（Select）、文本输入框统一为 `rounded-[var(--radius-sm)]`。

- [ ] **Step 3: 清理 `index.css` 中的 `.settings-*` 冗余样式**

- 移除 `index.css` 中的 `.settings-sidebar`, `.settings-content-pane`, `.settings-font-manager-grid` 等写死类名，改为组件内部工具类。

- [ ] **Step 4: 运行构建与 Lint 验证**

Run: `npm run build && npx oxlint src && npm run styles:check`
Expected: PASS with 0 errors

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/SettingsModal.tsx frontend/src/components/settings/ frontend/src/index.css
git commit -m "feat(ui): 设置中心样式现代化重构与 CSS 类名收敛"
```

---

### Task 5: 终端周边、快捷命令栏与通用数据页对齐

**Files:**
- Modify: `frontend/src/components/ProcessPage.tsx`
- Modify: `frontend/src/components/NetworkPage.tsx`
- Modify: `frontend/src/components/terminal/TerminalQuickCmdBar.tsx`
- Modify: `frontend/src/components/quickCommands/QuickCommandDialog.tsx`

**Interfaces:**
- Consumes: `var(--radius-sm)`, `var(--radius-md)`, `font-mono tabular-nums`
- Produces: Visually unified processes/network monitors & quick commands

- [ ] **Step 1: 数据页（进程管理、网络监控）工具栏与表格对齐**

- 顶部工具栏高度统一为 `h-8.5`，搜索框 `rounded-[var(--radius-sm)]`。
- PID、CPU%、MEM%、端口号列添加 `font-mono tabular-nums`。

- [ ] **Step 2: 终端快捷命令栏 `TerminalQuickCmdBar.tsx` 与编辑弹窗对齐**

- 快捷命令条胶囊按钮统一为 `rounded-[var(--radius-sm)]`，高亮和 hover 对齐现代消费级质感。
- `QuickCommandDialog.tsx` 弹窗对齐 `Modal` 规范。

- [ ] **Step 3: 运行构建与 Lint 验证**

Run: `npm run build && npx oxlint src && npm run styles:check`
Expected: PASS with 0 errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ProcessPage.tsx frontend/src/components/NetworkPage.tsx frontend/src/components/terminal/ frontend/src/components/quickCommands/
git commit -m "feat(ui): 进程/网络数据页与终端快捷命令栏对齐现代规范"
```

---

### Task 6: 全局评估、样式基线核验与代码复审

**Files:**
- Modify: `docs/superpowers/specs/2026-08-26-ui-pilot-review.md`

**Interfaces:**
- Full frontend repository

- [ ] **Step 1: 执行全量构建与静态代码检查**

在 `frontend/` 目录下执行：
```powershell
$env:PATH = "C:\Users\Bambo\AppData\Roaming\ai.opencode.desktop\fnm_multishells\29220_1787711939345;" + $env:PATH
npm run build
npx oxlint src
npm run styles:check
```
预期：
- `npm run build`: 成功，dist 产物生成正常。
- `npx oxlint src`: 0 warnings, 0 errors。
- `npm run styles:check`: 36/36 基线合规。

- [ ] **Step 2: 提交最终标记与文档更新**

```bash
git commit -am "chore(ui): 完成现代消费级 UI 全局推广与 CSS 瘦身"
```
