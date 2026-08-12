// 快捷命令动态参数工具
// 统一 Terminal.jsx / QuickCommands.jsx 的 [p#N 参数名] 占位符解析与填充

// [p#1 IP地址] → num=1, label='IP地址'；参数名可省略
const PARAM_RE = /\[p#(\d)(?:\s+([^\]]*))?\]/g;

export interface QuickCommandParam {
  num: number;
  label: string;
}

/**
 * 提取命令里的动态参数占位符，按编号升序去重。
 * 同一编号多次出现时保留第一个非空参数名，便于 [p#1 IP地址] ... [p#1] 复用同一值。
 * @param command - 命令字符串
 * @returns 参数列表，按 num 升序
 */
export function extractQuickCommandParams(command: string): QuickCommandParam[] {
  const map = new Map<number, string>(); // num -> label
  const re = new RegExp(PARAM_RE.source, 'g'); // 每次新建，避免共享 lastIndex
  let m: RegExpExecArray | null;
  while ((m = re.exec(String(command ?? ''))) !== null) {
    const num = Number(m[1]);
    const label = (m[2] || '').trim();
    // 保留已有参数名，不被后续同编号的空名覆盖
    if (!map.has(num) || label) map.set(num, label);
  }
  return [...map.entries()]
    .map(([num, label]) => ({ num, label }))
    .sort((a, b) => a.num - b.num);
}

/**
 * 用参数值替换命令里的占位符，未填的参数替换为空串。
 * @param command - 命令字符串
 * @param values - 参数值，键为参数编号
 * @returns 替换后的命令
 */
export function fillQuickCommandParams(command: string, values: Record<number, string>): string {
  const re = new RegExp(PARAM_RE.source, 'g');
  return String(command ?? '').replace(re, (_m, n) => (values?.[Number(n)] ?? ''));
}
