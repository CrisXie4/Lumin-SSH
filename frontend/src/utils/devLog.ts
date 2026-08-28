// 仅开发环境的诊断告警：生产构建中 import.meta.env.DEV 为常量 false，
// 分支会被折叠移除，不产生任何运行时开销。
// 用于「事件/状态被静默丢弃」这类不影响主流程、但排查时必须能看到线索的场景。
export function warnDev(...args: unknown[]): void {
  if (import.meta.env.DEV) {
    console.warn('[dev]', ...args);
  }
}
