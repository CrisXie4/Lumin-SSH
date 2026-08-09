import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Key, Lock, Eye, EyeOff, X } from 'lucide-react';
import * as AppGo from '../../bindings/luminssh-go/internal/wailsapp/app.js';
import { useTranslation } from '../i18n.js';
import Tiptop from './Tiptop.jsx';

const defaultCredForm = {
  name: '',
  authMethod: 'password',
  username: 'root',
  password: '',
  privateKey: '',
  passphrase: '',
};

export default function CredentialsModal({ onClose, onChange, addToast }) {
  const { t } = useTranslation();
  const [credentials, setCredentials] = useState([]);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(defaultCredForm);
  const [showPassword, setShowPassword] = useState(false);
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadCredentials = async (signal) => {
    try {
      const list = await AppGo.GetCredentials();
      if (signal?.cancelled) return;
      setCredentials(list || []);
    } catch (e) {
      if (signal?.cancelled) return;
      console.error('Failed to load credentials:', e);
    }
  };

  useEffect(() => {
    const signal = { cancelled: false };
    void loadCredentials(signal);
    return () => { signal.cancelled = true; };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      if (showForm) {
        closeForm();
        return;
      }
      onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, showForm]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const closeForm = () => {
    setEditing(null);
    setShowForm(false);
    setForm(defaultCredForm);
    setShowPassword(false);
    setShowPassphrase(false);
  };

  const startCreate = () => {
    setEditing(null);
    setShowForm(true);
    setForm(defaultCredForm);
    setShowPassword(false);
    setShowPassphrase(false);
  };

  const startEdit = (cred) => {
    setEditing(cred.id);
    setShowForm(true);
    setForm({
      name: cred.name || '',
      authMethod: cred.authMethod || 'password',
      username: cred.username || 'root',
      password: '',
      privateKey: '',
      passphrase: '',
    });
    setShowPassword(false);
    setShowPassphrase(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return window.luminDialog?.alert(t('凭据名称'));
    if (!form.username.trim()) return window.luminDialog?.alert(t('请填写用户名'));
    setSaving(true);
    try {
      const data = { ...form };
      if (editing) data.id = editing;
      await AppGo.SaveCredential(data);
      await loadCredentials();
      addToast(t('凭据已保存'), 'success');
      closeForm();
      onChange?.();
    } catch (err) {
      window.luminDialog?.alert(String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cred) => {
    const ok = await window.luminDialog?.confirm(t('确定删除此凭据？'));
    if (!ok) return;
    try {
      await AppGo.DeleteCredential(cred.id);
      await loadCredentials();
      addToast(t('凭据已删除'), 'success');
      if (editing === cred.id) closeForm();
      onChange?.();
    } catch (err) {
      window.luminDialog?.alert(String(err));
    }
  };

  const isEditing = editing !== null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-md" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{t('凭据管理')}</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label={t('关闭')}><X size={18} /></button>
        </div>

        <div className="modal-body" style={{ overflowY: 'auto', maxHeight: 'calc(80vh - 120px)', gap: 10 }}>
          {credentials.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '28px 0 12px', color: 'var(--text-tertiary)', fontSize: 13 }}>
              {t('暂无凭据')}
            </div>
          ) : (
            credentials.map((cred) => (
              <div
                key={cred.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)',
                  background: editing === cred.id ? 'var(--accent-dim)' : 'var(--surface-sunken)',
                }}
              >
                <div style={{ color: cred.authMethod === 'privateKey' ? 'var(--warning)' : 'var(--accent)', flexShrink: 0 }}>
                  {cred.authMethod === 'privateKey' ? <Key size={16} /> : <Lock size={16} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{cred.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                    {cred.username} · {cred.authMethod === 'privateKey' ? t('私钥认证') : t('密码认证')}
                  </div>
                </div>
                <Tiptop text={t('编辑凭据')}>
                  <button className="btn btn-ghost btn-icon" onClick={() => startEdit(cred)} aria-label={t('编辑凭据')}>
                    <Pencil size={14} />
                  </button>
                </Tiptop>
                <Tiptop text={t('删除凭据')}>
                  <button className="btn btn-ghost btn-icon" onClick={() => handleDelete(cred)} aria-label={t('删除凭据')} style={{ color: 'var(--danger)' }}>
                    <Trash2 size={14} />
                  </button>
                </Tiptop>
              </div>
            ))
          )}

          <button className="btn btn-secondary btn-block" onClick={startCreate}>
            <Plus size={16} /> {t('新增凭据')}
          </button>
        </div>
      </div>

      {showForm && (
        <div
          className="modal-overlay"
          style={{ background: 'rgba(0, 0, 0, 0.35)' }}
          onClick={(e) => {
            e.stopPropagation();
            closeForm();
          }}
        >
          <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{isEditing ? t('编辑凭据') : t('新增凭据')}</div>
              <button className="btn btn-ghost btn-icon" onClick={closeForm} aria-label={t('关闭')}><X size={18} /></button>
            </div>

            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label" htmlFor="cred-name">{t('凭据名称')} *</label>
                  <input className="input" id="cred-name" name="cred-name" autoComplete="off" value={form.name} onChange={set('name')} placeholder={t('凭据名称')} autoFocus />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="cred-auth-method">{t('认证方式')}</label>
                  <select
                    id="cred-auth-method"
                    name="cred-auth-method"
                    className="select"
                    value={form.authMethod}
                    onChange={(e) => setForm((f) => ({
                      ...f,
                      authMethod: e.target.value,
                      password: '',
                      privateKey: '',
                      passphrase: '',
                    }))}
                  >
                    <option value="password">{t('密码认证')}</option>
                    <option value="privateKey">{t('私钥认证')}</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="cred-username">{t('用户名')} *</label>
                  <input className="input" id="cred-username" name="cred-username" autoComplete="off" value={form.username} onChange={set('username')} placeholder="root" />
                </div>

                {form.authMethod === 'password' ? (
                  <div className="form-group">
                    <label className="form-label" htmlFor="cred-password">{t('密码')}</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        className="input"
                        id="cred-password"
                        name="cred-password"
                        autoComplete="current-password"
                        type={showPassword ? 'text' : 'password'}
                        value={form.password}
                        onChange={set('password')}
                        placeholder={isEditing ? t('留空不修改') : t('密码')}
                        style={{ paddingRight: 36 }}
                      />
                      <button
                        type="button"
                        className="btn btn-ghost btn-icon"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)' }}
                        aria-label={showPassword ? t('隐藏密码') : t('显示密码')}
                      >
                        {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="form-group">
                      <label className="form-label" htmlFor="cred-private-key">{t('私钥')}</label>
                      <textarea
                        id="cred-private-key"
                        name="cred-private-key"
                        className="input"
                        rows={4}
                        value={form.privateKey}
                        onChange={set('privateKey')}
                        placeholder={isEditing ? t('留空不修改') : '-----BEGIN RSA PRIVATE KEY-----...'}
                        style={{ fontFamily: 'monospace', fontSize: 12, resize: 'vertical' }}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="cred-passphrase">{t('私钥密码短语')}</label>
                      <div style={{ position: 'relative' }}>
                        <input
                          className="input"
                          id="cred-passphrase"
                          name="cred-passphrase"
                          autoComplete="current-password"
                          type={showPassphrase ? 'text' : 'password'}
                          value={form.passphrase}
                          onChange={set('passphrase')}
                          placeholder={isEditing ? t('留空不修改') : t('私钥密码短语')}
                          style={{ paddingRight: 36 }}
                        />
                        <button
                          type="button"
                          className="btn btn-ghost btn-icon"
                          onClick={() => setShowPassphrase(!showPassphrase)}
                          style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)' }}
                          aria-label={showPassphrase ? t('隐藏密码') : t('显示密码')}
                        >
                          {showPassphrase ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeForm} disabled={saving}>
                  {t('取消')}
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {isEditing ? t('保存') : t('新增凭据')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
