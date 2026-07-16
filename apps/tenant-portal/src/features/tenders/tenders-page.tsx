import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, FileBadge, Info, Megaphone, Plus, Send } from 'lucide-react';
import {
  useBuyerSupplierList,
  useBuyerTenderCreate,
  useBuyerTenderDistribute,
  useBuyerTenderList,
  useBuyerTenderPublish,
  useBuyerTenderUpdate,
  type SaveTenderRequest,
  type TenderResponse,
} from '@24bid/api-client';
import {
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
  StatusPill,
  cn,
} from '@24bid/ui';
import { OwnerAttachments } from '../attachments/owner-attachments';

const PAGE_SIZE = 8;

const currency = (v?: number) =>
  v == null ? '—' : `¥${v.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;
const shortTime = (v?: string | null) => (v ? `${v.slice(0, 10)} ${v.slice(11, 16)}` : '—');

const typeTone: Record<string, string> = {
  公开招标: 'bg-blue-50 text-blue-700',
  邀请招标: 'bg-violet-50 text-violet-700',
};

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100';

interface DraftForm {
  title: string;
  tenderType: string;
  budget: string;
  evaluationMethod: string;
  bidBondAmount: string;
  acquisitionDeadline: string;
  submissionDeadline: string;
  openingAt: string;
  documentHtml: string;
}

const emptyForm = (): DraftForm => ({
  title: '',
  tenderType: '公开招标',
  budget: '',
  evaluationMethod: '综合评分法',
  bidBondAmount: '',
  acquisitionDeadline: '',
  submissionDeadline: '',
  openingAt: '',
  documentHtml: '',
});

const toLocal = (v?: string | null) => (v ? v.slice(0, 16) : '');
const toIso = (v: string) => (v ? new Date(v).toISOString() : undefined);

// 招标管理(Track C C-1):文件编制(富文本)→ 发布发售 → 邀请发放 / 领取记录。
export function TendersPage() {
  const queryClient = useQueryClient();
  const tenders = useBuyerTenderList();
  const suppliers = useBuyerSupplierList({ status: '已准入' });
  const create = useBuyerTenderCreate();
  const update = useBuyerTenderUpdate();
  const publish = useBuyerTenderPublish();
  const distribute = useBuyerTenderDistribute();

  const [view, setView] = useState<'list' | 'edit' | 'detail'>('list');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<DraftForm>(emptyForm());
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('全部');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [distributeIds, setDistributeIds] = useState<string[]>([]);

  const all = tenders.data?.data ?? [];
  const selected = selectedId ? all.find((t) => t.id === selectedId) : undefined;

  const refresh = () =>
    queryClient.invalidateQueries({
      predicate: (q) => typeof q.queryKey[0] === 'string' && (q.queryKey[0] as string).includes('/buyer/tenders'),
    });

  const reportError = (e: unknown) =>
    setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '操作失败,请稍后重试');

  const payload = (): SaveTenderRequest => ({
    title: form.title.trim(),
    tenderType: form.tenderType,
    budget: form.budget ? Number(form.budget) : undefined,
    evaluationMethod: form.evaluationMethod || undefined,
    bidBondAmount: form.bidBondAmount ? Number(form.bidBondAmount) : undefined,
    acquisitionDeadline: toIso(form.acquisitionDeadline),
    submissionDeadline: toIso(form.submissionDeadline),
    openingAt: toIso(form.openingAt),
    documentHtml: form.documentHtml || undefined,
  });

  const saveDraft = (thenPublish: boolean) => {
    setError(null);
    const after = (t?: TenderResponse) => {
      if (thenPublish && t?.id) {
        publish.mutate(
          { tenderId: t.id },
          {
            onSuccess: () => {
              setFeedback(`招标项目「${t.title}」已发布,招标文件开始发售。`);
              setView('list');
              refresh();
            },
            onError: reportError,
          },
        );
      } else {
        setFeedback('招标项目已保存(编制中)。');
        setView('list');
        refresh();
      }
    };
    if (editingId) {
      update.mutate({ tenderId: editingId, data: payload() }, { onSuccess: (r) => after(r.data), onError: reportError });
    } else {
      create.mutate({ data: payload() }, { onSuccess: (r) => after(r.data), onError: reportError });
    }
  };

  const openEdit = (t?: TenderResponse) => {
    setError(null);
    if (t) {
      setEditingId(t.id ?? null);
      setForm({
        title: t.title ?? '',
        tenderType: t.tenderType ?? '公开招标',
        budget: t.budget != null ? String(t.budget) : '',
        evaluationMethod: t.evaluationMethod ?? '综合评分法',
        bidBondAmount: t.bidBondAmount != null ? String(t.bidBondAmount) : '',
        acquisitionDeadline: toLocal(t.acquisitionDeadline),
        submissionDeadline: toLocal(t.submissionDeadline),
        openingAt: toLocal(t.openingAt),
        documentHtml: t.documentHtml ?? '',
      });
    } else {
      setEditingId(null);
      setForm(emptyForm());
    }
    setView('edit');
  };

  const formValid =
    form.title.trim().length > 0 && (form.tenderType === '公开招标' || form.tenderType === '邀请招标');

  const kw = keyword.trim().toLowerCase();
  const filtered = all.filter((t) => {
    if (statusFilter !== '全部' && t.status !== statusFilter) return false;
    return !kw || [t.title, t.tenderNo].filter(Boolean).join(' ').toLowerCase().includes(kw);
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const countBy = (s: string) => all.filter((t) => t.status === s).length;

  const admitted = useMemo(() => suppliers.data?.data ?? [], [suppliers.data]);

  // ── 编制页 ─────────────────────────────────────────────────
  if (view === 'edit') {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm shadow-slate-200/50">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setView(editingId ? 'detail' : 'list')} aria-label="返回"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-50">
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-lg font-black text-slate-950">{editingId ? '编辑招标项目' : '新建招标项目'}</h1>
              <p className="mt-0.5 text-xs font-bold text-slate-500">编制招标文件 → 发布后进入发售期,供应商领取文件</p>
            </div>
          </div>
        </div>

        {error && <FeedbackNotice tone="error" message={error} />}

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50">
          <h3 className="text-sm font-black text-slate-950">基本要素</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="text-xs font-black text-slate-500"><span className="mr-1 text-red-500">*</span>招标项目名称</span>
              <input className={cn(inputCls, 'mt-1')} value={form.title} placeholder="如:2026年度机房设备公开招标"
                onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </label>
            <label className="block">
              <span className="text-xs font-black text-slate-500"><span className="mr-1 text-red-500">*</span>招标方式</span>
              <select className={cn(inputCls, 'mt-1')} value={form.tenderType}
                onChange={(e) => setForm({ ...form, tenderType: e.target.value })}>
                <option value="公开招标">公开招标(全平台供应商可领取)</option>
                <option value="邀请招标">邀请招标(定向发放招标文件)</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-black text-slate-500">预算金额(元)</span>
              <input className={cn(inputCls, 'mt-1')} type="number" min="0" value={form.budget}
                onChange={(e) => setForm({ ...form, budget: e.target.value })} />
            </label>
            <label className="block">
              <span className="text-xs font-black text-slate-500">评标办法</span>
              <select className={cn(inputCls, 'mt-1')} value={form.evaluationMethod}
                onChange={(e) => setForm({ ...form, evaluationMethod: e.target.value })}>
                <option value="综合评分法">综合评分法</option>
                <option value="最低评标价法">最低评标价法</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-black text-slate-500">投标保证金(元,选填)</span>
              <input className={cn(inputCls, 'mt-1')} type="number" min="0" value={form.bidBondAmount}
                onChange={(e) => setForm({ ...form, bidBondAmount: e.target.value })} />
            </label>
            <label className="block">
              <span className="text-xs font-black text-slate-500">文件获取截止(发布前必填)</span>
              <input className={cn(inputCls, 'mt-1')} type="datetime-local" value={form.acquisitionDeadline}
                onChange={(e) => setForm({ ...form, acquisitionDeadline: e.target.value })} />
            </label>
            <label className="block">
              <span className="text-xs font-black text-slate-500">投标递交截止(发布前必填)</span>
              <input className={cn(inputCls, 'mt-1')} type="datetime-local" value={form.submissionDeadline}
                onChange={(e) => setForm({ ...form, submissionDeadline: e.target.value })} />
            </label>
            <label className="block">
              <span className="text-xs font-black text-slate-500">开标时间(发布前必填)</span>
              <input className={cn(inputCls, 'mt-1')} type="datetime-local" value={form.openingAt}
                onChange={(e) => setForm({ ...form, openingAt: e.target.value })} />
            </label>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50">
          <h3 className="text-sm font-black text-slate-950">招标文件正文(发布前必填)</h3>
          <p className="mt-1 text-xs font-bold text-slate-400">支持小标题、加粗、列表等富文本排版;附件(图纸/清单等)在项目详情页上传。</p>
          <div className="mt-3">
            <RichTextEditor
              value={form.documentHtml}
              onChange={(html) => setForm({ ...form, documentHtml: html })}
              placeholder="项目概况、投标人资格要求、评标办法细则、合同主要条款……"
              minHeight={260}
            />
          </div>
        </section>

        <div className="sticky bottom-4 z-30 rounded-lg border border-slate-200 bg-white/95 px-5 py-4 shadow-lg shadow-slate-300/40 backdrop-blur">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-bold text-slate-500">
              保存草稿可稍后继续编制;发布发售须已填写正文与三个时间节点(获取截止 ≤ 递交截止 ≤ 开标时间)。
            </p>
            <div className="flex shrink-0 gap-2">
              <button type="button" disabled={!formValid || create.isPending || update.isPending}
                onClick={() => saveDraft(false)}
                className="inline-flex h-10 items-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                保存草稿
              </button>
              <PrimaryActionButton flushTop size="md" onClick={() => saveDraft(true)}
                busy={create.isPending || update.isPending || publish.isPending} pendingLabel="发布中"
                disabled={!formValid}>
                <Send size={14} /> 保存并发布发售
              </PrimaryActionButton>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── 详情页 ─────────────────────────────────────────────────
  if (view === 'detail' && selected) {
    const t = selected;
    const acquisitions = t.acquisitions ?? [];
    const acquiredCount = acquisitions.filter((a) => a.acquiredAt).length;
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm shadow-slate-200/50">
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => setView('list')} aria-label="返回招标台账"
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
              </div>
              <p className="mt-1 font-mono text-xs font-bold text-slate-500">
                {t.tenderNo} · 递交截止 {shortTime(t.submissionDeadline)} · 开标 {shortTime(t.openingAt)}
              </p>
            </div>
            <p className="shrink-0 font-mono text-xl font-black text-slate-950">{currency(t.budget)}</p>
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
                <p className="mt-3 text-xs font-bold text-slate-400">正文尚未编制,点击底部「继续编制」补齐后方可发布。</p>
              )}
            </section>

            {t.id && (
              <OwnerAttachments ownerType="tender" ownerId={t.id} title="招标文件附件"
                emptyHint="上传图纸、工程量清单、资格审查表等附件。" />
            )}

            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-black text-slate-950">发售与领取记录</h3>
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-black text-slate-500">
                  发放 {acquisitions.length} 家 · 已领取 {acquiredCount} 家
                </span>
              </div>
              {acquisitions.length === 0 ? (
                <p className="mt-3 text-xs font-bold text-slate-400">
                  {t.tenderType === '邀请招标'
                    ? '尚未定向发放。发售中可在底部操作条选择已准入供应商发放。'
                    : '公开招标发售中,供应商在其门户自助领取后出现在此。'}
                </p>
              ) : (
                <div className="mt-3 overflow-hidden rounded-lg border border-slate-100">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[11px] font-black text-slate-400">
                      <tr>
                        <th className="px-3 py-2">供应商</th>
                        <th className="px-3 py-2">来源</th>
                        <th className="px-3 py-2 text-right">领取时间</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {acquisitions.map((a) => (
                        <tr key={a.supplierId} className="font-bold text-slate-700">
                          <td className="px-3 py-2 font-black text-slate-900">{a.supplierName ?? a.supplierId}</td>
                          <td className="px-3 py-2">{a.source}</td>
                          <td className="px-3 py-2 text-right font-mono">
                            {a.acquiredAt ? shortTime(a.acquiredAt) : '已发放 · 待领取'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {t.tenderType === '邀请招标' && t.status === '发售中' && (
                <div className="mt-4 rounded-lg border border-violet-100 bg-violet-50/50 p-3">
                  <p className="text-xs font-black text-violet-800">定向发放招标文件(已准入供应商)</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {admitted.map((s) => {
                      const id = s.supplierId ?? '';
                      const already = acquisitions.some((a) => a.supplierId === id);
                      const checked = distributeIds.includes(id);
                      return (
                        <button key={id} type="button" disabled={already}
                          onClick={() => setDistributeIds((cur) => (checked ? cur.filter((x) => x !== id) : [...cur, id]))}
                          className={cn('rounded-lg border p-2.5 text-left text-xs font-black transition',
                            already ? 'border-slate-100 bg-slate-50 text-slate-300'
                              : checked ? 'border-violet-300 bg-violet-100 text-violet-800'
                                : 'border-slate-200 bg-white text-slate-700 hover:bg-violet-50')}>
                          {s.supplierName}{already ? '(已发放)' : ''}
                        </button>
                      );
                    })}
                  </div>
                  <PrimaryActionButton size="sm" onClick={() =>
                    t.id && distribute.mutate(
                      { tenderId: t.id, data: { supplierIds: distributeIds } },
                      {
                        onSuccess: () => { setFeedback(`已定向发放 ${distributeIds.length} 家。`); setDistributeIds([]); refresh(); },
                        onError: reportError,
                      },
                    )}
                    busy={distribute.isPending} pendingLabel="发放中" disabled={distributeIds.length === 0}>
                    发放招标文件({distributeIds.length})
                  </PrimaryActionButton>
                </div>
              )}
            </section>

            {/* C-2 投标递交情况:开标前内容密封,仅见递交登记与密封指纹 */}
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-black text-slate-950">投标递交情况</h3>
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-black text-slate-500">
                  密封在案 {(t.bids ?? []).filter((b) => b.sealedStatus === '已密封').length} 份
                </span>
              </div>
              <p className="mt-1 text-[11px] font-bold text-slate-400">
                开标前投标内容严格密封(报价与投标函不可见),此处仅为递交登记与密封指纹;开标环节(下一版本)解封唱标。
              </p>
              {(t.bids ?? []).length === 0 ? (
                <p className="mt-3 text-xs font-bold text-slate-400">暂无投标递交。</p>
              ) : (
                <div className="mt-3 overflow-hidden rounded-lg border border-slate-100">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[11px] font-black text-slate-400">
                      <tr>
                        <th className="px-3 py-2">投标人</th>
                        <th className="px-3 py-2">密封状态</th>
                        <th className="px-3 py-2">密封指纹</th>
                        <th className="px-3 py-2 text-right">递交时间</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(t.bids ?? []).map((b) => (
                        <tr key={b.id} className="font-bold text-slate-700">
                          <td className="px-3 py-2 font-black text-slate-900">{b.supplierName ?? b.supplierId}</td>
                          <td className="px-3 py-2">
                            <span className={cn('rounded-md px-2 py-0.5 text-[11px] font-black',
                              b.sealedStatus === '已密封' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500')}>
                              {b.sealedStatus}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-mono text-[11px] text-slate-400" title={b.contentDigest ?? undefined}>
                            {(b.contentDigest ?? '').slice(0, 16)}…
                          </td>
                          <td className="px-3 py-2 text-right font-mono">{shortTime(b.submittedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>

          <div className="space-y-4">
            <section className="rounded-lg bg-slate-900 p-5 text-white shadow-sm">
              <p className="flex items-center gap-2 text-sm font-black"><Info size={15} className="text-blue-400" /> 关键信息</p>
              <dl className="mt-4 space-y-3.5">
                {[
                  ['招标编号', t.tenderNo ?? '—'],
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
          </div>
        </div>

        <div className="sticky bottom-4 z-30 rounded-lg border border-slate-200 bg-white/95 px-5 py-4 shadow-lg shadow-slate-300/40 backdrop-blur">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
              <FileBadge size={14} className="shrink-0 text-blue-600" />
              <span>
                当前状态 <StatusPill label={t.status ?? '—'} />
                <span className="ml-2">
                  {t.status === '编制中'
                    ? '正文与时间节点齐备后即可发布发售。'
                    : t.status === '发售中'
                      ? t.tenderType === '邀请招标' ? '可继续定向发放招标文件。' : '公开发售中,供应商自助领取。'
                      : '发售已截止。'}
                </span>
              </span>
            </div>
            {t.status === '编制中' && (
              <div className="flex shrink-0 gap-2">
                <button type="button" onClick={() => openEdit(t)}
                  className="inline-flex h-10 items-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-slate-600 hover:bg-slate-50">
                  继续编制
                </button>
                <PrimaryActionButton flushTop size="md" onClick={() =>
                  t.id && publish.mutate({ tenderId: t.id },
                    { onSuccess: () => { setFeedback('招标文件已发布发售。'); refresh(); }, onError: reportError })}
                  busy={publish.isPending} pendingLabel="发布中">
                  <Megaphone size={14} /> 发布发售
                </PrimaryActionButton>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── 台账 ───────────────────────────────────────────────────
  return (
    <Panel title="招标管理" icon={FileBadge} subtitle="招标文件编制 · 发售 · 领取(Track C · 2.0)">
      <div className="mb-4 grid gap-2 sm:grid-cols-4">
        <MiniFact label="全部招标" value={String(all.length)} />
        <MiniFact label="编制中" value={String(countBy('编制中'))} />
        <MiniFact label="发售中" value={String(countBy('发售中'))} />
        <MiniFact label="公开招标" value={String(all.filter((t) => t.tenderType === '公开招标').length)} />
      </div>

      {feedback && <div className="mb-3"><FeedbackNotice tone="success" message={feedback} /></div>}
      {error && <div className="mb-3"><FeedbackNotice tone="error" message={error} /></div>}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FilterTabs
          items={['全部', '编制中', '发售中', '已截止'].map((id) => ({
            id, label: id, count: id === '全部' ? undefined : countBy(id),
          }))}
          value={statusFilter}
          onChange={(id) => { setStatusFilter(id); setPage(1); }}
        />
        <SearchInput className="mb-0 ml-auto" placeholder="按项目名称 / 招标编号搜索"
          onSearch={(k) => { setKeyword(k); setPage(1); }} />
        <button type="button" onClick={() => openEdit()}
          className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-slate-900 px-4 text-sm font-black text-white transition hover:bg-slate-800">
          <Plus size={15} /> 新建招标项目
        </button>
      </div>

      {tenders.isLoading ? (
        <FeedbackNotice tone="info" message="正在加载招标项目…" />
      ) : filtered.length === 0 ? (
        <FeedbackNotice tone="info"
          message={kw || statusFilter !== '全部' ? '没有符合条件的招标项目。' : '暂无招标项目。点击右上角「新建招标项目」开始编制招标文件。'} />
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
                  {t.status && <StatusPill label={t.status} />}
                </div>
                <button type="button" onClick={() => { setSelectedId(t.id ?? null); setView('detail'); }}
                  className="mt-3 inline-flex h-8 w-full items-center justify-center rounded-md border border-slate-200 bg-white text-xs font-black text-slate-600 hover:bg-slate-50">
                  查看详情
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
                  <th className="px-5 py-4">状态</th>
                  <th className="px-5 py-4 text-right">预算</th>
                  <th className="px-5 py-4 text-center">发放 / 领取</th>
                  <th className="px-5 py-4">递交截止</th>
                  <th className="px-5 py-4 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageItems.map((t, i) => {
                  const acq = t.acquisitions ?? [];
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
                      <td className="px-5 py-5">{t.status && <StatusPill label={t.status} />}</td>
                      <td className="px-5 py-5 text-right font-mono font-black text-slate-900">{currency(t.budget)}</td>
                      <td className="px-5 py-5 text-center font-mono text-xs font-black text-slate-600">
                        {acq.length > 0 ? `${acq.length} / ${acq.filter((a) => a.acquiredAt).length}` : '—'}
                      </td>
                      <td className="px-5 py-5 font-mono text-xs font-bold text-slate-600">{shortTime(t.submissionDeadline)}</td>
                      <td className="px-5 py-5 text-right">
                        <div className="flex justify-end gap-2">
                          {t.status === '编制中' && (
                            <button type="button" onClick={() => openEdit(t)}
                              className="inline-flex h-8 items-center rounded-md bg-blue-600 px-3 text-xs font-black text-white hover:bg-blue-700">
                              继续编制
                            </button>
                          )}
                          <button type="button" onClick={() => { setSelectedId(t.id ?? null); setView('detail'); }}
                            className="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 hover:bg-slate-50">
                            详情
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
