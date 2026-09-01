// check-overlay-lock.mjs — 校验所有 createPortal 弹层已接入 useOverlayScrollLock
//
// 背景：Linux WebKitGTK 会把滚动条（::-webkit-scrollbar 自绘 thumb 与原生 overlay
// indicator）绘制为独立合成层，盖过 position:fixed 弹层（#299）。portal 到 body 的
// 交互弹层必须调用 useOverlayScrollLock(open) 锁定背景滚动，否则滚动后立即打开弹层
// 时背景 thumb 会穿透到弹层上（GlobalContextMenu 曾遗漏，见 fix 分支记录）。
//
// 规则：src/**/*.tsx 中出现 createPortal 的文件必须出现 useOverlayScrollLock，
// 否则需在下方 EXEMPT 清单登记并写明原因（portal 内容为已加锁组件 / 非模态瞬时提示等）。
//
// 用法：node scripts/check-overlay-lock.mjs（已挂 npm run overlay:check）

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcRoot = path.join(root, 'src');

/** 豁免清单：portal 内容本身已加锁，或为非模态瞬时提示，无需重复接锁 */
const EXEMPT = new Map([
  // portal 内容为 ui/ContextMenu，其内部已调用 useOverlayScrollLock(true)
  ['components/QuickCommands.tsx', 'portal 内容为已加锁的 ui/ContextMenu'],
  ['components/filemanager/FileManagerOverlays.tsx', 'portal 内容为已加锁的 ui/ContextMenu；拖拽提示为瞬时非交互'],
  // 主体为 ui/Modal（已加锁），portal 的历史下拉是 Modal 内二级浮层，背景已被 Modal 锁定
  ['components/terminal/TerminalQuickCmdConfirm.tsx', '主体 ui/Modal 已加锁，portal 为 Modal 内二级下拉'],
  // tooltip 为非模态悬浮提示，锁定背景滚动会破坏 hover 浏览体验；穿透窗口仅滚动后 ~1s
  ['components/Tiptop.tsx', 'tooltip 非模态瞬时提示，不锁背景滚动'],
]);

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir).sort()) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else if (name.endsWith('.tsx')) out.push(full);
  }
  return out;
}

const violations = [];
const report = [];
for (const file of walk(srcRoot)) {
  const rel = path.relative(srcRoot, file).split(path.sep).join('/');
  const source = fs.readFileSync(file, 'utf8');
  if (!source.includes('createPortal')) continue;
  if (source.includes('useOverlayScrollLock')) {
    report.push(`ok: ${rel}`);
    continue;
  }
  const reason = EXEMPT.get(rel);
  if (reason) {
    report.push(`exempt: ${rel} — ${reason}`);
  } else {
    violations.push(rel);
  }
}

for (const line of report) console.log(line);
if (violations.length > 0) {
  console.error('\n[check-overlay-lock] 以下文件使用 createPortal 但未接入 useOverlayScrollLock：');
  for (const rel of violations) console.error(`  - ${rel}`);
  console.error('portal 到 body 的交互弹层须调用 useOverlayScrollLock(open)（Linux WebKitGTK 滚动条穿透，见 hooks/useOverlayScrollLock.ts）；');
  console.error('若确属无需加锁（内容已加锁/非模态瞬时提示），请在 scripts/check-overlay-lock.mjs 的 EXEMPT 登记原因。');
  process.exit(1);
}
console.log(`\n[check-overlay-lock] ${report.length} 个 portal 弹层全部合规（含 ${[...EXEMPT.keys()].length} 个豁免登记）`);
