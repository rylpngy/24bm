import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { EN_DICTIONARY } from './en';

export type Locale = 'zh-CN' | 'en-US';

const STORAGE_KEY = '24bid.locale';

/**
 * 轻量 i18n(G-3):**以中文原文为 key**,英文词典缺条目时原样回落中文。
 *
 * 这样选型是为了增量落地——把某处字面量包一层 t() 即可接入,未包的地方保持
 * 现状而不会出现 "missing.key" 之类的占位符;词典是纯增量资产,不需要一次性
 * 铺满 39 个页面。代价是同一中文在不同语境需要不同英文时无法区分,遇到时
 * 再按 `原文@语境` 形式加限定 key。
 */
interface I18nValue {
  locale: Locale;
  setLocale: (next: Locale) => void;
  t: (zh: string) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

// localStorage 在无痕模式与部分受限环境下会缺失或抛错,读写一律吞掉异常:
// 语言偏好丢失只是回落中文,不该让整个应用崩在启动路径上。
function readStoredLocale(): Locale {
  try {
    return window.localStorage?.getItem(STORAGE_KEY) === 'en-US' ? 'en-US' : 'zh-CN';
  } catch {
    return 'zh-CN';
  }
}

function persistLocale(locale: Locale): void {
  try {
    window.localStorage?.setItem(STORAGE_KEY, locale);
  } catch {
    // 忽略:本次会话内仍然生效,只是不跨刷新保持。
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readStoredLocale);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    persistLocale(next);
  }, []);

  const t = useCallback(
    (zh: string) => (locale === 'en-US' ? EN_DICTIONARY[zh] ?? zh : zh),
    [locale],
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/**
 * 未包 Provider 时回落中文直通,组件在任何宿主里都能独立渲染
 * (测试与 Storybook 式用法不必强制套壳)。
 */
export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (ctx) return ctx;
  return { locale: 'zh-CN', setLocale: () => {}, t: (zh: string) => zh };
}
