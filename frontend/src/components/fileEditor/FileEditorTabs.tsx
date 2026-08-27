import { X } from 'lucide-react';
import { cn } from '../../utils/cn.ts';
import type { FileEditorFile } from './fileEditorTypes.ts';

export interface FileEditorTabsProps {
  files: FileEditorFile[];
  activeFile?: FileEditorFile;
  editedContents: Record<string, string>;
  onActivate: (path: string) => void;
  closeFileWithConfirm: (path: string) => Promise<void>;
}

export function FileEditorTabs({
  files,
  activeFile,
  editedContents,
  onActivate,
  closeFileWithConfirm,
}: FileEditorTabsProps) {
  if (files.length <= 1) return null;

  return (
    <div className="terminal-sub-tab-bar file-editor-tab-bar">
      <div className="terminal-sub-tab-scroll">
        {files.map((f) => {
          const isActive = f.path === activeFile?.path;
          const fEdited = editedContents[f.path];
          const fModified = fEdited !== undefined && fEdited !== f.content;
          return (
            <div
              key={f.path}
              className={cn('terminal-sub-tab font-mono', isActive && 'active')}
              onClick={() => onActivate(f.path)}
              title={f.path}
            >
              {fModified && (
                <span className="w-1.5 h-1.5 rounded-full bg-warning shrink-0" />
              )}
              <span className="truncate max-w-[180px]">{f.name}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void closeFileWithConfirm(f.path);
                }}
                className="terminal-sub-tab-close p-0.5 border-0 bg-transparent"
                title="关闭"
                aria-label="关闭"
              >
                <X size={11} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
