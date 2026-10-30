import { useEffect, useState, type ReactNode } from 'react';
import {
  SettlementFundingFields,
  type SettlementFundingBasis,
  type SettlementFundingEntry,
} from './settlement-funding-fields';
import { RefreshCw, Download, FileCheck2, Eye } from 'lucide-react';
import { Pagination } from './pagination';
interface Entry {
  id: string;
  orderId: string;
  contractId: string | null;
  kind: string;
  reason: string;
  snapshot: string;
  goodsAmount: number;
  compensationAmount: number;
  finalAmount: number;
  initialPaid: number;
  status: string;
  revision: number;
  workflowInstanceId?: string;
  createdBy: string;
  createdAt: string;
  agreementName: string;
  supplierComment?: string;
}
interface Detail {
  fundingRequired?: boolean;
  fundingEntries?: SettlementFundingEntry[];
  record: Entry;
  evidence: {
    source?: string | null;
    cashPeriod?: string | null;
    id: string;
    kind: string;
    amount: number;
    evidenceNo: string;
    remark: string;
    createdBy: string;
    createdAt: string;
  }[];
  netPaid: number;
  refundDue: number;
  paymentDue: number;
  blockers: string[];
}
interface State {
  data?: {
    preview: { contractId?: string; baseline: string; blockers: string[] };
    items: Entry[];
    total: number;
    actorId: string;
  };
  loading: boolean;
  loadError: boolean;
  page: number;
  setPage: (p: number) => void;
  busy: boolean;
  error: string;
  selected: string;
  setSelected: (s: string) => void;
  detail?: Detail;
  detailLoading: boolean;
  detailError: boolean;
  refresh: () => unknown;
  propose: (d: Record<string, unknown>) => Promise<boolean>;
  act: (
    e: Entry,
    a: string,
    r: string,
    f?: Record<string, unknown>,
  ) => Promise<boolean>;
  evidence: (e: Entry, d: Record<string, unknown>) => Promise<boolean>;
}
const labels: Record<string, string> = {
  supplier_pending: '待供应商确认',
  agreed: '待提交内部审批',
  submitted: '内部审批中',
  approved: '待凭证清算',
  rejected: '已拒绝/驳回',
  withdrawn: '已撤回',
  settled: '清算完成',
  draft_void: '合同草案撤销',
  termination: '合同解除',
  reduction: '部分履约减量',
  order_closeout: '无独立合同订单清算',
  payment: '补付款',
  refund: '退款',
  invoice: '最终发票/红冲核对',
  compensation_receipt: '补偿款凭证',
};
const button =
  'inline-flex h-9 shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50';
const input =
  'h-10 w-full min-w-0 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800';
const money = (n: number) =>
  Number(n).toLocaleString('zh-CN', { style: 'currency', currency: 'CNY' });
