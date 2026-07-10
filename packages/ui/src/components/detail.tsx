import type { ReactNode } from 'react';
import { StatusPill } from './status-pill';

export interface Fact {
  label: string;
  value: string;
}

/** 详情字段网格——2/4 列响应式。复刻自旧 InlineFactGrid。 */
export function InlineFactGrid({ facts }: { facts: Fact[] }) {
  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {facts.map((fact) => (
        <div
          key={`${fact.label}:${fact.value}`}
          className="min-w-0 rounded-md border border-slate-100 bg-white/80 px-3 py-2"
        >
          <p className="text-[11px] font-black text-slate-400">{fact.label}</p>
          <p className="mt-1 break-words text-xs font-bold text-slate-700">{fact.value}</p>
        </div>
      ))}
    </div>
  );
}

/** 详情首屏卡——眉毛/标题/金额/状态/字段网格。复刻自旧 DetailHeroCard。 */
export function DetailHeroCard({
  eyebrow,
  title,
  meta,
  status,
  amountLabel,
  facts,
}: {
  eyebrow: string;
  title: string;
  meta: string;
  status?: string;
  amountLabel?: string;
  facts: Fact[];
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/60">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 max-w-full">
          <p className="text-[11px] font-black uppercase tracking-widest text-blue-600">{eyebrow}</p>
          <p className="mt-1 break-words text-base font-black text-slate-950">{title}</p>
          <p className="mt-1 break-words text-xs font-bold text-slate-400">{meta}</p>
        </div>
        {status && <StatusPill label={status} />}
      </div>
      {amountLabel && (
        <p className="mt-3 max-w-full font-mono text-xl font-black text-slate-950">{amountLabel}</p>
      )}
      <InlineFactGrid facts={facts} />
    </div>
  );
}

/** 详情分区块——标题 + 计数 + 内容。复刻自旧 DetailSection。 */
export function DetailSection({
  title,
  countLabel,
  children,
}: {
  title: string;
  countLabel?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="break-words text-xs font-black text-slate-600">{title}</p>
        {countLabel && (
          <span className="self-start rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-black text-slate-500">
            {countLabel}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

/** 详情操作面板——带 tone 配色。复刻自旧 DetailActionPanel。 */
export function DetailActionPanel({
  title,
  desc,
  status,
  tone = 'blue',
  children,
}: {
  title: string;
  desc?: string;
  status?: string;
  tone?: 'blue' | 'emerald' | 'slate';
  children: ReactNode;
}) {
  const toneClass =
    tone === 'emerald'
      ? 'border-emerald-100 bg-emerald-50 text-emerald-800'
      : tone === 'slate'
        ? 'border-slate-200 bg-slate-50 text-slate-700'
        : 'border-blue-100 bg-blue-50 text-blue-800';
  return (
    <section className={`rounded-lg border p-4 ${toneClass}`}>
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="break-words text-xs font-black">{title}</p>
          {desc && <p className="mt-1 break-words text-xs font-bold leading-5">{desc}</p>}
        </div>
        {status && (
          <span className="self-start">
            <StatusPill label={status} />
          </span>
        )}
      </div>
      <div className="min-w-0 space-y-3 overflow-x-auto rounded-lg border border-white/70 bg-white/60 p-3">
        {children}
      </div>
    </section>
  );
}

/** 键值对行。复刻自旧 DetailKeyValueRow。 */
export function DetailKeyValueRow({
  label,
  value,
  fontMono = false,
}: {
  label: string;
  value: string;
  fontMono?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-lg border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
      <span className="text-xs font-black text-slate-500 sm:min-w-[7rem]">{label}</span>
      <span
        className={`max-w-full break-words text-xs font-black text-slate-900 sm:text-right ${
          fontMono ? 'font-mono' : ''
        }`}
      >
        {value}
      </span>
    </div>
  );
}

/** 关联业务行。复刻自旧 RelatedBusinessRow。 */
export function RelatedBusinessRow({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="break-words text-sm font-black text-slate-900">{title}</p>
      <p className="mt-1 break-words text-xs font-bold leading-5 text-slate-500">{detail}</p>
    </div>
  );
}
