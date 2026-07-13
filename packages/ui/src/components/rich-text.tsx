import { useEffect, useRef } from 'react';
import {
  Bold,
  Heading2,
  Italic,
  List,
  ListOrdered,
  Quote,
  RemoveFormatting,
  Underline,
} from 'lucide-react';
import { cn } from '../lib/cn';

// ── 安全渲染:白名单标签 + 剥离全部属性(仅 a[href] 保留 http/https) ──────────
const ALLOWED_TAGS = new Set([
  'P', 'BR', 'B', 'STRONG', 'I', 'EM', 'U', 'H3', 'H4',
  'UL', 'OL', 'LI', 'BLOCKQUOTE', 'DIV', 'SPAN', 'A',
]);

export function sanitizeRichText(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  // 自底向上处理:先收集再改动,unwrap 时子节点已处理完毕。
  const elements = Array.from(doc.body.querySelectorAll('*')).reverse();
  for (const el of elements) {
    if (!ALLOWED_TAGS.has(el.tagName)) {
      el.replaceWith(...Array.from(el.childNodes));
      continue;
    }
    for (const attr of Array.from(el.attributes)) {
      if (el.tagName === 'A' && attr.name === 'href' && /^https?:\/\//i.test(attr.value)) continue;
      el.removeAttribute(attr.name);
    }
    if (el.tagName === 'A') {
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener noreferrer');
    }
  }
  return doc.body.innerHTML;
}

// 富文本转纯文本(列表摘要 / 搜索匹配用)。
export function richTextToPlain(html: string): string {
  if (!/<[a-z][\s\S]*>/i.test(html)) return html;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim();
}

const VIEW_CLS =
  'break-words text-sm font-semibold leading-6 text-slate-700 ' +
  '[&_h3]:mt-3 [&_h3]:text-base [&_h3]:font-black [&_h3]:text-slate-950 ' +
  '[&_h4]:mt-2 [&_h4]:text-sm [&_h4]:font-black [&_h4]:text-slate-900 ' +
  '[&_ul]:mt-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mt-1 [&_ol]:list-decimal [&_ol]:pl-5 ' +
  '[&_blockquote]:mt-2 [&_blockquote]:border-l-4 [&_blockquote]:border-slate-200 [&_blockquote]:pl-3 [&_blockquote]:text-slate-500 ' +
  '[&_a]:font-black [&_a]:text-blue-600 [&_a]:underline [&_p]:mt-1 first:[&_p]:mt-0 ' +
  '[&_b]:font-black [&_strong]:font-black';

/** 富文本只读渲染:HTML 内容走白名单消毒;纯文本内容按换行渲染(兼容历史公告)。 */
export function RichTextView({ html, className }: { html: string; className?: string }) {
  if (!/<[a-z][\s\S]*>/i.test(html)) {
    return <div className={cn(VIEW_CLS, 'whitespace-pre-wrap', className)}>{html}</div>;
  }
  return (
    // eslint-disable-next-line react/no-danger -- 内容已经过白名单消毒
    <div className={cn(VIEW_CLS, className)} dangerouslySetInnerHTML={{ __html: sanitizeRichText(html) }} />
  );
}

// ── 编辑器:contentEditable + execCommand 轻量实现(无外部依赖) ─────────────
const TOOLBAR: { cmd: string; arg?: string; icon: typeof Bold; label: string }[] = [
  { cmd: 'bold', icon: Bold, label: '加粗' },
  { cmd: 'italic', icon: Italic, label: '斜体' },
  { cmd: 'underline', icon: Underline, label: '下划线' },
  { cmd: 'formatBlock', arg: 'h3', icon: Heading2, label: '小标题' },
  { cmd: 'insertUnorderedList', icon: List, label: '无序列表' },
  { cmd: 'insertOrderedList', icon: ListOrdered, label: '有序列表' },
  { cmd: 'formatBlock', arg: 'blockquote', icon: Quote, label: '引用' },
  { cmd: 'removeFormat', icon: RemoveFormatting, label: '清除格式' },
];

export interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}

/** 富文本编辑器:工具栏(加粗/斜体/下划线/小标题/列表/引用/清格式)+ 可编辑区,值为 HTML。 */
export function RichTextEditor({ value, onChange, placeholder, minHeight = 160 }: RichTextEditorProps) {
  const ref = useRef<HTMLDivElement>(null);

  // 外部值变化时同步 DOM;编辑中内容一致则跳过,避免光标跳位。
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value || '';
    }
  }, [value]);

  const emit = () => onChange(ref.current?.innerHTML ?? '');
  const exec = (cmd: string, arg?: string) => {
    ref.current?.focus();
    // 强制标签式输出(<b>/<i>/<u>)而非内联 style——消毒白名单只保留语义标签。
    document.execCommand('styleWithCSS', false, 'false');
    document.execCommand(cmd, false, arg);
    emit();
  };

  const empty = richTextToPlain(value).length === 0;

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-100">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-100 bg-slate-50 px-2 py-1.5">
        {TOOLBAR.map((t) => (
          <button
            key={t.label}
            type="button"
            title={t.label}
            aria-label={t.label}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => exec(t.cmd, t.arg)}
            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-white hover:text-slate-900"
          >
            <t.icon size={15} />
          </button>
        ))}
      </div>
      <div className="relative">
        {empty && placeholder && (
          <p className="pointer-events-none absolute left-3 top-2.5 text-sm font-semibold text-slate-300">
            {placeholder}
          </p>
        )}
        <div
          ref={ref}
          contentEditable
          role="textbox"
          aria-multiline="true"
          onInput={emit}
          onBlur={emit}
          className={cn(VIEW_CLS, 'w-full px-3 py-2.5 !font-normal outline-none')}
          style={{ minHeight }}
        />
      </div>
    </div>
  );
}
