import { t as $t } from '../../i18n.js';
import { RadioOption, ToggleSwitch } from './SharedComponents';

export default function GeneralTab({
  language, onLanguageChange, availableLanguages = [],
  confirmCloseSession, onToggleConfirmCloseSession,
  confirmCloseAll, onToggleConfirmCloseAll,
  confirmFileDelete, onToggleConfirmFileDelete,
  confirmProcessKill, onToggleConfirmProcessKill,
  windowCloseAction, onWindowCloseActionChange,
  updateUseProxy, onToggleUpdateUseProxy,
  terminalRightClickPasteOnEmpty, onTerminalRightClickPasteOnEmptyChange,
  terminalRightClickPasteMode, onTerminalRightClickPasteModeChange,
  terminalLeftClickCopyOnSelection, onTerminalLeftClickCopyOnSelectionChange,
  terminalLeftClickCopyOnSelectionMode, onTerminalLeftClickCopyOnSelectionModeChange,
  terminalTabDoubleClickActionEnabled, onTerminalTabDoubleClickActionEnabledChange,
  terminalTabDoubleClickAction, onTerminalTabDoubleClickActionChange,
  rememberWorkspace, onToggleRememberWorkspace,
  workspacePersistenceLevel, onWorkspacePersistenceLevelChange,
  supportsWebviewGpuDisable, webviewGpuDisabled, onToggleWebviewGpuDisabled,
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      <div>
        <h3 style={{ fontSize: 14, color: 'var(--text-primary)', marginBottom: 12, fontWeight: 600 }}>{$t('语言')}</h3>
        <div className="form-group" style={{ background: 'var(--surface-overlay)', padding: 16, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ color: 'var(--text-primary)', fontSize: 13 }}>{$t('界面语言')}</div>
              <div style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>{$t('选择界面显示语言')}</div>
            </div>
            <select className="select" style={{ width: 200 }} value={language} onChange={onLanguageChange}>
              {availableLanguages.map((item) => (
                <option key={item.code} value={item.code}>{item.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div>
        <h3 style={{ fontSize: 14, color: 'var(--text-primary)', marginBottom: 12, fontWeight: 600 }}>{$t('操作确认')}</h3>
        <div className="form-group" style={{ background: 'var(--surface-overlay)', padding: 16, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ color: 'var(--text-primary)', fontSize: 13 }}>{$t('关闭连接时确认')}</div>
              <div style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>{$t('关闭单个 SSH 连接前弹出确认弹窗')}</div>
            </div>
            <ToggleSwitch checked={confirmCloseSession} onChange={onToggleConfirmCloseSession} />
          </div>
          <div className="divider" style={{ margin: '12px 0', borderTop: '1px solid var(--border)' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ color: 'var(--text-primary)', fontSize: 13 }}>{$t('关闭全部时确认')}</div>
              <div style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>{$t('批量关闭所有连接前弹出确认弹窗')}</div>
            </div>
            <ToggleSwitch checked={confirmCloseAll} onChange={onToggleConfirmCloseAll} />
          </div>
          <div className="divider" style={{ margin: '12px 0', borderTop: '1px solid var(--border)' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ color: 'var(--text-primary)', fontSize: 13 }}>{$t('文件管理器删除时确认')}</div>
              <div style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>{$t('删除文件或文件夹前弹出确认弹窗')}</div>
            </div>
            <ToggleSwitch checked={confirmFileDelete} onChange={onToggleConfirmFileDelete} />
          </div>
          <div className="divider" style={{ margin: '12px 0', borderTop: '1px solid var(--border)' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ color: 'var(--text-primary)', fontSize: 13 }}>{$t('终止进程时确认')}</div>
              <div style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>{$t('终止进程前弹出确认弹窗')}</div>
            </div>
            <ToggleSwitch checked={confirmProcessKill} onChange={onToggleConfirmProcessKill} />
          </div>
          <div className="divider" style={{ margin: '12px 0', borderTop: '1px solid var(--border)' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ color: 'var(--text-primary)', fontSize: 13 }}>{$t('关闭窗口时')}</div>
              <div style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>{$t('选择关闭窗口时的默认行为')}</div>
            </div>
            <select className="select" style={{ width: 160 }} value={windowCloseAction} onChange={e => onWindowCloseActionChange(e.target.value)}>
              <option value="ask">{$t('每次询问')}</option>
              <option value="quit">{$t('直接退出')}</option>
              <option value="tray">{$t('最小化到托盘')}</option>
            </select>
          </div>
        </div>
      </div>

      <div>
        <h3 style={{ fontSize: 14, color: 'var(--text-primary)', marginBottom: 12, fontWeight: 600 }}>{$t('交互偏好')}</h3>
        <div className="form-group" style={{ background: 'var(--surface-overlay)', padding: 16, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ color: 'var(--text-primary)', fontSize: 13 }}>{$t('右键直接粘贴')}</div>
              <div style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>{$t('开启后, 右键粘贴快捷操作会按下面选项触发')}</div>
            </div>
            <ToggleSwitch checked={terminalRightClickPasteOnEmpty} onChange={() => onTerminalRightClickPasteOnEmptyChange(!terminalRightClickPasteOnEmpty)} />
          </div>
          {terminalRightClickPasteOnEmpty && (
            <>
              <div className="divider" style={{ margin: '12px 0', borderTop: '1px solid var(--border)' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ color: 'var(--text-primary)', fontSize: 13 }}>{$t('右键粘贴触发方式')}</div>
                <div style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>{$t('选择右键直接粘贴的触发范围')}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                  <RadioOption
                    selected={terminalRightClickPasteMode !== 'always'}
                    label={$t('仅无选区时直接粘贴')}
                    description={$t('当前行为, 有选区时仍打开右键菜单')}
                    onClick={() => onTerminalRightClickPasteModeChange('empty')}
                  />
                  <RadioOption
                    selected={terminalRightClickPasteMode === 'always'}
                    label={$t('无论是否有选区都直接粘贴')}
                    description={$t('右键始终直接粘贴到终端, 不再显示右键菜单')}
                    onClick={() => onTerminalRightClickPasteModeChange('always')}
                  />
                </div>
              </div>
            </>
          )}
          <div className="divider" style={{ margin: '12px 0', borderTop: '1px solid var(--border)' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ color: 'var(--text-primary)', fontSize: 13 }}>{$t('左键选区自动复制')}</div>
              <div style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>{$t('开启后, 左键选区相关的复制快捷操作会按下面选项触发; 有选区时右键仍打开菜单')}</div>
            </div>
            <ToggleSwitch checked={terminalLeftClickCopyOnSelection} onChange={() => onTerminalLeftClickCopyOnSelectionChange(!terminalLeftClickCopyOnSelection)} />
          </div>
          {terminalLeftClickCopyOnSelection && (
            <>
              <div className="divider" style={{ margin: '12px 0', borderTop: '1px solid var(--border)' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ color: 'var(--text-primary)', fontSize: 13 }}>{$t('左键复制触发方式')}</div>
                <div style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>{$t('选择左键自动复制的触发时机')}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                  <RadioOption
                    selected={terminalLeftClickCopyOnSelectionMode !== 'mouseup'}
                    label={$t('点击已选中的文字时复制')}
                    description={$t('先完成选区, 再左键点击已选中的文字区域时自动复制')}
                    onClick={() => onTerminalLeftClickCopyOnSelectionModeChange('click')}
                  />
                  <RadioOption
                    selected={terminalLeftClickCopyOnSelectionMode === 'mouseup'}
                    label={$t('选中后松开鼠标时立即复制')}
                    description={$t('左键拖拽选中后, 松开鼠标按键时立即自动复制')}
                    onClick={() => onTerminalLeftClickCopyOnSelectionModeChange('mouseup')}
                  />
                </div>
              </div>
            </>
          )}
          <div className="divider" style={{ margin: '12px 0', borderTop: '1px solid var(--border)' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ color: 'var(--text-primary)', fontSize: 13 }}>{$t('为终端标签页添加双击行为')}</div>
              <div style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>{$t('开启后, 双击普通终端标签时会执行下面选择的动作; 分屏组标签不生效')}</div>
            </div>
            <ToggleSwitch checked={terminalTabDoubleClickActionEnabled} onChange={() => onTerminalTabDoubleClickActionEnabledChange(!terminalTabDoubleClickActionEnabled)} />
          </div>
          {terminalTabDoubleClickActionEnabled && (
            <>
              <div className="divider" style={{ margin: '12px 0', borderTop: '1px solid var(--border)' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ color: 'var(--text-primary)', fontSize: 13 }}>{$t('双击动作')}</div>
                <div style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>{$t('选择双击终端标签时要执行的动作')}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                  <RadioOption
                    selected={terminalTabDoubleClickAction === 'close'}
                    label={$t('关闭标签页')}
                    description={$t('双击普通终端标签时直接关闭该标签页')}
                    onClick={() => onTerminalTabDoubleClickActionChange('close')}
                  />
                  <RadioOption
                    selected={terminalTabDoubleClickAction !== 'close'}
                    label={$t('复制标签页')}
                    description={$t('双击普通终端标签时在同一连接下复制一个新终端标签, 并同步当前工作目录和文件资源管理器标签页')}
                    onClick={() => onTerminalTabDoubleClickActionChange('duplicate')}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div>
        <h3 style={{ fontSize: 14, color: 'var(--text-primary)', marginBottom: 12, fontWeight: 600 }}>{$t('工作区')}</h3>
        <div className="form-group" style={{ background: 'var(--surface-overlay)', padding: 16, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ color: 'var(--text-primary)', fontSize: 13 }}>{$t('记忆工作区')}</div>
              <div style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>{$t('重新启动后自动恢复上次的连接、终端标签和分屏布局')}</div>
            </div>
            <ToggleSwitch checked={rememberWorkspace} onChange={onToggleRememberWorkspace} />
          </div>
          {rememberWorkspace && (
            <>
              <div className="divider" style={{ margin: '12px 0', borderTop: '1px solid var(--border)' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ color: 'var(--text-primary)', fontSize: 13 }}>{$t('持久化级别')}</div>
                <div style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>{$t('选择工作区状态的额外持久化粒度')}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                  <RadioOption
                    selected={workspacePersistenceLevel !== 'session'}
                    label={$t('程序')}
                    description={$t('仅保留当前的程序级工作区恢复行为')}
                    onClick={() => onWorkspacePersistenceLevelChange('program')}
                  />
                  <RadioOption
                    selected={workspacePersistenceLevel === 'session'}
                    label={$t('会话')}
                    description={$t('在保留程序级恢复的同时, 为每个服务器单独保存最近一次会话状态; 重新连接该服务器时优先恢复')}
                    onClick={() => onWorkspacePersistenceLevelChange('session')}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div>
        <h3 style={{ fontSize: 14, color: 'var(--text-primary)', marginBottom: 12, fontWeight: 600 }}>{$t('更新下载')}</h3>
        <div className="form-group" style={{ background: 'var(--surface-overlay)', padding: 16, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ color: 'var(--text-primary)', fontSize: 13 }}>{$t('优先使用镜像下载')}</div>
              <div style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>{$t('优先通过多个镜像地址下载 GitHub 更新,失败后自动回退为官方直连下载')}</div>
            </div>
            <ToggleSwitch checked={updateUseProxy} onChange={onToggleUpdateUseProxy} />
          </div>
        </div>
      </div>

      {supportsWebviewGpuDisable && (
        <div>
          <h3 style={{ fontSize: 14, color: 'var(--text-primary)', marginBottom: 12, fontWeight: 600 }}>{$t('渲染')}</h3>
          <div className="form-group" style={{ background: 'var(--surface-overlay)', padding: 16, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ color: 'var(--text-primary)', fontSize: 13 }}>{$t('禁用硬件加速')}</div>
                <div style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>{$t('关闭 WebView GPU 加速，重启应用后生效')}</div>
              </div>
              <ToggleSwitch checked={webviewGpuDisabled} onChange={onToggleWebviewGpuDisabled} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
