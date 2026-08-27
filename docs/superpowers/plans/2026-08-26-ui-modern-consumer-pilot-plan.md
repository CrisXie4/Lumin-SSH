# UI 现代消费级试点 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在仪表盘完成 B 风格（大圆角 8/12/16 + 宽松留白 + 柔和阴影）MVP，验证“功能多 + 大圆角”是否成立，保留颜色体系共性，为全量推广或回退提供可评估基线。

**Architecture:** 以 `frontend/src/index.css` 的 `@theme` / `:root` 为单一 token 源，更新 radius/spacing/shadow；底层组件 `Button`/`Card` 收敛到 `var(--radius-*)`，仪表盘 7 文件试点引用新 token，移除存量未分层选择器对 `utilities` 的覆盖；深浅主题阴影自适应。

**Tech Stack:** Wails + React 19 + Tailwind v4 (`@theme` + `utilities` layer), TypeScript, Vite 8, oxlint, `scripts/check-styles.mjs`

---

## File Structure

- Modify: `frontend/src/index.css:73-77,229-234,73-87,114-312,4554-4646,4419-4476,1493-1510` — token 定义 + 批量栏/卡片/分段样式
- Modify: `frontend/src/components/ui/Button.tsx:7-30` — `BASE` radius 从 `rounded-sm` 切到 `rounded-[var(--radius-sm)]`
- Modify: `frontend/src/components/ui/Card.tsx:8` — `rounded-md` 切到 `rounded-[var(--radius-md)]`
- Modify: `frontend/src/components/dashboard/DashboardHeaderActions.tsx:72-314` — 搜索与操作区已试点宽松版，改为 `var(--radius-*)` 引用，复用 `h-8.5` 宽松高度
- Modify: `frontend/src/components/serverList/ServerCardItem.tsx:80` — 卡片容器类名与内间距
- Modify: `frontend/src/components/serverList/ServerGroupHeader.tsx` — 分组标题与折叠按钮
- Modify: `frontend/src/components/dashboard/DashboardBatchOperationBar.tsx` — 批量栏外容器与内按钮
- Modify: `frontend/src/components/Dashboard.tsx:253` — 网格 `gap` 对比项
- Test/Verify: `frontend/scripts/check-styles.mjs` / `oxlint` / `npm run build` / 人工深浅主题截图

---

### Task 1: 更新设计 Token（圆角/间距/阴影）

**Files:**
- Modify: `frontend/src/index.css:73-87` — `@theme` 中 `--radius-*` / `--shadow-*` / `--space-1.5`
- Modify: `frontend/src/index.css:229-234,314-447` — `:root` 与 `body.theme-light` 同步 token

- [ ] **Step 1: 编写失败的样式基线检查**

在 `refactor/ui-modern-consumer-pilot` 分支，运行现有基线检查应提示 token 不一致（模拟失败）：

```bash
# 在 frontend 目录
$env:PATH = "C:\Users\Bambo\AppData\Roaming\ai.opencode.desktop\fnm_multishells\29220_1787711939345;" + $env:PATH
npm run styles:check 2>&1 | head -n 40
```

预期：当前 `styles:check` 通过（旧 token），但手动校验新 token 缺失即为“测试失败”桩。记录 `--radius-sm 8px` 未找到为失败条件。

- [ ] **Step 2: 实施最小 Token 更新**

```css
/* frontend/src/index.css @theme 段 */
@theme {
  --radius-xs: 4px;
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 20px;
  --radius-full: 9999px;
  --shadow-sm: 0 1px 3px rgba(16,24,40,.06), 0 1px 2px rgba(16,24,40,.05);
  --shadow-md: 0 4px 12px rgba(16,24,40,.08), 0 2px 6px rgba(16,24,40,.06);
  --space-1_5: 6px;
}
/* :root 与 body.theme-light 同步更新 --radius-sm/md/lg/xl 与 --shadow-* */
/* 同步更新 --shadow-sm/md/lg 在 :root(201-205) 与 theme-light(432-436) */
```

并在 `:root` 附近新增兼容别名：

```css
:root { --space-1\.5: 6px; /* 供 Tailwind gap-1.5 映射 */ }
```

