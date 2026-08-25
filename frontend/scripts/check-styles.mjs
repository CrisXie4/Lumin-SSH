#!/usr/bin/env node
// UI 样式防回归检查：tsx 中禁止新增 内联 hex 颜色 / 数字字号 / zIndex 魔数。
// 基线机制：存量违规记录在 scripts/style-baseline.json，超出基线即失败；
// 修复存量后运行 `npm run styles:baseline` 下调基线。
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'src');
const baselinePath = join(root, 'scripts', 'style-baseline.json');

const RULES = {
  hexColor: { re: /['"`]#[0-9a-fA-F]{3,8}\b['"`]/g, hint: '内联 hex 颜色，改用语义工具类（text-primary/bg-raised…）或任意值 bg-[var(--xxx)]' },
  numericFontSize: { re: /fontSize:\s*(\d+(?:\.\d+)?)\b/g, hint: '数字字号，11/12/13/14/15 用 text-xs/sm/base/md/lg，其余 text-[Npx]' },
  magicZIndex: { re: /zIndex:\s*(\d{3,})\b/g, hint: 'zIndex 魔数，改用 constants/zIndex.ts 的 Z 常量' },
};

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(tsx)$/.test(name)) out.push(p);
  }
  return out;
}

const files = walk(srcDir);
const violations = {};
let total = 0;

for (const file of files) {
  const rel = file.slice(root.length + 1).replace(/\\/g, '/');
  const code = readFileSync(file, 'utf-8');
  for (const [rule, { re }] of Object.entries(RULES)) {
    const matches = code.match(re) ?? [];
    if (matches.length > 0) {
      violations[rule] ??= {};
      violations[rule][rel] = matches.length;
      total += matches.length;
    }
  }
}

const baseline = existsSync(baselinePath)
  ? JSON.parse(readFileSync(baselinePath, 'utf-8'))
  : Object.fromEntries(Object.keys(RULES).map((k) => [k, Infinity]));

let failed = false;
const baselineTotal = Object.values(baseline).reduce((a, b) => a + b, 0);

for (const rule of Object.keys(RULES)) {
  const current = Object.values(violations[rule] ?? {}).reduce((a, b) => a + b, 0);
  const base = baseline[rule] ?? 0;
  const mark = current > base ? 'FAIL' : current < base ? 'IMPROVED' : 'OK';
  if (mark === 'FAIL') failed = true;
  console.log(`[${mark}] ${rule}: current=${current} baseline=${base}`);
}

const forceBaseline = process.argv.includes('--baseline');

if (failed && !forceBaseline) {
  console.error('\n新增违规明细（文件: 数量）:');
  for (const [rule, byFile] of Object.entries(violations)) {
    for (const [file, count] of Object.entries(byFile)) {
      console.error(`  ${rule} ${file}: ${count}  ${RULES[rule].hint}`);
    }
  }
  process.exit(1);
}

if (forceBaseline || total < baselineTotal) {
  writeFileSync(baselinePath, JSON.stringify(
    Object.fromEntries(Object.keys(RULES).map((k) => [k, Object.values(violations[k] ?? {}).reduce((a, b) => a + b, 0)])),
    null, 2,
  ) + '\n');
  console.log(`\n基线已写入 scripts/style-baseline.json（当前总量 ${total}）`);
} else {
  console.log(`\n通过：未超过基线（总量 ${total}/${baselineTotal}）`);
}
