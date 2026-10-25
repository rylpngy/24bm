import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
export const projectButton =
  'inline-flex h-9 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 disabled:opacity-40';
export const projectInput =
  'min-h-10 w-full min-w-0 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-normal';
export const projectMoney = (value: number | null | undefined) =>
  value == null
    ? '待核对'
    : new Intl.NumberFormat('zh-CN', {
        style: 'currency',
        currency: 'CNY',
      }).format(value);
export function ProjectDialog({
  title,
  children,
  onClose,
  busy = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
}) {
  const panel = useRef<HTMLDivElement>(null),
    close = useRef(onClose),
    pending = useRef(busy);
  close.current = onClose;
  pending.current = busy;
  useEffect(() => {
    const old = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !pending.current) {
        e.preventDefault();
        close.current();
      }
      if (e.key === 'Tab') {
        const items = [
          ...(panel.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]',
          ) || []),
        ];
        const first = items[0],
          last = items.at(-1);
        if (!first) {
          e.preventDefault();
          return;
        }
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === panel.current)
        ) {
          e.preventDefault();
          last?.focus();
        } else if (
          !e.shiftKey &&
          (document.activeElement === last ||
            document.activeElement === panel.current)
        ) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('keydown', key);
      document.body.style.overflow = overflow;
      if (old?.isConnected) old.focus();
    };
  }, []);
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-3 sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[90dvh] w-full max-w-5xl overflow-y-auto rounded-lg bg-white shadow-xl outline-none"
      >
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 bg-white p-5">
          <h2 className="min-w-0 break-words text-lg font-bold">{title}</h2>
          <button
            type="button"
            className={projectButton}
            title="关闭"
            aria-label="关闭"
            disabled={busy}
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </header>
        <div className="space-y-5 p-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
