import { Activity, AlertCircle, CheckCircle2 } from 'lucide-react';

export type NextActionTone = 'slate' | 'blue' | 'amber' | 'emerald';

const nextActionToneClasses: Record<NextActionTone, string> = {
  slate: 'border-slate-200 bg-slate-50 text-slate-600',
  blue: 'border-blue-100 bg-blue-50 text-blue-700',
  amber: 'border-amber-100 bg-amber-50 text-amber-700',
  emerald: 'border-emerald-100 bg-emerald-50 text-emerald-700',
};

/** 下一步动作提示——业务叙事。复刻自旧 NextActionNotice。 */
export function NextActionNotice({
  title,
  detail,
  tone = 'blue',
}: {
  title: string;
  detail: string;
  tone?: NextActionTone;
}) {
  return (
    <div className={`mt-4 rounded-lg border p-3 ${nextActionToneClasses[tone]}`}>
      <p className="text-xs font-black">{title}</p>
      <p className="mt-1 text-xs font-bold leading-5 opacity-80">{detail}</p>
    </div>
  );
}

const processStateToneClasses = {
  handled: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  waiting: 'border-slate-200 bg-slate-50 text-slate-600',
  blocked: 'border-amber-100 bg-amber-50 text-amber-800',
};

/** 流程状态提示——已处理/等待/阻断三态。复刻自旧 ProcessStateNotice。 */
export function ProcessStateNotice({
  variant,
  title,
  desc,
}: {
  variant: 'handled' | 'waiting' | 'blocked';
  title: string;
  desc: string;
}) {
  const Icon = variant === 'handled' ? CheckCircle2 : variant === 'blocked' ? AlertCircle : Activity;
  return (
    <div className={`mt-4 rounded-lg border p-3 ${processStateToneClasses[variant]}`}>
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/80">
          <Icon size={16} />
        </div>
        <div className="min-w-0">
          <p className="break-words text-xs font-black">{title}</p>
          <p className="mt-1 break-words text-xs font-bold leading-5 opacity-80">{desc}</p>
        </div>
      </div>
    </div>
  );
}
