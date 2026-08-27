import React from 'react';
import { RotateCcw } from 'lucide-react';
import { t as $t } from '../../../i18n.ts';
import { Button } from '../../ui';
import { Switch } from '../../ui/Switch';
import { SettingsDivider } from '../SharedComponents';

export interface BackgroundPanelProps {
  termBgImage: string;
  globalBgImage: string;
  globalCoverTerminal: boolean;
  onGlobalCoverTerminalChange: () => void;
  onBgUpload: (target: 'global' | 'terminal', e: React.ChangeEvent<HTMLInputElement>) => void;
  onBgReset: (target: 'global' | 'terminal') => void;
  termBgOpacity: number;
  globalBgOpacity: number;
  onBgOpacityChange: (target: 'global' | 'terminal', e: React.ChangeEvent<HTMLInputElement>) => void;
  globalIconOpacity: number;
  onGlobalIconOpacityChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

function OpacityRow({ label, value, min, max, step, defaultValue, onChange }: {
  label: string;
  value: number;
  min: string;
  max: string;
  step: string;
  /** 出厂默认值：偏离时显示一键重置徽标 */
  defaultValue?: number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  const deviates = defaultValue !== undefined && Math.round(value * 100) !== Math.round(defaultValue * 100);
  return (
    <div className="flex justify-between items-center">
      <div className="text-base text-primary">{label}</div>
      <div className="flex items-center gap-3">
        <input type="range" min={min} max={max} step={step} value={value} onChange={onChange} />
        <span className="text-base w-8 text-right text-primary">{Math.round(value * 100)}%</span>
        {deviates ? (
          <button
            type="button"
            title={$t('恢复默认') + ` ${Math.round(defaultValue * 100)}%`}
            aria-label={`${label} ${$t('恢复默认')} ${Math.round(defaultValue * 100)}%`}
            onClick={() => onChange({ target: { value: String(defaultValue) } } as React.ChangeEvent<HTMLInputElement>)}
            className="w-5 h-5 inline-flex items-center justify-center rounded-[var(--radius-sm)] border border-accent-border bg-accent-dim text-accent hover:bg-hover cursor-pointer transition-colors duration-[80ms] shrink-0"
          >
            <RotateCcw size={10} strokeWidth={2.5} />
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** 全局背景与终端背景两块并列展示，各自上传互不清除；「覆盖终端」开关决定终端显示哪张 */
export default function BackgroundPanel({
  termBgImage,
  globalBgImage,
  globalCoverTerminal,
  onGlobalCoverTerminalChange,
  onBgUpload,
  onBgReset,
  termBgOpacity,
  globalBgOpacity,
  onBgOpacityChange,
  globalIconOpacity,
  onGlobalIconOpacityChange,
}: BackgroundPanelProps) {
  const renderHeader = (target: 'global' | 'terminal', hasImage: boolean, title: string, desc: string, extra?: React.ReactNode) => (
      <div className="flex items-center gap-3 flex-1 min-w-0">
      <div className="min-w-0 flex-1">
        <div className="text-base text-primary">{title}</div>
        <div className="text-xs text-tertiary">{desc}</div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {extra}
        {hasImage && (
          <Button size="sm" onClick={() => onBgReset(target)}>{$t('恢复默认')}</Button>
        )}
        <label htmlFor={`appearance-bg-upload-${target}`} className="inline-flex items-center justify-center gap-1 min-h-6 py-[3px] px-[7px] rounded-sm text-sm font-medium leading-none whitespace-nowrap border select-none cursor-pointer outline-none transition-colors duration-[80ms] bg-raised text-secondary border-line hover:bg-hover hover:text-primary hover:border-focus active:bg-active">
          {$t('上传图片')}
          <input id={`appearance-bg-upload-${target}`} type="file" accept="image/*" className="hidden" onChange={(e) => onBgUpload(target, e)} />
        </label>
      </div>
    </div>
  );

  return (
    <>
      {/* ── 终端背景 ── */}
      {renderHeader('terminal', Boolean(termBgImage), $t('终端背景'), $t('设置终端显示区域的背景图片'))}
      <SettingsDivider />
      <OpacityRow label={$t('终端背景可见度')} value={termBgOpacity} min="0" max="1" step="0.05" defaultValue={0.15} onChange={(e) => onBgOpacityChange('terminal', e)} />
      <SettingsDivider />

      {/* ── 全局背景 ── */}
      {renderHeader(
        'global',
        Boolean(globalBgImage),
        $t('全局背景'),
        $t('作用于整个应用界面；开启覆盖终端后也应用于终端'),
        globalBgImage ? (
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-sm text-secondary">{$t('覆盖终端')}</span>
            <Switch checked={globalCoverTerminal} onChange={onGlobalCoverTerminalChange} size="sm" />
          </label>
        ) : undefined,
      )}
      <SettingsDivider />
      <OpacityRow label={$t('全局背景可见度')} value={globalBgOpacity} min="0" max="0.5" step="0.02" defaultValue={0.12} onChange={(e) => onBgOpacityChange('global', e)} />
      <SettingsDivider />
      <OpacityRow label={$t('图标透明度')} value={globalIconOpacity} min="0.4" max="1" step="0.05" defaultValue={1} onChange={onGlobalIconOpacityChange} />
    </>
  );
}
