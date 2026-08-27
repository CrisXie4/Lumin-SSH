import { Check, X } from 'lucide-react';
import type React from 'react';
import type { config } from '../../../wailsjs/go/models.ts';
import type { ServerPingResult } from '../../hooks/useServerPing.ts';
import { useTranslation } from '../../i18n.ts';
import { cn } from '../../utils/cn.ts';
import { Button } from '../ui';
import { getOSInfo, LATENCY_CLASS } from './serverIcons.tsx';

export interface ServerTableItemProps {
  server: config.Connection;
  flatIdx: number;
  pingEnabled: boolean;
  pings: Record<string, ServerPingResult>;
  connectedSessionMap: Map<string, { id?: string; serverId?: string; status?: string; osInfo?: unknown; [key: string]: unknown }>;
  isActive: (server: config.Connection) => boolean | undefined;
  hasSession: (server: config.Connection) => boolean;
  getSaveFlowTokens: (server: config.Connection) => { rowToken: unknown; nameToken: unknown; hostToken: unknown; usernameToken?: unknown };
  selectedSet: Set<string>;
  selectionMode: boolean;
  handleShiftClick: (server: config.Connection, flatIdx: number) => void;
  handleServerClick: (server: config.Connection, flatIdx: number) => void;
  tryConnect: (server: config.Connection) => void;
  pointerSelectHandlers: Record<string, unknown>;
  handleContextMenu: (e: React.MouseEvent, server: config.Connection) => void;
  onSelectChange: (id: string) => void;
  hideSensitive: boolean;
  mask: (text: string) => string;
  triggerEdit: (server: config.Connection, root: HTMLElement | null) => void;
}

export function ServerTableItem({
  server,
  flatIdx,
  pingEnabled,
  pings,
  connectedSessionMap,
  isActive,
  hasSession,
  getSaveFlowTokens,
  selectedSet,
  selectionMode,
  handleShiftClick,
  handleServerClick,
  tryConnect,
  pointerSelectHandlers,
  handleContextMenu,
  onSelectChange,
  hideSensitive,
  mask,
  triggerEdit,
}: ServerTableItemProps) {
  const { t } = useTranslation();
  const ping = pingEnabled ? pings[server.id] : undefined;
  const latClass = ping ? LATENCY_CLASS(ping.latency) : 'offline';
  const active = isActive(server);
  const connected = hasSession(server);
  const sessionForServer = connectedSessionMap.get(server.id);
  const osInfo = getOSInfo(server.name, server.os, (sessionForServer?.osInfo as Record<string, unknown> | null | undefined) || null);
  const { rowToken, nameToken, hostToken, usernameToken } = getSaveFlowTokens(server);
  const isChecked = selectedSet.has(server.id);

  const handleTableRowClick = (e: React.MouseEvent) => {
    if (selectionMode) {
      e.stopPropagation();
      if (e.shiftKey) {
        handleShiftClick(server, flatIdx);
      } else {
        handleServerClick(server, flatIdx);
      }
      return;
    }
    tryConnect(server);
  };

  return (
    <tr
      key={`${server.id}-${rowToken || 'stable'}`}
      data-server-update-id={server.id}
      className={cn('server-table-row', active && 'active', Boolean(rowToken) && 'save-flow-hit', selectionMode && isChecked && 'selected')}
      {...pointerSelectHandlers}
      onClick={handleTableRowClick}
      onContextMenu={(e) => handleContextMenu(e, server)}
    >
      {selectionMode && (
        <td className="w-9 px-2 py-1">
          <div
            className={cn('custom-checkbox', isChecked && 'checked')}
            onClick={(e) => {
              e.stopPropagation();
              onSelectChange(server.id);
            }}
          >
            {isChecked && (
              <Check size={10} strokeWidth={4} />
            )}
          </div>
        </td>
      )}
      <td>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5" style={{ color: osInfo.accent }}>{osInfo.icon}</div>
          <span className="text-sm text-tertiary">{osInfo.label}</span>
        </div>
      </td>
      <td data-edit-source-field="name" className="font-medium text-primary">
        <span key={`name-${nameToken || 'stable'}`} className={cn('save-flow-target', Boolean(nameToken) && 'save-flow-target-active')}>
          {server.name || server.host}
        </span>
        {connected && <span className="ml-1.5 text-[10px] text-success py-0.5 px-1.5 bg-success-dim rounded-full">{t('已连接')}</span>}
      </td>
      <td data-edit-source-field="hostPort" className="text-base text-secondary font-mono">
        <span key={`host-${hostToken || 'stable'}`} className={cn('save-flow-target', Boolean(hostToken) && 'save-flow-target-active')}>
          {hideSensitive ? mask(server.host) : `${server.host}:${server.port || 22}`}
        </span>
      </td>
      <td data-edit-source-field="username" className="text-secondary">
        <span key={`username-${usernameToken || 'stable'}`} className={cn('save-flow-target', Boolean(usernameToken) && 'save-flow-target-active')}>
          {hideSensitive ? mask(server.username) : server.username}
        </span>
      </td>
      <td>
        {ping?.online && ping?.latency !== undefined && ping?.latency !== null ? (
          <span className={cn(
            'inline-flex items-center gap-1.5 rounded-full py-[2px] pl-[7px] pr-[9px] text-xs font-medium',
            latClass === 'good' ? 'bg-success-dim text-success' : (latClass === 'warn' ? 'bg-warning-dim text-warning' : 'bg-danger-dim text-danger'),
          )}>
            <span className="w-[7px] h-[7px] rounded-full bg-current" />
            <span className="font-mono">
              {ping.latency === -1 ? t('<1毫秒') : `${ping.latency}${t('毫秒')}`}
            </span>
          </span>
        ) : (
          ping !== undefined && !ping?.online ? (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-[2px] text-xs font-medium bg-danger-dim text-danger">
              <X size={11} strokeWidth={3} />
              {t('离线')}
            </span>
          ) : <span className="text-tertiary">-</span>
        )}
      </td>
      <td>
        <Button
          variant="ghost"
          size="sm"
          className="px-2 py-1"
          onClick={(e) => {
            e.stopPropagation();
            triggerEdit(server, e.currentTarget.closest('.server-table-row'));
          }}
        >
          {t('编辑')}
        </Button>
      </td>
    </tr>
  );
}
