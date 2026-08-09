import { useState, useEffect, useCallback, useRef } from 'react';
import * as AppGo from '../../bindings/luminssh-go/internal/wailsapp/app.js';
import { APP_GITHUB_RELEASE_API, APP_VERSION } from '../config.js';
import { Events, Browser } from "@wailsio/runtime";
import { t } from '../i18n.js';

const RELEASE_API = APP_GITHUB_RELEASE_API;

let sharedDownloadProgress = -1;
const downloadProgressListeners = new Set();

function setSharedDownloadProgress(progress) {
  sharedDownloadProgress = progress;
  downloadProgressListeners.forEach((listener) => listener(progress));
}

// 语义化版本比较：latest > current 返回 true
export function compareVersions(latestVer, currentVer) {
  if (latestVer === currentVer) return false;
  const lParts = latestVer.split('.').map(Number);
  const cParts = currentVer.split('.').map(Number);
  for (let i = 0; i < Math.max(lParts.length, cParts.length); i++) {
    const l = lParts[i] || 0;
    const c = cParts[i] || 0;
    if (l > c) return true;
    if (l < c) return false;
  }
  return false;
}

// 判断当前是否 Linux 平台
function isLinux() {
  return navigator.userAgent.includes('Linux') || navigator.platform.includes('Linux');
}

// 判断当前是否 macOS 平台
function isMacOS() {
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform) || navigator.userAgent.includes('Mac OS');
}

// 判断当前 macOS 的 CPU 架构，用于选择对应的 dmg 下载
async function getMacArch() {
  try {
    const arch = await AppGo.GetArch();
    if (arch === 'arm64') return 'arm64';
    if (arch === 'amd64') return 'amd64';
  } catch {}
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('arm') || ua.includes('aarch64')) return 'arm64';
  return 'amd64';
}

function isGithubAssetDownloadUrl(url) {
  if (typeof url !== 'string' || !url.startsWith('https://')) return false;
  try {
    const parsed = new URL(url);
    // 直连与常见 ghproxy 前缀都会落到 github.com/.../releases/download/...
    return (
      parsed.hostname === 'github.com' ||
      parsed.hostname.endsWith('.github.com') ||
      /\/github\.com\//.test(parsed.pathname)
    ) && /\/releases\/download\//.test(url);
  } catch {
    return false;
  }
}

function pickAsset(assets, predicate) {
  if (!Array.isArray(assets) || assets.length === 0) return null;
  return assets.find((a) => {
    const name = typeof a?.name === 'string' ? a.name : '';
    const url = typeof a?.browser_download_url === 'string' ? a.browser_download_url : '';
    if (!name || !url || !isGithubAssetDownloadUrl(url)) return false;
    // 校验文件本身不可作为更新包
    if (name.toLowerCase().endsWith('.sha256')) return false;
    return predicate(name);
  }) || null;
}

/**
 * 严格匹配当前平台可安装资产。
 * 匹配失败返回 null（绝不回退到 Release 页面 html_url + 假文件名），
 * 避免 Windows 包尚未上传时用错误 URL 触发热替换。
 */
async function resolveDownloadAsset(data) {
  const assets = data?.assets;
  if (!Array.isArray(assets) || assets.length === 0) {
    return null;
  }

  // macOS: Release 使用 DMG 分发，按架构选择对应的 dmg
  if (isMacOS()) {
    const arch = await getMacArch();
    const targetAsset =
      pickAsset(assets, (name) => name.toLowerCase().includes(`-${arch}.dmg`)) ||
      pickAsset(assets, (name) => name.toLowerCase().endsWith('.dmg'));
    if (!targetAsset) return null;
    return { url: targetAsset.browser_download_url, filename: targetAsset.name };
  }

  // Linux: 优先选取 .deb 包，其次 .rpm（不拿无扩展名二进制当热更包）
  if (isLinux()) {
    const targetAsset =
      pickAsset(assets, (name) => name.toLowerCase().endsWith('.deb')) ||
      pickAsset(assets, (name) => name.toLowerCase().endsWith('.rpm'));
    if (!targetAsset) return null;
    return { url: targetAsset.browser_download_url, filename: targetAsset.name };
  }

  // Windows: 便携版 / 安装版
  let isPortable = false;
  try {
    isPortable = await AppGo.IsPortableVersion();
  } catch {
    isPortable = false;
  }

  let targetAsset = null;
  if (isPortable) {
    // 优先明确 portable 命名，再退到非 installer 的 .exe
    targetAsset =
      pickAsset(assets, (name) => /portable\.exe$/i.test(name)) ||
      pickAsset(assets, (name) => !/installer|setup/i.test(name) && name.toLowerCase().endsWith('.exe'));
  } else {
    targetAsset =
      pickAsset(assets, (name) => /installer\.exe$/i.test(name)) ||
      pickAsset(assets, (name) => /setup|installer/i.test(name) && name.toLowerCase().endsWith('.exe'));
  }
  // 不再用「任意 .exe」兜底：避免误选到错误产物
  if (!targetAsset) return null;
  return { url: targetAsset.browser_download_url, filename: targetAsset.name };
}

/**
 * 自动更新检查 Hook，封装 GitHub Releases 检查、资源匹配、下载进度、应用更新逻辑
 * @param {Object} options
 * @param {Function} [options.onResult] - (result) => void
 * @param {Function} [options.onError] - (err) => void
 */
