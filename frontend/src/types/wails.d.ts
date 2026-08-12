/**
 * Wails 桥接全局对象类型声明
 *
 * 类型全部复用 Wails 自动生成的声明文件：
 *   - wailsjs/go/wailsapp/*.d.ts    （Go 方法绑定）
 *   - wailsjs/go/models.ts          （Go 结构体模型）
 * 迁移期不重新生成、不手改，仅在此处聚合声明。
 *
 * 注意：window.go 声明为必选（非 optional），以兼容现有代码中
 * `window.go.wailsapp.App.xxx()` 的直接调用方式；纯浏览器 dev
 * 场景（无 wails 环境）由代码中的可选链守卫（window.go?.）处理。
 */
import type * as App from '../../wailsjs/go/wailsapp/App';
import type * as AIBindings from '../../wailsjs/go/wailsapp/AIBindings';
import type * as AIProviderBindings from '../../wailsjs/go/wailsapp/AIProviderBindings';

declare global {
  interface Window {
    go: {
      wailsapp: {
        App: typeof App;
        AIBindings: typeof AIBindings;
        AIProviderBindings: typeof AIProviderBindings;
      };
    };
    /** wails runtime 全局（部分场景直接挂在 window 上） */
    runtime?: {
      BrowserOpenURL?: (url: string) => void;
      [key: string]: unknown;
    };
    /** 文件管理器/编辑器状态注入（App 调用处桥接，AI 上下文快照读取） */
    __luminEditorStates?: Record<string, { openFilePaths?: unknown; activeFilePath?: unknown }>;
    __luminFileManagerPaths?: Record<string, unknown>;
  }
}

export {};
