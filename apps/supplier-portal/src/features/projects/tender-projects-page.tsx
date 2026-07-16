import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Award, FileBadge, Gavel, Info, Lock, Undo2 } from 'lucide-react';
import {
  useSupplierEsignList,
  useSupplierEsignSign,
  useSupplierTenderAcquire,
  useSupplierTenderList,
  useSupplierTenderSubmitBid,
  useSupplierTenderWithdrawBid,
  type TenderResponse,
} from '@24bid/api-client';
import {
  EsignRecordList,
  FeedbackNotice,
  FilterTabs,
  MiniFact,
  Pagination,
  Panel,
  PrimaryActionButton,
  ResponsiveTableFrame,
  RichTextEditor,
  RichTextView,
  SearchInput,
  SignaturePad,
  StatusPill,
  cn,
} from '@24bid/ui';
import { useAuthStore } from '../../lib/auth-store';
import { currency, shortTime } from './shared';

const PAGE_SIZE = 10;

const typeTone: Record<string, string> = {
  公开招标: 'bg-blue-50 text-blue-700',
  邀请招标: 'bg-violet-50 text-violet-700',
};

function acquisitionState(t: TenderResponse) {
  const mine = (t.acquisitions ?? [])[0];
  if (mine?.acquiredAt) return '已领取';
  if (mine) return '已发放待领取';
  return '未领取';
}

const acqTone: Record<string, string> = {
  已领取: 'bg-emerald-50 text-emerald-700',
  已发放待领取: 'bg-amber-50 text-amber-700',
  未领取: 'bg-slate-100 text-slate-500',
};

// 投标函电子签署留痕(密封凭证配套)。
function BidEsignRecords({ bidId }: { bidId: string }) {
  const records = useSupplierEsignList({ targetType: 'tender-bid', targetId: bidId });
  const list = records.data?.data ?? [];
  if (list.length === 0) return null;
  return <div className="mt-3"><EsignRecordList records={list} /></div>;
}


