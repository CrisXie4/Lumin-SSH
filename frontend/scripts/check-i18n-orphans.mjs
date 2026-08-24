import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '@babel/parser';

// 扫描 zh-CN 语言包中源码零引用的孤儿键。
// 已知动态键机制：
//   1. mcp.tool.* 由 MCPAccessView.tsx 用 `mcp.tool.${tool.name}` 拼装，视为被引用；
//   2. Go 后端中文错误串会经前端 t(error.message) 翻译，因此语料必须包含 internal/ 下 .go 文件。
// 输出三类：确认孤儿 / 前缀疑似(需人工确认) / 动态键保留。

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const localeRoot = path.join(root, 'frontend', 'src', 'i18n');
const EXCLUDE_DIRS = new Set(['i18n', 'node_modules', 'dist', 'build', 'bin', '.git']);
const CODE_EXTS = new Set(['.go', '.ts', '.tsx', '.js', '.jsx', '.css', '.html']);

function extractKeys(file) {
  const source = fs.readFileSync(file, 'utf8');
  const ast = parse(source, { sourceType: 'module', plugins: ['jsx', 'typescript'] });
  const declaration = ast.program.body.find((node) => node.type === 'ExportDefaultDeclaration');
  let exportValue = declaration?.declaration;
  while (exportValue && (exportValue.type === 'TSSatisfiesExpression' || exportValue.type === 'TSAsExpression')) {
    exportValue = exportValue.expression;
  }
  if (!exportValue || exportValue.type !== 'ObjectExpression') {
    throw new Error(`${file}: default export must be an object`);
  }
  const keys = [];
  for (const property of exportValue.properties) {
    if (property.type !== 'ObjectProperty' || property.computed) continue;
    if (property.key.type === 'Identifier') keys.push(property.key.name);
    else if (property.key.type === 'StringLiteral') keys.push(property.key.value);
  }
  return keys;
}

function collectFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!EXCLUDE_DIRS.has(entry.name)) collectFiles(path.join(dir, entry.name), out);
    } else if (CODE_EXTS.has(path.extname(entry.name))) {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

// 变体：原文 / \n转真换行 / 去尾部标点 / 去全部空白；前缀单独用于"疑似"分级
function variants(key) {
  const realNewlines = key.replace(/\\n/g, '\n');
  return [
    key,
    realNewlines,
    realNewlines.replace(/[。，；,.！？:：]+$/g, ''),
    realNewlines.replace(/\s+/g, ''),
  ];
}

const zhFile = path.join(localeRoot, 'zh-CN', 'basic.ts');
const keys = extractKeys(zhFile);
let corpus = '';
for (const file of collectFiles(root)) corpus += fs.readFileSync(file, 'utf8');

const DYNAMIC_KEY_PREFIXES = [/^mcp\.tool\./];
const orphans = [];
const suspicious = [];
const dynamicKept = [];

for (const key of keys) {
  if (DYNAMIC_KEY_PREFIXES.some((re) => re.test(key))) {
    dynamicKept.push(key);
    continue;
  }
  let prefixHit = false;
  let referenced = false;
  for (const variant of variants(key)) {
    if (corpus.includes(variant)) { referenced = true; break; }
  }
  if (!referenced && key.length >= 12) {
    prefixHit = corpus.includes(key.slice(0, 12));
  }
  if (!referenced && !prefixHit) orphans.push(key);
  else if (!referenced && prefixHit) suspicious.push(key);
}

console.log(`zh-CN 键数: ${keys.length}`);
console.log(`\n[确认孤儿] ${orphans.length} 个（全变体零引用，可删）`);
orphans.forEach((k) => console.log(`  × ${k}`));
console.log(`\n[前缀疑似] ${suspicious.length} 个（长前缀命中，多为兄弟键干扰，需人工确认）`);
suspicious.forEach((k) => console.log(`  ? ${k}`));
console.log(`\n[动态键保留] ${dynamicKept.length} 个`);
dynamicKept.forEach((k) => console.log(`  √ ${k}`));
