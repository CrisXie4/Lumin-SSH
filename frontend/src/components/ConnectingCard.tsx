import { Monitor, Radio, Loader2 } from 'lucide-react';
import { Z } from '../constants/zIndex';
import type { ConnectingServer } from '../hooks/useSessionConnections.ts';

interface ConnectingCardProps {
  connectingServer: ConnectingServer | null;
  t: (key: string, vars?: Record<string, unknown>) => string;
  onCancel: () => void;
}

export default function ConnectingCard({ connectingServer, t, onCancel }: ConnectingCardProps) {
  if (!connectingServer) return null;
  const server = connectingServer.server;
  const host = server.host;
  const port = server.port || 22;
  const isPostAuthSlow = connectingServer.status === 'post-auth-slow';
  const message = connectingServer.message || t('正在建立 SSH 连接，请稍候...');

  return (
    <div
      className="absolute inset-0 flex items-center justify-center bg-black/[0.42]"
      style={{ zIndex: Z.FULLSCREEN_OVERLAY }}
    >
      <div className="w-[380px] rounded-[16px] overflow-hidden bg-overlay border border-line shadow-xl pt-5 px-6 pb-[22px]">
        {/* 标题行：图标 + 名称 + 按钮 */}
        <div className="flex items-start gap-3.5 mb-[18px]">
          <div className="w-[42px] h-[42px] rounded-[10px] shrink-0 bg-[rgba(var(--danger-rgb),0.85)] flex items-center justify-center">
            <Monitor size={22} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-lg font-bold text-primary mb-[3px]">
              {server.name || server.host}
            </div>
            <div className="text-sm text-success font-mono">
              {t('SSH')} {host}:{port || 22}
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              className="px-3.5 py-[5px] text-sm rounded-lg cursor-pointer bg-sunken hover:bg-hover border border-line text-secondary transition-colors duration-100"
              onClick={onCancel}
            >
              {t('取消')}
            </button>
          </div>
        </div>

        {/* 双进度条 */}
        <div className="flex items-center gap-2.5 mb-3.5">
          <div className="w-2.5 h-2.5 rounded-full bg-success shrink-0" />
          <div className="flex-1 h-1 rounded-sm bg-[var(--border-subtle)] overflow-hidden">
            <div
              className="h-full rounded-sm bg-success"
              style={{ animation: 'ssh-progress-indeterminate 1.4s ease-in-out infinite' }}
            />
          </div>
          <div className="shrink-0 text-md text-success"><Radio size={14} /></div>
          <div className="flex-1 h-1 rounded-sm bg-[var(--border-subtle)] overflow-hidden">
            <div
              className="h-full rounded-sm bg-success"
              style={{ animation: 'ssh-progress-indeterminate 1.4s ease-in-out 0.4s infinite' }}
            />
          </div>
          <div className="flex-none text-md text-muted"><Loader2 size={14} style={{ animation: 'spin 1.2s linear infinite' }} /></div>
        </div>

        {/* 提示文字 */}
        <div className={`text-sm flex items-start gap-1.5 leading-normal ${isPostAuthSlow ? 'text-warning' : 'text-secondary'}`}>
          <span className="inline-flex items-center mt-0.5" style={{ animation: 'spin 1.5s linear infinite' }}><Loader2 size={14} /></span>
          <span>
            {message}
            {isPostAuthSlow && (
              <span className="block text-muted mt-1">
                {t('仍在继续等待，总等待时间达到 30 秒后会自动断开。')}
              </span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