// C-2 投标递交区:报价+投标函(富文本)+手写签名(必签)→ 密封递交;
// 已密封显示密封凭证(指纹/时间/签署留痕)与撤回;撤回后可在截止前重投(覆盖为新密封)。
function BidSubmissionSection({
  tender,
  onFeedback,
  onError,
}: {
  tender: TenderResponse;
  onFeedback: (m: string) => void;
  onError: (m: string | null) => void;
}) {
  const queryClient = useQueryClient();
  const displayName = useAuthStore((st) => st.session?.displayName ?? '');
  const submitBid = useSupplierTenderSubmitBid();
  const withdrawBid = useSupplierTenderWithdrawBid();
  const esign = useSupplierEsignSign();
  const [amount, setAmount] = useState('');
  const [doc, setDoc] = useState('');
  const [signature, setSignature] = useState<string | null>(null);

  const myBid = (tender.bids ?? [])[0];
  const sealed = myBid?.sealedStatus === '已密封';
  const deadlinePassed = tender.submissionDeadline
    ? new Date(tender.submissionDeadline).getTime() <= Date.now()
    : false;

  const refresh = () =>
    queryClient.invalidateQueries({
      predicate: (q) =>
        typeof q.queryKey[0] === 'string' && /\/supplier\/(tenders|esign-records)/.test(q.queryKey[0] as string),
    });

  const doSubmit = () => {
    if (!tender.id) return;
    onError(null);
    submitBid.mutate(
      { tenderId: tender.id, data: { bidAmount: Number(amount), documentHtml: doc } },
      {
        onSuccess: (res) => {
          const bid = res.data;
          if (signature && bid?.id) {
            esign.mutate(
              { data: { targetType: 'tender-bid', targetId: bid.id, signatureImage: signature, signerName: displayName } },
              { onSettled: refresh },
            );
          }
          onFeedback('投标已密封递交并完成电子签署。开标前招标人不可见内容,密封指纹已归档。');
          setAmount('');
          setDoc('');
          setSignature(null);
          refresh();
        },
        onError: (e) =>
          onError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '递交失败,请稍后重试'),
      },
    );
  };

  const doWithdraw = () => {
    if (!tender.id) return;
    onError(null);
    withdrawBid.mutate(
      { tenderId: tender.id },
      {
        onSuccess: () => {
          onFeedback('投标已撤回(留痕)。截止前可重新递交,重投将覆盖为新密封。');
          refresh();
        },
        onError: (e) =>
          onError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '撤回失败,请稍后重试'),
      },
    );
  };

  const canSubmit = Number(amount) > 0 && doc.trim().length > 0 && !!signature && !deadlinePassed;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-base font-black text-slate-950">
          <Lock size={15} className="text-blue-600" /> 投标递交(加密密封)
        </h3>
        {myBid && (
          <span className={cn('rounded-md px-2 py-0.5 text-[11px] font-black',
            sealed ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500')}>
            {myBid.sealedStatus}
          </span>
        )}
      </div>
      <p className="mt-1 text-[11px] font-bold text-slate-400">
        递交即密封:开标前招标人不可见投标内容;递交时生成 SHA-256 密封指纹,开标后可核验未被篡改。
      </p>

      {sealed && myBid ? (
        <div className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50/40 p-4">
          <p className="text-xs font-black text-emerald-800">本方投标已密封在案</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <MiniFact label="投标报价(仅本方可见)" value={currency(myBid.bidAmount)} />
            <MiniFact label="递交时间" value={shortTime(myBid.submittedAt)} />
            <MiniFact label="密封指纹" value={(myBid.contentDigest ?? '').slice(0, 16) + '…'} />
          </div>
          {myBid.id && <BidEsignRecords bidId={myBid.id} />}
          {!deadlinePassed && (
            <button type="button" onClick={doWithdraw} disabled={withdrawBid.isPending}
              className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-lg border border-amber-200 bg-white px-4 text-xs font-black text-amber-700 hover:bg-amber-50 disabled:opacity-50">
              <Undo2 size={14} /> {withdrawBid.isPending ? '撤回中…' : '撤回投标(截止前可重投)'}
            </button>
          )}
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          {myBid?.sealedStatus === '已撤回' && (
            <FeedbackNotice tone="info" message={`此前投标已于 ${shortTime(myBid.withdrawnAt)} 撤回;重新递交将覆盖为新密封。`} />
          )}
          {deadlinePassed ? (
            <FeedbackNotice tone="info" message="投标递交已截止。" />
          ) : (
            <>
              <label className="block sm:w-64">
                <span className="text-xs font-black text-slate-500"><span className="mr-1 text-red-500">*</span>投标报价(元,含税)</span>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                  type="number" min="0" value={amount} placeholder="0.00" aria-label="投标报价"
                  onChange={(e) => setAmount(e.target.value)} />
              </label>
              <div>
                <p className="text-xs font-black text-slate-500"><span className="mr-1 text-red-500">*</span>投标函正文</p>
                <div className="mt-1">
                  <RichTextEditor value={doc} onChange={setDoc} minHeight={180}
                    placeholder="响应条款、报价说明、供货与服务承诺……(附件在上方招标附件区对照准备)" />
                </div>
              </div>
              <div>
                <p className="text-xs font-black text-slate-500">
                  <span className="mr-1 text-red-500">*</span>投标函电子签署(递交前须手写签名,与密封指纹绑定)
                </p>
                <SignaturePad className="mt-1.5" onChange={setSignature} />
              </div>
              <PrimaryActionButton onClick={doSubmit} busy={submitBid.isPending} pendingLabel="密封递交中"
                disabled={!canSubmit}>
                <Lock size={14} /> 签署并密封递交
              </PrimaryActionButton>
            </>
          )}
        </div>
      )}
    </section>
  );
}

