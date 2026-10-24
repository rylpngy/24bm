import { useEffect, useState } from 'react';
import { ShieldCheck, X } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useBuyerMallCategories } from '@24bid/api-client';
import { mallControlKey, saveMallPurchaseControl, useMallPurchaseControl } from '@24bid/api-client/mall-purchasing';
import { FeedbackNotice, PrimaryActionButton } from '@24bid/ui';

export function MallPurchaseControls({ canManage = false }: { canManage?: boolean }) {
  const [open, setOpen] = useState(false);
  const query = useMallPurchaseControl(open);
  const categories = useBuyerMallCategories({ query: { enabled: open } });
  const client = useQueryClient();
  const [amount, setAmount] = useState('');
  const [ids, setIds] = useState<string[]>([]);
  const [address, setAddress] = useState(false);
  const [reason, setReason] = useState('');
  const [dirty, setDirty] = useState(false);
  const save = useMutation({ mutationFn: saveMallPurchaseControl, onSuccess: data => { client.setQueryData(mallControlKey, data); setOpen(false); setDirty(false); setReason(''); } });
  useEffect(() => {
    if (!open || !query.data || dirty) return;
    setAmount(query.data.maxCheckoutAmount == null ? '' : String(query.data.maxCheckoutAmount));
    setIds(query.data.categoryIds); setAddress(query.data.requireAddress);
  }, [open, query.data, dirty]);
  const input = 'mt-1 block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-normal';
  return <>
    <button type="button" onClick={() => { setDirty(false); setOpen(true); save.reset(); }} className="inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-md border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700"><ShieldCheck size={15} />采购控制</button>
    {open && <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={e => { if (e.target === e.currentTarget && !save.isPending) setOpen(false); }}><section role="dialog" aria-modal="true" aria-labelledby="mall-controls-title" className="h-full w-full max-w-lg overflow-y-auto bg-white p-5 shadow-xl">
      <header className="flex items-center justify-between border-b border-slate-200 pb-4"><h2 id="mall-controls-title" className="text-lg font-bold">企业直采控制</h2><button type="button" aria-label="关闭采购控制" disabled={save.isPending} onClick={() => setOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200"><X size={17} /></button></header>
      {query.isError || categories.isError ? <FeedbackNotice tone="error" message="采购规则加载失败，请刷新重试。" /> : query.isPending ? <FeedbackNotice tone="info" message="正在加载采购规则…" /> : <form aria-label="采购控制配置" className="mt-5" onSubmit={e => { e.preventDefault(); if (!canManage || save.isPending) return; save.mutate({ maxCheckoutAmount: amount ? Number(amount) : null, categoryIds: ids, requireAddress: address, reason: reason.trim() }); }}>
        <fieldset disabled={!canManage || save.isPending} className="space-y-5">
        <label className="block text-sm font-bold">单次结算限额（元）<input type="number" min="0.01" step="0.01" value={amount} onChange={e => { setDirty(true); setAmount(e.target.value); }} className={input} /><span className="mt-1 block text-xs font-normal text-slate-500">留空不限额，按拆单前的整笔结算金额校验。</span></label>
        <fieldset><legend className="text-sm font-bold">允许采购分类</legend><p className="mt-1 text-xs text-slate-500">未选择时不限分类</p><div className="mt-2 grid grid-cols-2 gap-2">{(categories.data?.data ?? []).map(c => <label key={c.id} className="flex min-w-0 items-center gap-2 text-sm"><input type="checkbox" checked={ids.includes(c.id!)} onChange={e => { setDirty(true); setIds(old => e.target.checked ? [...old, c.id!] : old.filter(x => x !== c.id)); }} /><span className="truncate" title={c.name}>{c.name}</span></label>)}</div></fieldset>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={address} onChange={e => { setDirty(true); setAddress(e.target.checked); }} />下单必须选择企业收货地址</label>
        {canManage && <label className="block text-sm font-bold">调整依据 <span className="text-red-600">*</span><textarea required maxLength={1000} rows={4} className={input} value={reason} onChange={e => setReason(e.target.value)} /></label>}
        {save.isError && <FeedbackNotice tone="error" message={(save.error as { response?: { data?: { message?: string } } }).response?.data?.message ?? '采购规则保存失败，请重试。'} />}
        {canManage && <PrimaryActionButton type="submit" onClick={() => {}} busy={save.isPending} disabled={!reason.trim() || (!!amount && !(Number(amount) > 0))}>保存规则</PrimaryActionButton>}
        </fieldset>
      </form>}
    </section></div>}
  </>;
}
