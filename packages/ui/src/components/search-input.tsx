import { useState } from 'react';
import { Search } from 'lucide-react';
import { cn } from '../lib/cn';
import { useI18n } from '../i18n/i18n';

export interface SearchInputProps {
  onSearch: (keyword: string) => void;
  placeholder?: string;
  className?: string;
}

/** 列表搜索框——输入 + 搜索按钮提交(Enter 亦可)+ 清除。自管输入态,提交时回调已 trim 关键词。 */
export function SearchInput({ onSearch, placeholder, className }: SearchInputProps) {
  const { t } = useI18n();
  const [text, setText] = useState('');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSearch(text.trim());
      }}
      className={cn('mb-3 flex items-center gap-1.5', className)}
    >
      <div className="relative w-48 sm:w-56">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder ?? t('搜索')}
          className="h-8 w-full rounded-md border border-slate-200 bg-slate-50 pl-8 pr-2.5 text-xs font-semibold outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
        />
      </div>
      <button
        type="submit"
        aria-label={t('搜索')}
        className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md bg-blue-600 px-2.5 text-xs font-black text-white transition hover:bg-blue-700"
      >
        <Search size={13} /> {t('搜索')}
      </button>
      {text && (
        <button
          type="button"
          onClick={() => {
            setText('');
            onSearch('');
          }}
          className="inline-flex h-8 shrink-0 items-center rounded-md border border-slate-200 bg-white px-2.5 text-xs font-black text-slate-600 hover:bg-slate-50"
        >
          {t('清除')}
        </button>
      )}
    </form>
  );
}
