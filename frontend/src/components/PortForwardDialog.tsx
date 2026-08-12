import { useState, useEffect, type ChangeEvent, type FocusEvent } from 'react';
import { ExternalLink, X, ArrowRight, ArrowLeftRight, MonitorSmartphone, Server, Hash, Power, Play, Trash2 } from 'lucide-react';
import * as AppGo from '../../wailsjs/go/wailsapp/App.js';
import { useTranslation } from '../i18n.ts';
import type { PortForwardInitialMapping } from '../hooks/usePortForwardDialog.ts';
import type { sshmanager } from '../../wailsjs/go/models.ts';

export interface PortForwardDialogProps {
  sessionId: string;
  onClose: () => void;
  initialMapping: PortForwardInitialMapping | null;
  initialTab: string | null;
}

export default function PortForwardDialog({
    sessionId,
    onClose,
    initialMapping = null,
    initialTab = null,
}: PortForwardDialogProps) {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<string>(initialTab || (initialMapping ? 'new' : 'list'));
    const [portForwards, setPortForwards] = useState<sshmanager.PortForwardInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [kind, setKind] = useState<string>(initialMapping?.kind || 'local');
    const [localHost, setLocalHost] = useState<string>(initialMapping?.localHost || '127.0.0.1');
    const [localPort, setLocalPort] = useState<string>(initialMapping?.localPort || '');
    const [remoteHost, setRemoteHost] = useState<string>(initialMapping?.remoteHost || '127.0.0.1');
    const [remotePort, setRemotePort] = useState<string>(initialMapping?.remotePort || '');
    const [error, setError] = useState('');

    useEffect(() => {
        void refreshPortForwards();
    }, [sessionId]);

    useEffect(() => {
        if (!initialMapping) return;
        setActiveTab('new');
        setKind(initialMapping.kind || 'local');
        setLocalHost(initialMapping.localHost || '127.0.0.1');
        setLocalPort(initialMapping.localPort || '');
        setRemoteHost(initialMapping.remoteHost || '127.0.0.1');
        setRemotePort(initialMapping.remotePort || '');
    }, [initialMapping]);

    // 通知监控面板端口映射卡片实时刷新
    const notifyChanged = () => {
        window.dispatchEvent(new CustomEvent('port-forward-changed', { detail: { sessionId } }));
    };

    const refreshPortForwards = async () => {
        setLoading(true);
        try {
            const list = await AppGo.ListPortForwards(sessionId);
            setPortForwards(list || []);
        } catch (err) {
            window.luminDialog?.alert(`${t('加载端口映射失败')}: ${String(err)}`);
        } finally {
            setLoading(false);
        }
    };

    const normalizePort = (value: string) => {
        return value.trim();
    };

    const validatePort = (value: string) => {
        const port = normalizePort(value);
        if (!/^[0-9]+$/.test(port)) {
            return false;
        }
        const intValue = Number(port);
        return intValue >= 1 && intValue <= 65535;
    };

    const handleCreate = async () => {
        setError('');
        const normalizedLocalPort = normalizePort(localPort);
        const normalizedRemotePort = normalizePort(remotePort);
        if (!validatePort(normalizedLocalPort) || !validatePort(normalizedRemotePort)) {
            setError(t('请输入有效的端口号（1-65535）'));
            return;
        }
        if (!remoteHost.trim()) {
            setError(t('请输入远程主机地址'));
            return;
        }
        if (!localHost.trim()) {
            setError(t('请输入本机主机地址'));
            return;
        }

        // localHost/localPort 恒为本机侧, remoteHost/remotePort 恒为远程侧
        const localAddr = `${localHost}:${normalizedLocalPort}`;
        const remoteAddr = `${remoteHost}:${normalizedRemotePort}`;
        setSubmitting(true);

        try {
            if (kind === 'local') {
                // SSH -L: 本机监听 localAddr, 转发到远程可达的 remoteAddr
                await AppGo.StartLocalPortForward(sessionId, localAddr, remoteAddr);
            } else {
                // SSH -R: 远程监听 remoteAddr, 转发回本机的 localAddr
                await AppGo.StartRemotePortForward(sessionId, remoteAddr, localAddr);
            }
            notifyChanged();
            await refreshPortForwards();
            setActiveTab('list');
        } catch (err) {
            if (kind === 'local' && String(err).includes('local port already in use')) {
                setError(t('本地端口已占用'));
                return;
            }
            window.luminDialog?.alert(`${kind === 'local' ? t('创建本地端口映射失败') : t('创建远程端口映射失败')}: ${String(err)}`);
        } finally {
            setSubmitting(false);
        }
    };

    const handleStop = async (id: string) => {
        try {
            await AppGo.StopPortForwardForSession(sessionId, id);
            notifyChanged();
            await refreshPortForwards();
        } catch (err) {
            window.luminDialog?.alert(`${t('关闭端口映射失败')}: ${String(err)}`);
        }
    };

    const handleRestart = async (id: string) => {
        try {
            await AppGo.RestartPortForwardForSession(sessionId, id);
            notifyChanged();
            await refreshPortForwards();
        } catch (err) {
            window.luminDialog?.alert(`${t('关闭端口映射失败')}: ${String(err)}`);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await AppGo.DeletePortForwardForSession(sessionId, id);
            setPortForwards((prev) => prev.filter((info) => info.ID !== id));
            notifyChanged();
            await refreshPortForwards();
        } catch (err) {
            window.luminDialog?.alert(`${t('关闭端口映射失败')}: ${String(err)}`);
        }
    };

    // 列表方向文案对齐后端语义: local=SSH -L 本地监听→远程目标; remote=SSH -R 远程监听→本机目标
    const renderMappingLabel = (info: sshmanager.PortForwardInfo) => {
        if (info.Kind === 'local') {
            return `${t('本地监听')} ${info.LocalAddr} → ${t('远程目标')} ${info.RemoteAddr}`;
        }
        return `${t('远程监听')} ${info.RemoteAddr} → ${t('本机目标')} ${info.LocalAddr}`;
    };

    // 地址字段块: 卡片化容器, 与上方方向卡片视觉统一; 输入框绑定固定(local*=本机, remote*=远程), 仅 label/图标/角色随 kind 变
    const inputStyle: React.CSSProperties = {
        width: '100%',
        padding: '8px 10px',
        fontSize: 13,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        color: 'var(--text-primary)',
        outline: 'none',
        transition: 'var(--transition-fast)',
        boxSizing: 'border-box',
    };
    const handleInputFocus = (event: FocusEvent<HTMLInputElement>) => {
        event.target.style.borderColor = 'var(--accent)';
        event.target.style.boxShadow = '0 0 0 2px color-mix(in srgb, var(--accent) 18%, transparent)';
    };
    const handleInputBlur = (event: FocusEvent<HTMLInputElement>) => {
        event.target.style.borderColor = 'var(--border)';
        event.target.style.boxShadow = 'none';
    };
    // 监听地址安全判定: 仅回环地址视为安全; 空值或 0.0.0.0/:: 等非回环地址视为可能对外暴露
    const isSafeListenHost = (host: string) => {
        const h = String(host || '').trim().toLowerCase().replace(/^\[|\]$/g, '');
        return h === '127.0.0.1' || h === 'localhost' || h === '::1';
    };

    interface AddressFieldCardOptions {
        keyName: string;
        roleText: string;
        roleColor: string;
        roleIcon: React.ReactNode;
        hostValue: string;
        onHostChange: (event: ChangeEvent<HTMLInputElement>) => void;
        portValue: string;
        onPortChange: (event: ChangeEvent<HTMLInputElement>) => void;
        isListen: boolean;
    }
    const addressFieldCard = (options: AddressFieldCardOptions) => {
        const { keyName, roleText, roleColor, roleIcon, hostValue, onHostChange, portValue, onPortChange, isListen } = options;
        const showListenWarning = isListen && hostValue.trim() !== '' && !isSafeListenHost(hostValue);
        return (
            <div
                key={keyName}
                style={{
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border)',
                    background: 'var(--surface-raised)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 24,
                            height: 24,
                            borderRadius: 'var(--radius-xs)',
                            background: `color-mix(in srgb, ${roleColor} 14%, transparent)`,
                            color: roleColor,
                            flexShrink: 0,
                        }}
                    >
                        {roleIcon}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{roleText}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 108px', gap: 10 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label htmlFor={`pf-${keyName}-host`} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-tertiary)' }}>
                            <Server size={11} /> {t('主机地址')}
                        </label>
                        <input
                            type="text"
                            id={`pf-${keyName}-host`}
                            name={`pf-${keyName}-host`}
                            autoComplete="off"
                            value={hostValue}
                            onChange={onHostChange}
                            onFocus={handleInputFocus}
                            onBlur={handleInputBlur}
                            placeholder="127.0.0.1"
                            style={showListenWarning ? { ...inputStyle, borderColor: 'var(--danger)' } : inputStyle}
                        />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label htmlFor={`pf-${keyName}-port`} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-tertiary)' }}>
                            <Hash size={11} /> {t('端口')}
                        </label>
                        <input
                            type="text"
                            id={`pf-${keyName}-port`}
                            name={`pf-${keyName}-port`}
                            autoComplete="off"
                            value={portValue}
                            onChange={onPortChange}
                            onFocus={handleInputFocus}
                            onBlur={handleInputBlur}
                            placeholder="0"
                            style={inputStyle}
                        />
                    </div>
                </div>
                {showListenWarning && (
                    <div style={{ fontSize: 11, lineHeight: 1.4, color: 'var(--danger)' }}>
                        {t('警告: 0.0.0.0、:: 或其他非本地地址可能暴露监听端口')}
                    </div>
                )}
            </div>
        );
    };
    const localFieldBlock = addressFieldCard({
        keyName: 'local',
        roleText: kind === 'local' ? t('本地监听地址') : t('本地目标地址'),
        roleColor: 'var(--accent)',
        roleIcon: <MonitorSmartphone size={14} />,
        hostValue: localHost,
        onHostChange: (event) => setLocalHost(event.target.value),
        portValue: localPort,
        onPortChange: (event) => setLocalPort(event.target.value),
        isListen: kind === 'local',
    });
    const remoteFieldBlock = addressFieldCard({
        keyName: 'remote',
        roleText: kind === 'local' ? t('远程目标地址') : t('远程监听地址'),
        roleColor: 'var(--success)',
        roleIcon: <Server size={14} />,
        hostValue: remoteHost,
        onHostChange: (event) => setRemoteHost(event.target.value),
        portValue: remotePort,
        onPortChange: (event) => setRemotePort(event.target.value),
        isListen: kind === 'remote',
    });
    // local(-L): 监听端在本机, 本机在上; remote(-R): 监听端在远程, 远程在上
    const orderedFieldBlocks = kind === 'local'
        ? [localFieldBlock, remoteFieldBlock]
        : [remoteFieldBlock, localFieldBlock];

    const kindOptions = [
        {
            value: 'local',
            title: t('本地转发到远程'),
            desc: t('在本机监听一个端口，连接会被转发到远程可达的服务'),
        },
        {
            value: 'remote',
            title: t('远程转发到本地'),
            desc: t('在远程监听一个端口，连接会被转发回本机的服务'),
        },
    ];

    return (
        <div className="modal-overlay" style={{ alignItems: 'flex-start', paddingTop: 52 }}>
            <div className="modal modal-md" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', maxHeight: 'calc(100vh - 80px)' }}>
                <div className="modal-header">
                    <div>
                        <div className="modal-title" style={{ marginBottom: 4 }}>{t('端口映射')}</div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
                            {t('在本机与远程服务器之间建立端口转发通道。')}
                        </div>
                    </div>
                    <button className="btn btn-ghost btn-sm" type="button" onClick={onClose} aria-label={t('关闭')}>
                        <X size={16} />
                    </button>
                </div>

                <div style={{ display: 'flex', gap: 8, padding: '8px 24px 0' }}>
                    <button
                        type="button"
                        className={`btn btn-ghost btn-sm${activeTab === 'list' ? ' active' : ''}`}
                        onClick={() => setActiveTab('list')}
                    >
                        {t('当前映射')}
                    </button>
                    <button
                        type="button"
                        className={`btn btn-ghost btn-sm${activeTab === 'new' ? ' active' : ''}`}
                        onClick={() => setActiveTab('new')}
                    >
                        {t('新建映射')}
                    </button>
                </div>

                <div style={{ padding: 24, overflowY: 'auto', flex: 1, minHeight: 0 }}>
                    {activeTab === 'list' ? (
                        <div>
                            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ fontWeight: 500 }}>{t('当前会话端口映射')}</div>
                                <button type="button" className="btn btn-secondary btn-sm" onClick={refreshPortForwards} disabled={loading}>
                                    {t('刷新')}
                                </button>
                            </div>
                            {loading ? (
                                <div>{t('加载中...')}</div>
                            ) : portForwards.length === 0 ? (
                                <div style={{ color: 'var(--text-tertiary)' }}>{t('当前会话没有端口映射。')}</div>
                            ) : (
                                <div style={{ display: 'grid', rowGap: 12 }}>
                                    {portForwards.map((info) => {
                                        const stopped = info.Enabled === false;
                                        return (
                                            <div key={info.ID} style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 12, display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center', opacity: stopped ? 0.65 : 1 }}>
                                                <div style={{ minWidth: 0 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                                        <span style={{ fontWeight: 600 }}>{renderMappingLabel(info)}</span>
                                                        {stopped && (
                                                            <span style={{ flexShrink: 0, fontSize: 11, padding: '1px 8px', borderRadius: 999, background: 'color-mix(in srgb, var(--text-tertiary) 18%, transparent)', color: 'var(--text-tertiary)' }}>{t('已停止')}</span>
                                                        )}
                                                    </div>
                                                    <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{info.ID}</div>
                                                    {!stopped && info.Kind === 'local' && info.LocalAddr && (
                                                        <a
                                                            href={`http://${info.LocalAddr}`}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 8, color: 'var(--accent)', fontSize: 12 }}
                                                        >
                                                            {t('打开本地地址')} <ExternalLink size={12} />
                                                        </a>
                                                    )}
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                                    {stopped ? (
                                                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => void handleRestart(info.ID)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--success)' }}>
                                                            <Play size={13} /> {t('重启')}
                                                        </button>
                                                    ) : (
                                                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => void handleStop(info.ID)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--warning)' }}>
                                                            <Power size={13} /> {t('停止')}
                                                        </button>
                                                    )}
                                                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => void handleDelete(info.ID)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--danger)' }}>
                                                        <Trash2 size={13} /> {t('删除')}
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div style={{ display: 'grid', rowGap: 16 }}>
                            {/* 方向选择: 卡片式, 标题 + 说明, 避免只用按钮文案表达方向 */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                {kindOptions.map((option) => {
                                    const selected = kind === option.value;
                                    return (
                                        <button
                                            key={option.value}
                                            type="button"
                                            onClick={() => setKind(option.value)}
                                            style={{
                                                textAlign: 'left',
                                                padding: '12px 14px',
                                                borderRadius: 12,
                                                border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
                                                background: selected ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'var(--surface-raised)',
                                                cursor: 'pointer',
                                                transition: 'var(--transition-fast)',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: 6,
                                            }}
                                        >
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: selected ? 'var(--accent)' : 'var(--text-primary)' }}>
                                                <ArrowLeftRight size={14} />
                                                {option.title}
                                            </span>
                                            <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                                {option.desc}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* 方向可视化: 监听端 → 目标端 */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '6px 0', color: 'var(--text-secondary)', fontSize: 12 }}>
                                <span style={{ padding: '3px 10px', borderRadius: 999, border: '1px solid var(--border)', background: 'var(--surface-raised)' }}>
                                    {kind === 'local' ? t('本地监听') : t('远程监听')}
                                </span>
                                <ArrowRight size={16} style={{ color: 'var(--accent)' }} />
                                <span style={{ padding: '3px 10px', borderRadius: 999, border: '1px solid var(--border)', background: 'var(--surface-raised)' }}>
                                    {kind === 'local' ? t('远程目标') : t('本机目标')}
                                </span>
                            </div>

                            <div style={{ display: 'grid', rowGap: 12 }}>
                                {orderedFieldBlocks}
                            </div>

                            {error && (
                                <div style={{ color: 'var(--danger)', marginTop: 4 }}>{error}</div>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                                <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
                                    {t('关闭')}
                                </button>
                                <button type="button" className="btn btn-primary" onClick={handleCreate} disabled={submitting}>
                                    {submitting ? t('创建中...') : t('创建映射')}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}