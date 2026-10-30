import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Banknote, RotateCcw } from 'lucide-react';
import { usePaymentLedger, useRecordPaymentAmount, useReversePayment } from '@24bid/api-client';
import { FeedbackNotice, MiniFact } from '@24bid/ui';
import { financeErrorMessage } from './finance-feedback';

const money = (value: number | null) => value == null ? '待核对' : `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;
const inputClass = 'mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-normal text-slate-800';

export function PaymentLedgerPanel({ invoiceId }: { invoiceId: string }) {
  const query = usePaymentLedger(invoiceId);
  const record = useRecordPaymentAmount(invoiceId);
  const reverse = useReversePayment(invoiceId);
  const client = useQueryClient();
  const [amount, setAmount] = useState('');
  const [milestone, setMilestone] = useState('');
  const [evidence, setEvidence] = useState('');
  const [remark, setRemark] = useState('');
  const [reverseId, setReverseId] = useState('');
  const [reason, setReason] = useState('');
  const [notice, setNotice] = useState('');
  const [fundAmounts,setFundAmounts]=useState<Record<string,string>>({});
  const key = useRef({ fingerprint: '', value: '' });
  const submitKey = (fingerprint: string) => {
    if (key.current.fingerprint !== fingerprint) key.current = { fingerprint, value: crypto.randomUUID() };
    return key.current.value;
  };
  const refresh = () => {
    key.current = { fingerprint: '', value: '' };
    void client.invalidateQueries({ predicate: q => typeof q.queryKey[0] === 'string' && /\/buyer\/(invoices|payment|contracts)/.test(q.queryKey[0]) });
  };
  const busy = record.isPending || reverse.isPending;
  if (query.isError) return <FeedbackNotice tone="error" message={financeErrorMessage(query.error, '付款金额台账加载失败')} />;
  if (!query.data?.data) return <p role="status">加载付款金额台账…</p>;
  const data = query.data.data;
  const funding=data.funding,sourceLines=(funding?.sources||[]).filter(s=>Number(fundAmounts[s.fundId]||0)>0).map(s=>({fundId:s.fundId,amount:Number(fundAmounts[s.fundId])}));
  const fundingValid=!funding?.enabled||(!funding.blocker&&sourceLines.length>0&&Object.values(fundAmounts).every(v=>v===''||/^\d+(\.\d{1,2})?$/.test(v))&&sourceLines.reduce((n,s)=>n+Math.round(s.amount*100),0)===Math.round(Number(amount)*100));
  const selected = data.milestones.find(m => m.id === milestone);
  const limit = data.milestones.length ? (selected ? (selected.reached && selected.verified ? selected.remaining ?? 0 : 0) : data.milestones.filter(m => m.reached && m.verified).reduce((sum, m) => sum + (m.remaining ?? 0), 0)) : data.remainingAmount ?? 0;
  const error = record.error ?? reverse.error;

  return <section id="payment-amount-ledger" className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
    <h3 className="flex items-center gap-2 text-base font-black text-slate-950"><Banknote size={18} className="text-blue-600" />付款金额台账</h3>
    <div className="my-4 grid gap-2 sm:grid-cols-3">
      <MiniFact label="应付金额" value={money(data.invoiceAmount)} />
      <MiniFact label="累计已付" value={money(data.paidAmount)} />
      <MiniFact label="剩余应付" value={money(data.remainingAmount)} />
    </div>
    {data.warning && <FeedbackNotice tone="error" message={data.warning} />}
    {error && <FeedbackNotice tone="error" message={financeErrorMessage(error, '操作失败，请重试')} />}
    {notice && <p role="status" className="my-2 text-sm text-emerald-700">{notice}</p>}
    {!data.reconciliationRequired && (data.remainingAmount ?? 0) > 0 && <form className="mt-4 border-t border-slate-100 pt-4" onSubmit={event => {
      event.preventDefault(); record.reset(); reverse.reset(); setNotice('');
      if(!fundingValid)return;
      const payload = { amount: Number(amount), milestoneId: milestone || undefined, evidenceNo: evidence.trim(), remark: remark.trim(),...(funding?.enabled?{fundingLines:sourceLines}:{}) };
      record.mutate({ ...payload, idempotencyKey: submitKey(JSON.stringify(payload)) }, { onSuccess: () => {
        setAmount(''); setEvidence(''); setRemark('');setFundAmounts({}); setNotice('付款已登记，累计金额已更新。'); refresh();
      } });
    }}>
      <fieldset disabled={busy} className="grid min-w-0 gap-3 sm:grid-cols-2">
        {data.milestones.length > 0 && <label className="text-xs font-bold text-slate-600 sm:col-span-2">合同付款里程碑
          <select className={inputClass} value={milestone} onChange={e => setMilestone(e.target.value)}>
            <option value="">按已达成里程碑依次分配</option>
            {data.milestones.map(m => <option key={m.id} value={m.id} disabled={!m.reached || !m.verified || !m.remaining}>
              {m.name} · {m.reached ? `剩余 ${money(m.remaining)}` : '未达成'}
            </option>)}
          </select>
        </label>}
        <label className="text-xs font-bold text-slate-600">本次付款金额（元）<span className="text-red-600"> *</span>
          <input aria-label="本次付款金额" className={inputClass} type="number" min="0.01" step="0.01" max={Math.min(limit, data.remainingAmount ?? 0)} required value={amount} onChange={e => setAmount(e.target.value)} />
          <span className="mt-1 block font-normal">当前可登记额度：{money(Math.min(limit, data.remainingAmount ?? 0))}</span>
        </label>
        <label className="text-xs font-bold text-slate-600">付款凭据号<span className="text-red-600"> *</span>
          <input aria-label="付款凭据号" className={inputClass} maxLength={200} required value={evidence} onChange={e => setEvidence(e.target.value)} />
        </label>
        <label className="text-xs font-bold text-slate-600 sm:col-span-2">备注
          <input className={inputClass} maxLength={1000} value={remark} onChange={e => setRemark(e.target.value)} />
        </label>
        {funding?.enabled&&<div className="space-y-3 border-t border-slate-100 pt-3 sm:col-span-2"><h4 className="text-sm font-bold">本次付款资金来源 <span className="text-red-600">*</span></h4>{funding.blocker&&<FeedbackNotice tone="error" message={funding.blocker}/>}<div className="grid min-w-0 gap-3 sm:grid-cols-2">{funding.sources.map(s=><label key={s.fundId} className="min-w-0 text-sm">{s.code} · {s.name}<span className="block text-xs text-slate-500">剩余可付 {money(s.remainingAmount)}</span><input aria-label={'付款资金来源 '+s.code} className={inputClass} type="number" min="0" step="0.01" max={s.remainingAmount} value={fundAmounts[s.fundId]||''} onChange={e=>setFundAmounts({...fundAmounts,[s.fundId]:e.target.value})}/></label>)}</div><p className={'text-xs '+(fundingValid?'text-emerald-700':'text-amber-700')}>分摊合计 {money(sourceLines.reduce((n,s)=>n+Math.round(s.amount*100),0)/100)} / 本次付款 {money(Number(amount)||0)}</p></div>}
        <div className="flex justify-end sm:col-span-2"><button className="inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-md bg-blue-600 px-4 text-sm font-bold text-white disabled:opacity-50" type="submit" disabled={!evidence.trim() || limit <= 0||!fundingValid}>
          <Banknote size={16} />{record.isPending ? '登记中…' : '确认登记付款'}
        </button></div>
      </fieldset>
    </form>}
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-xs">
        <thead className="bg-slate-50 text-slate-500"><tr>{['时间 / 操作人', '类型', '金额', '凭据 / 原因', '操作'].map(h => <th key={h} className="px-3 py-3 whitespace-nowrap">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">{data.entries.map(entry => {
          const reversed = data.entries.some(e => e.reversalOf === entry.id);
          return <tr key={entry.id}>
            <td className="px-3 py-3"><p>{entry.createdAt?.slice(0, 19).replace('T', ' ')}</p><p className="mt-1 break-all text-slate-500">{entry.createdBy}</p></td>
            <td className="px-3 py-3 whitespace-nowrap">{entry.reversalOf ? '冲销' : reversed ? '已冲销' : '付款'}</td>
            <td className="px-3 py-3 whitespace-nowrap font-bold">{money(entry.amount)}</td>
            <td className="max-w-60 break-words px-3 py-3"><p>{entry.evidenceNo || '未提供凭据'}</p><p className="mt-1 text-slate-500">{entry.remark}</p></td>
            <td className="px-3 py-3">{!entry.reversalOf && !reversed && data.frozenEntryIds?.includes(entry.id) ? <span className="whitespace-nowrap text-amber-700" title="请在下方跨年冻结付款更正台账申请审批">跨年冻结</span> : !entry.reversalOf && !reversed && !data.reconciliationRequired && <button type="button" disabled={busy} onClick={() => { setReverseId(entry.id); setReason(''); record.reset(); reverse.reset(); }} className="inline-flex h-8 items-center gap-1 whitespace-nowrap rounded-md border border-red-200 px-2 text-red-700"><RotateCcw size={14} />冲销</button>}</td>
          </tr>;
        })}</tbody>
      </table>
      {data.entries.length === 0 && <p className="py-6 text-center text-sm text-slate-500">暂无金额流水</p>}
    </div>
    {!!funding?.entries.length&&<div className="mt-4 overflow-x-auto border-t border-slate-100 pt-3"><h4 className="mb-3 text-sm font-bold">付款资金归属台账</h4><table className="w-full min-w-[560px] text-left text-xs"><thead className="bg-slate-50 text-slate-500"><tr>{['资金来源','归属金额','付款流水 / 凭据'].map(h=><th key={h} className="px-3 py-3">{h}</th>)}</tr></thead><tbody>{funding.entries.map(s=><tr key={s.entryId+s.fundId} className="border-t border-slate-100"><td className="px-3 py-3">{s.code}</td><td className="px-3 py-3">{money(s.amount)}</td><td className="break-words px-3 py-3">{s.evidenceNo}<span className="block text-slate-500">{s.entryId}</span></td></tr>)}</tbody></table></div>}
    {reverseId && <form className="mt-3 border-t border-red-100 pt-3" onSubmit={e => {
      e.preventDefault(); record.reset(); reverse.reset(); setNotice('');
      reverse.mutate({ entryId: reverseId, reason: reason.trim(), idempotencyKey: submitKey(JSON.stringify({ reverseId, reason: reason.trim() })) }, { onSuccess: () => { setReverseId(''); setNotice('原付款已冲销，反向流水已保留。'); refresh(); } });
    }}>
      <label className="text-sm font-bold text-slate-700">冲销原因<span className="text-red-600"> *</span><input aria-label="冲销原因" className={inputClass} required maxLength={1000} value={reason} disabled={busy} onChange={e => setReason(e.target.value)} /></label>
      <div className="mt-3 flex justify-end gap-2"><button type="button" disabled={busy} onClick={() => setReverseId('')} className="h-9 rounded-md border border-slate-200 px-3 text-sm">取消</button><button type="submit" disabled={busy || !reason.trim()} className="inline-flex h-9 items-center gap-1 rounded-md bg-red-600 px-3 text-sm font-bold text-white disabled:opacity-50"><RotateCcw size={15} />确认冲销</button></div>
    </form>}
  </section>;
}
