# index.css 模块化重构与瘦身设计规范 (Design Spec)

## 1. 背景与目标
当前前端项目的 `src/index.css` 包含超过 6100 行样式，包含了 Tailwind v4 主题、深浅色设计 Token、CSS 动画 Keyframes、业务组件样式、第三方组件覆盖等，是一个巨大的单文件单体（Monolith）。

**目标**：
1. **彻底消除单文件 6000 行单体**：将 `index.css` 按清晰的职责领域（Token、Base、Animations、Vendor、Components）拆分到 `src/styles/` 模块化目录中。
2. **剔除确认的废弃/死样式与未引用 Keyframes**：减少 CSS 体积，消除冗余代码。
3. **零视觉与交互回归**：严格保证样式层级、优先级和选择器完整性，确保前端构建、样式检查（`pnpm styles:check`）、Lint（`oxlint`）及所有页面渲染完全一致。

---

## 2. 架构与目录规划

将在 `src/styles/` 下建立清晰的分层结构：

```
frontend/src/
├── styles/
│   ├── tokens.css              # Tailwind @theme 映射、@custom-variant、深色/浅色 CSS 变量 (480 行)
│   ├── base.css                # Reset、全局焦点环、滚动条、窗口拖拽区、应用根布局 (60 行)
│   ├── animations.css          # AI 模块动效、Toast、Modal、骨架屏 Keyframes (850 行)
│   ├── vendor/
│   │   ├── codemirror.css      # CodeMirror 6 高亮、对话框、面板覆盖
│   │   └── xterm.css           # xterm.js 搜索高亮、终端光标与容器默认变量
│   └── components/
│       ├── common.css          # 模态框、提示条、分割线、Toggle、徽标、分屏分割线
│       ├── topbar.css          # 顶栏导航、Logo、操作按钮、系统窗口控制
│       ├── tabs.css            # 会话标签栏、SVG 外凹反弧圆角、标签状态
│       ├── subtabs.css         # 终端子标签栏、进程/网络抽屉标签
│       ├── dashboard.css       # 服务器卡片、主机网格、编辑表单、状态数据网格、批量操作条
│       ├── probe.css           # 探针面板、仪表盘指标、CPU/内存/磁盘图表、进程列表
│       ├── filemanager.css     # 文件列表、面包屑、传输进度、覆盖层、WebDAV
│       └── terminal.css        # 快捷命令条、搜索框、底部输入栏、主题预设卡片
└── index.css                   # 入口文件（仅包含 layer 声明与 @import，约 25 行）
```

---

## 3. 入口 `src/index.css` 声明顺序

```css
@layer theme, base, components, utilities;
@import "tailwindcss/theme.css" layer(theme);
@import "tailwindcss/utilities.css" layer(utilities);

@import "./styles/tokens.css";
@import "./styles/base.css";
@import "./styles/animations.css";
@import "./styles/vendor/codemirror.css";
@import "./styles/vendor/xterm.css";
@import "./styles/components/common.css";
@import "./styles/components/topbar.css";
@import "./styles/components/tabs.css";
@import "./styles/components/subtabs.css";
@import "./styles/components/dashboard.css";
@import "./styles/components/probe.css";
@import "./styles/components/filemanager.css";
@import "./styles/components/terminal.css";
```

---

## 4. 死代码清理清单
- 清理已确认无 TSX 引用、无 CSS 继承关系的孤立选择器（如 `.update-entry-button`, `.w3`, `.modal-lg`, `.topbar-home-btn` 等）。
- 清理未使用的 `@keyframes`（如 `slideUpFade`, `ai-chat-stream-char-enter`, `updateBubbleAttention`, `updateBubblePulse`）。
- 清理遗留的空规则占位符。

---

## 5. 验证标准
1. **构建验证**：`pnpm build` 成功完成且无 CSS 语法警告。
2. **代码规范**：`pnpm lint`（oxlint）0 错误 0 警告。
3. **样式基准检查**：`pnpm styles:check` 检查通过，不突破 baseline 限制。
4. **功能与视觉对齐**：深浅色主题切换正常、标签栏反弧曲线平滑对齐、文件管理器与监控探针正常呈现。
