import { useState } from 'react';
import { t as $t } from '../../../i18n.ts';
import { getGlobalAppearanceSettings, notifyGlobalAppearanceChanged } from '../../../utils/globalAppearance.ts';

type AddToast = (message: string | Error, type?: string, duration?: number, actions?: unknown[]) => number;

/** 背景图设置：全局/终端背景两块独立上传互不清除、可见度与图标透明度 */
export function useBackgroundSettings({ addToast }: { addToast: AddToast }) {
  const [termBgImage, setTermBgImage] = useState(localStorage.getItem('termBgImage') || '');
  const [termBgOpacity, setTermBgOpacity] = useState(parseFloat(localStorage.getItem('termBgOpacity') || '0.15'));
  const [globalBgImage, setGlobalBgImage] = useState(() => getGlobalAppearanceSettings().backgroundImage);
  const [globalBgOpacity, setGlobalBgOpacity] = useState(() => getGlobalAppearanceSettings().backgroundOpacity);
  const [globalIconOpacity, setGlobalIconOpacity] = useState(() => getGlobalAppearanceSettings().iconOpacity);
  // 覆盖终端：开启时全屏（含终端）都用全局背景；关闭时终端区域镂空、只显示自己的壁纸
  const [globalCoverTerminal, setGlobalCoverTerminal] = useState(() => localStorage.getItem('globalBgCoverTerminal') === '1');

  const handleBgUpload = (target: 'global' | 'terminal', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = typeof ev.target?.result === 'string' ? ev.target.result : '';
      try {
        if (target === 'global') {
          localStorage.setItem('globalBgImage', base64);
          setGlobalBgImage(base64);
          notifyGlobalAppearanceChanged();
          window.dispatchEvent(new CustomEvent('terminal-bg-changed'));
          addToast($t('全局背景已更新'), 'success');
        } else {
          localStorage.setItem('termBgImage', base64);
          setTermBgImage(base64);
          notifyGlobalAppearanceChanged();
          window.dispatchEvent(new CustomEvent('terminal-bg-changed'));
          addToast($t('终端背景已更新'), 'success');
        }
      } catch {
        addToast($t('图片过大，无法保存，请使用较小的图片'), 'error');
      }
    };
    reader.onerror = () => addToast($t('读取图片失败'), 'error');
    reader.readAsDataURL(file);
  };

  const handleBgReset = (target: 'global' | 'terminal') => {
    if (target === 'global') {
      localStorage.removeItem('globalBgImage');
      setGlobalBgImage('');
      notifyGlobalAppearanceChanged();
      window.dispatchEvent(new CustomEvent('terminal-bg-changed'));
      addToast($t('已恢复默认全局背景'), 'success');
    } else {
      localStorage.removeItem('termBgImage');
      setTermBgImage('');
      window.dispatchEvent(new CustomEvent('terminal-bg-changed'));
      addToast($t('已恢复默认终端背景'), 'success');
    }
  };

  const handleBgOpacityChange = (target: 'global' | 'terminal', e: React.ChangeEvent<HTMLInputElement>) => {
    if (target === 'global') {
      const value = Math.min(0.5, Math.max(0, Number.parseFloat(e.target.value) || 0));
      localStorage.setItem('globalBgOpacity', String(value));
      setGlobalBgOpacity(value);
      notifyGlobalAppearanceChanged();
    } else {
      const val = Math.min(1, Math.max(0, Number.parseFloat(e.target.value) || 0));
      localStorage.setItem('termBgOpacity', String(val));
      setTermBgOpacity(val);
      window.dispatchEvent(new CustomEvent('terminal-bg-changed'));
    }
  };

  const handleGlobalIconOpacityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Math.min(1, Math.max(0.4, Number.parseFloat(e.target.value) || 1));
    localStorage.setItem('globalIconOpacity', String(value));
    setGlobalIconOpacity(value);
    notifyGlobalAppearanceChanged();
  };

  const handleGlobalCoverTerminalChange = () => {
    const next = !globalCoverTerminal;
    localStorage.setItem('globalBgCoverTerminal', next ? '1' : '0');
    setGlobalCoverTerminal(next);
    // 重新应用全局外观（决定是否镂空终端），并刷新终端背景层
    notifyGlobalAppearanceChanged();
    window.dispatchEvent(new CustomEvent('terminal-bg-changed'));
  };

  return {
    termBgImage,
    termBgOpacity,
    globalBgImage,
    globalBgOpacity,
    globalIconOpacity,
    globalCoverTerminal,
    handleBgUpload,
    handleBgReset,
    handleBgOpacityChange,
    handleGlobalIconOpacityChange,
    handleGlobalCoverTerminalChange,
  };
}
