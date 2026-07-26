import React from 'react';
import { t as $t } from '../../i18n.js';
import { RadioOption, ToggleSwitch } from './SharedComponents';

function SettingRow({ title, description, action }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ color: 'var(--text-primary)', fontSize: 13 }}>{title}</div>
        <div style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>{description}</div>
      </div>
      {action}
    </div>
  );
}

export default function FileManagerTab({
  fileManagerCompressedTransfer,
  onToggleFileManagerCompressedTransfer,
  fileManagerAutoOpenTransferQueue,
  onToggleFileManagerAutoOpenTransferQueue,
  fileManagerShowTabIcons,
  onToggleFileManagerShowTabIcons,
  fileManagerHideTabCloseButton,
  onToggleFileManagerHideTabCloseButton,
  fileManagerLayoutMode = 'classic',
  onFileManagerLayoutModeChange,
  fileManagerDualPaneDragTransferEnabled,
  onToggleFileManagerDualPaneDragTransferEnabled,
  fileManagerDualPaneDragPromptOnDirectory,
  onToggleFileManagerDualPaneDragPromptOnDirectory,
  fileManagerDualPaneDragInvertModifier,
  onToggleFileManagerDualPaneDragInvertModifier,
  fileManagerChmodAutoApplyLastSettings,
  onToggleFileManagerChmodAutoApplyLastSettings,
  fileManagerDoubleClickUncompressArchive,
  onToggleFileManagerDoubleClickUncompressArchive,
  fileManagerSmartUncompressConflictStrategy,
  onFileManagerSmartUncompressConflictStrategyChange,
  fileManagerDefaultOpenMode = 'builtin',
  onFileManagerDefaultOpenModeChange,
  fileManagerPreferredExternalApp = '',
  onPickFileManagerPreferredExternalApp,
  onClearFileManagerPreferredExternalApp,
  fileManagerInitialPathMode,
  onFileManagerInitialPathModeChange,
  fileManagerNewTabPathMode,
  onFileManagerNewTabPathModeChange,
  fileManagerAskDownloadEveryTime,
  onToggleFileManagerAskDownloadEveryTime,
  fileManagerDownloadConflictStrategy,
  onFileManagerDownloadConflictStrategyChange,
  fileManagerDownloadConflictDiffBySize,
  onToggleFileManagerDownloadConflictDiffBySize,
  fileManagerDownloadConflictDiffByMtime,
  onToggleFileManagerDownloadConflictDiffByMtime,
  fileManagerDownloadRenameSuffixMode,
  onFileManagerDownloadRenameSuffixModeChange,
  fileManagerDownloadDefaultDir,
  onFileManagerDownloadDefaultDirChange,
  fileManagerDownloadDefaultDirPreview,
  fileManagerUploadChunkSizeKiB,
  onFileManagerUploadChunkSizeKiBChange,
  fileManagerUploadMaxFiles,
  onFileManagerUploadMaxFilesChange,
  fileManagerUploadMaxChunksPerFile,
  onFileManagerUploadMaxChunksPerFileChange,
  fileManagerUploadGlobalInflightLimit,
  onFileManagerUploadGlobalInflightLimitChange,
}) {
  const withDefaultValue = (text, value) => `${text} ${$t('默认值：{value}，仅影响下一次上传任务', { value })}`;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      <div>
        <h3 style={{ fontSize: 14, color: 'var(--text-primary)', marginBottom: 12, fontWeight: 600 }}>{$t('偏好设置')}</h3>
        <div className="form-group" style={{ background: 'var(--surface-overlay)', padding: 16, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
          <SettingRow
            title={$t('压缩传输')}
            description={$t('多文件或文件夹上传时先在本机打包为 tar.gz，上传后远端自动解压')}
            action={<ToggleSwitch checked={fileManagerCompressedTransfer} onChange={onToggleFileManagerCompressedTransfer} />}
          />
          <div className="divider" style={{ margin: '12px 0', borderTop: '1px solid var(--border)' }} />
          <SettingRow
            title={$t('发起传输任务时自动打开传输队列')}
            description={$t('上传或下载新建传输任务后自动展开传输队列面板')}
            action={<ToggleSwitch checked={fileManagerAutoOpenTransferQueue} onChange={onToggleFileManagerAutoOpenTransferQueue} />}
          />
          <div className="divider" style={{ margin: '12px 0', borderTop: '1px solid var(--border)' }} />
          <SettingRow
            title={$t('显示文件资源管理器标签页目录图标')}
            description={$t('关闭后只隐藏目录图标,仍显示置顶图标')}
            action={<ToggleSwitch checked={fileManagerShowTabIcons} onChange={onToggleFileManagerShowTabIcons} />}
          />
          <div className="divider" style={{ margin: '12px 0', borderTop: '1px solid var(--border)' }} />
          <SettingRow
            title={$t('文件资源管理器不显示关闭图标按钮')}
            description={$t('开启后,文件资源管理器标签页不显示关闭图标按钮,仅可双击关闭')}
            action={<ToggleSwitch checked={fileManagerHideTabCloseButton} onChange={onToggleFileManagerHideTabCloseButton} />}
          />
          <div className="divider" style={{ margin: '12px 0', borderTop: '1px solid var(--border)' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ color: 'var(--text-primary)', fontSize: 13 }}>{$t('文件资源管理器视图')}</div>
            <div style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>{$t('选择顶部标签单栏,或左侧标签双面板视图')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
              <RadioOption
                selected={fileManagerLayoutMode === 'classic'}
                label={$t('经典顶部标签')}
                description={$t('保留当前顶部横向标签栏与单内容区')}
                onClick={() => onFileManagerLayoutModeChange?.('classic')}
              />
              <RadioOption
                selected={fileManagerLayoutMode === 'sidebar_dual'}
                label={$t('左侧标签双面板')}
                description={$t('左侧显示历史标签,主内容区同时显示左右两个文件列表')}
                onClick={() => onFileManagerLayoutModeChange?.('sidebar_dual')}
              />
            </div>
            {fileManagerLayoutMode === 'sidebar_dual' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 12, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--surface)' }}>
                <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{$t('仅在左侧标签双面板视图中生效')}</div>
                <SettingRow
                  title={$t('允许左右面板互相拖拽文件')}
                  description={$t('开启后,可在双栏之间直接拖拽文件;默认复制,按住 Ctrl 为移动')}
                  action={<ToggleSwitch checked={fileManagerDualPaneDragTransferEnabled} onChange={onToggleFileManagerDualPaneDragTransferEnabled} />}
                />
                <div className="divider" style={{ margin: '2px 0', borderTop: '1px solid var(--border)' }} />
                <SettingRow
                  title={$t('拖拽文件夹时先询问')}
                  description={$t('开启后,拖拽内容包含文件夹时先确认是否继续')}
                  action={<ToggleSwitch checked={fileManagerDualPaneDragPromptOnDirectory} onChange={onToggleFileManagerDualPaneDragPromptOnDirectory} />}
                />
                <div className="divider" style={{ margin: '2px 0', borderTop: '1px solid var(--border)' }} />
                <SettingRow
                  title={$t('反转 Ctrl 拖拽语义')}
                  description={$t('开启后,默认移动,按住 Ctrl 为复制')}
                  action={<ToggleSwitch checked={fileManagerDualPaneDragInvertModifier} onChange={onToggleFileManagerDualPaneDragInvertModifier} />}
                />
              </div>
            ) : null}
          </div>
          <div className="divider" style={{ margin: '12px 0', borderTop: '1px solid var(--border)' }} />
          <SettingRow
            title={$t('默认应用上次权限设置')}
            description={$t('开启后,修改权限弹窗会默认套用上次保存的权限模式和包含子目录选项')}
            action={<ToggleSwitch checked={fileManagerChmodAutoApplyLastSettings} onChange={onToggleFileManagerChmodAutoApplyLastSettings} />}
          />
          <div className="divider" style={{ margin: '12px 0', borderTop: '1px solid var(--border)' }} />
          <SettingRow
            title={$t('双击解压压缩包')}
            description={$t('开启后,双击压缩包会直接解压;右键“解压”也会使用同样的智能解压规则')}
            action={<ToggleSwitch checked={fileManagerDoubleClickUncompressArchive} onChange={onToggleFileManagerDoubleClickUncompressArchive} />}
          />
          <div className="divider" style={{ margin: '12px 0', borderTop: '1px solid var(--border)' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ color: 'var(--text-primary)', fontSize: 13 }}>{$t('智能解压遇到同名文件夹时')}</div>
            <div style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>{$t('如果准备解压到“压缩包同名文件夹”,但这个文件夹已经存在,就按这里处理')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
              <RadioOption
                selected={fileManagerSmartUncompressConflictStrategy === 'overwrite'}
                label={$t('覆盖')}
                description={$t('继续解压到现有同名文件夹,里面同名文件会被替换')}
                onClick={() => onFileManagerSmartUncompressConflictStrategyChange?.('overwrite')}
              />
              <RadioOption
                selected={fileManagerSmartUncompressConflictStrategy === 'auto_rename'}
                label={$t('自动重命名')}
                description={$t('保留已有文件夹,自动新建“压缩包名 (2)”这类文件夹')}
                onClick={() => onFileManagerSmartUncompressConflictStrategyChange?.('auto_rename')}
              />
              <RadioOption
                selected={fileManagerSmartUncompressConflictStrategy === 'prompt'}
                label={$t('每次都询问我')}
                description={$t('每次遇到同名文件夹时都弹窗让我选')}
                onClick={() => onFileManagerSmartUncompressConflictStrategyChange?.('prompt')}
              />
            </div>
          </div>
          <div className="divider" style={{ margin: '12px 0', borderTop: '1px solid var(--border)' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ color: 'var(--text-primary)', fontSize: 13 }}>{$t('打开文件默认方式')}</div>
            <div style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>{$t('双击或点“编辑”时的默认打开方式；编辑器内仍可随时切换到系统/指定编辑器')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
              <RadioOption
                selected={fileManagerDefaultOpenMode === 'builtin'}
                label={$t('内置编辑器')}
                description={$t('使用 Lumin 内置编辑器打开，支持高亮与保存回远端')}
                onClick={() => onFileManagerDefaultOpenModeChange?.('builtin')}
              />
              <RadioOption
                selected={fileManagerDefaultOpenMode === 'system'}
                label={$t('系统编辑器')}
                description={$t('用系统默认程序打开临时文件，保存后自动同步回远端')}
                onClick={() => onFileManagerDefaultOpenModeChange?.('system')}
              />
              <RadioOption
                selected={fileManagerDefaultOpenMode === 'external'}
                label={$t('指定外部编辑器')}
                description={$t('始终使用你选择的编辑器程序打开，例如 VS Code / Notepad++')}
                onClick={() => onFileManagerDefaultOpenModeChange?.('external')}
              />
            </div>
            {fileManagerDefaultOpenMode === 'external' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--surface)' }}>
                <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                  {$t('当前外部编辑器')}：{fileManagerPreferredExternalApp
                    ? fileManagerPreferredExternalApp
                    : $t('未选择（首次打开时会提示选择）')}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-secondary" style={{ fontSize: 12, padding: '6px 10px' }} onClick={() => onPickFileManagerPreferredExternalApp?.()}>
                    {fileManagerPreferredExternalApp ? $t('更换外部编辑器') : $t('选择外部编辑器')}
                  </button>
                  {fileManagerPreferredExternalApp ? (
                    <button type="button" className="btn btn-ghost" style={{ fontSize: 12, padding: '6px 10px' }} onClick={() => onClearFileManagerPreferredExternalApp?.()}>
                      {$t('清除')}
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
          <div className="divider" style={{ margin: '12px 0', borderTop: '1px solid var(--border)' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ color: 'var(--text-primary)', fontSize: 13 }}>{$t('进入服务器默认路径')}</div>
            <div style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>{$t('首次打开文件管理器时的初始目录来源；优先使用配置中的文件管理器初始目录，未填写时使用当前终端启动目录，最后回退到 /root 和根目录')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
              <RadioOption
                selected={fileManagerInitialPathMode === 'session_initial_path'}
                label={$t('服务器初始目录')}
                description={$t('优先使用当前服务器配置中的文件管理器初始目录，未填写时使用当前终端启动目录')}
                onClick={() => onFileManagerInitialPathModeChange('session_initial_path')}
              />
              <RadioOption
                selected={fileManagerInitialPathMode === 'root'}
                label={$t('根目录')}
                description={$t('首次进入时从根目录开始')}
                onClick={() => onFileManagerInitialPathModeChange('root')}
              />
              <RadioOption
                selected={fileManagerInitialPathMode === 'terminal_cwd'}
                label={$t('当前终端目录')}
                description={$t('使用当前终端最近一次上报的工作目录')}
                onClick={() => onFileManagerInitialPathModeChange('terminal_cwd')}
              />
            </div>
          </div>
          <div className="divider" style={{ margin: '12px 0', borderTop: '1px solid var(--border)' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ color: 'var(--text-primary)', fontSize: 13 }}>{$t('新建标签默认路径')}</div>
            <div style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>{$t('手动新建文件管理器标签时的初始目录来源；如果首选路径不可用，会依次回退到当前标签目录和根目录')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
              <RadioOption
                selected={fileManagerNewTabPathMode === 'inherit_current'}
                label={$t('继承当前标签所在目录')}
                description={$t('新标签默认打开当前标签所在目录')}
                onClick={() => onFileManagerNewTabPathModeChange('inherit_current')}
              />
              <RadioOption
                selected={fileManagerNewTabPathMode === 'root'}
                label={$t('根目录')}
                description={$t('新标签始终从根目录开始')}
                onClick={() => onFileManagerNewTabPathModeChange('root')}
              />
              <RadioOption
                selected={fileManagerNewTabPathMode === 'session_initial_path'}
                label={$t('服务器初始目录')}
                description={$t('优先使用当前服务器配置中的文件管理器初始目录，未填写时使用当前终端启动目录')}
                onClick={() => onFileManagerNewTabPathModeChange('session_initial_path')}
              />
              <RadioOption
                selected={fileManagerNewTabPathMode === 'terminal_cwd'}
                label={$t('当前终端目录')}
                description={$t('使用当前终端最近一次上报的工作目录')}
                onClick={() => onFileManagerNewTabPathModeChange('terminal_cwd')}
              />
            </div>
          </div>
        </div>
      </div>
      <div>
        <h3 style={{ fontSize: 14, color: 'var(--text-primary)', marginBottom: 12, fontWeight: 600 }}>{$t('上传并发')}</h3>
        <div className="form-group" style={{ background: 'var(--surface-overlay)', padding: 16, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
          <SettingRow
            title={$t('单文件分块大小 (KiB)')}
            description={withDefaultValue($t('控制单个文件上传时的默认分块大小'), '256 KiB')}
            action={<input className="input" type="number" value={fileManagerUploadChunkSizeKiB} onChange={onFileManagerUploadChunkSizeKiBChange} style={{ width: 160, textAlign: 'right' }} />}
          />
          <div className="divider" style={{ margin: '12px 0', borderTop: '1px solid var(--border)' }} />
          <SettingRow
            title={$t('多文件并发上传最大数量')}
            description={withDefaultValue($t('控制同一时间允许并发上传的文件数量'), '6')}
            action={<input className="input" type="number" value={fileManagerUploadMaxFiles} onChange={onFileManagerUploadMaxFilesChange} style={{ width: 160, textAlign: 'right' }} />}
          />
          <div className="divider" style={{ margin: '12px 0', borderTop: '1px solid var(--border)' }} />
          <SettingRow
            title={$t('单文件分块传输最大数量')}
            description={withDefaultValue($t('控制单个文件在同一时间允许并发传输的分块数量'), '8')}
            action={<input className="input" type="number" value={fileManagerUploadMaxChunksPerFile} onChange={onFileManagerUploadMaxChunksPerFileChange} style={{ width: 160, textAlign: 'right' }} />}
          />
          <div className="divider" style={{ margin: '12px 0', borderTop: '1px solid var(--border)' }} />
          <SettingRow
            title={$t('全局在途块上限')}
            description={withDefaultValue($t('控制所有上传任务共享的在途分块总数'), '24')}
            action={<input className="input" type="number" value={fileManagerUploadGlobalInflightLimit} onChange={onFileManagerUploadGlobalInflightLimitChange} style={{ width: 160, textAlign: 'right' }} />}
          />
        </div>
      </div>
      <div>
        <h3 style={{ fontSize: 14, color: 'var(--text-primary)', marginBottom: 12, fontWeight: 600 }}>{$t('下载保存')}</h3>
        <div className="form-group" style={{ background: 'var(--surface-overlay)', padding: 16, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
          <SettingRow
            title={$t('每次下载都询问')}
            description={$t('开启后，每次下载文件或文件夹前都先询问保存位置；关闭后直接保存到默认位置')}
            action={<ToggleSwitch checked={fileManagerAskDownloadEveryTime} onChange={onToggleFileManagerAskDownloadEveryTime} />}
          />
          <div className="divider" style={{ margin: '12px 0', borderTop: '1px solid var(--border)' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ color: 'var(--text-primary)', fontSize: 13 }}>{$t('下载遇到同名时')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
              <RadioOption
                selected={fileManagerDownloadConflictStrategy === 'diff_overwrite'}
                label={$t('差异覆盖')}
                description={$t('目录下载时逐文件比较，大小或修改时间任一不同即覆盖，相同则跳过')}
                onClick={() => onFileManagerDownloadConflictStrategyChange('diff_overwrite')}
              />
              <RadioOption
                selected={fileManagerDownloadConflictStrategy === 'force_overwrite'}
                label={$t('强制覆盖')}
                description={$t('文件直接覆盖；文件夹保留多余本地文件，仅覆盖远端存在的同名内容')}
                onClick={() => onFileManagerDownloadConflictStrategyChange('force_overwrite')}
              />
              <RadioOption
                selected={fileManagerDownloadConflictStrategy === 'prompt'}
                label={$t('每次都询问我')}
                description={$t('首次遇到冲突时询问，并可应用到本次剩余冲突')}
                onClick={() => onFileManagerDownloadConflictStrategyChange('prompt')}
              />
              <RadioOption
                selected={fileManagerDownloadConflictStrategy === 'auto_rename'}
                label={$t('自动重命名')}
                description={$t('保留已有文件，下载结果自动追加后缀')}
                onClick={() => onFileManagerDownloadConflictStrategyChange('auto_rename')}
              />
            </div>
          </div>
          {fileManagerDownloadConflictStrategy === 'diff_overwrite' && (
            <>
              <div className="divider" style={{ margin: '12px 0', borderTop: '1px solid var(--border)' }} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                <SettingRow
                  title={$t('比较文件大小')}
                  description={$t('大小不同即判定为差异')}
                  action={<ToggleSwitch checked={fileManagerDownloadConflictDiffBySize} onChange={onToggleFileManagerDownloadConflictDiffBySize} />}
                />
                <SettingRow
                  title={$t('比较修改时间')}
                  description={$t('修改时间不同即判定为差异')}
                  action={<ToggleSwitch checked={fileManagerDownloadConflictDiffByMtime} onChange={onToggleFileManagerDownloadConflictDiffByMtime} />}
                />
              </div>
            </>
          )}
          {fileManagerDownloadConflictStrategy === 'auto_rename' && (
            <>
              <div className="divider" style={{ margin: '12px 0', borderTop: '1px solid var(--border)' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ color: 'var(--text-primary)', fontSize: 13 }}>{$t('自动重命名后缀')}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                  <RadioOption
                    selected={fileManagerDownloadRenameSuffixMode === 'timestamp'}
                    label={$t('高精度时间戳')}
                    description={$t('格式：name_yyyymmdd_hhmmss_nnnnnnnnn.ext')}
                    onClick={() => onFileManagerDownloadRenameSuffixModeChange('timestamp')}
                  />
                  <RadioOption
                    selected={fileManagerDownloadRenameSuffixMode === 'random'}
                    label={$t('随机数')}
                    description={$t('格式：name_ab12cd34.ext')}
                    onClick={() => onFileManagerDownloadRenameSuffixModeChange('random')}
                  />
                  <RadioOption
                    selected={fileManagerDownloadRenameSuffixMode === 'sequence'}
                    label={$t('顺序号 +1')}
                    description={$t('格式：name_1.ext、name_2.ext，自动在已有最大序号上加 1')}
                    onClick={() => onFileManagerDownloadRenameSuffixModeChange('sequence')}
                  />
                </div>
              </div>
            </>
          )}
          <div className="divider" style={{ margin: '12px 0', borderTop: '1px solid var(--border)' }} />
          <SettingRow
            title={$t('下载默认保存位置')}
            description={(
              <>
                <div>{$t('支持变量：{value}（程序所在目录）', { value: '${APP_DIR}' })}</div>
                <div>{$t('预保存：{path}', { path: fileManagerDownloadDefaultDirPreview || $t('加载中...') })}</div>
              </>
            )}
            action={<input className="input" type="text" value={fileManagerDownloadDefaultDir} onChange={onFileManagerDownloadDefaultDirChange} style={{ width: 260 }} />}
          />
        </div>
      </div>
    </div>
  );
}