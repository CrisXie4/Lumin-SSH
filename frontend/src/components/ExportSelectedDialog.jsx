import { useState, useEffect } from 'react';
import { Database, Download, Eye, EyeOff, X } from 'lucide-react';
import { useTranslation } from '../i18n.js';
import { Z } from '../constants/zIndex';

/**
 * 导出已选择节点弹窗。
 *
 * props:
 *   onClose          关闭回调
 *   onExport(opts)   导出回调，opts = { useEncryption: bool, password: string }
 *   hasRecoveryPassword bool  本机是否设置了恢复密码
 *   busy             bool  操作进行中
 *   selectedCount    number 已选择的服务器数量
 */
export default function ExportSelectedDialog({ onClose, onExport, hasRecoveryPassword, busy, selectedCount }) {
  const { t } = useTranslation();
  const [format, setFormat] = useState('plain');        // 'plain' | 'encrypted'
  const [keyMode, setKeyMode] = useState('recovery');   // 'recovery' | 'password'（仅密文时）
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // ESC 关闭
  useEffect(() => {
    const handleKeyDown = (e) => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // 切到明文时重置密码相关状态
  useEffect(() => {
    if (format === 'plain') {
      setKeyMode('recovery');
      setPassword('');
    }
  }, [format]);

  // 未设置恢复密码时，密文默认走自定义密码
  useEffect(() => {
    if (format === 'encrypted' && !hasRecoveryPassword) {
      setKeyMode('password');
    }
  }, [format, hasRecoveryPassword]);

  const canExport = () => {
    if (busy) return false;
    if (format === 'encrypted' && keyMode === 'password' && !password.trim()) return false;
    return true;
  };

  const handleExportClick = () => {
    if (!canExport()) return;
    onExport({
      useEncryption: format === 'encrypted',
      password: format === 'encrypted' && keyMode === 'password' ? password : '',
    });
  };

  const rowStyle = {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '10px 12px', borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)', cursor: 'pointer',
    background: 'var(--surface-secondary)',
    transition: 'border-color 0.15s',
  };
  const activeRowStyle = {
    ...rowStyle,
    borderColor: 'var(--accent)',
    background: 'var(--accent-dim)',
  };
  const radioDot = (active) => (
    <span style={{
      width: 16, height: 16, borderRadius: '50%',
      border: `2px solid ${active ? 'var(--accent)' : 'var(--text-tertiary)'}`,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      {active && <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)' }} />}
    </span>
  );

  return (
    <div className="modal-overlay" style={{ zIndex: Z.MODAL }}>
      <div className="modal modal-md" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Database size={18} />
            {t('导出已选节点')}
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="close"><X size={18} /></button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', background: 'var(--surface-secondary)', padding: '10px 12px', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--accent)' }}>
            {t('您已选择 {count} 个服务器节点进行导出。', { count: selectedCount })}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* 导出格式选择 */}
            <div style={{ display: 'flex', gap: 8 }}>
              <div onClick={() => setFormat('plain')} role="radio" aria-checked={format === 'plain'} style={{ ...(format === 'plain' ? activeRowStyle : rowStyle), flex: 1 }}>
                {radioDot(format === 'plain')}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{t('明文')}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>.json</div>
                </div>
              </div>
              <div onClick={() => setFormat('encrypted')} role="radio" aria-checked={format === 'encrypted'} style={{ ...(format === 'encrypted' ? activeRowStyle : rowStyle), flex: 1 }}>
                {radioDot(format === 'encrypted')}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{t('密文')}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>.lumin2</div>
                </div>
              </div>
            </div>

            {/* 加密方式选择（仅密文时显示） */}
            {format === 'encrypted' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 4 }}>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{t('加密方式')}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ ...rowStyle, cursor: hasRecoveryPassword ? 'pointer' : 'not-allowed', opacity: hasRecoveryPassword ? 1 : 0.5, padding: '8px 12px' }}
                    onClick={() => hasRecoveryPassword && setKeyMode('recovery')}>
                    {radioDot(keyMode === 'recovery')}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontSize: 13 }}>{t('复用恢复密码')}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{t('与同步加密使用同一个恢复密码')}</span>
                    </div>
                    {!hasRecoveryPassword && <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 'auto' }}>{t('未设置')}</span>}
                  </label>
                  <label style={{ ...(keyMode === 'password' ? activeRowStyle : rowStyle), padding: '8px 12px' }} onClick={() => setKeyMode('password')}>
                    {radioDot(keyMode === 'password')}
                    <span style={{ fontSize: 13 }}>{t('自定义密码')}</span>
                  </label>
                </div>

                {keyMode === 'password' && (
                  <div style={{ position: 'relative', marginTop: 2 }}>
                    <input
                      id="export-selected-password"
                      name="export-selected-password"
                      autoComplete="off"
                      className="input"
                      type={showPassword ? 'text' : 'password'}
                      placeholder={t('请输入导出密码')}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoFocus
                      style={{ width: '100%', paddingRight: 36, height: 34, fontSize: 13 }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label="toggle password visibility"
                      style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex', padding: 2 }}
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                )}
                {keyMode === 'recovery' && !hasRecoveryPassword && (
                  <div style={{ fontSize: 11, color: 'var(--warning)', padding: '0 2px' }}>
                    {t('未设置恢复密码，请输入自定义密码或先在同步设置中设置')}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>{t('关闭')}</button>
          <button className="btn btn-primary" onClick={handleExportClick} disabled={!canExport()} style={{ minWidth: 80 }}>
            <Download size={14} style={{ marginRight: 6 }} />{t('导出')}
          </button>
        </div>
      </div>
    </div>
  );
}