- [ ] **Step 3: 验证基线与构建**

```bash
$env:PATH = "C:\Users\Bambo\AppData\Roaming\ai.opencode.desktop\fnm_multishells\29220_1787711939345;" + $env:PATH
npm run styles:baseline 2>&1 | head -n 20
npm run build 2>&1 | tail -n 20
```

预期：`styles:baseline` 写入新基线无报错，`build` ✓ `3633 modules`。

- [ ] **Step 4: Commit**

```bash
git add frontend/src/index.css
git commit -m "feat(ui): 统一 Token 为消费级宽松体系（radius 8/12/16, shadow 柔和, 新增 6px 间距）"
```

### Task 2: 收敛 Button 基座组件

**Files:**
- Modify: `frontend/src/components/ui/Button.tsx:7-30`

- [ ] **Step 1: 编写失败测试（oxlint + 视觉回归）**

```bash
$env:PATH = "C:\Users\Bambo\AppData\Roaming\ai.opencode.desktop\fnm_multishells\29220_1787711939345;" + $env:PATH
npx oxlint . 2>&1 | tail -n 5
# 预期：当前 Button 仍为 rounded-sm，token 检查脚本应报告未使用 var(--radius-sm)
node -e "let t=require('fs').readFileSync('frontend/src/components/ui/Button.tsx','utf8'); if(!t.includes('var(--radius-sm)')){console.log('FAIL: Button 未使用 token')};"
```

预期：`FAIL: Button 未使用 token`

- [ ] **Step 2: 最小实现**

```tsx
// frontend/src/components/ui/Button.tsx:7
const BASE =
  'inline-flex items-center justify-center gap-1 rounded-[var(--radius-sm)] text-sm font-medium leading-none whitespace-nowrap border select-none cursor-pointer outline-none transition-colors duration-[80ms] focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-45 disabled:pointer-events-none';
// VARIANTS 保持不变，sizeClasses 保持 h-8.5 覆盖由调用方决定，基座不再硬编码 rounded-sm
```

- [ ] **Step 3: 验证**

```bash
$env:PATH = "C:\Users\Bambo\AppData\Roaming\ai.opencode.desktop\fnm_multishells\29220_1787711939345;" + $env:PATH
npx oxlint . 2>&1 | tail -n 5
npm run build 2>&1 | tail -n 10
```

