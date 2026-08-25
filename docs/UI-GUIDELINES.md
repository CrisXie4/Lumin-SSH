# Lumin SSH PC — UI 样式规范

> 适用于 `pc/frontend/src`。目标：消灭"各模块拼装感"，所有新 UI 一律遵循本文。
> 技术栈：React 19 + Tailwind v4（CSS-first）+ 设计 token（`src/index.css`）。

## 核心原则

1. **样式只写 Tailwind 工具类**，语义色/字号/圆角全部走 token 映射，禁止内联 hex、数字字号、zIndex 魔数（`npm run styles:check` 强制）。
2. **基础控件一律用 `src/components/ui/`**：Button / Modal / EmptyState / ContextMenu / MenuList / MenuPanel / Card。禁止手搓 overlay、下拉、空状态、右键菜单。
3. **动态值才允许内联 `style`**：运行时计算的坐标/尺寸/颜色（如 `translate(${x}px)`、进度 `%`、状态调色板）。
4. **深浅主题自动生效**：工具类底层引用 CSS 变量（`bg-raised` → `var(--surface-raised)`），不要写死深色值。确需主题分支用 `light:` 前缀。

## token → 工具类速查

| 语义 | 工具类 |
|---|---|
| 表面 | `bg-canvas` `bg-raised` `bg-overlay` `bg-sunken` `bg-hover` `bg-active` |
| 文本 | `text-primary` `text-secondary` `text-tertiary` `text-muted` |
| 边框 | `border-line` `border-line-subtle` `border-line-light` `border-focus` |
| 强调/语义 | `accent` `success` `danger` `warning` `info`（+ `-dim` `-hover` `-border` 变体，支持 `/透明度`） |
| 字号 | `text-xs`=11 `text-sm`=12 `text-base`=13 `text-md`=14 `text-lg`=15 `text-xl`=17 `text-2xl`=20 `text-3xl`=22 |
| 圆角 | `rounded-xs`=3 `sm`=5 `md`=7 `lg`=10 `xl`=12 `full` |
| 阴影 | `shadow-xs` ~ `shadow-xl` |
| 间距 | 4px 基准：`p-1`=4 `p-1.5`=6 `p-2`=8 `p-2.5`=10 `p-3`=12 … |
| 动画 | 全局 keyframes：`fadeIn` `slideUp` `spin` + `ai-*`/`toast*` 系列，用 `animate-[name_0.12s_ease]` 引用 |

无 token 的运行时变量用任意值：`bg-[var(--term-container-bg)]`、`text-[var(--probe-label)]`。

## 组件用法

```tsx
import { Button, Modal, EmptyState, ContextMenu } from './ui';
import { cn } from '../utils/cn';

// 按钮：variant × size，aria-pressed 自动激活态
<Button variant="primary" size="sm" onClick={...}>保存</Button>
<Button variant="ghost" size="icon" aria-pressed={open}><X size={14}/></Button>

// 条件类：一律 cn()（tailwind-merge，后者覆盖前者）
<div className={cn('px-2 py-1 rounded-sm', active && 'bg-active text-primary')} />

// 模态框：自带遮罩/Escape/关闭按钮
<Modal open={open} onClose={close} title={t('标题')} footer={<Button.../>}>…</Modal>

// 右键菜单：自动 clamp、键盘导航
<ContextMenu x={e.clientX} y={e.clientY} onClose={close}
  items={[{ label, icon, danger?, disabled?, shortcut?, onSelect }, 'separator', { type: 'header', label }]} />
```

## 禁止事项（styles:check 会拦截新增）

- ❌ tsx 内联 hex 颜色 → 用语义类或 `bg-[rgba(var(--danger-rgb),0.35)]`
- ❌ `fontSize: 12` 数字字号 → `text-sm`
- ❌ `zIndex: 1000` 魔数 → `constants/zIndex.ts` 的 `Z.*`
- ❌ `onMouseEnter/Leave` 改 style 模拟 hover → `hover:` 工具类
- ❌ 组件内 `<style>` 注入 → keyframes 统一放 `index.css` 动画区
- ❌ 新旧混用：给带 `.btn` 等旧 class 的元素叠工具类去覆盖同名属性（未分层旧 class 永远赢）——迁移即整体替换

## 层级与级联须知

- `index.css` 存量 class 规则**未分层**，优先级高于 utilities 层；元素级 reset 在 `@layer base`，可被工具类覆盖。
- 与保留的系统类（`.data-page*`、`.server-card`、`.term-*`、`.tab-*`、`.tiptop` 等）冲突的属性，保留内联 style 并加注释说明。

## 迁移存量时的对照

| 旧写法 | 新写法 |
|---|---|
| `.btn btn-primary btn-sm` | `<Button variant="primary" size="sm">` |
| `.modal-overlay` + `.modal modal-md` | `<Modal size="md">` |
| `.empty-state` 三件套 | `<EmptyState icon text action />` |
| 手写 context menu + clampMenuPosition | `<ContextMenu items onClose />` |
| `getThemeComponentTheme('xxx')` 私有主题对象 | 直接用语义工具类（其值本就是 token 的复制） |

## 检查命令

```bash
npm run styles:check    # 违规检查（超出基线即失败）
npm run styles:baseline # 修复存量后下调基线
npm run i18n:check      # 翻译键完整性
npm run build           # 构建验证
```
