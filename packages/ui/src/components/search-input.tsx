import { useState } from 'react';
import { Search } from 'lucide-react';
import { cn } from '../lib/cn';

export interface SearchInputProps {
  onSearch: (keyword: string) => void;
  placeholder?: string;
  className?: string;
}

/** 列表搜索框——输入 + 搜索按钮提交(Enter 亦可)+ 清除。自管输入态,提交时回调已 trim 关键词。 */
export function SearchInput({ onSearch, placeholder = '搜索', className }: SearchInputProps) {
  const [text, setText] = useState('');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSearch(text.trim());
      }}
      className={cn('mb-3 flex flex-wrap items-center gap-2', className)}
    >
      <div className="relative min-w-[200px] flex-1">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm font-semibold outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
        />
      </div>
      <button
        type="submit"
        className="inline-flex h-9 items-center gap-1.5 rounded-md bg-blue-600 px-4 text-xs font-black text-white transition hover:bg-blue-700"
      >
        <Search size={14} /> 搜索
      </button>
      {text && (
        <button
          type="button"
          onClick={() => {
            setText('');
            onSearch('');
          }}
          className="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 hover:bg-slate-50"
        >
          清除
        </button>
      )}
    </form>
  );
}
