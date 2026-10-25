import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Send, Save, ExternalLink } from 'lucide-react';
import { FeedbackNotice, ConfirmDialog, Pagination } from '@24bid/ui';
import {
  projectPackages,
  projectPackageBalances,
  projectPackageSave,
  projectPackageAction,
  projectPackageExecute,
  projectPackageLink,
  projectPackageExecution,
  projectChanges,
  projectChange,
  projectChangeSave,
  projectChangeAction,
  usePurchaseDemandList,
  type ProjectPackage,
  type ProjectChange,
  type ProcProject,
  type ProcProjectLine,
  type ProcProjectDraft,
  type ProcProjectDemand,
} from '@24bid/api-client';
import { useBuyerPermissions } from '../../lib/use-buyer-permissions';
import { WorkflowSubmitDialog } from '../workflow/workflow-submit-dialog';
import { WorkflowStatusPanel } from '../workflow/workflow-instance-panel';
import { OwnerAttachments } from '../attachments/owner-attachments';
import {
  ProjectDialog,
  projectButton as btn,
  projectInput as input,
  projectMoney as money,
} from './project-dialog';
import {
  ProjectChangeEditor,
  ProjectPlanSummary,
} from './project-change-editor';
import { projectAmount } from './project-amount';
import { ProjectMallPanel } from './project-mall-panel';

const labels: Record<string, string> = {
  draft: '草稿',
  ready: '待采购 / 执行中',
  closed: '已结项',
  cancelled: '已取消',
  submitted: '审批中',
  approved: '已批准',
  rejected: '已驳回',
  withdrawn: '已撤回',
};
const err = (e: unknown) =>
  (e as { response?: { data?: { message?: string } } }).response?.data
    ?.message || (e instanceof Error ? e.message : '办理失败，请刷新重试。');
