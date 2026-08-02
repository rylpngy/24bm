import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { I18nProvider, useI18n } from './i18n';

function Probe() {
  const { locale, setLocale, t } = useI18n();
  return (
    <div>
      <p data-testid="locale">{locale}</p>
      <p data-testid="known">{t('采购需求')}</p>
      <p data-testid="unknown">{t('某个还没翻译的业务文案')}</p>
      <button type="button" onClick={() => setLocale('en-US')}>
        to-en
      </button>
    </div>
  );
}

describe('i18n', () => {
  // 测试环境不保证有 localStorage(Node 内置实现需显式开启),装一个内存替身。
  beforeEach(() => {
    const store = new Map<string, string>();
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
        clear: () => store.clear(),
      },
    });
  });

  it('缺省中文,切换后按词典给出英文', () => {
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    );
    expect(screen.getByTestId('locale')).toHaveTextContent('zh-CN');
    expect(screen.getByTestId('known')).toHaveTextContent('采购需求');

    fireEvent.click(screen.getByRole('button', { name: 'to-en' }));
    expect(screen.getByTestId('locale')).toHaveTextContent('en-US');
    expect(screen.getByTestId('known')).toHaveTextContent('Requisitions');
  });

  it('词典缺条目时回落中文原文,不出现占位符', () => {
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'to-en' }));
    expect(screen.getByTestId('unknown')).toHaveTextContent('某个还没翻译的业务文案');
  });

  it('语言选择写入本地存储,刷新后保持', () => {
    const { unmount } = render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'to-en' }));
    expect(window.localStorage.getItem('24bid.locale')).toBe('en-US');
    unmount();

    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    );
    expect(screen.getByTestId('locale')).toHaveTextContent('en-US');
  });

  it('未套 Provider 时直通中文,组件可独立渲染', () => {
    render(<Probe />);
    expect(screen.getByTestId('locale')).toHaveTextContent('zh-CN');
    expect(screen.getByTestId('known')).toHaveTextContent('采购需求');
  });
});
