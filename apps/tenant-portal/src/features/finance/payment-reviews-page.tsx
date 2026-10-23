import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ClipboardCheck, Eye, Save } from 'lucide-react';
import { usePaymentReviews, usePaymentReview, useRecordPaymentReview, type PaymentReviewRow } from '@24bid/api-client';
import { FeedbackNotice, MiniFact, Pagination, Panel, ResponsiveTableFrame, SearchInput, StatusPill } from '@24bid/ui';
import { financeErrorMessage } from './finance-feedback';

const money = (amount: number | null | undefined) => amount == null ? '待核对' : `¥${amount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;
const button = 'inline-flex h-9 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 disabled:opacity-50';
const input = 'mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-800';

function Findings({ row }: { row: PaymentReviewRow }) {
  return row.findings.length ? <ul className="space-y-1 text-sm text-amber-800">{row.findings.map(f => <li key={f}>{f}</li>)}</ul>
    : <span className="text-sm text-slate-500">本次检查未发现差异</span>;
}

function ReviewDetail({ invoiceId, onBack, onInvoice }: { invoiceId: string; onBack: () => void; onInvoice: (id: string) => void }) {
  const [page, setPage] = useState(1);
  const query = usePaymentReview(invoiceId, page);
  const save = useRecordPaymentReview(invoiceId);
  const client = useQueryClient();
  const [amount, setAmount] = useState('');
  const [evidence, setEvidence] = useState('');
  const [explanation, setExplanation] = useState('');
  const [notice, setNotice] = useState('');
  const key = useRef({ fingerprint: '', value: '' });
  const data = query.data?.data;
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-3">
      <button className={button} onClick={onBack} aria-label="返回核对台账"><ArrowLeft size={16} />返回</button>
      <h2 className="min-w-0 flex-1 break-words text-xl font-bold">付款核对详情</h2>
      {!query.isError && data && <button className={button} onClick={() => onInvoice(invoiceId)}><Eye size={16} />发票详情</button>}
    </div>
    {query.isError ? <FeedbackNotice tone="error" message={financeErrorMessage(query.error, '核对详情加载失败')} />
      : !data ? <FeedbackNotice tone="info" message="正在加载核对详情…" /> : <>
      <section className="border-y border-slate-200 py-4">
        <div className="mb-3 flex flex-wrap items-center gap-3"><h3 className="break-all font-bold">{data.invoice.invoiceNo || invoiceId}</h3><StatusPill label={data.invoice.paymentStatus} /></div>
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <MiniFact label="发票应付" value={money(data.invoice.invoiceAmount)} />
          <MiniFact label="可确认台账金额" value={money(data.invoice.ledgerAmount)} />
          <MiniFact label="核对记录" value={String(data.totalNotes)} />
        </div>
        <Findings row={data.invoice} />
      </section>
      {data.canRecord && <form className="space-y-3" onSubmit={event => {
        event.preventDefault(); save.reset(); setNotice('');
        const payload = { reportedPaidAmount: amount === '' ? undefined : Number(amount), evidenceReference: evidence.trim(), explanation: explanation.trim() };
        const fingerprint = JSON.stringify(payload);
        if (fingerprint !== key.current.fingerprint) key.current = { fingerprint, value: crypto.randomUUID() };
        save.mutate({ ...payload, idempotencyKey: key.current.value }, { onSuccess: () => {
          setAmount(''); setEvidence(''); setExplanation(''); setPage(1); key.current = { fingerprint: '', value: '' };
          setNotice('核对依据已留存，付款余额、审批状态及异常标记未更改。');
          void client.invalidateQueries({ queryKey: ['/api/v1/buyer/payment-reviews'] });
        } });
      }}>
        <h3 className="font-bold">登记核对依据</h3>
        <fieldset disabled={save.isPending} className="grid min-w-0 gap-3 sm:grid-cols-2">
          <label className="min-w-0 text-sm font-bold">凭据所载累计付款（元）<input aria-label="凭据所载累计付款" type="number" min="0" max="999999999999.99" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className={input} /><span className="mt-1 block text-xs font-normal text-slate-500">金额无法确定时留空，不按零元处理。</span></label>
          <label className="min-w-0 text-sm font-bold">凭据编号或存档位置 <span className="text-red-600">*</span><input aria-label="凭据编号或存档位置" required maxLength={500} value={evidence} onChange={e => setEvidence(e.target.value)} className={input} /></label>
          <label className="text-sm font-bold sm:col-span-2">核对说明 <span className="text-red-600">*</span><textarea aria-label="核对说明" required maxLength={2000} rows={3} value={explanation} onChange={e => setExplanation(e.target.value)} className={input} /></label>
          <div className="sm:col-span-2 flex justify-end"><button type="submit" disabled={!evidence.trim() || !explanation.trim()} className={`${button} !border-blue-600 !bg-blue-600 !text-white`}><Save size={16} />{save.isPending ? '保存中…' : '保存核对依据'}</button></div>
        </fieldset>
        {save.isError && <FeedbackNotice tone="error" message={financeErrorMessage(save.error, '保存失败')} />}
        {notice && <FeedbackNotice tone="success" message={notice} />}
      </form>}
      <section className="border-t border-slate-200 pt-4">
        <h3 className="mb-3 font-bold">核对记录</h3>
        {!data.notes.length && <p className="text-sm text-slate-500">暂无核对记录</p>}
        <div className="space-y-3">{data.notes.map(note => <article key={note.id} className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap justify-between gap-2 text-sm"><strong>凭据所载累计付款：{money(note.reportedPaidAmount)}</strong><span className="break-all text-slate-500">{note.createdBy} · {note.createdAt.slice(0, 19).replace('T', ' ')}</span></div>
          <p className="mt-2 break-words text-sm">凭据：{note.evidenceReference}</p>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm">{note.explanation}</p>
          <details className="mt-3 text-xs text-slate-500"><summary className="cursor-pointer">登记时系统快照</summary><p className="mt-2 break-words">{note.snapshot}</p></details>
        </article>)}</div>
        <Pagination page={page} pageSize={10} total={data.totalNotes} onPageChange={setPage} />
      </section>
    </>}
  </div>;
}

export function PaymentReviewsPage({ onBack, onInvoice }: { onBack: () => void; onInvoice: (id: string) => void }) {
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [selected, setSelected] = useState('');
  const query = usePaymentReviews({ page, keyword, paymentStatus });
  if (selected) return <ReviewDetail key={selected} invoiceId={selected} onBack={() => setSelected('')} onInvoice={onInvoice} />;
  const data = query.data?.data;
  return <div className="space-y-4">
    <button className={button} onClick={onBack}><ArrowLeft size={16} />返回发票台账</button>
    <Panel title="历史付款核对" icon={ClipboardCheck} subtitle="">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select aria-label="付款状态" value={paymentStatus} onChange={e => { setPaymentStatus(e.target.value); setPage(1); }} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm">
          <option value="">全部付款状态</option>{['待付款', '部分付款', '已付款'].map(s => <option key={s}>{s}</option>)}
        </select>
        <SearchInput className="mb-0 max-w-full flex-wrap" placeholder="搜索发票号或订单号" onSearch={value => { setKeyword(value); setPage(1); }} />
      </div>
      {query.isError ? <FeedbackNotice tone="error" message={financeErrorMessage(query.error, '核对台账加载失败')} />
        : !data ? <FeedbackNotice tone="info" message="正在检查付款记录…" /> : <>
        <ResponsiveTableFrame mobileCards={data.items.map((row, i) => <article key={row.invoiceId} className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="flex items-start justify-between gap-2"><h4 className="min-w-0 break-all text-sm font-bold"><span className="mr-2 text-slate-400">{(page - 1) * data.pageSize + i + 1}</span>{row.invoiceNo || row.invoiceId}</h4><button className={button} onClick={() => setSelected(row.invoiceId)}><Eye size={14} />详情</button></div>
          <div className="my-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-600"><span>{row.paymentStatus}</span><span>应付 {money(row.invoiceAmount)}</span><span>台账 {money(row.ledgerAmount)}</span></div>
          <Findings row={row} /><p className="mt-2 text-xs text-slate-500">核对记录 {row.noteCount} 条</p>
        </article>)}>
          <table className="w-full min-w-[840px] table-fixed text-left text-sm">
            <colgroup><col className="w-14" /><col className="w-44" /><col className="w-24" /><col className="w-32" /><col className="w-32" /><col /><col className="w-28" /></colgroup>
            <thead className="bg-slate-50 text-slate-500"><tr>{['序号', '发票', '付款状态', '应付金额', '台账金额', '核对事项', '操作'].map(h => <th key={h} className="px-3 py-3 whitespace-nowrap">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">{data.items.map((row, i) => <tr key={row.invoiceId} className="bg-white align-top">
              <td className="px-3 py-4">{(page - 1) * data.pageSize + i + 1}</td>
              <td className="px-3 py-4"><p className="truncate font-bold" title={row.invoiceNo}>{row.invoiceNo || row.invoiceId}</p><span className="text-xs text-slate-500">核对记录 {row.noteCount} 条</span></td>
              <td className="px-3 py-4 whitespace-nowrap">{row.paymentStatus}</td>
              <td className="px-3 py-4 break-all">{money(row.invoiceAmount)}</td><td className="px-3 py-4 break-all">{money(row.ledgerAmount)}</td>
              <td className="px-3 py-4"><Findings row={row} /></td>
              <td className="px-3 py-4"><button className={button} onClick={() => setSelected(row.invoiceId)}><Eye size={14} />详情</button></td>
            </tr>)}</tbody>
          </table>
        </ResponsiveTableFrame>
        {!data.items.length && <p className="py-8 text-center text-sm text-slate-500">没有符合条件的发票</p>}
        <Pagination page={page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />
      </>}
    </Panel>
  </div>;
}