type LotForm = {
  id?: string;
  title: string;
  revision: number;
  projectRevision: number;
  quantities: Record<string, number>;
  demandIds: string[];
};
type ChangeForm = {
  id?: string;
  revision: number;
  projectRevision: number;
  reason: string;
  draft: ProcProjectDraft;
};
type Confirm = {
  kind: 'cancel' | 'create-demand' | 'close' | 'execute' | 'retry' | 'withdraw';
  id: string;
  revision: number;
  type?: 'rfq' | 'tender' | 'auction';
};
export function ProjectExpansionPanel({
  project: p,
  lines,
  demands,
  onChanged,
  onPackagesReady,
}: {
  project: ProcProject;
  lines: ProcProjectLine[];
  demands: ProcProjectDemand[];
  onChanged: () => Promise<void>;
  onPackagesReady?: (count: number | null) => void;
}) {
  const { can } = useBuyerPermissions(),
    manage = can('buyer:project:manage') && p.status === 'approved';
  const initialChange = new URLSearchParams(location.search).get('changeId');
  const [tab, setTab] = useState<'packages' | 'changes'>(
      initialChange ? 'changes' : 'packages',
    ),
    [page, setPage] = useState(1),
    [packagePage, setPackagePage] = useState(1);
  const [lotId, setLotId] = useState<string | null>(null),
    [changeId, setChangeId] = useState<string | null>(initialChange);
  const [lotForm, setLotForm] = useState<LotForm | null>(null),
    [changeForm, setChangeForm] = useState<ChangeForm | null>(null);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState<{
      tone: 'success' | 'error';
      message: string;
    } | null>(null),
    [confirm, setConfirm] = useState<Confirm | null>(null),
    [submit, setSubmit] = useState(false),
    [submitError, setSubmitError] = useState<unknown>();
  const [auction, setAuction] = useState({
    trigger: '5',
    extend: '5',
    price: '',
    decrement: '0',
    start: '',
    deadline: '',
  });
  const [method, setMethod] = useState<'rfq' | 'tender' | 'auction'>(() =>
      can('buyer:rfq:manage') ? 'rfq' : 'tender',
    ),
    [link, setLink] = useState('');
  const lots = useQuery({
    queryKey: ['project-packages', p.id],
    queryFn: () => projectPackages(p.id),
  });
  const changes = useQuery({
    queryKey: ['project-changes', p.id, page],
    queryFn: () => projectChanges(p.id, page),
  });
  const change = useQuery({
    queryKey: ['project-change', p.id, changeId],
    queryFn: () => projectChange(p.id, changeId!),
    enabled: !!changeId,
  });
  const trace = useQuery({
    queryKey: ['project-package-execution', p.id, lotId],
    queryFn: () => projectPackageExecution(p.id, lotId!),
    enabled: !!lotId && can('buyer:demand:read'),
  });
  const nativeDemands = usePurchaseDemandList(undefined, {
    query: { enabled: (!!lotForm || !!lotId) && can('buyer:demand:read') },
  });
  const balances = useQuery({
    queryKey: ['project-package-balances', p.id],
    queryFn: () => projectPackageBalances(p.id),
    enabled: !!lotForm,
  });
  function available(materialId: string) {
    const base = balances.data?.find(
      (b) => b.materialId === materialId,
    )?.remaining;
    if (base == null) return null;
    const own =
      rows
        .find((r) => r.info.id === lotForm?.id)
        ?.lines.find((l) => l.materialId === materialId)?.quantity || 0;
    const adopted = (nativeDemands.data?.data || [])
      .filter((d) => !!d.id && lotForm?.demandIds.includes(d.id))
      .flatMap((d) => d.lineItems || [])
      .filter((l) => l.materialId === materialId)
      .reduce((n, l) => n + (l.quantity || 0), 0);
    return base + own + adopted;
  }
  const rows = lots.isError ? [] : lots.data || [],
    lot = rows.find((l) => l.info.id === lotId),
    c = change.isError ? undefined : change.data;
  const pending = changes.data?.pending;
  const canNew =
    manage &&
    !pending &&
    !lots.isError &&
    !changes.isError &&
    !lots.isLoading &&
    !changes.isLoading;
  useEffect(() => {
    onPackagesReady?.(
      lots.isError || lots.isLoading || pending ? null : lots.data?.length || 0,
    );
  }, [lots.data, lots.isError, lots.isLoading, pending, onPackagesReady]);
  const openLot = (l: ProjectPackage) => {
    setChangeId(null);
    setLotId(l.info.id);
    setLink('');
    setMessage(null);
  };
  const openChange = (id: string) => {
    setLotId(null);
    setChangeId(id);
    setMessage(null);
  };
  function newLot(l?: ProjectPackage) {
    setLotForm({
      id: l?.info.id,
      title: l?.info.title || '',
      revision: l?.info.revision || 0,
      projectRevision: p.revision,
      quantities: Object.fromEntries(
        (l?.lines || []).map((l) => [l.materialId, l.quantity]),
      ),
      demandIds: [],
    });
    setMessage(null);
  }
  function newChange(row?: ProjectChange) {
    const saved = row
      ? (JSON.parse(row.proposal).plan as ProcProjectDraft)
      : null;
    setChangeForm({
      id: row?.id,
      revision: row?.revision || 0,
      projectRevision: p.revision,
      reason: row?.reason || '',
      draft: saved || {
        title: p.title,
        departmentId: p.departmentId,
        ownerId: p.ownerId,
        period: p.period,
        fundingSource: p.fundingSource,
        purpose: p.purpose,
        lines: lines.map((l) => ({ ...l })),
        revision: p.revision,
      },
    });
    setMessage(null);
  }
  async function run(fn: () => Promise<unknown>, success: string) {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      await fn();
      setConfirm(null);
      setLotForm(null);
      setChangeForm(null);
      setMessage({ tone: 'success', message: success });
      await onChanged();
    } catch (e) {
      setMessage({ tone: 'error', message: err(e) });
    } finally {
      setBusy(false);
    }
  }
  const choices = demands.filter(
    (d) =>
      !p.executionId && !rows.some((l) => l.demands.some((x) => x.id === d.id)),
  );
  function adopt(id: string, checked: boolean) {
    if (!lotForm) return;
    const source = nativeDemands.data?.data?.find((d) => d.id === id);
    let quantities = { ...lotForm.quantities };
    for (const l of source?.lineItems || []) {
      if (l.materialId)
        quantities[l.materialId] = Math.max(
          0,
          (quantities[l.materialId] || 0) +
            (checked ? 1 : -1) * (l.quantity || 0),
        );
    }
    setLotForm({
      ...lotForm,
      quantities,
      demandIds: checked
        ? [...lotForm.demandIds, id]
        : lotForm.demandIds.filter((x) => x !== id),
    });
  }
  const draftTotal = lotForm
    ? projectAmount(
        lines.map((l) => ({
          ...l,
          quantity: lotForm.quantities[l.materialId] || 0,
        })),
      )
    : 0;
  const before = c
    ? (JSON.parse(c.beforeSnapshot) as ProcProjectDraft & {
        plannedAmount: number;
        lines: ProcProjectLine[];
      })
    : null;
  const after = c
    ? (JSON.parse(c.proposal) as {
        plan: ProcProjectDraft;
        lines: ProcProjectLine[];
      })
    : null;
  return (
    <section className="min-w-0 space-y-4" aria-label="项目分包与变更">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex gap-1 rounded-md bg-slate-100 p-1">
          {[
            ['packages', '采购分包'],
            ['changes', '立项变更'],
          ].map(([key, title]) => (
            <button
              key={key}
              type="button"
              className={
                btn +
                (tab === key
                  ? ' border-blue-200 text-blue-700'
                  : ' border-transparent bg-transparent')
              }
              onClick={() => {
                setTab(key as typeof tab);
                setMessage(null);
              }}
            >
              {title}
            </button>
          ))}
        </div>
        {canNew && (
          <button
            type="button"
            className={btn}
            disabled={
              busy ||
              (tab === 'changes' &&
                (!can('buyer:material:read') || !!changes.data?.hasOpenChange))
            }
            onClick={() => (tab === 'packages' ? newLot() : newChange())}
          >
            <Plus size={14} />
            {tab === 'packages' ? '新建分包' : '申请立项变更'}
          </button>
        )}
      </header>
      {message && <FeedbackNotice {...message} />}
      {pending && (
        <FeedbackNotice
          tone="info"
          message="立项变更正在审批，新增分包、需求及下发暂时冻结；已有执行可继续履约。"
        />
      )}
      {tab === 'packages' &&
        (lots.isError ? (
          <FeedbackNotice
            tone="error"
            message="分包列表加载失败，请刷新后重试。"
          />
        ) : (
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] table-fixed text-left text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500">
                  <tr>
                    {[
                      '序号',
                      '分包名称',
                      '方案版本',
                      '分包金额',
                      '状态 / 执行数量',
                      '操作',
                    ].map((h, i) => (
                      <th
                        key={h}
                        className={
                          'p-3 ' +
                          (i === 0
                            ? 'w-14'
                            : i === 1
                              ? 'w-60'
                              : i === 5
                                ? 'w-32'
                                : '')
                        }
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows
                    .slice((packagePage - 1) * 10, packagePage * 10)
                    .map((l, i) => (
                      <tr key={l.info.id} className="border-b border-slate-100">
                        <td className="p-3 text-slate-400">
                          {(packagePage - 1) * 10 + i + 1}
                        </td>
                        <td
                          className="truncate p-3 font-bold"
                          title={l.info.title}
                        >
                          {l.info.title}
                        </td>
                        <td className="whitespace-nowrap p-3">
                          v{l.info.projectRevision}
                        </td>
                        <td className="whitespace-nowrap p-3">
                          {money(l.info.amount)}
                        </td>
                        <td className="p-3">
                          <p className="whitespace-nowrap">
                            {labels[l.info.status]}
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            有效{' '}
                            {l.runs.filter((r) => r.status === 'active').length}{' '}
                            · 历史 {l.runs.length}
                          </p>
                        </td>
                        <td className="p-3">
                          <div className="flex gap-2">
                            <button
                              className={btn}
                              type="button"
                              onClick={() => openLot(l)}
                            >
                              详情
                            </button>
                            {canNew &&
                              ['draft', 'ready'].includes(l.info.status) &&
                              !l.runs.length &&
                              l.demands.every((d) =>
                                ['草稿', '已驳回'].includes(d.status),
                              ) && (
                                <button
                                  className={btn}
                                  type="button"
                                  onClick={() => newLot(l)}
                                >
                                  编辑
                                </button>
                              )}
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            {!rows.length && (
              <p className="py-8 text-center text-sm text-slate-400">
                {lots.isLoading ? '加载中…' : '暂无分包'}
              </p>
            )}
            <Pagination
              page={packagePage}
              pageSize={10}
              total={rows.length}
              onPageChange={setPackagePage}
            />
          </div>
        ))}
      {tab === 'changes' &&
        (changes.isError ? (
          <FeedbackNotice tone="error" message="变更台账加载失败。" />
        ) : (
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] table-fixed text-left text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500">
                  <tr>
                    {['申请时间', '变更原因', '变更后金额', '状态', '操作'].map(
                      (h, i) => (
                        <th
                          key={h}
                          className={
                            'p-3 ' + (i === 1 ? 'w-72' : i === 4 ? 'w-44' : '')
                          }
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {changes.data?.items.map((row) => (
                    <tr key={row.id} className="border-b border-slate-100">
                      <td className="p-3 text-xs text-slate-500">
                        {row.createdAt.slice(0, 19).replace('T', ' ')}
                      </td>
                      <td className="truncate p-3" title={row.reason}>
                        {row.reason}
                      </td>
                      <td className="whitespace-nowrap p-3">
                        {money(row.amount)}
                      </td>
                      <td className="whitespace-nowrap p-3">
                        {labels[row.status]}
                      </td>
                      <td className="p-3">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className={btn}
                            onClick={() => openChange(row.id)}
                          >
                            详情
                          </button>
                          {canNew &&
                            ['draft', 'rejected', 'withdrawn'].includes(
                              row.status,
                            ) && (
                              <button
                                type="button"
                                className={btn}
                                onClick={() => newChange(row)}
                              >
                                编辑
                              </button>
                            )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!changes.data?.items.length && (
              <p className="py-8 text-center text-sm text-slate-400">
                暂无变更申请
              </p>
            )}
            <Pagination
              page={page}
              pageSize={10}
              total={changes.data?.total || 0}
              onPageChange={setPage}
            />
          </div>
        ))}
      {lotForm && (
        <ProjectDialog
          title={lotForm.id ? '编辑采购分包' : '新建采购分包'}
          onClose={() => setLotForm(null)}
          busy={busy}
        >
          <form
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              if (!canNew || !lotForm) return;
              void run(
                () =>
                  projectPackageSave(
                    p.id,
                    {
                      ...lotForm,
                      lines: Object.entries(lotForm.quantities)
                        .filter(([, q]) => q > 0)
                        .map(([materialId, quantity]) => ({
                          materialId,
                          quantity,
                        })),
                    },
                    lotForm.id,
                  ),
                '分包已保存。',
              );
            }}
          >
            {message?.tone === 'error' && <FeedbackNotice {...message} />}
            {balances.isError && (
              <FeedbackNotice
                tone="error"
                message="可分配数量读取失败，请关闭后重试，当前不能保存分包。"
              />
            )}
            {nativeDemands.isError && (
              <FeedbackNotice
                tone="error"
                message="已有需求读取失败，暂不能选择纳入已有需求。"
              />
            )}
            <label className="block space-y-1 text-xs text-slate-500">
              分包名称 *
              <input
                aria-label="分包名称"
                required
                maxLength={200}
                className={input}
                disabled={busy}
                value={lotForm.title}
                onChange={(e) =>
                  setLotForm({ ...lotForm, title: e.target.value })
                }
              />
            </label>
            {choices.length > 0 && (
              <fieldset className="space-y-2 border-b border-slate-100 pb-3">
                <legend className="mb-2 text-sm font-bold">
                  纳入已有项目需求
                </legend>
                {choices.map((d) => (
                  <label key={d.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      disabled={
                        busy || nativeDemands.isLoading || nativeDemands.isError
                      }
                      checked={lotForm.demandIds.includes(d.id)}
                      onChange={(e) => adopt(d.id, e.target.checked)}
                    />
                    {d.title} · {money(d.budget)}
                  </label>
                ))}
              </fieldset>
            )}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[650px] text-left text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500">
                  <tr>
                    {[
                      '已批准物料',
                      '批准数量',
                      '可分配数量',
                      '参考预算单价',
                      '本次分配数量',
                      '金额',
                    ].map((h) => (
                      <th key={h} className="p-2">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr
                      key={l.materialId}
                      className="border-b border-slate-100"
                    >
                      <td className="p-2">
                        {l.name}
                        <p className="text-xs text-slate-400">
                          {l.specification}
                        </p>
                      </td>
                      <td className="p-2">
                        {l.quantity} {l.unit}
                      </td>
                      <td className="p-2">
                        {available(l.materialId) ?? '待核对'}
                      </td>
                      <td className="whitespace-nowrap p-2">
                        {money(l.unitPrice)}
                      </td>
                      <td className="w-36 p-2">
                        <input
                          aria-label={`分包数量${i + 1}`}
                          type="number"
                          min="0"
                          max={Math.max(0, available(l.materialId) ?? 0)}
                          step="0.0001"
                          className={input}
                          disabled={
                            busy || balances.isLoading || balances.isError
                          }
                          value={lotForm.quantities[l.materialId] || 0}
                          onChange={(e) =>
                            setLotForm({
                              ...lotForm,
                              quantities: {
                                ...lotForm.quantities,
                                [l.materialId]: Number(e.target.value),
                              },
                            })
                          }
                        />
                      </td>
                      <td className="whitespace-nowrap p-2">
                        {money(
                          projectAmount([
                            {
                              ...l,
                              quantity: lotForm.quantities[l.materialId] || 0,
                            },
                          ]),
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-right text-sm font-bold">
              本次分配参考金额 {money(draftTotal)}
            </p>
            <footer className="flex justify-end gap-2">
              <button
                type="button"
                className={btn}
                disabled={busy}
                onClick={() => setLotForm(null)}
              >
                取消
              </button>
              <button
                type="submit"
                className={btn}
                disabled={
                  busy ||
                  balances.isLoading ||
                  balances.isError ||
                  !draftTotal ||
                  draftTotal <= 0
                }
              >
                <Save size={14} />
                保存分包
              </button>
            </footer>
          </form>
        </ProjectDialog>
      )}
      {changeForm && (
        <ProjectDialog
          title={changeForm.id ? '编辑立项变更' : '申请立项变更'}
          busy={busy}
          onClose={() => setChangeForm(null)}
        >
          <form
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              if (!canNew || !changeForm) return;
              void run(async () => {
                const result = await projectChangeSave(
                  p.id,
                  {
                    projectRevision: changeForm.projectRevision,
                    revision: changeForm.revision,
                    reason: changeForm.reason,
                    proposal: changeForm.draft,
                  },
                  changeForm.id,
                );
                setChangeId(result.id);
                setTab('changes');
              }, '变更草稿已保存，提交并批准后才生效。');
            }}
          >
            {message?.tone === 'error' && <FeedbackNotice {...message} />}
            <label className="block space-y-1 text-xs text-slate-500">
              变更原因 *
              <textarea
                aria-label="立项变更原因"
                className={input}
                required
                maxLength={1000}
                disabled={busy}
                value={changeForm.reason}
                onChange={(e) =>
                  setChangeForm({ ...changeForm, reason: e.target.value })
                }
              />
            </label>
            <ProjectChangeEditor
              draft={changeForm.draft}
              onChange={(draft) => setChangeForm({ ...changeForm, draft })}
              locked={!!p.executionId || !!rows.length || !!demands.length}
              busy={busy}
            />
            <footer className="flex justify-end gap-2">
              <button
                type="button"
                className={btn}
                disabled={busy}
                onClick={() => setChangeForm(null)}
              >
                取消
              </button>
              <button
                type="submit"
                className={btn}
                disabled={
                  busy ||
                  !changeForm.draft.lines.length ||
                  !projectAmount(changeForm.draft.lines)
                }
              >
                <Save size={14} />
                保存变更草稿
              </button>
            </footer>
          </form>
        </ProjectDialog>
      )}
      {lot && !lotForm && !changeForm && !confirm && (
        <ProjectDialog
          title={lot.info.title}
          busy={busy}
          onClose={() => setLotId(null)}
        >
          {message?.tone === 'error' && <FeedbackNotice {...message} />}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-bold">
              方案 v{lot.info.projectRevision} · {money(lot.info.amount)} ·{' '}
              {labels[lot.info.status]}
            </p>
            <div className="flex flex-wrap gap-2">
              {canNew && lot.info.status === 'draft' && !lot.demands.length && (
                <>
                  <button
                    type="button"
                    className={btn}
                    disabled={busy || !can('buyer:demand:create')}
                    onClick={() =>
                      setConfirm({
                        kind: 'create-demand',
                        id: lot.info.id,
                        revision: lot.info.revision,
                      })
                    }
                  >
                    生成需求
                  </button>
                  <button
                    type="button"
                    className={btn}
                    disabled={busy}
                    onClick={() =>
                      setConfirm({
                        kind: 'cancel',
                        id: lot.info.id,
                        revision: lot.info.revision,
                      })
                    }
                  >
                    取消分包
                  </button>
                </>
              )}
              {canNew && lot.info.status === 'ready' && (
                <>
                  <select
                    aria-label="分包采购方式"
                    className={input + ' !w-32'}
                    value={method}
                    onChange={(e) => setMethod(e.target.value as typeof method)}
                  >
                    <option value="rfq" disabled={!can('buyer:rfq:manage')}>
                      询比采购
                    </option>
                    <option
                      value="tender"
                      disabled={!can('buyer:tender:manage')}
                    >
                      招标采购
                    </option>
                    <option value="auction" disabled={!can('buyer:rfq:manage')}>
                      竞价采购
                    </option>
                  </select>
                  <button
                    type="button"
                    className={btn}
                    disabled={
                      busy ||
                      !lot.demands.length ||
                      lot.demands.some((d) => d.status !== '已通过') ||
                      lot.runs.some((r) => r.status === 'active') ||
                      !can(
                        `buyer:${method === 'auction' ? 'rfq' : method}:manage`,
                      ) ||
                      (method === 'auction' &&
                        (!auction.deadline ||
                          Date.parse(auction.deadline) <= Date.now() ||
                          (auction.start &&
                            Date.parse(auction.start) >=
                              Date.parse(auction.deadline)) ||
                          (auction.price &&
                            (Number(auction.price) <= 0 ||
                              Number(auction.price) >
                                Math.min(
                                  lot.info.amount,
                                  lot.demands.reduce((s, d) => s + d.budget, 0),
                                ))) ||
                          Number(auction.decrement) < 0))
                    }
                    onClick={() =>
                      setConfirm({
                        kind: 'execute',
                        id: lot.info.id,
                        revision: lot.info.revision,
                        type: method,
                      })
                    }
                  >
                    下发采购
                  </button>
                  {lot.runs.some((r) => r.status === 'active') && (
                    <button
                      type="button"
                      className={btn}
                      disabled={
                        busy ||
                        !can(
                          `buyer:${method === 'auction' ? 'rfq' : method}:manage`,
                        ) ||
                        (method === 'auction' &&
                          (!auction.deadline ||
                            Date.parse(auction.deadline) <= Date.now())) ||
                        !lot.runs.some(
                          (r) =>
                            r.status === 'active' &&
                            ['已流标', '已废标'].includes(
                              lot.sourceStatuses?.[r.executionId] || '',
                            ),
                        )
                      }
                      title="仅已流标或废标且没有订单时可办理"
                      onClick={() =>
                        setConfirm({
                          kind: 'retry',
                          id: lot.info.id,
                          revision: lot.info.revision,
                          type: method,
                        })
                      }
                    >
                      失败后重采
                    </button>
                  )}
                  {method === 'auction' && (
                    <div className="grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <label className="space-y-1 text-xs">
                        <span>
                          起拍总价（上限{' '}
                          {money(
                            Math.min(
                              lot.info.amount,
                              lot.demands.reduce((s, d) => s + d.budget, 0),
                            ),
                          )}
                          ）
                        </span>
                        <input
                          aria-label="竞价起拍价"
                          className={input}
                          type="number"
                          min="0.01"
                          step="0.01"
                          placeholder="默认批准需求金额"
                          value={auction.price}
                          onChange={(e) =>
                            setAuction((a) => ({ ...a, price: e.target.value }))
                          }
                        />
                      </label>
                      <label className="space-y-1 text-xs">
                        <span>最小降价步长</span>
                        <input
                          aria-label="竞价降价步长"
                          className={input}
                          type="number"
                          min="0"
                          step="0.01"
                          value={auction.decrement}
                          onChange={(e) =>
                            setAuction((a) => ({
                              ...a,
                              decrement: e.target.value,
                            }))
                          }
                        />
                      </label>
                      <label className="space-y-1 text-xs">
                        <span>计划开始时间</span>
                        <input
                          aria-label="竞价开始时间"
                          className={input}
                          type="datetime-local"
                          value={auction.start}
                          onChange={(e) =>
                            setAuction((a) => ({ ...a, start: e.target.value }))
                          }
                        />
                      </label>
                      <label className="space-y-1 text-xs">
                        <span>
                          竞价截止时间 <span className="text-red-600">*</span>
                        </span>
                        <input
                          aria-label="竞价截止时间"
                          className={input}
                          type="datetime-local"
                          value={auction.deadline}
                          onChange={(e) =>
                            setAuction((a) => ({
                              ...a,
                              deadline: e.target.value,
                            }))
                          }
                        />
                      </label>
                    </div>
                  )}
                  {method === 'auction' && (
                    <div className="grid w-full gap-3 sm:grid-cols-2">
                      <label className="space-y-1 text-xs">
                        <span>延时触发窗口（分钟，0关闭）</span>
                        <input
                          aria-label="延时触发窗口"
                          className={input}
                          type="number"
                          min="0"
                          max="120"
                          value={auction.trigger}
                          onChange={(e) =>
                            setAuction((a) => ({
                              ...a,
                              trigger: e.target.value,
                            }))
                          }
                        />
                      </label>
                      <label className="space-y-1 text-xs">
                        <span>自动顺延时长（分钟）</span>
                        <input
                          aria-label="自动顺延时长"
                          className={input}
                          type="number"
                          min="0"
                          max="120"
                          value={auction.extend}
                          onChange={(e) =>
                            setAuction((a) => ({
                              ...a,
                              extend: e.target.value,
                            }))
                          }
                        />
                      </label>
                    </div>
                  )}
                  {trace.data?.canClose && (
                    <button
                      type="button"
                      className={btn}
                      disabled={
                        busy || trace.isError || !can('buyer:rfq:manage')
                      }
                      onClick={() =>
                        setConfirm({
                          kind: 'close',
                          id: lot.info.id,
                          revision: lot.info.revision,
                        })
                      }
                    >
                      分包结项
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
          {Math.abs(lot.info.amount - (projectAmount(lot.lines) || 0)) >
            0.0001 && (
            <FeedbackNotice
              tone="info"
              message={`本包含分币尾差调整 ${money(lot.info.amount - (projectAmount(lot.lines) || 0))}，分包总额与批准金额保持一致。`}
            />
          )}
          <ProjectPlanSummary plan={{}} lines={lot.lines} />
          <h3 className="font-bold">关联需求</h3>
          {lot.demands.map((d) => (
            <div
              key={d.id}
              className="flex flex-wrap justify-between gap-2 border-b border-slate-100 pb-2 text-sm"
            >
              <div>
                {d.title}
                <p className="text-xs text-slate-400">
                  {d.status} · {money(d.budget)}
                </p>
              </div>
              <a
                className={btn}
                href={`?module=demands&recordId=${encodeURIComponent(d.id)}`}
              >
                详情
              </a>
            </div>
          ))}
          {canNew &&
            !lot.runs.length &&
            lot.info.status !== 'cancelled' &&
            lot.info.status !== 'closed' &&
            can('buyer:demand:read') && (
              <form
                className="flex flex-wrap gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(
                    () =>
                      projectPackageLink(
                        p.id,
                        lot.info.id,
                        lot.info.revision,
                        link,
                      ),
                    '需求已关联。',
                  );
                }}
              >
                <select
                  aria-label="关联需求编号"
                  className={input + ' sm:max-w-sm'}
                  required
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  disabled={
                    busy || nativeDemands.isLoading || nativeDemands.isError
                  }
                >
                  <option value="">选择已有采购需求</option>
                  {(nativeDemands.isError ? [] : nativeDemands.data?.data || [])
                    .filter(
                      (d) => !!d.id && !lot.demands.some((x) => x.id === d.id),
                    )
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.title} · {money(d.budget)}
                      </option>
                    ))}
                </select>
                <button type="submit" className={btn} disabled={busy || !link}>
                  关联需求
                </button>
              </form>
            )}
          <ProjectMallPanel
            key={lot.info.id}
            projectId={p.id}
            lot={lot}
            enabled={canNew}
            onChanged={onChanged}
          />
          <h3 className="font-bold">采购执行历史</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-left text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  {['方式', '执行编号', '状态', '办理依据', '操作'].map((h) => (
                    <th key={h} className="p-2">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lot.runs.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100">
                    <td className="whitespace-nowrap p-2">
                      {lot.sourceMethods?.[r.executionId] ||
                        (r.executionType === 'rfq' ? '询比' : '招标')}
                    </td>
                    <td className="max-w-60 truncate p-2" title={r.executionId}>
                      {r.executionId}
                    </td>
                    <td className="whitespace-nowrap p-2">
                      {r.status === 'active' ? '有效执行' : '已替换'}
                      {lot.sourceStatuses?.[r.executionId] && (
                        <span className="ml-2 text-xs text-slate-500">
                          {lot.sourceStatuses[r.executionId]}
                        </span>
                      )}
                    </td>
                    <td className="max-w-60 truncate p-2" title={r.reason}>
                      {r.reason || '—'}
                    </td>
                    <td className="p-2">
                      <a
                        className={btn}
                        href={`?module=${r.executionType === 'rfq' ? 'rfqs' : 'tenders'}&recordId=${encodeURIComponent(r.executionId)}`}
                      >
                        详情
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h3 className="font-bold">履约与财务进度</h3>
          {trace.isLoading && (
            <p role="status" className="text-sm text-slate-500">
              正在加载执行进度…
            </p>
          )}
          {trace.isError ? (
            <FeedbackNotice
              tone="error"
              message="执行进度加载失败或缺少源业务查看权限。"
            />
          ) : (
            trace.data && (
              <>
                <div className="grid gap-3 text-sm sm:grid-cols-3">
                  {[
                    ['订单金额', trace.data.orderAmount],
                    ['有效开票', trace.data.invoicedAmount],
                    ['净付款登记', trace.data.paidAmount],
                  ].map(([k, v]) => (
                    <div key={String(k)}>
                      <p className="text-xs text-slate-400">{k}</p>
                      <p className="mt-1 font-bold">
                        {money(v as number | null)}
                      </p>
                    </div>
                  ))}
                </div>
                {trace.data.warnings.map((w) => (
                  <p key={w} className="text-xs text-amber-700">
                    {w}
                  </p>
                ))}
              </>
            )
          )}
        </ProjectDialog>
      )}
      {changeId && !changeForm && !lotForm && !submit && !confirm && (
        <ProjectDialog
          title="立项变更详情"
          onClose={() => setChangeId(null)}
          busy={busy}
        >
          {change.isLoading && (
            <p role="status" className="text-sm text-slate-500">
              正在加载变更详情…
            </p>
          )}
          {change.isError ? (
            <FeedbackNotice tone="error" message="变更详情读取失败或无权限。" />
          ) : (
            c &&
            before &&
            after && (
              <>
                {message?.tone === 'error' && <FeedbackNotice {...message} />}
                {c.basedRevision !== p.revision &&
                  ['draft', 'rejected', 'withdrawn'].includes(c.status) && (
                    <FeedbackNotice
                      tone="info"
                      message="项目内容已更新，此变更基线已过期。请撤回草稿，基于最新项目重新发起变更；原记录保留供追溯。"
                    />
                  )}
                <header className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm">
                    {labels[c.status]} · 变更后 {money(c.amount)}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {manage &&
                      ['draft', 'rejected', 'withdrawn'].includes(c.status) && (
                        <>
                          <button
                            type="button"
                            className={btn}
                            disabled={busy || c.basedRevision !== p.revision}
                            onClick={() => newChange(c)}
                          >
                            编辑变更
                          </button>
                          <button
                            type="button"
                            className={btn}
                            disabled={
                              busy || pending || c.basedRevision !== p.revision
                            }
                            onClick={() => {
                              setSubmit(true);
                              setSubmitError(undefined);
                            }}
                          >
                            <Send size={14} />
                            提交变更审批
                          </button>
                        </>
                      )}
                    {manage && ['draft', 'submitted'].includes(c.status) && (
                      <button
                        type="button"
                        className={btn}
                        onClick={() =>
                          setConfirm({
                            kind: 'withdraw',
                            id: c.id,
                            revision: c.revision,
                          })
                        }
                      >
                        撤回变更
                      </button>
                    )}
                    <a className={btn} href="?module=approvals">
                      <ExternalLink size={13} />
                      审批中心
                    </a>
                  </div>
                </header>
                <p className="whitespace-pre-wrap break-words text-sm text-slate-600">
                  变更原因：{c.reason}
                </p>
                <div className="grid gap-5 lg:grid-cols-2">
                  <div className="min-w-0">
                    <h3 className="mb-3 border-b border-slate-200 pb-2 font-bold">
                      变更前批准方案
                    </h3>
                    <ProjectPlanSummary plan={before} lines={before.lines} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="mb-3 border-b border-blue-200 pb-2 font-bold text-blue-700">
                      申请变更后方案
                    </h3>
                    <ProjectPlanSummary plan={after.plan} lines={after.lines} />
                  </div>
                </div>
                {can('buyer:workflow:read') && (
                  <WorkflowStatusPanel
                    businessType="project_change"
                    businessId={c.id}
                    hideBusinessSnapshot
                  />
                )}
                <OwnerAttachments
                  ownerType="procurement_project_change"
                  ownerId={c.id}
                  readOnly={
                    !manage ||
                    !['draft', 'rejected', 'withdrawn'].includes(c.status)
                  }
                  title="变更证明材料"
                />
              </>
            )
          )}
        </ProjectDialog>
      )}
      {submit && c && (
        <WorkflowSubmitDialog
          businessType="project_change"
          title="提交立项变更审批"
          busy={busy}
          submissionError={submitError}
          onClose={() => setSubmit(false)}
          onSubmit={async (formData) => {
            setBusy(true);
            try {
              await projectChangeAction(
                p.id,
                c.id,
                'submit',
                c.revision,
                c.reason,
                formData,
              );
              setSubmit(false);
              await onChanged();
            } catch (e) {
              setSubmitError(e);
            } finally {
              setBusy(false);
            }
          }}
        >
          <p className="text-sm">{c.reason}</p>
        </WorkflowSubmitDialog>
      )}
      <ConfirmDialog
        open={!!confirm}
        title={
          confirm?.kind === 'withdraw'
            ? '撤回立项变更'
            : confirm?.kind === 'retry'
              ? '保留历史并重新采购'
              : confirm?.kind === 'close'
                ? '分包结项'
                : confirm?.kind === 'cancel'
                  ? '取消采购分包'
                  : confirm?.kind === 'execute'
                    ? '下发分包采购'
                    : '生成分包需求'
        }
        message={
          message?.tone === 'error'
            ? message.message
            : confirm?.kind === 'retry'
              ? '只允许无订单的已流标或废标执行，原记录保留，新执行仍沿用原分包需求。'
              : '按当前版本核验后办理，审批及业务历史完整保留。'
        }
        input={{ label: '办理原因', minLength: 1 }}
        busy={busy}
        onCancel={() => {
          setConfirm(null);
          setMessage(null);
        }}
        onConfirm={(reason) => {
          if (!confirm) return;
          const a = confirm;
          if (a.kind === 'withdraw')
            void run(
              () =>
                projectChangeAction(p.id, a.id, 'withdraw', a.revision, reason),
              '变更已撤回，原方案保持不变。',
            );
          else if (a.kind === 'execute' || a.kind === 'retry')
            void run(
              () =>
                projectPackageExecute(
                  p.id,
                  a.id,
                  a.revision,
                  a.type!,
                  reason,
                  a.kind === 'retry',
                  a.type === 'auction'
                    ? {
                        startPrice: auction.price
                          ? Number(auction.price)
                          : undefined,
                        minDecrement: Number(auction.decrement),
                        softCloseTriggerMinutes: Number(auction.trigger),
                        softCloseExtendMinutes: Number(auction.extend),
                        startsAt: auction.start
                          ? new Date(auction.start).toISOString()
                          : undefined,
                        deadlineAt: auction.deadline
                          ? new Date(auction.deadline).toISOString()
                          : undefined,
                      }
                    : undefined,
                ),
              '采购草稿已创建，请在采购执行详情中完善并发布。',
            );
          else {
            const kind = a.kind;
            void run(
              () => projectPackageAction(p.id, a.id, kind, a.revision, reason),
              '办理已完成。',
            );
          }
        }}
      />
    </section>
  );
}
