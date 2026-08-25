import React, { useState, useRef, useEffect, useCallback } from 'react';
import { t as $t } from '../../i18n.ts';
import { Z } from '../../constants/zIndex';

/**
 * 轻量色盘 Popover 组件
 * - HSL 滑块（色相 + 饱和度/明度）
 * - Hex 输入框
 * - 当前终端背景色预览条（方便判断对比度）
 */

interface HslColor {
  h: number;
  s: number;
  l: number;
}

function hexToHsl(hex: string): HslColor {
  const clean = String(hex || '').replace('#', '');
  if (!/^[\da-fA-F]{6}$/.test(clean)) return { h: 0, s: 100, l: 50 };
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

interface ColorPickerProps {
  value: string;
  onChange?: (hex: string) => void;
  onClose?: () => void;
  terminalBg?: string;
}

const SLIDER_TRACK_CLASS = 'w-full h-3 rounded-md cursor-pointer appearance-none outline-none';

export default function ColorPicker({ value, onChange, onClose, terminalBg }: ColorPickerProps) {
  const [hsl, setHsl] = useState<HslColor>(() => hexToHsl(value));
  const [hexInput, setHexInput] = useState(value || '#ff6b6b');
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const currentHex = hslToHex(hsl.h, hsl.s, hsl.l);

  useEffect(() => {
    setHexInput(currentHex);
  }, [currentHex]);

  // 点击外部关闭
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose?.();
      }
    };
    document.addEventListener('mousedown', handler, true);
    return () => document.removeEventListener('mousedown', handler, true);
  }, [onClose]);

  const handleHexInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setHexInput(val);
    if (/^#[\da-fA-F]{6}$/.test(val)) {
      setHsl(hexToHsl(val));
      onChange?.(val);
    }
  }, [onChange]);

  const handleHueChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const h = Number(e.target.value);
    setHsl((prev) => {
      const next = { ...prev, h };
      onChange?.(hslToHex(next.h, next.s, next.l));
      return next;
    });
  }, [onChange]);

  const handleSatChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const s = Number(e.target.value);
    setHsl((prev) => {
      const next = { ...prev, s };
      onChange?.(hslToHex(next.h, next.s, next.l));
      return next;
    });
  }, [onChange]);

  const handleLightChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const l = Number(e.target.value);
    setHsl((prev) => {
      const next = { ...prev, l };
      onChange?.(hslToHex(next.h, next.s, next.l));
      return next;
    });
  }, [onChange]);

  return (
    <div
      ref={popoverRef}
      className="absolute top-full left-0 mt-1.5 bg-overlay border border-line rounded-md p-3.5 w-60 shadow-[0_8px_32px_rgba(0,0,0,0.3)]"
      style={{ zIndex: Z.SETTINGS }}
    >
      {/* 预览色块 */}
      <div className="flex items-center gap-2.5 mb-3">
        <div
          className="w-8 h-8 rounded-md border border-line shrink-0"
          style={{ background: currentHex }}
        />
        <input
          id="color-picker-hex"
          name="color-picker-hex"
          autoComplete="off"
          value={hexInput}
          onChange={handleHexInput}
          className="flex-1 bg-sunken border border-line rounded-md px-2 py-[5px] text-sm text-primary font-mono"
          spellCheck={false}
        />
      </div>

      {/* 色相滑块 */}
      <div className="mb-2.5">
        <div className="text-xs text-tertiary mb-1">{$t('色相')}</div>
        <input
          id="color-picker-hue"
          name="color-picker-hue"
          autoComplete="off"
          type="range" min="0" max="360" value={hsl.h}
          onChange={handleHueChange}
          className={SLIDER_TRACK_CLASS}
          style={{
            background: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)',
          }}
        />
      </div>

      {/* 饱和度滑块 */}
      <div className="mb-2.5">
        <div className="text-xs text-tertiary mb-1">{$t('饱和度')}</div>
        <input
          id="color-picker-saturation"
          name="color-picker-saturation"
          autoComplete="off"
          type="range" min="0" max="100" value={hsl.s}
          onChange={handleSatChange}
          className={SLIDER_TRACK_CLASS}
          style={{
            background: `linear-gradient(to right, ${hslToHex(hsl.h, 0, hsl.l)}, ${hslToHex(hsl.h, 100, hsl.l)})`,
          }}
        />
      </div>

      {/* 明度滑块 */}
      <div className="mb-3">
        <div className="text-xs text-tertiary mb-1">{$t('明度')}</div>
        <input
          id="color-picker-lightness"
          name="color-picker-lightness"
          autoComplete="off"
          type="range" min="0" max="100" value={hsl.l}
          onChange={handleLightChange}
          className={SLIDER_TRACK_CLASS}
          style={{
            background: `linear-gradient(to right, #000, ${hslToHex(hsl.h, hsl.s, 50)}, #fff)`,
          }}
        />
      </div>

      {/* 终端背景色参考条 */}
      {terminalBg && (
        <div className="mb-2.5">
          <div className="text-xs text-tertiary mb-1">{$t('终端背景参考')}</div>
          <div
            className="flex items-center gap-2 rounded-md px-2.5 py-1.5 border border-line"
            style={{ background: terminalBg }}
          >
            <span className="text-sm font-bold font-mono" style={{ color: currentHex }}>
              Error Warning Info
            </span>
          </div>
        </div>
      )}

      {/* 确认按钮 */}
      <div className="flex justify-end">
        <button
          onClick={onClose}
          className="px-3.5 py-1 text-sm rounded-md border border-line bg-raised text-primary cursor-pointer"
        >
          {$t('确定')}
        </button>
      </div>
    </div>
  );
}
