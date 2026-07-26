import React, { useEffect, useState } from 'react';
import * as AppGo from '../../../wailsjs/go/main/App.js';
import { t as $t } from '../../i18n.js';
import {
  APP_GITHUB_ANDROID_RELEASES_URL,
  APP_GITHUB_ANDROID_REPO_URL,
  APP_GITHUB_ISSUES_URL,
  APP_GITHUB_RELEASES_URL,
  APP_GITHUB_REPO_URL,
} from '../../config.js';
import logoImg from '../../assets/logo.png';
import logoLightImg from '../../assets/logo_q.png';
import logoDarkImg from '../../assets/logo_s.png';
import { Z } from '../../constants/zIndex';
import { AboutLink } from './SharedComponents';

const CONTRIBUTORS_CACHE_TTL = 10 * 60 * 1000;
const CONTRIBUTORS_API_URL = 'https://lumin.callmy.vip/api/';

let contributorsCache = {
  data: null,
  expiresAt: 0,
};

function getFreshContributorsCache() {
  if (Array.isArray(contributorsCache.data) && contributorsCache.data.length > 0 && Date.now() < contributorsCache.expiresAt) {
    return contributorsCache.data;
  }
  return null;
}

function getResolvedThemeMode() {
  const savedTheme = localStorage.getItem('themeMode') || 'dark';
  if (savedTheme === 'system') {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  return savedTheme === 'light' ? 'light' : 'dark';
}

function resolveContributorAvatar(value) {
  const rawValue = typeof value === 'string' ? value.trim() : '';
  if (!rawValue) {
    return '';
  }
  if (/^data:image\/[a-z0-9.+-]+;base64,/i.test(rawValue)) {
    return rawValue;
  }
  try {
    const parsed = new URL(rawValue);
    parsed.searchParams.delete('s');
    parsed.searchParams.delete('v');
    return parsed.toString();
  } catch {
    return rawValue;
  }
}

function normalizeContributors(payload) {
  if (!Array.isArray(payload)) {
    return [];
  }
  return payload
    .map((item) => {
      const author = item?.author && typeof item.author === 'object' ? item.author : item;
      const login = typeof author?.login === 'string' ? author.login.trim() : '';
      const avatar = resolveContributorAvatar(
        typeof author?.avatar === 'string'
          ? author.avatar
          : (typeof item?.avatar === 'string' ? item.avatar : '')
      );
      const path = typeof author?.path === 'string' ? author.path.trim() : '';
      const total = Number(item?.total) || 0;
      const weeks = Array.isArray(item?.weeks) ? item.weeks : (Array.isArray(item?.weeeks) ? item.weeeks : []);
      const additions = weeks.reduce((sum, week) => sum + (Number(week?.a) || 0), 0);
      const deletions = weeks.reduce((sum, week) => sum + (Number(week?.d) || 0), 0);
      if (!login || !avatar || !path || total <= 0) {
        return null;
      }
      const profileUrl = path.startsWith('http')
        ? path
        : `https://github.com${path.startsWith('/') ? path : `/${path}`}`;
      return {
        login,
        avatar,
        total,
        additions,
        deletions,
        profileUrl,
      };
    })
    .filter(Boolean)
    .sort((left, right) => right.total - left.total);
}

async function fetchContributorsFromApi() {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(`${CONTRIBUTORS_API_URL}github/contributors?repoUrl=${encodeURIComponent(APP_GITHUB_REPO_URL)}`, {
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function loadContributors() {
  const cached = getFreshContributorsCache();
  if (cached) {
    return cached;
  }
  let payload = null;
  try {
    payload = await fetchContributorsFromApi();
  } catch {
    payload = await AppGo.GetGitHubContributors();
  }
  const data = normalizeContributors(payload);
  if (data.length > 0) {
    contributorsCache.data = data;
    contributorsCache.expiresAt = Date.now() + CONTRIBUTORS_CACHE_TTL;
  } else {
    contributorsCache.data = null;
    contributorsCache.expiresAt = 0;
  }
  return data;
}

export default function AppTab({ CURRENT_VERSION, BUILD_TIME, updateInfo, checkingUpdate, downloadProgress, onCheckUpdate, onApplyUpdate }) {
  const [contributors, setContributors] = useState(() => getFreshContributorsCache() || []);
  const [contributorsLoading, setContributorsLoading] = useState(() => !getFreshContributorsCache());
  const [showRefreshedLogo, setShowRefreshedLogo] = useState(false);
  const [resolvedThemeMode, setResolvedThemeMode] = useState(() => getResolvedThemeMode());
  const logoTransitionImg = resolvedThemeMode === 'light' ? logoLightImg : logoDarkImg;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setShowRefreshedLogo(true);
    }, 260);
    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const refreshThemeMode = () => {
      setResolvedThemeMode(getResolvedThemeMode());
    };
    const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
    window.addEventListener('theme-mode-changed', refreshThemeMode);
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', refreshThemeMode);
    } else if (typeof mediaQuery.addListener === 'function') {
      mediaQuery.addListener(refreshThemeMode);
    }
    return () => {
      window.removeEventListener('theme-mode-changed', refreshThemeMode);
      if (typeof mediaQuery.removeEventListener === 'function') {
        mediaQuery.removeEventListener('change', refreshThemeMode);
      } else if (typeof mediaQuery.removeListener === 'function') {
        mediaQuery.removeListener(refreshThemeMode);
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const cached = getFreshContributorsCache();
    if (cached) {
      setContributors(cached);
      setContributorsLoading(false);
      return () => {
        cancelled = true;
      };
    }
    setContributorsLoading(true);
    loadContributors()
      .then((data) => {
        if (cancelled) {
          return;
        }
        setContributors(data);
        setContributorsLoading(false);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setContributors([]);
        setContributorsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', maxWidth: 'none', padding: '16px 24px', gap: 32 }}>
      {/* 顶部布局：图标与标题 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        <div
          style={{
            width: 96,
            height: 96,
            position: 'relative',
            borderRadius: 24,
            overflow: 'hidden',
            boxShadow: 'var(--shadow-sm)',
            border: '1px solid var(--border-light)',
            background: 'var(--surface-overlay)',
            flexShrink: 0,
          }}
        >
          <img
            src={logoImg}
            alt="Lumin"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              opacity: showRefreshedLogo ? 0 : 1,
              transform: showRefreshedLogo ? 'scale(0.9) rotate(-8deg)' : 'scale(1) rotate(0deg)',
              filter: showRefreshedLogo ? 'blur(8px)' : 'blur(0px)',
              transition: 'opacity 0.6s ease, transform 0.7s cubic-bezier(0.22, 1, 0.36, 1), filter 0.6s ease',
            }}
          />
          <img
            src={logoTransitionImg}
            alt="Lumin Refresh"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              opacity: showRefreshedLogo ? 1 : 0,
              transform: showRefreshedLogo ? 'scale(1) rotate(0deg)' : 'scale(1.12) rotate(8deg)',
              filter: showRefreshedLogo ? 'blur(0px)' : 'blur(10px)',
              transition: 'opacity 0.6s ease, transform 0.7s cubic-bezier(0.22, 1, 0.36, 1), filter 0.6s ease',
            }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{
            fontSize: 32,
            fontWeight: 800,
            color: 'var(--text-primary)',
            letterSpacing: '-0.5px',
            display: 'flex',
            alignItems: 'baseline',
            gap: 8
          }}>
            Lumin
            <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-tertiary)', letterSpacing: '0' }}>by WuMing</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
              {CURRENT_VERSION}
            </span>
            {BUILD_TIME && (
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                {BUILD_TIME}
              </span>
            )}
            <button
              onClick={onCheckUpdate}
              disabled={checkingUpdate}
              style={{
                marginLeft: 4,
                background: 'var(--surface-overlay)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '6px 14px',
                fontSize: 12,
                fontWeight: 500,
                cursor: checkingUpdate ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.2s',
                opacity: checkingUpdate ? 0.7 : 1,
                flexShrink: 0
              }}
              onMouseEnter={(e) => { if(!checkingUpdate) { e.currentTarget.style.background = 'var(--surface-sunken)'; e.currentTarget.style.color = 'var(--text-secondary)'; } }}
              onMouseLeave={(e) => { if(!checkingUpdate) { e.currentTarget.style.background = 'var(--surface-overlay)'; e.currentTarget.style.color = 'var(--text-secondary)'; } }}
            >
              <svg className={checkingUpdate ? 'spin' : ''} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6"></path><path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path><path d="M3 22v-6h6"></path><path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path></svg>
              {checkingUpdate
                 ? $t('检查中...')
                 : $t('检查更新')}
            </button>
            {(updateInfo?.hasUpdate || downloadProgress >= 0) && (
              <span
                onClick={onApplyUpdate}
                style={{
                  background: downloadProgress >= 0 ? 'var(--accent-dim)' : 'rgba(var(--success-rgb), 0.12)',
                  color: downloadProgress >= 0 ? 'var(--accent)' : 'var(--success)',
                  borderRadius: 12,
                  padding: '2px 8px',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: downloadProgress >= 0 ? 'default' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  boxShadow: 'none',
                  position: 'relative',
                  overflow: 'hidden',
                  minWidth: 80,
                  justifyContent: 'center'
                }}
              >
                {downloadProgress >= 0 && (
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, background: 'rgba(var(--accent-rgb), 0.22)', width: `${downloadProgress}%`, transition: 'width 0.2s ease-out' }}></div>
                )}
                <span style={{ position: 'relative', zIndex: Z.CONTENT, display: 'flex', alignItems: 'center', gap: 4 }}>
                  {downloadProgress >= 0 ? (
                    <>
                      <svg className="spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6"></path><path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path><path d="M3 22v-6h6"></path><path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path></svg>
                      {Math.round(downloadProgress)}%
                    </>
                  ) : (
                    <>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
                      {updateInfo.latestVersion} {$t('立即更新')}
                    </>
                  )}
                </span>
              </span>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 12, marginTop: 12 }}>
        <AboutLink
          icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M9 15L15 15"></path><path d="M12 12L12 18"></path></svg>}
          title={$t('反馈问题')}
          url={APP_GITHUB_ISSUES_URL}
        />
        <AboutLink
          icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path></svg>}
          title={$t('GitHub')}
          url={APP_GITHUB_REPO_URL}
        />
        <AboutLink
          icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>}
          title={$t('Android 客户端')}
          url={APP_GITHUB_ANDROID_REPO_URL}
        />
        <AboutLink
          icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>}
          title={$t('更新内容')}
          url={APP_GITHUB_RELEASES_URL}
        />
      </div>

      <div style={{
        marginTop: 4,
        padding: '14px 16px',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border)',
        background: 'var(--surface-overlay)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
          {$t('跨端说明')}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
          {$t('本产品为桌面端。Android 客户端独立仓库、分开发版，数据可通过云同步互通。')}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.55 }}>
          {$t('本 Release 仅 Desktop，Android 端见 Lumin-SSH-Android')}
          {' · '}
          {$t('许可见仓库 LICENSE')}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 2 }}>
          <button
            type="button"
            onClick={() => window.runtime?.BrowserOpenURL(APP_GITHUB_ANDROID_REPO_URL)}
            style={{
              background: 'var(--surface-base)',
              color: 'var(--accent)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {$t('打开 Android 仓库')}
          </button>
          <button
            type="button"
            onClick={() => window.runtime?.BrowserOpenURL(APP_GITHUB_ANDROID_RELEASES_URL)}
            style={{
              background: 'var(--surface-base)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {$t('Android 发行版')}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 8 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
          {$t('特别鸣谢')}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14, padding: 18, borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', background: 'var(--surface-base)', alignContent: 'start', maxHeight: 'min(420px, 48vh)', overflowY: 'auto', overflowX: 'hidden' }}>
          {contributorsLoading
            ? Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={`contributor-skeleton-${index}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', borderRadius: 'var(--radius-md)', background: 'var(--surface-overlay)', border: '1px solid var(--border)' }}
                >
                  <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--surface-hover)', flexShrink: 0 }}></div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0, flex: 1 }}>
                    <div style={{ width: 116, height: 16, borderRadius: 999, background: 'var(--surface-hover)' }}></div>
                    <div style={{ width: 68, height: 12, borderRadius: 999, background: 'var(--surface-hover)' }}></div>
                    <div style={{ width: 138, height: 14, borderRadius: 999, background: 'var(--surface-hover)' }}></div>
                  </div>
                </div>
              ))
            : contributors.map((item) => (
                <div
                  key={item.login}
                  onClick={() => window.runtime?.BrowserOpenURL(item.profileUrl)}
                  className="about-list-item"
                  style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', borderRadius: 'var(--radius-md)', cursor: 'pointer', transition: 'all 0.2s', background: 'var(--surface-overlay)', border: '1px solid var(--border)', textAlign: 'left' }}
                >
                  <img
                    src={item.avatar}
                    alt={item.login}
                    loading="lazy"
                    style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-xs)', flexShrink: 0 }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3, wordBreak: 'break-word' }}>
                      {item.login}
                    </div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="12" cy="12" r="3"></circle>
                        <line x1="3" y1="12" x2="9" y2="12"></line>
                        <line x1="15" y1="12" x2="21" y2="12"></line>
                      </svg>
                      {item.total}
                    </div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                      <span style={{ color: 'var(--success)', fontWeight: 600 }}>+{item.additions.toLocaleString()} ++</span>
                      <span style={{ color: 'var(--danger)', fontWeight: 600 }}>-{item.deletions.toLocaleString()} --</span>
                    </div>
                  </div>
                </div>
              ))}
        </div>
      </div>
    </div>
  );
}
