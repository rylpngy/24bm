import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, Download, Upload } from 'lucide-react';
import {
  axiosInstance,
  useSupplierQualificationChangeStatus,
  useSupplierQualificationCreate,
  useSupplierQualificationCreateUploadTicket,
  useSupplierQualificationList,
} from '@24bid/api-client';
import {
  FilterTabs,
  FeedbackNotice,
  Pagination,
  Panel,
  PrimaryActionButton,
  ResponsiveTableFrame,
  SearchInput,
  StatusPill,
  cn,
} from '@24bid/ui';

const PAGE_SIZE = 8;

const isExpired = (d?: string) => !!d && d < new Date().toISOString().slice(0, 10);

// 到期状态徽标(后端按今天判定,前端只呈现)。
const EXPIRY_TONE: Record<string, string> = {
  已过期: 'bg-red-50 text-red-600',
  临期: 'bg-amber-50 text-amber-700',
  有效: 'bg-emerald-50 text-emerald-700',
  长期有效: 'bg-slate-100 text-slate-500',
};

// 资质认证:证照档案(自助上传原件 + 到期提醒)+ 状态管理;采购方在准入核验时可下载原件。
export function QualificationsPage() {
  const queryClient = useQueryClient();
  const quals = useSupplierQualificationList();
  const changeStatus = useSupplierQualificationChangeStatus();
  const createTicket = useSupplierQualificationCreateUploadTicket();
  const createQualification = useSupplierQualificationCreate();
  const [uploading, setUploading] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [draft, setDraft] = useState({ qualificationType: '', certificateNo: '', expiresAt: '', fileName: '', storageKey: '' });
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('全部');
  const [page, setPage] = useState(1);

  const all = quals.data?.data ?? [];
  const statuses = ['全部', ...Array.from(new Set(all.map((q) => q.status).filter(Boolean) as string[]))];
  const kw = keyword.toLowerCase();
  const list = all.filter((q) => {
    if (statusFilter !== '全部' && q.status !== statusFilter) return false;
    if (!kw) return true;
    return [q.qualificationType, q.certificateNo, q.fileName].filter(Boolean).join(' ').toLowerCase().includes(kw);
  });
  const statusCount = (s: string) => (s === '全部' ? all.length : all.filter((q) => q.status === s).length);
  const pageCount = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageItems = list.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const expiringCount = all.filter((q) => isExpired(q.expiresAt)).length;

  const toggle = (id: string, current?: string) => {
    const next = current === '停用' ? '有效' : '停用';
    changeStatus.mutate(
      { qualificationId: id, data: { status: next } },
      {
        onSuccess: () => {
          setFeedback(next === '停用' ? '资质已停用。' : '资质已恢复有效。');
          setError(null);
          queryClient.invalidateQueries({
            predicate: (q) =>
              typeof q.queryKey[0] === 'string' && (q.queryKey[0] as string).includes('/supplier/qualifications'),
          });
        },
        onError: (e) =>
          setError(
            (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
              '状态更新失败,请稍后重试。',
          ),
      },
    );
  };

  return (
    <Panel title="资质认证" icon={BadgeCheck} subtitle="证照档案 · 有效期跟踪 · 状态管理">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FilterTabs
          items={statuses.map((s) => ({ id: s, label: s, count: s === '全部' ? undefined : statusCount(s) }))}
          value={statusFilter}
          onChange={(id) => {
            setStatusFilter(id);
            setPage(1);
          }}
        />
        <SearchInput
          className="mb-0 ml-auto"
          placeholder="按资质类型 / 证书编号搜索"
          onSearch={(k) => {
            setKeyword(k);
            setPage(1);
          }}
        />
      </div>

      {expiringCount > 0 && (
        <div className="mb-4">
          <FeedbackNotice tone="error" message={`${expiringCount} 项资质已过有效期,请尽快联系采购方更新证照,避免影响准入与投标。`} />
        </div>
      )}
      {feedback && (
        <div className="mb-4">
          <FeedbackNotice tone="success" message={feedback} />
        </div>
      )}
      {error && (
        <div className="mb-4">
          <FeedbackNotice tone="error" message={error} />
        </div>
      )}

      {/* E-1 证照到期提醒:已过期/临期优先处理 */}
      {(() => {
        const expired = all.filter((q) => q.expiryState === '已过期');
        const expiring = all.filter((q) => q.expiryState === '临期');
        if (expired.length === 0 && expiring.length === 0) return null;
        return (
          <div className="mb-3">
            <FeedbackNotice
              tone={expired.length > 0 ? 'error' : 'info'}
              message={[
                expired.length > 0 ? `${expired.length} 项资质已过期,请尽快上传新证照续档` : '',
                expiring.length > 0 ? `${expiring.length} 项资质将在 30 天内到期` : '',
              ].filter(Boolean).join(';')}
            />
          </div>
        );
      })()}

      {/* E-1 自助上传:先传原件拿到 storageKey,再建档 */}
      <section className="mb-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
        <h3 className="flex items-center gap-2 text-base font-black text-slate-950">
          <Upload size={18} className="text-blue-600" /> 上传资质证照
        </h3>
        <p className="mt-1 text-[11px] font-bold text-slate-400">
          支持营业执照、资质证书、认证报告等;上传原件后填写要素归档,采购方准入核验时可查阅原件。
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_10rem_auto]">
          <input className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none focus:border-blue-300"
            placeholder="资质类型(必填)" aria-label="资质类型" value={draft.qualificationType}
            onChange={(e) => setDraft({ ...draft, qualificationType: e.target.value })} />
          <input className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none focus:border-blue-300"
            placeholder="证书编号(选填)" aria-label="证书编号" value={draft.certificateNo}
            onChange={(e) => setDraft({ ...draft, certificateNo: e.target.value })} />
          <input className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none focus:border-blue-300"
            type="date" aria-label="有效期至" value={draft.expiresAt}
            onChange={(e) => setDraft({ ...draft, expiresAt: e.target.value })} />
          <label className="inline-flex h-9 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-xs font-black text-slate-600 hover:bg-slate-50">
            {uploading ? '上传中…' : draft.fileName || '选择证照文件'}
            <input type="file" className="hidden" aria-label="证照文件"
              onChange={async (ev) => {
                const file = ev.target.files?.[0];
                if (!file) return;
                setError(null);
                setUploading(true);
                try {
                  const ticket = await createTicket.mutateAsync({ data: { fileName: file.name } });
                  const key = ticket.data?.storageKey ?? '';
                  const buffer = await file.arrayBuffer();
                  await axiosInstance.post(
                    `/api/v1/supplier/qualifications/upload-sink?storageKey=${encodeURIComponent(key)}&contentType=${encodeURIComponent(file.type || 'application/octet-stream')}`,
                    buffer,
                    { headers: { 'Content-Type': 'application/octet-stream' } },
                  );
                  setDraft((d) => ({ ...d, fileName: file.name, storageKey: key }));
                  setFeedback(`证照「${file.name}」已上传,填写要素后点击归档。`);
                } catch (e) {
                  setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '上传失败,请稍后重试');
                } finally {
                  setUploading(false);
                  ev.target.value = '';
                }
              }} />
          </label>
        </div>
        <div className="mt-3">
          <PrimaryActionButton size="sm" busy={archiving} pendingLabel="归档中"
            disabled={!draft.qualificationType.trim() || !draft.storageKey}
            onClick={async () => {
              setError(null);
              setArchiving(true);
              try {
                await createQualification.mutateAsync({
                  data: {
                    qualificationType: draft.qualificationType.trim(),
                    certificateNo: draft.certificateNo.trim() || undefined,
                    expiresAt: draft.expiresAt || undefined,
                    fileName: draft.fileName,
                    storageKey: draft.storageKey,
                  },
                });
                setFeedback(`资质「${draft.qualificationType.trim()}」已归档。`);
                setDraft({ qualificationType: '', certificateNo: '', expiresAt: '', fileName: '', storageKey: '' });
                void queryClient.invalidateQueries({
                  predicate: (q) => typeof q.queryKey[0] === 'string' && (q.queryKey[0] as string).includes('/supplier/qualifications'),
                });
              } catch (e) {
                setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '归档失败,请稍后重试');
              } finally {
                setArchiving(false);
              }
            }}>
            归档资质
          </PrimaryActionButton>
          {!draft.storageKey && <span className="ml-2 text-[11px] font-bold text-slate-400">请先上传证照文件</span>}
        </div>
      </section>

      {quals.isLoading ? (
        <FeedbackNotice tone="info" message="正在加载资质档案…" />
      ) : quals.isError ? (
        <FeedbackNotice tone="error" message="资质档案加载失败:登录态可能已过期,请重新登录后重试。" />
      ) : list.length === 0 ? (
        <FeedbackNotice
          tone="info"
          message={
            keyword || statusFilter !== '全部'
              ? '没有符合条件的资质。'
              : '暂无资质档案。在上方「上传资质证照」自助上传原件并归档。'
          }
        />
      ) : (
        <>
          <ResponsiveTableFrame
            mobileCards={pageItems.map((q, i) => (
              <div key={q.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-black text-slate-950">
                      <span className="mr-1.5 font-mono text-slate-400">{(safePage - 1) * PAGE_SIZE + i + 1}.</span>
                      {q.qualificationType}
                    </p>
                    <p className="mt-1 font-mono text-xs font-bold text-slate-500">{q.certificateNo || '—'}</p>
                  </div>
                  {q.status && <StatusPill label={q.status} />}
                </div>
                <p className={cn('mt-2 font-mono text-xs font-black', isExpired(q.expiresAt) ? 'text-red-600' : 'text-slate-600')}>
                  有效期至 {q.expiresAt ?? '长期'}
                  {isExpired(q.expiresAt) && ' · 已过期'}
                </p>
              </div>
            ))}
          >
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-black text-slate-500">
                <tr>
                  <th className="w-12 px-2 py-4 text-center">序号</th>
                  <th className="px-5 py-4">资质类型</th>
                  <th className="px-5 py-4">证书编号</th>
                  <th className="px-5 py-4">证照文件</th>
                  <th className="px-5 py-4">有效期至</th>
                  <th className="px-5 py-4">归档时间</th>
                  <th className="px-5 py-4">状态</th>
                  <th className="px-5 py-4 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageItems.map((q, i) => (
                  <tr key={q.id} className="hover:bg-blue-50/30">
                    <td className="px-2 py-5 text-center font-mono font-black text-slate-400">
                      {(safePage - 1) * PAGE_SIZE + i + 1}
                    </td>
                    <td className="px-5 py-5 font-black text-slate-950">{q.qualificationType}</td>
                    <td className="px-5 py-5 font-mono text-xs font-black text-slate-500">{q.certificateNo || '—'}</td>
                    <td className="px-5 py-5 text-xs font-bold text-slate-600">
                      {q.fileName ? (
                        <button type="button"
                          onClick={() => window.open(`/api/v1/supplier/qualifications/${q.id}/download`, '_blank')}
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700">
                          <Download size={13} /> {q.fileName}
                        </button>
                      ) : '—'}
                    </td>
                    <td className={cn('px-5 py-5 font-mono text-xs font-black', isExpired(q.expiresAt) ? 'text-red-600' : 'text-slate-600')}>
                      {q.expiresAt ?? '长期'}
                      {q.expiryState && q.expiryState !== '有效' && (
                        <span className={cn('ml-1.5 rounded px-1.5 py-0.5 text-[10px] font-black', EXPIRY_TONE[q.expiryState] ?? 'bg-slate-100 text-slate-500')}>
                          {q.expiryState}
                          {q.expiryState === '临期' && q.daysToExpiry != null ? ` ${q.daysToExpiry} 天` : ''}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-5 font-mono text-xs font-bold text-slate-500">{q.createdAt?.slice(0, 10) ?? '—'}</td>
                    <td className="px-5 py-5">{q.status && <StatusPill label={q.status} />}</td>
                    <td className="px-5 py-5 text-right">
                      <button
                        type="button"
                        disabled={changeStatus.isPending}
                        onClick={() => q.id && toggle(q.id, q.status ?? undefined)}
                        className={cn(
                          'inline-flex h-8 items-center rounded-md border px-3 text-xs font-black transition disabled:opacity-50',
                          q.status === '停用'
                            ? 'border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                        )}
                      >
                        {q.status === '停用' ? '恢复有效' : '停用'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ResponsiveTableFrame>
          <Pagination page={safePage} pageSize={PAGE_SIZE} total={list.length} onPageChange={setPage} />
        </>
      )}
    </Panel>
  );
}