function parse(s: string) {
  try {
    return JSON.parse(s) as {
      funding?: SettlementFundingBasis;
      previousSettlementId?: string;
      period?: string;
      cashPeriods?: { source: string; period: string; amount: number }[];
      invoiceBasis?: {
        source: string;
        label: string;
        face: number;
        paid: number;
      }[];
      allocationRequired?: boolean;
      invoicePlan?: {
        source: string;
        label: string;
        face: number;
        paid: number;
        target: number;
      }[];
      lines?: {
        id: string;
        description: string;
        quantity: number;
        received: number;
        unitPrice: number;
        settlementUnitPrice?: number;
        retainedQuantity?: number;
        cancelledQuantity?: number;
      }[];
      assessment?: {
        lines?: {
          id: string;
          description: string;
          quantity: number;
          received: number;
          unitPrice: number;
          settlementUnitPrice?: number;
          retainedQuantity?: number;
          cancelledQuantity?: number;
        }[];
      };
    };
  } catch {
    return {};
  }
}
export function OrderSettlementPanel({
  state: s,
  supplier = false,
  canManage = false,
  canContractManage = true,
  canFinance = false,
  attachments,
  attachmentOptions = [],
  onSubmit,
  onAgreement,
  workflow,
}: {
  state: State;
  supplier?: boolean;
  canManage?: boolean;
  canContractManage?: boolean;
  canFinance?: boolean;
  attachments?: ReactNode;
  attachmentOptions?: { id: string; fileName: string }[];
  onSubmit?: (e: Entry, reason: string) => void;
  onAgreement: (e: Entry) => void;
  workflow?: (e: Entry) => ReactNode;
}) {
  const [creating, setCreating] = useState(false),
    [reason, setReason] = useState(''),
    [agreement, setAgreement] = useState(''),
    [compensation, setCompensation] = useState('0'),
    [prices, setPrices] = useState<Record<string, string>>({}),
    [allocations, setAllocations] = useState<Record<string, string>>({}),
    [source, setSource] = useState(''),
    [kind, setKind] = useState('refund'),
    [amount, setAmount] = useState(''),
    [reference, setReference] = useState(''),
    [proof, setProof] = useState(''),
    [remark, setRemark] = useState('');
  const [fundingValues, setFundingValues] = useState<Record<string, string>>(
      {},
    ),
    [fundingReady, setFundingReady] = useState(false);
  const [cashPeriod, setCashPeriod] = useState(''),
    [targets, setTargets] = useState<Record<string, string>>({});
  const e = s.detail?.record,
    lines = parse(s.data?.preview.baseline || '{}').lines || [];
  const basis = parse(s.data?.preview.baseline || '{}');
  const invoicePlan = e ? parse(e.snapshot).invoicePlan : undefined;
  const funding = e ? parse(e.snapshot).funding : undefined;
  const settlementBasis = e ? parse(e.snapshot) : basis;
  const years = Array.from(
    new Set(
      (settlementBasis.cashPeriods || [])
        .filter((x) => x.source === source && x.amount > 0)
        .map((x) => x.period),
    ),
  );
  const chosenPeriod =
    kind === 'payment'
      ? settlementBasis.period
      : cashPeriod ||
        (years.length === 1 && years[0] === settlementBasis.period
          ? years[0]
          : '');
  useEffect(() => {
    setFundingValues({});
    setFundingReady(false);
    setCashPeriod('');
    setTargets({});
  }, [e?.id]);
  const mayManage =
    canManage &&
    (!(e?.contractId || s.data?.preview.contractId) || canContractManage);
  return (
    <section
      aria-label="合同解除与订单清算"
      className="min-w-0 space-y-4 rounded-lg border border-slate-200 bg-white p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-bold text-slate-900">合同解除与订单清算</h3>
        <div className="flex gap-2">
          <button
            className={button}
            title="刷新清算台账"
            aria-label="刷新清算台账"
            onClick={() => void s.refresh()}
          >
            <RefreshCw size={14} />
          </button>
          {!supplier &&
            mayManage &&
            s.data &&
            !s.data.preview.blockers.length && (
              <button className={button} onClick={() => setCreating(!creating)}>
                <FileCheck2 size={14} />
                {basis.previousSettlementId
                  ? '发起补充清算'
                  : s.data.preview.contractId
                    ? '发起合同清算'
                    : '发起订单清算'}
              </button>
            )}
        </div>
      </div>
      {s.loading && <p role="status">加载清算台账…</p>}
      {s.loadError && (
        <p role="alert" className="text-sm text-red-600">
          清算台账加载失败，请刷新重试。
        </p>
      )}
      {s.error && (
        <p role="alert" className="text-sm text-red-600">
          {s.error}
        </p>
      )}
      {!supplier &&
        s.data &&
        s.data.preview.blockers.length > 0 &&
        !s.data.items.length && (
          <ul className="space-y-1 text-sm text-slate-500">
            {s.data.preview.blockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        )}
      {creating && (
        <form
          className="space-y-3 border-t border-slate-100 pt-4"
          onSubmit={async (event) => {
            event.preventDefault();
            if (
              await s.propose({
                reason,
                agreementId: agreement,
                compensation: Number(compensation),
                ...(basis.previousSettlementId
                  ? { previousSettlementId: basis.previousSettlementId }
                  : {}),
                prices: Object.entries(prices).map(([lineId, p]) => ({
                  lineId,
                  unitPrice: Number(p),
                })),
                ...(basis.allocationRequired
                  ? {
                      allocations: (basis.invoiceBasis || []).map((x) => ({
                        source: x.source,
                        goodsAmount: Number(allocations[x.source]),
                      })),
                    }
                  : {}),
              })
            ) {
              setCreating(false);
              setReason('');
            }
          }}
        >
          <h4 className="font-semibold">清算方案</h4>
          <p className="text-xs text-slate-500">
            保留已验收数量，终止未履行余额。降价须在协议中约定；补偿与货款合计不得超原订单额。
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[540px] text-left text-sm">
              <thead>
                <tr>
                  <th>货物</th>
                  <th>原数量</th>
                  <th>保留数量</th>
                  <th>终止数量</th>
                  <th>清算单价</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.id}>
                    <td className="py-2">{l.description}</td>
                    <td>{l.quantity}</td>
                    <td>{l.retainedQuantity ?? l.received}</td>
                    <td>{l.cancelledQuantity ?? l.quantity - l.received}</td>
                    <td>
                      <input
                        aria-label={`清算单价 ${l.description}`}
                        className={input}
                        type="number"
                        min="0"
                        max={l.unitPrice}
                        step="0.01"
                        value={prices[l.id] ?? String(l.unitPrice)}
                        onChange={(v) =>
                          setPrices({ ...prices, [l.id]: v.target.value })
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {basis.allocationRequired && (
            <fieldset className="space-y-3 rounded-md border border-slate-200 p-3">
              <legend className="px-1 text-sm font-semibold">
                逐票货款归属
              </legend>
              {(basis.invoiceBasis || []).map((x) => (
                <label
                  key={x.source}
                  className="grid items-center gap-2 text-sm sm:grid-cols-[minmax(0,1fr)_10rem]"
                >
                  <span className="min-w-0 break-words">
                    {x.label}
                    <span className="block text-xs text-slate-500">
                      原金额 {money(x.face)} · 已付 {money(x.paid)}
                    </span>
                  </span>
                  <input
                    className={input}
                    aria-label={`${x.label}清算货款`}
                    required
                    type="number"
                    min="0"
                    max={x.face}
                    step="0.01"
                    value={allocations[x.source] ?? ''}
                    onChange={(v) =>
                      setAllocations({
                        ...allocations,
                        [x.source]: v.target.value,
                      })
                    }
                  />
                </label>
              ))}
            </fieldset>
          )}
          <label className="block text-sm">
            补偿款
            <input
              className={input}
              required
              type="number"
              min="0"
              step="0.01"
              value={compensation}
              onChange={(v) => setCompensation(v.target.value)}
            />
          </label>
          <label className="block text-sm">
            清算原因
            <textarea
              className={input + ' h-20 py-2'}
              required
              maxLength={1000}
              value={reason}
              onChange={(v) => setReason(v.target.value)}
            />
          </label>
          {attachments}
          <label className="block text-sm">
            共享给供应商的清算协议
            <select
              className={input}
              required
              value={agreement}
              onChange={(v) => setAgreement(v.target.value)}
            >
              <option value="">请选择已上传原件</option>
              {attachmentOptions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.fileName}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-2">
            <button className={button} disabled={s.busy} type="submit">
              提交供应商确认
            </button>
            <button
              className={button}
              type="button"
              onClick={() => setCreating(false)}
            >
              取消
            </button>
          </div>
        </form>
      )}
      {s.data && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] table-fixed text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="w-36 p-2">类型 / 状态</th>
                  <th className="p-2">清算原因</th>
                  <th className="w-32 p-2">约定净额</th>
                  <th className="w-24 p-2 text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {s.data.items.map((x) => (
                  <tr key={x.id} className="border-b border-slate-100">
                    <td className="p-2">
                      <div>{labels[x.kind]}</div>
                      <div className="text-xs text-blue-600">
                        {labels[x.status]}
                      </div>
                    </td>
                    <td className="truncate p-2" title={x.reason}>
                      {x.reason}
                    </td>
                    <td className="p-2 tabular-nums">{money(x.finalAmount)}</td>
                    <td className="p-2 text-right">
                      <button
                        className={button}
                        onClick={() => s.setSelected(x.id)}
                      >
                        <Eye size={13} />
                        详情
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={s.page}
            pageSize={10}
            total={s.data.total}
            onPageChange={s.setPage}
          />
        </>
      )}
      {s.selected && (
        <div className="space-y-3 border-t border-slate-200 pt-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold">清算详情</h4>
            <button className={button} onClick={() => s.setSelected('')}>
              收起
            </button>
          </div>
          {s.detailLoading && <p role="status">加载详情…</p>}
          {s.detailError && <p role="alert">详情加载失败，请刷新。</p>}
          {e && !s.detailLoading && !s.detailError && (
            <>
              <div className="grid gap-3 text-sm sm:grid-cols-3">
                <div>
                  结算货款
                  <br />
                  <strong>{money(e.goodsAmount)}</strong>
                </div>
                <div>
                  补偿款
                  <br />
                  <strong>{money(e.compensationAmount)}</strong>
                </div>
                <div>
                  清算状态
                  <br />
                  <strong>{labels[e.status]}</strong>
                </div>
                <div>
                  实际净付款
                  <br />
                  {money(s.detail!.netPaid)}
                </div>
                <div>
                  待退款
                  <br />
                  {money(s.detail!.refundDue)}
                </div>
                <div>
                  待补付
                  <br />
                  {money(s.detail!.paymentDue)}
                </div>
              </div>
              <p className="break-words text-sm">{e.reason}</p>
              {parse(e.snapshot).previousSettlementId && (
                <div className="flex flex-wrap items-center gap-2 border-l-2 border-blue-500 pl-3 text-sm">
                  <span>补充清算</span>
                  <button
                    className={button}
                    onClick={() =>
                      s.setSelected(parse(e.snapshot).previousSettlementId!)
                    }
                  >
                    <Eye size={14} />
                    查看上次清算
                  </button>
                </div>
              )}
              {invoicePlan && (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[580px] text-left text-sm">
                    <thead>
                      <tr>
                        <th>发票 / 款项</th>
                        <th>约定净额</th>
                        <th>实际净付</th>
                        <th>待退款</th>
                        <th>待补付</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoicePlan.map((row) => {
                        const net =
                          row.paid +
                          s
                            .detail!.evidence.filter(
                              (p) => p.source === row.source,
                            )
                            .reduce(
                              (n, p) =>
                                n +
                                (p.kind === 'payment'
                                  ? p.amount
                                  : p.kind === 'refund'
                                    ? -p.amount
                                    : 0),
                              0,
                            );
                        return (
                          <tr key={row.source}>
                            <td className="max-w-56 break-words py-2">
                              {row.label}
                            </td>
                            <td>{money(row.target)}</td>
                            <td>{money(net)}</td>
                            <td>{money(Math.max(0, net - row.target))}</td>
                            <td>{money(Math.max(0, row.target - net))}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <button className={button} onClick={() => onAgreement(e)}>
                <Download size={14} />
                下载清算协议
              </button>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead>
                    <tr>
                      <th>货物</th>
                      <th>保留 / 终止数量</th>
                      <th>清算单价</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(parse(e.snapshot).assessment?.lines || []).map((l) => (
                      <tr key={l.id}>
                        <td className="py-2">{l.description}</td>
                        <td>
                          {l.retainedQuantity} / {l.cancelledQuantity}
                        </td>
                        <td>{money(l.settlementUnitPrice ?? l.unitPrice)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {e.supplierComment && (
                <p className="text-sm">供应商确认：{e.supplierComment}</p>
              )}
              {mayManage &&
                ((supplier && e.status === 'supplier_pending') ||
                  (!supplier &&
                    e.createdBy === s.data?.actorId &&
                    ['supplier_pending', 'agreed'].includes(e.status))) && (
                  <div className="flex flex-wrap items-end gap-2">
                    <label className="min-w-48 flex-1 text-sm">
                      办理意见
                      <input
                        className={input}
                        maxLength={1000}
                        value={remark}
                        onChange={(v) => setRemark(v.target.value)}
                      />
                    </label>
                    {(supplier
                      ? ['accept', 'reject']
                      : e.status === 'agreed'
                        ? ['submit', 'withdraw']
                        : ['withdraw']
                    ).map((a) => (
                      <button
                        key={a}
                        className={button}
                        disabled={s.busy || !remark.trim()}
                        onClick={() =>
                          a === 'submit'
                            ? onSubmit?.(e, remark)
                            : void s.act(e, a, remark)
                        }
                      >
                        {
                          (
                            {
                              accept: '同意方案',
                              reject: '拒绝方案',
                              submit: '提交内部审批',
                              withdraw: '撤回申请',
                            } as Record<string, string>
                          )[a]
                        }
                      </button>
                    ))}
                  </div>
                )}
              {workflow?.(e)}
              {!supplier && s.detail!.fundingRequired && !funding && (
                <p role="alert" className="text-sm text-red-600">
                  专项清算需要预算查看权限，当前仅可查看普通清算资料。
                </p>
              )}
              {!supplier &&
                e.status === 'approved' &&
                canFinance &&
                (!s.detail!.fundingRequired || !!funding) && (
                  <form
                    className="space-y-3 border-t border-slate-100 pt-3"
                    onSubmit={async (event) => {
                      event.preventDefault();
                      if (
                        funding &&
                        ['payment', 'refund'].includes(kind) &&
                        !fundingReady
                      )
                        return;
                      if (
                        await s.evidence(e, {
                          kind,
                          amount: Number(amount),
                          evidenceNo: reference,
                          attachmentId: proof,
                          remark,
                          ...(invoicePlan ? { source } : {}),
                          ...(['payment', 'refund'].includes(kind) &&
                          chosenPeriod
                            ? { cashPeriod: chosenPeriod }
                            : {}),
                          ...(funding && ['payment', 'refund'].includes(kind)
                            ? {
                                fundingLines: funding.sources
                                  .filter(
                                    (x) =>
                                      !chosenPeriod ||
                                      !x.period ||
                                      x.period === chosenPeriod,
                                  )
                                  .map((x) => ({
                                    fundId: x.fundId,
                                    ...(x.historical
                                      ? { targetFundId: targets[x.fundId] }
                                      : {}),
                                    amount: Number(
                                      fundingValues[x.fundId] || 0,
                                    ),
                                  }))
                                  .filter((x) => x.amount > 0),
                              }
                            : {}),
                        })
                      ) {
                        setReference('');
                        setAmount('');
                        setFundingValues({});
                        setFundingReady(false);
                      }
                    }}
                  >
                    <h4 className="font-semibold">登记实际清算凭证</h4>
                    {attachments}
                    <div className="grid gap-3 sm:grid-cols-2">
                      {invoicePlan && (
                        <label className="text-sm">
                          发票或款项归属
                          <select
                            className={input}
                            required
                            value={source}
                            onChange={(v) => {
                              setSource(v.target.value);
                              setFundingValues({});
                              setFundingReady(false);
                              setCashPeriod('');
                              setTargets({});
                            }}
                          >
                            <option value="">请选择归属</option>
                            {invoicePlan.map((row) => (
                              <option key={row.source} value={row.source}>
                                {row.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                      <label className="text-sm">
                        类型
                        <select
                          className={input}
                          value={kind}
                          onChange={(v) => {
                            setKind(v.target.value);
                            setFundingValues({});
                            setFundingReady(false);
                          }}
                        >
                          {[
                            'refund',
                            'payment',
                            'invoice',
                            'compensation_receipt',
                          ].map((k) => (
                            <option key={k} value={k}>
                              {labels[k]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="text-sm">
                        金额
                        <input
                          className={input}
                          required
                          type="number"
                          min="0"
                          step="0.01"
                          value={amount}
                          onChange={(v) => setAmount(v.target.value)}
                        />
                      </label>
                      <label className="text-sm">
                        凭证编号
                        <input
                          className={input}
                          required
                          maxLength={150}
                          value={reference}
                          onChange={(v) => setReference(v.target.value)}
                        />
                      </label>
                      <label className="text-sm">
                        原件
                        <select
                          className={input}
                          required
                          value={proof}
                          onChange={(v) => setProof(v.target.value)}
                        >
                          <option value="">请选择原件</option>
                          {attachmentOptions.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.fileName}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="text-sm sm:col-span-2">
                        核对说明
                        <input
                          className={input}
                          required
                          maxLength={1000}
                          value={remark}
                          onChange={(v) => setRemark(v.target.value)}
                        />
                      </label>
                    </div>
                    {kind === 'refund' && settlementBasis.period && (
                      <label className="block text-sm">
                        退款归属年度 <span className="text-red-600">*</span>
                        <select
                          aria-label="退款归属年度"
                          className={input}
                          required
                          value={chosenPeriod || ''}
                          onChange={(v) => {
                            setCashPeriod(v.target.value);
                            setFundingValues({});
                            setTargets({});
                            setFundingReady(false);
                          }}
                        >
                          <option value="">请选择原付款年度</option>
                          {years.map((y) => (
                            <option key={y} value={y}>
                              {y}
                              {y === settlementBasis.period
                                ? '（当前责任年度）'
                                : '（历史冻结年度）'}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    {funding &&
                      ['payment', 'refund'].includes(kind) &&
                      (!settlementBasis.period || !!chosenPeriod) && (
                        <SettlementFundingFields
                          basis={funding}
                          entries={s.detail!.fundingEntries || []}
                          evidence={s.detail!.evidence}
                          kind={kind}
                          source={source}
                          amount={amount}
                          value={fundingValues}
                          onChange={setFundingValues}
                          onReady={setFundingReady}
                          cashPeriod={chosenPeriod}
                          targets={targets}
                          onTargetsChange={setTargets}
                        />
                      )}
                    <button
                      className={button}
                      disabled={
                        s.busy ||
                        (kind === 'refund' &&
                          !!settlementBasis.period &&
                          !chosenPeriod) ||
                        !!(
                          funding &&
                          ['payment', 'refund'].includes(kind) &&
                          !fundingReady
                        )
                      }
                      type="submit"
                    >
                      登记凭证
                    </button>
                    {s.detail!.blockers.map((b) => (
                      <p className="text-sm text-amber-700" key={b}>
                        {b}
                      </p>
                    ))}
                    <button
                      className={button}
                      type="button"
                      disabled={
                        s.busy || !!s.detail!.blockers.length || !remark.trim()
                      }
                      onClick={() => void s.act(e, 'complete', remark)}
                    >
                      {e.contractId ? '完成清算并归档合同' : '完成订单清算'}
                    </button>
                  </form>
                )}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[500px] text-left text-sm">
                  <thead>
                    <tr>
                      <th>凭证</th>
                      {invoicePlan && <th>款项归属</th>}
                      <th>金额</th>
                      <th>编号</th>
                      <th>登记时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.detail!.evidence.map((p) => (
                      <tr key={p.id}>
                        <td className="py-2">
                          {labels[p.kind]}
                          {p.cashPeriod && (
                            <span className="block text-xs text-slate-500">
                              {p.cashPeriod} 年度
                            </span>
                          )}
                        </td>
                        {invoicePlan && (
                          <td className="max-w-48 break-words">
                            {invoicePlan.find((row) => row.source === p.source)
                              ?.label || '未归属'}
                          </td>
                        )}
                        <td>{money(p.amount)}</td>
                        <td>{p.evidenceNo}</td>
                        <td>{new Date(p.createdAt).toLocaleString('zh-CN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!supplier && !!s.detail!.fundingEntries?.length && (
                <section
                  aria-label="清算来源分账明细"
                  className="space-y-2 border-t border-slate-200 pt-3"
                >
                  <h4 className="font-semibold">清算来源分账</h4>
                  {s.detail!.fundingEntries.map((x) => (
                    <div
                      key={x.evidenceId + ':' + x.fundId}
                      className="flex flex-wrap justify-between gap-2 text-sm"
                    >
                      <span>
                        {x.code} · {x.name}
                        {x.targetName && (
                          <span className="block text-xs text-slate-500">
                            当年责任回补：{x.targetName}
                          </span>
                        )}
                      </span>
                      <span>
                        {x.amount < 0 ? '退款' : '补付'}{' '}
                        {money(Math.abs(x.amount))} ·{' '}
                        {
                          s.detail!.evidence.find((p) => p.id === x.evidenceId)
                            ?.evidenceNo
                        }
                      </span>
                    </div>
                  ))}
                </section>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