export function useUpdateChecker({ onResult, onError } = {}) {
  const [checking, setChecking] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(sharedDownloadProgress);

  const cbRef = useRef({ onResult, onError });
  cbRef.current = { onResult, onError };

  useEffect(() => {
    downloadProgressListeners.add(setDownloadProgress);
    const off = Events.On('app-update-progress', (progress) => {
      if (typeof progress === 'number') setSharedDownloadProgress(progress);
    });
    return () => {
      downloadProgressListeners.delete(setDownloadProgress);
      off?.();
    };
  }, []);

  const checkUpdate = useCallback(async () => {
    setChecking(true);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const res = await fetch(RELEASE_API, { signal: controller.signal });
      if (!res.ok) throw new Error('API request failed');
      const data = await res.json();
      if (!data || !data.tag_name) return null;

      const latest = data.tag_name.replace(/^v+/i, '');
      const versionNewer = compareVersions(latest, APP_VERSION);
      if (!versionNewer) {
        const result = {
          hasUpdate: false,
          latestVersion: latest,
          url: '',
          filename: '',
          assetReady: true,
          reason: 'up_to_date',
        };
        cbRef.current.onResult?.(result);
        return result;
      }

      const asset = await resolveDownloadAsset(data);
      if (!asset?.url || !asset?.filename) {
        // 版本更新了，但当前平台安装包尚未上传（例如 Windows 构建较慢）
        const result = {
          hasUpdate: false,
          latestVersion: latest,
          url: '',
          filename: '',
          assetReady: false,
          reason: 'asset_pending',
        };
        cbRef.current.onResult?.(result);
        return result;
      }

      const result = {
        hasUpdate: true,
        latestVersion: latest,
        url: asset.url,
        filename: asset.filename,
        assetReady: true,
        reason: 'ready',
      };
      cbRef.current.onResult?.(result);
      return result;
    } catch (err) {
      cbRef.current.onError?.(err);
      return null;
    } finally {
      clearTimeout(timeout);
      setChecking(false);
    }
  }, []);

  const applyUpdate = useCallback(async (updateInfo) => {
    if (!updateInfo || !updateInfo.url) {
      throw new Error('当前平台安装包尚未就绪，请稍后再试');
    }
    if (downloadProgress >= 0) return;

    // 仅允许真实的 GitHub Release 资产下载地址 + 已知安装包后缀
    const packageName = String(updateInfo.filename || '').toLowerCase();
    if (!isGithubAssetDownloadUrl(updateInfo.url) || !/\.(exe|deb|rpm|dmg)$/.test(packageName)) {
      // 非可安装资产：最多打开浏览器，绝不进入热替换
      if (updateInfo.url) {
        Browser.OpenURL(updateInfo.url);
      }
      throw new Error('未找到可安装的更新包，已取消自动替换');
    }

    setSharedDownloadProgress(0);
    try {
      const proxyFirst = localStorage.getItem('updateUseProxy') === 'true';
      await AppGo.UpdateApp(updateInfo.url, updateInfo.filename, proxyFirst);
    } catch (err) {
      setSharedDownloadProgress(-1);
      throw err;
    }
  }, [downloadProgress]);

  return { checking, downloadProgress, checkUpdate, applyUpdate };
}

/** 将后端/前端更新错误翻成当前语言（中文 key 稳定匹配）。 */
export function formatUpdateError(err) {
  const raw = String(err?.message || err || '').trim();
  if (!raw) return t('更新下载失败');

  // 所有下载源均失败（a → b）: detail
  let m = raw.match(/^所有下载源均失败（(.+?)）(?::\s*(.*))?$/s);
  if (m) {
    const sources = m[1]
      .split(/\s*→\s*/)
      .map((s) => (s === 'GitHub直连' ? t('GitHub直连') : s))
      .join(' → ');
    const head = t('所有下载源均失败（{sources}）', { sources });
    return m[2] ? `${head}: ${formatUpdateErrorDetail(m[2])}` : head;
  }

  // 更新下载失败: detail
  m = raw.match(/^更新下载失败(?::\s*(.*))?$/s);
  if (m) {
    const head = t('更新下载失败');
    return m[1] ? `${head}: ${formatUpdateErrorDetail(m[1])}` : head;
  }

  // source 多线程与单线程均失败: detail
  m = raw.match(/^(.+?) 多线程与单线程均失败(?::\s*(.*))?$/s);
  if (m) {
    const source = m[1] === 'GitHub直连' ? t('GitHub直连') : m[1];
    const head = t('{source} 多线程与单线程均失败', { source });
    return m[2] ? `${head}: ${m[2]}` : head;
  }

  if (raw === '当前平台安装包尚未就绪，请稍后再试' || raw === '未找到可安装的更新包，已取消自动替换') {
    return t(raw);
  }

  // 完整 key 命中则翻，否则原样（保留底层网络错误）
  const full = t(raw);
  return full !== raw ? full : raw;
}

function formatUpdateErrorDetail(detail) {
  const raw = String(detail || '').trim();
  if (!raw) return raw;
  const m = raw.match(/^(.+?) 多线程与单线程均失败(?::\s*(.*))?$/s);
  if (m) {
    const source = m[1] === 'GitHub直连' ? t('GitHub直连') : m[1];
    const head = t('{source} 多线程与单线程均失败', { source });
    return m[2] ? `${head}: ${m[2]}` : head;
  }
  return raw;
}