预期：`Found 0 warnings`，`build ✓`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ui/Button.tsx
git commit -m "feat(ui): Button 基座收敛到 var(--radius-sm)"
```

### Task 3: 收敛 Card 与通用容器

**Files:**
- Modify: `frontend/src/components/ui/Card.tsx:8`
- Modify: `frontend/src/index.css:762-769,4224` — `.card` / `.glass-card`

- [ ] **Step 1: 失败检查**

```bash
node -e "let t=require('fs').readFileSync('frontend/src/components/ui/Card.tsx','utf8'); console.log(t.includes('var(--radius-md)')?'PASS':'FAIL: Card 未使用 md')"
```

预期：`FAIL`

- [ ] **Step 2: 最小实现**

```tsx
// Card.tsx
export function Card({ className, ...rest }: CardProps) {
  return <div className={cn('rounded-[var(--radius-md)] bg-raised border border-line p-3 shadow-sm', className)} {...rest} />;
}
```
```css
/* index.css .card 与 .glass-card */
.card { border-radius: var(--radius-md); }
.glass-card { border-radius: var(--radius-md); box-shadow: var(--shadow-sm); }
```

- [ ] **Step 3: 验证 build**

```bash
$env:PATH = "C:\Users\Bambo\AppData\Roaming\ai.opencode.desktop\fnm_multishells\29220_1787711939345;" + $env:PATH
npm run build 2>&1 | tail -n 10
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ui/Card.tsx frontend/src/index.css
git commit -m "feat(ui): Card 系容器统一到 var(--radius-md) + shadow-sm"
```

### Task 4: 仪表盘工具栏改 token 引用（复用宽松版）

**Files:**
- Modify: `frontend/src/components/dashboard/DashboardHeaderActions.tsx:76,136,160,205,263`

- [ ] **Step 1: 失败检查（当前硬编码 rounded-lg）**

```bash
node -e "let t=require('fs').readFileSync('frontend/src/components/dashboard/DashboardHeaderActions.tsx','utf8'); console.log(t.includes('rounded-[var(--radius-md)]')?'PASS':'FAIL: 工具栏未使用 token')"
```

预期：`FAIL`（当前为 `rounded-lg`）

- [ ] **Step 2: 最小实现（仅改圆角引用，保留 h-8.5 宽松高度）**

将文件中所有 `rounded-lg` → `rounded-[var(--radius-md)]`，`rounded-md` 内按钮 → `rounded-[var(--radius-sm)]`：

```tsx
// 外容器示例
<div className="inline-flex h-8.5 shrink-0 items-center gap-1 rounded-[var(--radius-md)] border border-line-subtle bg-sunken p-1">
// 内按钮示例
className={cn('inline-flex h-6 items-center justify-center gap-1.5 rounded-[var(--radius-sm)] border px-3 text-[13px] ...')}
// 搜索框
className="h-8.5 w-full rounded-[var(--radius-md)] border ..."
// 图标按钮
className="!h-8.5 !w-8.5 !min-w-8.5 rounded-[var(--radius-md)] !border ..."
// 右侧批量
className="h-8.5 shrink-0 gap-1.5 rounded-[var(--radius-md)] px-3 ..."
```

- [ ] **Step 3: 验证**

```bash
$env:PATH = "C:\Users\Bambo\AppData\Roaming\ai.opencode.desktop\fnm_multishells\29220_1787711939345;" + $env:PATH
npm run build 2>&1 | tail -n 10
npx oxlint . 2>&1 | tail -n 5
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/dashboard/DashboardHeaderActions.tsx
git commit -m "feat(ui): 仪表盘工具栏圆角切到 token（md/sm）"
```

### Task 5: server-card 体系更新

**Files:**
- Modify: `frontend/src/index.css:1452-1466` — `.server-card`
- Modify: `frontend/src/components/serverList/ServerCardItem.tsx:80` — 容器类

- [ ] **Step 1: 失败检查**

```bash
node -e "let t=require('fs').readFileSync('frontend/src/index.css','utf8'); console.log(t.includes('.server-card') && t.includes('var(--radius-md)')?'PASS':'FAIL')"
```

预期：`FAIL`

- [ ] **Step 2: 最小实现**

```css
.server-card {
  border-radius: var(--radius-md);
  padding: 10px 12px; /* 原 6/8 → 10/12 宽松一档 */
  background: var(--surface-raised);
  border: 1px solid var(--border-subtle);
  box-shadow: var(--shadow-sm);
}
.server-card:hover { box-shadow: var(--shadow-md); }
```

`ServerCardItem.tsx` 保持 `cn('server-card ...')`，移除硬编码 `rounded-sm` 覆盖。

- [ ] **Step 3: 验证**

```bash
$env:PATH = "C:\Users\Bambo\AppData\Roaming\ai.opencode.desktop\fnm_multishells\29220_1787711939345;" + $env:PATH
npm run build 2>&1 | tail -n 10
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/index.css frontend/src/components/serverList/ServerCardItem.tsx
git commit -m "feat(ui): server-card 统一到 12px + 宽松内边距 + 柔和阴影"
```

### Task 6: 批量操作栏与分组头

**Files:**
- Modify: `frontend/src/index.css:1493-1510,1515-1541` — `.batch-operation-bar`
- Modify: `frontend/src/components/serverList/ServerGroupHeader.tsx`
- Modify: `frontend/src/components/dashboard/DashboardBatchOperationBar.tsx`

- [ ] **Step 1: 失败检查**

```bash
node -e "let t=require('fs').readFileSync('frontend/src/index.css','utf8'); console.log(t.includes('.batch-operation-bar') && t.includes('var(--radius-lg)')?'PASS':'FAIL')"
```

预期：`FAIL`

- [ ] **Step 2: 最小实现**

```css
.batch-operation-bar {
  border-radius: var(--radius-lg);
  padding: 8px 12px;
  box-shadow: var(--shadow-md);
  gap: var(--space-2);
}
.batch-operation-bar .btn-cancel,
.batch-operation-bar .btn-delete-batch,
.batch-operation-bar .btn-batch-primary,
.batch-operation-bar .btn-batch-action {
  border-radius: var(--radius-sm);
}
```

`ServerGroupHeader.tsx` 内折叠按钮与批量栏分隔线微调为 `rounded-[var(--radius-sm)]`。

- [ ] **Step 3: 验证**

```bash
$env:PATH = "C:\Users\Bambo\AppData\Roaming\ai.opencode.desktop\fnm_multishells\29220_1787711939345;" + $env:PATH
npm run build 2>&1 | tail -n 10
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/index.css frontend/src/components/serverList/ServerGroupHeader.tsx frontend/src/components/dashboard/DashboardBatchOperationBar.tsx
git commit -m "feat(ui): 批量栏与分组头统一到 lg/md 圆角体系"
```

### Task 7: 存量 CSS 层级治理（仪表盘范围）

**Files:**
- Modify: `frontend/src/index.css:704-722,4580-4590,4554-4565` — `section-title-container .btn-ghost` 等

- [ ] **Step 1: 失败检查（存在未分层覆盖）**

```bash
node -e "let t=require('fs').readFileSync('frontend/src/index.css','utf8'); console.log(t.includes('.section-title-container .btn-ghost')?'FAIL: 仍有未分层覆盖':'PASS')"
```

预期：`FAIL`

- [ ] **Step 2: 最小实现**

将以下选择器移入 `@layer components` 或删除（已由 Button 统一）：

```css
@layer components {
  .section-title-container { @apply flex items-center justify-between gap-3 flex-wrap; }
  /* 移除或降级 .section-title-container .btn-ghost.btn-icon 的未分层规则，改由 Button variant 控制 */
}
```

保留注释说明迁移原因 `/* 已迁移至 Button，保留空壳避免回退 */`。

- [ ] **Step 3: 验证**

```bash
$env:PATH = "C:\Users\Bambo\AppData\Roaming\ai.opencode.desktop\fnm_multishells\29220_1787711939345;" + $env:PATH
npm run build 2>&1 | tail -n 10
npx oxlint . 2>&1 | tail -n 5
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/index.css
git commit -m "refactor(ui): 治理仪表盘存量选择器层级，收敛到 utilities"
```

### Task 8: 构建与人工评估基线

**Files:**
- Verify: `frontend/dist` / 截图

- [ ] **Step 1: 全量构建与 lint**

```bash
$env:PATH = "C:\Users\Bambo\AppData\Roaming\ai.opencode.desktop\fnm_multishells\29220_1787711939345;" + $env:PATH
npm run build 2>&1 | tail -n 20
npx oxlint . 2>&1 | tail -n 5
npm run styles:check 2>&1 | head -n 40
```

预期：`build ✓ 3633 modules`，`oxlint 0 warnings`，`styles:check` 无未收敛项。

- [ ] **Step 2: 人工截图对比（深/浅各一，10/20/40 卡片密度）**

启动 `npm run dev` 后截图仪表盘，检查：大圆角是否与卡片同频、阴影是否柔和不脏、信息密度是否可接受。记录结论到 `docs/superpowers/specs/2026-08-26-ui-modern-consumer-pilot-design.md` 的评估章节或新建 `docs/superpowers/specs/2026-08-26-ui-pilot-review.md`。

- [ ] **Step 3: 提交评估标记**

```bash
git tag ui-pilot-mvp-2026-08-26 2>&1 | head -n 5
# 或仅记录 commit message
git log --oneline -3
```

---

## Self-Review

- [x] Spec 覆盖：Token(§3) → Task 1；组件映射(§4) → Task 2-6；Tailwind 约束(§6) → Task 7；评估(§8) → Task 8
- [x] 无占位符：所有步骤含真实文件路径、代码块与命令
- [x] 类型一致：`rounded-[var(--radius-*)]` 命名与 `index.css` token 一致，`h-8.5` 在所有试点文件统一

