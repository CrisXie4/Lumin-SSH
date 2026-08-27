# index.css 模块化重构与瘦身实现计划 (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `src/index.css`（6100 行单体）按职责领域分层拆解为独立的模块化 CSS 文件，剔除确认死代码，保留 100% 视觉和交互一致性。

**Architecture:** 按照 `tokens` -> `base` -> `animations` -> `vendor` -> `components` 建立清晰的 `src/styles/` 目录结构，通过入口 `src/index.css` 的 `@import` 进行顺序整合。

**Tech Stack:** Tailwind CSS v4, PostCSS/Vite, React 19, TypeScript

---

### Task 1: 核心系统与 Tokens 模块化
**Files:**
- Create: `frontend/src/styles/tokens.css`
- Create: `frontend/src/styles/base.css`
- Create: `frontend/src/styles/animations.css`

- [ ] **Step 1: 提取设计 Token 与 Tailwind 配置到 `tokens.css`**
- [ ] **Step 2: 提取 Reset、全局焦点环、滚动条到 `base.css`**
- [ ] **Step 3: 提取动效与 Keyframes 到 `animations.css` 并剔除死 Keyframes**

---

### Task 2: 第三方组件样式覆盖模块化
**Files:**
- Create: `frontend/src/styles/vendor/codemirror.css`
- Create: `frontend/src/styles/vendor/xterm.css`

- [ ] **Step 1: 提取 CodeMirror 6 编辑器覆盖规则到 `vendor/codemirror.css`**
- [ ] **Step 2: 提取 xterm.js 样式与默认变量覆盖到 `vendor/xterm.css`**

---

### Task 3: 基础 UI 与导航组件模块化
**Files:**
- Create: `frontend/src/styles/components/common.css`
- Create: `frontend/src/styles/components/topbar.css`
- Create: `frontend/src/styles/components/tabs.css`
- Create: `frontend/src/styles/components/subtabs.css`

- [ ] **Step 1: 提取 Modal、Alert、Toggle、Badge 等基础通用组件到 `components/common.css`**
- [ ] **Step 2: 提取顶栏样式到 `components/topbar.css`**
- [ ] **Step 3: 提取主会话标签页与 SVG 反弧曲线到 `components/tabs.css`**
- [ ] **Step 4: 提取终端子标签与抽屉标签到 `components/subtabs.css`**

---

### Task 4: 业务功能领域组件模块化
**Files:**
- Create: `frontend/src/styles/components/dashboard.css`
- Create: `frontend/src/styles/components/probe.css`
- Create: `frontend/src/styles/components/filemanager.css`
- Create: `frontend/src/styles/components/terminal.css`

- [ ] **Step 1: 提取服务器卡片与编辑面板到 `components/dashboard.css`**
- [ ] **Step 2: 提取监控探针面板到 `components/probe.css`**
- [ ] **Step 3: 提取文件管理器相关样式到 `components/filemanager.css`**
- [ ] **Step 4: 提取终端命令栏与控制台样式到 `components/terminal.css`**

---

### Task 5: 入口整合与死样式清理
**Files:**
- Modify: `frontend/src/index.css`

- [ ] **Step 1: 重写 `frontend/src/index.css`，配置按序 @import 引入**
- [ ] **Step 2: 剔除残留的死选择器与空占位符**

---

### Task 6: 构建与基线完整性验证
- [ ] **Step 1: 执行 `pnpm build` 确认打包无语法/导入错误**
- [ ] **Step 2: 执行 `pnpm styles:check` 确认基线通过**
- [ ] **Step 3: 执行 `pnpm lint` 确认无代码检查错误**
