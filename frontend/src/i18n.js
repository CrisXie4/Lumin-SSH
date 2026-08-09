import { useState, useEffect } from 'react';

const DEFAULT_LANG = 'zh-CN';

const languageModuleLoaders = import.meta.glob('./i18n/*/basic.js');

// 语言名称不需要加载完整语言包，使用元数据映射可保持语言包按需加载。
const languageLabels = {
  ar: 'العربية',
  bn: 'বাংলা',
  cs: 'Čeština',
  de: 'Deutsch',
  'en-US': 'English',
  es: 'Español',
  'fa-IR': 'فارسی',
  fr: 'Français',
  hi: 'हिन्दी',
  id: 'Bahasa Indonesia',
  it: 'Italiano',
  'ja-JP': '日本語',
  'ko-KR': '한국어',
  nl: 'Nederlands',
  pl: 'Polski',
  'pt-BR': 'Português (Brasil)',
  ro: 'Română',
  ru: 'Русский',
  th: 'ไทย',
  tr: 'Türkçe',
  uk: 'Українська',
  vi: 'Tiếng Việt',
  'zh-CN': '简体中文',
  'zh-HK': '繁體中文（香港）',
  'zh-Hant': '繁體中文',
  'zh-MO': '繁體中文（澳門）',
  'zh-TW': '繁體中文（台灣）',
};

function buildLanguageMap(modules) {
  return Object.fromEntries(
    Object.entries(modules)
      .map(([filePath, value]) => {
        const match = filePath.match(/^\.\/i18n\/([^/]+)\/basic\.js$/);
        return match ? [match[1], value] : null;
      })
      .filter(Boolean)
  );
}

const languageLoaders = buildLanguageMap(languageModuleLoaders);

const loadedDict = Object.create(null);
const loadingPromises = Object.create(null);

function normalizeLanguage(lang) {
  return Object.prototype.hasOwnProperty.call(languageLoaders, lang) ? lang : DEFAULT_LANG;
}

let currentLang = normalizeLanguage(localStorage.getItem('appLanguage') || DEFAULT_LANG);
let activeLang = DEFAULT_LANG;
const listeners = new Set();

async function loadLanguage(lang) {
  const normalizedLang = normalizeLanguage(lang);
  if (loadedDict[normalizedLang]) {
    return loadedDict[normalizedLang];
  }
  if (!loadingPromises[normalizedLang]) {
    loadingPromises[normalizedLang] = languageLoaders[normalizedLang]()
      .then((module) => {
        const table = module?.default && typeof module.default === 'object' ? module.default : {};
        loadedDict[normalizedLang] = table;
        return table;
      })
      .finally(() => {
        delete loadingPromises[normalizedLang];
      });
  }
  return loadingPromises[normalizedLang];
}

function notifyLanguageChanged() {
  listeners.forEach((fn) => fn(activeLang));
}

function getActiveTable() {
  return loadedDict[activeLang] || loadedDict[DEFAULT_LANG] || {};
}

export async function initializeI18n() {
  await loadLanguage(DEFAULT_LANG);
  const nextLang = normalizeLanguage(currentLang);
  currentLang = nextLang;
  localStorage.setItem('appLanguage', nextLang);
  if (nextLang !== DEFAULT_LANG) {
    try {
      await loadLanguage(nextLang);
      activeLang = nextLang;
      return activeLang;
    } catch (error) {
      console.error('[i18n] failed to load language:', nextLang, error);
    }
  }
  activeLang = DEFAULT_LANG;
  return activeLang;
}

export async function setLanguage(lang) {
  const nextLang = normalizeLanguage(lang);
  currentLang = nextLang;
  localStorage.setItem('appLanguage', nextLang);
  try {
    await loadLanguage(nextLang);
    activeLang = nextLang;
  } catch (error) {
    console.error('[i18n] failed to switch language:', nextLang, error);
    activeLang = DEFAULT_LANG;
  }
  notifyLanguageChanged();
  return activeLang;
}

export function getLanguage() {
  return currentLang;
}

export function getAvailableLanguages() {
  return Object.keys(languageLoaders)
    .sort((left, right) => {
      if (left === DEFAULT_LANG) return -1;
      if (right === DEFAULT_LANG) return 1;
      return left.localeCompare(right);
    })
    .map((code) => ({
      code,
      label: typeof languageLabels[code] === 'string' && languageLabels[code].trim()
        ? languageLabels[code].trim()
        : code,
    }));
}

function interpolateText(text, params) {
  if (!params || typeof text !== 'string') return text;
  return text.replace(/\{(\w+)\}/g, (_, name) => params[name] ?? `{${name}}`);
}

function translateDynamicText(text, table) {
  if (typeof text !== 'string' || !text) {
    return text;
  }
  let next = text;
  next = next.replace(/\nai\.change_review\.start_line:(\d+)/g, (_, count) => `\n${interpolateText(table["起始行: {count}"] ?? "起始行: {count}", { count })}`);
  next = next.replace(/\nai\.change_review\.match_count:(\d+)/g, (_, count) => `\n${interpolateText(table["匹配次数: {count}"] ?? "匹配次数: {count}", { count })}`);
  next = next.replace(/\nai\.change_review\.similarity:([\d.]+):([\d.]+)/g, (_, similarity, required) => `\n${interpolateText(table["相似度: {similarity}% / 需要 {required}%"] ?? "相似度: {similarity}% / 需要 {required}%", { similarity, required })}`);
  next = next.replace(/\n\nai\.change_review\.best_match:\n/g, `\n\n${table["最佳匹配片段:"] ?? "最佳匹配片段:"}\n`);
  return next;
}

export function t(key, params) {
  const table = getActiveTable();
  const rawText = table[key] !== undefined ? table[key] : key;
  const translatedText = table[key] !== undefined ? rawText : translateDynamicText(rawText, table);
  return interpolateText(translatedText, params);
}

export function useTranslation() {
  const [lang, setLang] = useState(activeLang);
  useEffect(() => {
    const handler = (nextLang) => setLang(nextLang);
    listeners.add(handler);
    return () => listeners.delete(handler);
  }, []);
  return { t, lang };
}