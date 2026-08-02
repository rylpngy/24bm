import { useEffect, useState } from 'react';
import { AlertTriangle, ShieldQuestion } from 'lucide-react';
import { cn } from '../lib/cn';
import { useI18n } from '../i18n/i18n';

export interface ConfirmDialogProps {
  open: boolean;
  /** 弹窗标题(动作名,如「确认流标」)。 */
  title: string;
  /** 说明文字:动作后果、适用情形。 */
  message: string;
  /** danger=红色确认按钮(终止/删除类);primary=蓝色。 */
  tone?: 'danger' | 'primary';
  confirmLabel?: string;
  cancelLabel?: string;
  /** 需要用户输入时配置;optional=false 时输入为必填。 */
  input?: {
    label: string;
    placeholder?: string;
    optional?: boolean;
    /** password 等;默认 text。 */
    type?: string;
    /** 最小长度(仅必填时校验)。 */
    minLength?: number;
  };
  busy?: boolean;
  onConfirm: (inputValue: string) => void;
  onCancel: () => void;
}

/** 系统统一确认弹窗:替代原生 window.confirm / window.prompt,样式与系统 UI 一致。 */
export function ConfirmDialog({
  open,
  title,
  message,
  tone = 'primary',
  confirmLabel,
  cancelLabel,
  input,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useI18n();
  const [value, setValue] = useState('');
  useEffect(() => {
    if (open) setValue('');
  }, [open]);

  if (!open) return null;
  const inputInvalid =
    !!input && !input.optional && (value.trim().length === 0 || value.trim().length < (input.minLength ?? 1));
  const danger = tone === 'danger';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-6"
      onClick={busy ? undefined : onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
              danger ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600',
            )}
          >
            {danger ? <AlertTriangle size={19} /> : <ShieldQuestion size={19} />}
          </span>
          <div className="min-w-0">
            <p className="text-base font-black text-slate-950">{title}</p>
            <p className="mt-1.5 text-sm font-semibold leading-6 text-slate-600">{message}</p>
          </div>
        </div>

        {input && (
          <label className="mt-4 block">
            <span className="text-xs font-black text-slate-500">
              {!input.optional && <span className="mr-1 text-red-500">*</span>}
              {input.label}
              {input.optional && <span className="ml-1 text-slate-400">(选填)</span>}
            </span>
            <input
              autoFocus
              type={input.type ?? 'text'}
              value={value}
              placeholder={input.placeholder}
              onChange={(e) => setValue(e.target.value)}
              className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
            />
            {!input.optional && (input.minLength ?? 0) > 1 && (
              <span className="mt-1 block text-[11px] font-bold text-slate-400">至少 {input.minLength} 位。</span>
            )}
          </label>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="inline-flex h-10 items-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          >
            {cancelLabel ?? t('取消')}
          </button>
          <button
            type="button"
            disabled={busy || inputInvalid}
            onClick={() => onConfirm(value.trim())}
            className={cn(
              'inline-flex h-10 items-center rounded-lg px-5 text-sm font-black text-white transition disabled:cursor-not-allowed disabled:bg-slate-300',
              danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700',
            )}
          >
            {busy ? t('处理中…') : confirmLabel ?? t('确定')}
          </button>
        </div>
      </div>
    </div>
  );
}