// C-3 开标唱标公示:各家投标人/报价升序/指纹核验结果公开;本方投标高亮,他方投标函正文不下发。
function OpeningRollSection({ tender }: { tender: TenderResponse }) {
  const mySupplierId = (tender.acquisitions ?? [])[0]?.supplierId;
  const bids = tender.bids ?? [];
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-base font-black text-slate-950">
          <Gavel size={15} className="text-blue-600" /> 开标唱标公示
        </h3>
        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-black text-slate-500">
          已开标 {shortTime(tender.openedAt)} · 有效投标 {bids.filter((b) => b.sealedStatus === '已开启').length} 份
        </span>
      </div>
      <p className="mt-1 text-[11px] font-bold text-slate-400">
        投标报价按金额升序公示;指纹核验=开标解封时按内容复算 SHA-256 与递交时密封指纹比对(通过=内容未被篡改)。
      </p>
      {bids.length === 0 ? (
        <p className="mt-3 text-xs font-bold text-slate-400">本项目开标时无有效投标。</p>
      ) : (
        <div className="mt-3 overflow-hidden rounded-lg border border-slate-100">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[11px] font-black text-slate-400">
              <tr>
                <th className="w-10 px-3 py-2 text-center">名次</th>
                <th className="px-3 py-2">投标人</th>
                <th className="px-3 py-2 text-right">投标报价</th>
                <th className="px-3 py-2">指纹核验</th>
                <th className="px-3 py-2 text-right">递交时间</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bids.map((b, i) => (
                <tr key={b.id} className={cn('font-bold text-slate-700', b.supplierId === mySupplierId && 'bg-blue-50/40')}>
                  <td className="px-3 py-2 text-center font-mono font-black text-slate-400">
                    {b.sealedStatus === '已开启' ? i + 1 : '—'}
                  </td>
                  <td className="px-3 py-2 font-black text-slate-900">
                    {b.supplierName ?? b.supplierId}
                    {b.supplierId === mySupplierId && (
                      <span className="ml-1.5 rounded-md bg-blue-100 px-1.5 py-0.5 text-[10px] font-black text-blue-700">本方</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-mono font-black text-slate-900">
                    {b.sealedStatus === '已撤回' ? '已撤回' : b.bidAmount != null ? currency(b.bidAmount) : '—'}
                  </td>
                  <td className="px-3 py-2">
                    {b.digestVerified == null ? (
                      <span className="text-[11px] font-black text-slate-400">未解封</span>
                    ) : b.digestVerified ? (
                      <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-black text-emerald-700">核验通过</span>
                    ) : (
                      <span className="rounded-md bg-red-50 px-2 py-0.5 text-[11px] font-black text-red-600">指纹异常</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{shortTime(b.submittedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// C-5 中标结果:定标后全体可见方公示中标人;中标人可读中标通知书全文(招标人已签章)。
function AwardResultSection({ tender }: { tender: TenderResponse }) {
  const mySupplierId = (tender.acquisitions ?? [])[0]?.supplierId;
  const winner = (tender.bids ?? []).find((b) => b.id === tender.awardedBidId);
  const isWinner = !!winner && winner.supplierId === mySupplierId;
  return (
    <section className={cn('rounded-lg border bg-white p-4 shadow-sm shadow-slate-200/50',
      isWinner ? 'border-emerald-200' : 'border-slate-200')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-base font-black text-slate-950">
          <Award size={15} className="text-emerald-600" /> 中标结果公示
        </h3>
        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-black text-slate-500">
          定标时间 {shortTime(tender.awardedAt)}
        </span>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <MiniFact label="中标人" value={winner?.supplierName ?? '—'} />
        <MiniFact label="中标价" value={currency(winner?.bidAmount)} />
      </div>
      {isWinner ? (
        <div className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50/40 p-4">
          <p className="text-xs font-black text-emerald-800">恭喜,贵方为本项目中标人。中标通知书(招标人已电子签章):</p>
          {tender.awardNoticeHtml && <RichTextView html={tender.awardNoticeHtml} className="mt-2" />}
          <p className="mt-2 text-[11px] font-bold text-slate-500">请按招标文件约定与招标人签订合同;通知书签章指纹与贵方投标密封凭证绑定,可核验。</p>
        </div>
      ) : (
        <FeedbackNotice tone="info" message="感谢贵方参与本项目投标。本项目已定标,未中标投标文件按规定留档。" />
      )}
    </section>
  );
}

// 招标项目(供应商侧,Track C C-1/C-2):领取文件后阅读正文并加密递交投标。
export function TenderProjectsPage() {
  const queryClient = useQueryClient();
  const tenders = useSupplierTenderList();
  const acquire = useSupplierTenderAcquire();
  const [filter, setFilter] = useState('全部');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const all = tenders.data?.data ?? [];
  const selected = selectedId ? all.find((t) => t.id === selectedId) : undefined;

  const refresh = () =>
    queryClient.invalidateQueries({
      predicate: (q) => typeof q.queryKey[0] === 'string' && (q.queryKey[0] as string).includes('/supplier/tenders'),
    });

  const doAcquire = (tenderId?: string) => {
    if (!tenderId) return;
    setError(null);
    acquire.mutate(
      { tenderId },
      {
        onSuccess: () => { setFeedback('招标文件已领取,可查阅正文并准备投标。'); refresh(); },
        onError: (e) =>
          setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '领取失败,请稍后重试'),
      },
    );
  };

  const kw = keyword.trim().toLowerCase();
  const filtered = all.filter((t) => {
    if (filter !== '全部') {
      if (filter === '公开招标' || filter === '邀请招标') {
        if (t.tenderType !== filter) return false;
      } else if (acquisitionState(t) !== filter) {
        return false;
      }
    }
    return !kw || [t.title, t.tenderNo].filter(Boolean).join(' ').toLowerCase().includes(kw);
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const acquiredCount = all.filter((t) => acquisitionState(t) === '已领取').length;

  // ── 详情:要素 + 正文(领取后) ───────────────────────────────
  if (selected) {
    const t = selected;
    const state = acquisitionState(t);
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm shadow-slate-200/50">
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => setSelectedId(null)} aria-label="返回招标项目"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-50">
              <ArrowLeft size={18} />
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn('rounded-md px-2 py-0.5 text-[11px] font-black', typeTone[t.tenderType ?? ''] ?? 'bg-slate-100 text-slate-600')}>
                  {t.tenderType}
                </span>
                <h1 className="break-words text-lg font-black text-slate-950">{t.title}</h1>
                {t.status && <StatusPill label={t.status} />}
                <span className={cn('rounded-md px-2 py-0.5 text-[11px] font-black', acqTone[state])}>{state}</span>
              </div>
              <p className="mt-1 font-mono text-xs font-bold text-slate-500">
                {t.tenderNo} · 递交截止 {shortTime(t.submissionDeadline)} · 开标 {shortTime(t.openingAt)}
              </p>
            </div>
          </div>
        </div>

        {feedback && <FeedbackNotice tone="success" message={feedback} />}
        {error && <FeedbackNotice tone="error" message={error} />}

        <div className="grid gap-4 xl:grid-cols-[1fr_20rem]">
          <div className="min-w-0 space-y-4">
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
              <h3 className="text-base font-black text-slate-950">招标文件正文</h3>
              {t.documentHtml ? (
                <RichTextView html={t.documentHtml} className="mt-3" />
              ) : (
                <div className="mt-3 rounded-lg border border-amber-100 bg-amber-50/60 p-4">
                  <p className="text-xs font-black text-amber-800">领取招标文件后方可查阅正文。</p>
                  <p className="mt-1 text-[11px] font-bold text-slate-500">
                    {state === '已发放待领取'
                      ? '招标人已定向发放,点击下方「确认领取」即可查阅并准备投标。'
                      : '公开招标发售期内可自助领取。'}
                  </p>
                  <PrimaryActionButton size="sm" onClick={() => doAcquire(t.id)} busy={acquire.isPending} pendingLabel="领取中">
                    {state === '已发放待领取' ? '确认领取招标文件' : '领取招标文件'}
                  </PrimaryActionButton>
                </div>
              )}
            </section>
            {/* C-2 投标递交:领取后、开标前开放;递交即密封,开标前对招标人不可见 */}
            {state === '已领取' && !t.openedAt && (
              <BidSubmissionSection tender={t} onFeedback={setFeedback} onError={setError} />
            )}
            {/* C-3 开标后:唱标公示替代递交区 */}
            {t.openedAt && <OpeningRollSection tender={t} />}
            {/* C-5 定标后:中标结果公示(中标人可读签章通知书) */}
            {t.awardedBidId && <AwardResultSection tender={t} />}

          </div>

          <div className="space-y-4">
            <section className="rounded-lg bg-slate-900 p-5 text-white shadow-sm">
              <p className="flex items-center gap-2 text-sm font-black"><Info size={15} className="text-blue-400" /> 关键信息</p>
              <dl className="mt-4 space-y-3.5">
                {[
                  ['招标编号', t.tenderNo ?? '—'],
                  ['预算金额', currency(t.budget)],
                  ['评标办法', t.evaluationMethod ?? '—'],
                  ['投标保证金', t.bidBondAmount != null ? currency(t.bidBondAmount) : '不收取'],
                  ['文件获取截止', shortTime(t.acquisitionDeadline)],
                  ['投标递交截止', shortTime(t.submissionDeadline)],
                  ['开标时间', shortTime(t.openingAt)],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-[11px] font-bold text-slate-400">{k}</dt>
                    <dd className="mt-0.5 break-words text-sm font-black">{v}</dd>
                  </div>
                ))}
              </dl>
            </section>
            <FeedbackNotice tone="info" message={t.status === '已流标'
              ? `本项目已流标(${t.failureReason ?? '原因见招标人公告'});如重新招标将另行发布,请留意新项目。`
              : t.awardedBidId
              ? '本项目已定标:中标结果公示如左,中标人可查阅招标人签章的中标通知书。'
              : t.openedAt
                ? '本项目已开标唱标:各家报价与指纹核验结果公示如左;评标与中标结果请留意后续通知。'
                : '递交即密封:开标前招标人不可见投标内容;截止前可撤回并重投(重投覆盖为新密封)。'} />
          </div>
        </div>
      </div>
    );
  }

  // ── 台账 ───────────────────────────────────────────────────
  return (
    <Panel title="招标项目" icon={FileBadge} subtitle="受邀发放 · 公开发售 · 招标文件领取(2.0)">
      <div className="mb-4 grid gap-2 sm:grid-cols-4">
        <MiniFact label="全部招标" value={String(all.length)} />
        <MiniFact label="已领取文件" value={String(acquiredCount)} />
        <MiniFact label="公开招标" value={String(all.filter((t) => t.tenderType === '公开招标').length)} />
        <MiniFact label="邀请招标" value={String(all.filter((t) => t.tenderType === '邀请招标').length)} />
      </div>

      {feedback && <div className="mb-3"><FeedbackNotice tone="success" message={feedback} /></div>}
      {error && <div className="mb-3"><FeedbackNotice tone="error" message={error} /></div>}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FilterTabs
          items={['全部', '公开招标', '邀请招标', '已领取', '未领取'].map((id) => ({
            id,
            label: id,
            count:
              id === '全部'
                ? undefined
                : id === '公开招标' || id === '邀请招标'
                  ? all.filter((t) => t.tenderType === id).length
                  : all.filter((t) => acquisitionState(t) === id).length,
          }))}
          value={filter}
          onChange={(id) => { setFilter(id); setPage(1); }}
        />
        <SearchInput className="mb-0 ml-auto" placeholder="按项目名称 / 招标编号搜索"
          onSearch={(k) => { setKeyword(k); setPage(1); }} />
      </div>

      {tenders.isLoading ? (
        <FeedbackNotice tone="info" message="正在加载招标项目…" />
      ) : filtered.length === 0 ? (
        <FeedbackNotice tone="info"
          message={kw || filter !== '全部' ? '没有符合条件的招标项目。' : '暂无招标项目。收到定向发放或平台出现公开招标后展示在此。'} />
      ) : (
        <>
          <ResponsiveTableFrame
            mobileCards={pageItems.map((t, i) => (
              <div key={t.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-black text-slate-950">
                      <span className="mr-1.5 text-slate-400">{(safePage - 1) * PAGE_SIZE + i + 1}.</span>{t.title}
                    </p>
                    <p className="mt-1 font-mono text-[11px] font-bold text-slate-400">{t.tenderNo}</p>
                  </div>
                  <span className={cn('rounded-md px-2 py-0.5 text-[11px] font-black', acqTone[acquisitionState(t)])}>
                    {acquisitionState(t)}
                  </span>
                </div>
                <button type="button" onClick={() => setSelectedId(t.id ?? null)}
                  className="mt-3 inline-flex h-8 w-full items-center justify-center rounded-md border border-slate-200 bg-white text-xs font-black text-slate-600 hover:bg-slate-50">
                  查看招标
                </button>
              </div>
            ))}
          >
            <table className="w-full min-w-[1020px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-black text-slate-500">
                <tr>
                  <th className="w-12 px-2 py-4 text-center">序号</th>
                  <th className="px-5 py-4">招标项目</th>
                  <th className="px-5 py-4">招标方式</th>
                  <th className="px-5 py-4">领取状态</th>
                  <th className="px-5 py-4 text-right">预算</th>
                  <th className="px-5 py-4">文件获取截止</th>
                  <th className="px-5 py-4">投标递交截止</th>
                  <th className="px-5 py-4 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageItems.map((t, i) => {
                  const state = acquisitionState(t);
                  return (
                    <tr key={t.id} className="hover:bg-blue-50/30">
                      <td className="px-2 py-5 text-center font-mono font-black text-slate-400">
                        {(safePage - 1) * PAGE_SIZE + i + 1}
                      </td>
                      <td className="px-5 py-5">
                        <p className="w-56 truncate font-black text-slate-950" title={t.title ?? undefined}>{t.title}</p>
                        <p className="mt-1 w-56 truncate font-mono text-[11px] font-bold text-slate-400">{t.tenderNo}</p>
                      </td>
                      <td className="px-5 py-5">
                        <span className={cn('rounded-md px-2 py-0.5 text-[11px] font-black', typeTone[t.tenderType ?? ''] ?? 'bg-slate-100 text-slate-600')}>
                          {t.tenderType}
                        </span>
                      </td>
                      <td className="px-5 py-5">
                        <span className={cn('rounded-md px-2 py-0.5 text-[11px] font-black', acqTone[state])}>{state}</span>
                      </td>
                      <td className="px-5 py-5 text-right font-mono font-black text-slate-900">{currency(t.budget)}</td>
                      <td className="px-5 py-5 font-mono text-xs font-bold text-slate-600">{shortTime(t.acquisitionDeadline)}</td>
                      <td className="px-5 py-5 font-mono text-xs font-bold text-slate-600">{shortTime(t.submissionDeadline)}</td>
                      <td className="px-5 py-5 text-right">
                        <div className="flex justify-end gap-2">
                          {state !== '已领取' && t.status === '发售中' && (
                            <button type="button" onClick={() => doAcquire(t.id)} disabled={acquire.isPending}
                              className="inline-flex h-8 items-center rounded-md bg-blue-600 px-3 text-xs font-black text-white hover:bg-blue-700 disabled:bg-slate-300">
                              {state === '已发放待领取' ? '确认领取' : '领取文件'}
                            </button>
                          )}
                          <button type="button" onClick={() => setSelectedId(t.id ?? null)}
                            className="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 hover:bg-slate-50">
                            查看招标
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ResponsiveTableFrame>
          <Pagination page={safePage} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />
        </>
      )}
    </Panel>
  );
}
