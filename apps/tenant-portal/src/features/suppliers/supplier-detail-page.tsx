import { useState } from 'react';
import { useBuyerPermissions } from '../../lib/use-buyer-permissions';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Banknote,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Contact,
  FileText,
  Gauge,
  LineChart,
  Mail,
  MapPin,
  Phone,
  Pencil,
  ShieldCheck,
  Star,
  TrendingUp,
  Workflow,
} from 'lucide-react';
import {
  type BuyerSupplierResponse,
  type PurchaseOrderResponse,
  useBuyerSupplierChangeStatus,
  buyerSupplierExitRisk,
  type SupplierExitRiskResponse,
  usePurchaseOrderList,
  type WorkflowTask,
  useWorkflowBuyerSupplierAdmissionSubmit,
  useWorkflowRuntimeTasks,
} from '@24bid/api-client';
import { ConfirmDialog, FeedbackNotice, StatusPill, cn } from '@24bid/ui';
import { SupplierQualificationsTab } from './supplier-qualifications-tab';
import { SupplierAdmissionSubmitDialog } from './supplier-admission-submit-dialog';
import { WorkflowStatusPanel } from '../workflow/workflow-instance-panel';
import { SupplierAdmissionReviewDialog } from './supplier-admission-review-dialog';
import { SupplierExitActions } from './supplier-exit-actions';
import { SupplierEvaluationPanel } from './supplier-evaluation-panel';
import { SupplierPerformanceTasks } from './supplier-performance-tasks';

type TabId = 'orders' | 'finance' | 'performance' | 'products' | 'qualifications';

const TABS: { id: TabId; label: string }[] = [
  { id: 'orders', label: '采购订单' },
  { id: 'finance', label: '财务记录' },
  { id: 'performance', label: '绩效考核' },
  { id: 'products', label: '供应产品' },
  { id: 'qualifications', label: '资质证书' },
];

const currency = (v?: number) =>
  v == null ? '—' : `¥ ${v.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`;

const shortDate = (v?: string) => (v ? v.slice(0, 10) : '—');

interface AdmissionFeedback {
  tone: 'success' | 'error' | 'info';
  message: string;
}

const scoreTone = (score: number) => {
  if (score >= 90) return 'text-emerald-700 bg-emerald-50 border-emerald-100';
  if (score >= 80) return 'text-blue-700 bg-blue-50 border-blue-100';
  return 'text-amber-700 bg-amber-50 border-amber-100';
};

export function SupplierDetailPage({
  supplier,
  onBack,
  onEdit,
  initialTab = 'performance',
}: {
  supplier: BuyerSupplierResponse;
  onBack: () => void;
  onEdit?: () => void;
  initialTab?: TabId;
}) {
  const { can } = useBuyerPermissions();
  const [tab, setTab] = useState<TabId>(initialTab);
  const [showApproval, setShowApproval] = useState(false);
  const id = supplier.id ?? '';
  const supplierId = supplier.supplierId ?? '';
  const ordersQuery = usePurchaseOrderList(
    supplierId ? { supplierId } : undefined,
    { query: { enabled: !!supplierId && can('buyer:order:read') } },
  );
  const orders = can('buyer:order:read') && !ordersQuery.isError ? ordersQuery.data?.data ?? [] : [];
  const score = Math.round(
    supplier.lastEvaluationScore ?? supplier.performanceScore ?? fallbackScore(supplier),
  );
  const totalAmount = orders.reduce((sum, order) => sum + (order.amount ?? 0), 0);
  const completedOrders = orders.filter((order) => ['已完成', '已收货'].includes(order.status ?? '')).length;
  const trend = buildTrend(orders);
  const categories = supplier.categories?.length ? supplier.categories : ['未维护品类'];

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <section className="rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-50 hover:text-slate-900"
              aria-label="返回供应商库"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-xl font-black text-white ">
              {supplier.supplierName?.slice(0, 1) ?? '供'}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="break-words text-xl font-black tracking-normal text-slate-950">
                  {supplier.supplierName ?? '未命名供应商'}
                </h1>
                <StatusPill label={supplier.status ?? '待维护'} />
                <span className="rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-black text-blue-700">
                  {supplier.level ?? supplier.cooperationTier ?? 'A'}级供应商
                </span>
              </div>
              <p className="mt-1 break-words text-sm font-bold text-slate-500">
                {supplier.supplierId ?? 'SUP-000'} · 主营：{categories.join('、')}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {onEdit && can('buyer:supplier:manage') && <button type="button" onClick={onEdit}
              className="inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50">
              <Pencil size={16} />编辑私域资料
            </button>}
            <button
              onClick={() => setTab('performance')}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-black text-white  hover:bg-slate-800"
            >
              <TrendingUp size={16} /> 绩效考核
            </button>
            {can('buyer:workflow:read') && <button
              type="button"
              onClick={() => setShowApproval((visible) => !visible)}
              disabled={!id}
              aria-expanded={showApproval}
              aria-controls="supplier-approval-panel"
              className={cn(
                'inline-flex h-10 items-center gap-2 rounded-lg border px-4 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50',
                showApproval
                  ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50',
              )}
            >
              <Workflow size={16} />
              审批信息
              <ChevronDown
                size={15}
                className={cn('transition-transform', showApproval && 'rotate-180')}
              />
            </button>}
          </div>
        </div>
      </section>

      {id && showApproval && can('buyer:workflow:read') && (
        <div id="supplier-approval-panel">
          <WorkflowStatusPanel businessType="buyer_supplier_admission" businessId={id} />
          <WorkflowStatusPanel businessType="buyer_supplier_exit" businessId={id} />
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <aside className="space-y-5">
          <ScoreCard score={score} supplier={supplier} orders={orders} />
          <RiskCard supplier={supplier} />
          <ArchiveCard supplier={supplier} />
          <ContactCard supplier={supplier} />
          <AdmissionCard supplier={supplier} />
        </aside>

        <main className="min-w-0 space-y-5 lg:col-span-2">
          <HistoryOverview
            totalAmount={totalAmount}
            completedOrders={completedOrders}
            orderCount={orders.length}
            trend={trend}
          />

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex gap-1 border-b border-slate-100 bg-slate-50/70 p-1.5">
              {TABS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={cn(
                    'h-10 flex-1 rounded-lg px-3 text-sm font-black transition',
                    tab === item.id
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-500 hover:bg-white hover:text-slate-900',
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {tab === 'orders' && <OrdersTab orders={orders} loading={ordersQuery.isLoading} />}
          {tab === 'finance' && <FinanceTab orders={orders} />}
          {id && <div hidden={tab !== 'performance'}><SupplierPerformanceTasks key={`tasks-${id}`} relationId={id} /><SupplierEvaluationPanel key={id} relationId={id} supplierId={supplierId} /></div>}
          {tab === 'products' && <ProductsTab supplier={supplier} />}
          {tab === 'qualifications' && id && (
            <SupplierQualificationsTab relationId={id} supplierId={supplier.supplierId} />
          )}
        </main>
      </div>

      <AdmissionActionBar supplier={supplier} />
    </div>
  );
}

function ScoreCard({
  score,
  supplier,
  orders,
}: {
  score: number;
  supplier: BuyerSupplierResponse;
  orders: PurchaseOrderResponse[];
}) {
  const stars = Math.max(1, Math.min(5, Math.round(score / 20)));
  // 订单完成率:该供应商真实订单中「已收货」的占比;无订单时为空。
  const completionRate = orders.length > 0
    ? `${Math.round((orders.filter((o) => o.status === '已收货').length / orders.length) * 100)}%`
    : '—';

  return (
    <section className="relative overflow-hidden rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="absolute right-5 top-6">
        <Star size={84} strokeWidth={1.6} color="#f1f5f9" />
      </div>
      <PanelTitle icon={Gauge} title="核心绩效仪表盘" />
      <div className="relative mt-8 text-center">
        <p className="text-5xl font-black leading-none text-slate-950">{score}</p>
        <div className="mt-3 flex justify-center gap-1 text-amber-400">
          {Array.from({ length: 5 }).map((_, index) => (
            <Star
              key={index}
              size={18}
              className={index < stars ? 'fill-current' : 'text-slate-200'}
            />
          ))}
        </div>
        <span className={cn('mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-black', scoreTone(score))}>
          综合绩效评分(来自考核台账)
        </span>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3">
        <MetricTile label="订单完成率" value={completionRate} />
        <MetricTile label="最近考核实测" value={supplier.lastEvaluationScore != null ? String(supplier.lastEvaluationScore) : '—'} />
      </div>
    </section>
  );
}

function RiskCard({ supplier }: { supplier: BuyerSupplierResponse }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <PanelTitle icon={Building2} title="工商与信用风控" />
      <div className="mt-4 flex items-center justify-between rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3">
        <span className="inline-flex items-center gap-2 text-sm font-black text-emerald-700">
          <CheckCircle2 size={16} /> 经营状态正常
        </span>
        <span className="rounded-lg border border-emerald-200 bg-white px-2 py-1 text-xs font-black text-emerald-700">
          在营
        </span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <MetricTile label="供应商等级" value={`${supplier.level ?? '—'} 级`} />
        <MetricTile label="合作层级" value={supplier.cooperationTier ?? '—'} />
      </div>
      <InfoRows
        rows={[
          ['统一社会信用代码', supplier.creditCode || '—'],
          ['准入状态', supplier.status ?? '—'],
          ['黑名单', supplier.status === '黑名单' ? '已列入' : '未列入'],
        ]}
      />
      <p className="mt-4 text-center text-[11px] font-bold text-slate-400">
        数据源:供应商主档与准入台账;工商/司法风控需接入外部征信后启用
      </p>
    </section>
  );
}

function ArchiveCard({ supplier }: { supplier: BuyerSupplierResponse }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <PanelTitle icon={FileText} title="基础档案" />
      <div className="mt-4 space-y-3">
        <ArchiveItem icon={Building2} label="企业全称" value={supplier.supplierName ?? '—'} />
        <ArchiveItem icon={Contact} label="法定代表人" value={supplier.legalPerson || '—'} />
        <ArchiveItem icon={Banknote} label="统一社会信用代码" value={supplier.creditCode || '—'} />
        <ArchiveItem icon={CalendarDays} label="合作层级" value={supplier.cooperationTier ?? '—'} />
      </div>
    </section>
  );
}

function ContactCard({ supplier }: { supplier: BuyerSupplierResponse }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <PanelTitle icon={MapPin} title="联系方式" />
      <InfoRows
        rows={[
          ['销售代表', supplier.contactName || '—', Contact],
          ['移动电话', supplier.contactPhone || '—', Phone],
          ['电子邮箱', supplier.contactEmail || '—', Mail],
        ]}
      />
    </section>
  );
}

function AdmissionCard({ supplier }: { supplier: BuyerSupplierResponse }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <PanelTitle icon={ShieldCheck} title="准入与生命周期" />
      <p className="mt-3 text-sm font-bold leading-6 text-slate-500">
        当前状态为 <span className="font-black text-slate-900">{supplier.status ?? '—'}</span>，
        生命周期操作(提交准入 / 审批 / 冻结 / 恢复)见页面底部悬浮操作条。
      </p>
    </section>
  );
}

// 底部悬浮操作条:生命周期动作常驻可见,样式对齐需求/登记页提交操作条。
function AdmissionActionBar({ supplier }: { supplier: BuyerSupplierResponse }) {
  const { can } = useBuyerPermissions();
  const queryClient = useQueryClient();
  const submit = useWorkflowBuyerSupplierAdmissionSubmit();
  const workflowTasks = useWorkflowRuntimeTasks(can('buyer:workflow:review'));
  const [review, setReview] = useState<{ task: WorkflowTask; approved: boolean } | null>(null);
  const changeStatus = useBuyerSupplierChangeStatus();
  const [riskLoading, setRiskLoading] = useState(false);
  const [statusTarget, setStatusTarget] = useState<{ status: string; risk: SupplierExitRiskResponse } | null>(null);
  const id = supplier.id ?? '';
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [feedback, setFeedback] = useState<AdmissionFeedback | null>(null);
  const admissionTask = (workflowTasks.data?.data ?? []).find(
    (task) => task.businessType === 'buyer_supplier_admission' && task.businessId === id,
  );
  const busy = submit.isPending || changeStatus.isPending || riskLoading;
  const prepareStatus = async (status: string) => {
    if (!id || !can('buyer:supplier:manage') || busy) return;
    setFeedback(null);
    setRiskLoading(true);
    try {
      const response = await buyerSupplierExitRisk(id);
      if (!response.data) throw new Error('风险数据为空');
      setStatusTarget({ status, risk: response.data });
    } catch {
      setFeedback({ tone: 'error', message: '未结业务风险加载失败，暂不能调整状态，请重试。' });
    } finally { setRiskLoading(false); }
  };
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({
        predicate: (q) =>
          typeof q.queryKey[0] === 'string' && (q.queryKey[0] as string).includes('/buyer/suppliers'),
      }),
      queryClient.invalidateQueries({
        predicate: (q) =>
          typeof q.queryKey[0] === 'string' && (q.queryKey[0] as string).includes('/buyer/workflow/tasks'),
      }),
    ]);

  const reviewAdmission = (approved: boolean) => {
    if (!admissionTask || workflowTasks.isError || !can('buyer:workflow:review')) return;
    setFeedback(null);
    setReview({ task: admissionTask, approved });
  };

  const action = lifecycleAction(
    supplier.status,
    {
      submit: () => setShowSubmitDialog(true),
      approve: () => reviewAdmission(true),
      reject: () => reviewAdmission(false),
      blacklist: () => { void prepareStatus('黑名单'); },
      restore: () => { void prepareStatus('待准入'); },
    },
    Boolean(admissionTask) && !workflowTasks.isError && !workflowTasks.isLoading && can('buyer:workflow:review'),
  ).filter(() => supplier.status === '准入审批中' ? can('buyer:workflow:review') : can('buyer:supplier:manage'));
  const hint =
    supplier.status === '待准入' || supplier.status === '已驳回'
      ? '资料确认无误后提交准入,进入准入审批。'
      : supplier.status === '准入审批中'
        ? workflowTasks.isLoading
          ? '正在确认当前审批节点的办理权限。'
          : workflowTasks.isError
            ? '暂时无法确认当前办理权限，请刷新页面后重试。'
            : admissionTask
              ? '当前审批节点由您办理，可直接通过或驳回。'
              : '当前审批节点已分配给其他办理人，您可查看详情但不能越权审批。'
        : supplier.status === '已准入'
          ? '已准入供应商;发现重大风险可加入黑名单。'
          : supplier.status === '黑名单'
            ? '黑名单供应商;整改核实后可恢复为待准入。'
            : supplier.status === '退出审批中'
              ? '退出审核期间暂停新订单，已有业务保留。'
              : supplier.status === '已退出'
                ? '已退出合作；恢复后需重新完成准入审批。'
            : '可执行生命周期操作。';

  return (
    <>
      <ConfirmDialog open={!!statusTarget} title={statusTarget?.status === '黑名单' ? '加入黑名单' : '恢复为待准入'}
        tone={statusTarget?.status === '黑名单' ? 'danger' : 'primary'}
        message={`未收货订单 ${statusTarget?.risk.unreceivedOrderCount ?? 0} 笔；未付清发票 ${statusTarget?.risk.unpaidInvoiceCount ?? 0} 张，票面合计 ¥${Number(statusTarget?.risk.unpaidInvoiceFaceAmount ?? 0).toLocaleString('zh-CN')}（非剩余应付余额）。${statusTarget?.status === '黑名单' ? '将禁止新订单并继续拦截付款，既有订单可继续履约。' : '需重新完成准入审批才可下新单，不代表原有风险已结清。'}`}
        input={{ label: '处理原因', placeholder: '填写风险情况、处理依据或整改情况' }}
        confirmLabel="确认调整" busy={changeStatus.isPending} onCancel={() => setStatusTarget(null)}
        onConfirm={(reason) => {
          if (!statusTarget || !can('buyer:supplier:manage')) return;
          changeStatus.mutate({ relationId: id, data: { status: statusTarget.status, reason } }, {
            onSuccess: () => { setStatusTarget(null); setFeedback({ tone: 'success', message: '状态已调整，处理原因已记录。' }); void refresh(); },
            onError: (e) => { setStatusTarget(null); setFeedback({ tone: 'error', message: (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '状态调整失败，请刷新后重试。' }); },
          });
        }} />
      <SupplierExitActions id={id} status={supplier.status} supplierId={supplier.supplierId} />
      <div className="sticky bottom-4 z-30 rounded-lg border border-slate-200 bg-white/95 px-5 py-4 shadow-lg shadow-slate-300/40 backdrop-blur">
        {feedback && (
          <div className="mb-3">
            <FeedbackNotice tone={feedback.tone} message={feedback.message} />
          </div>
        )}
        {workflowTasks.isError && supplier.status === '准入审批中' && (
          <div className="mb-3">
            <FeedbackNotice tone="error" message="审批任务加载失败，暂不能办理准入审批，请刷新页面后重试。" />
          </div>
        )}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
            <ShieldCheck size={14} className="shrink-0 text-blue-600" />
            <span>
              当前状态 <StatusPill label={supplier.status ?? '—'} />
              <span className="ml-2">{hint}</span>
            </span>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {supplier.status === '准入审批中' && workflowTasks.isLoading && (
              <span className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-4 text-sm font-black text-slate-500">
                <Clock3 size={15} /> 正在确认办理人
              </span>
            )}
            {supplier.status === '准入审批中' &&
              !workflowTasks.isLoading &&
              !workflowTasks.isError &&
              !admissionTask && (
              <span
                className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-4 text-sm font-black text-amber-700"
                title="该流程当前节点已分配给其他办理人，当前账号不可越权审批"
              >
                <Clock3 size={15} /> 等待其他办理人
              </span>
            )}
            {action.map((item) => (
              <button
                key={item.label}
                type="button"
                disabled={busy || !id}
                onClick={item.onClick}
                className={cn(
                  'inline-flex h-10 items-center whitespace-nowrap rounded-lg px-5 text-sm font-black text-white transition disabled:bg-slate-300',
                  item.tone === 'blue' && 'bg-blue-600 hover:bg-blue-700',
                  item.tone === 'emerald' && 'bg-emerald-600 hover:bg-emerald-700',
                  item.tone === 'red' && 'bg-red-600 hover:bg-red-700',
                )}
              >
                {busy ? '处理中' : item.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      {review && <SupplierAdmissionReviewDialog {...review} onClose={() => setReview(null)} onComplete={message => {
        setReview(null); setFeedback({ tone: 'success', message }); void refresh();
      }} />}
      {showSubmitDialog && (
        <SupplierAdmissionSubmitDialog
          relationId={id}
          title={supplier.supplierName ?? '供应商准入'}
          busy={submit.isPending}
          submissionError={submit.error}
          onClose={() => setShowSubmitDialog(false)}
          onSubmit={(formData) =>
            submit.mutate(
              { relationId: id, formData },
              { onSuccess: () => { setShowSubmitDialog(false); refresh(); } },
            )
          }
        />
      )}
    </>
  );
}

function HistoryOverview({
  totalAmount,
  completedOrders,
  orderCount,
  trend,
}: {
  totalAmount: number;
  completedOrders: number;
  orderCount: number;
  trend: TrendPoint[];
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <PanelTitle icon={LineChart} title="采购历史概览" />
      <div className="mt-4 grid gap-4 xl:grid-cols-[13rem_1fr]">
        <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
          <MetricTile label="累计交易总额" value={orderCount > 0 ? currency(totalAmount) : '—'} strong />
          <MetricTile label="签订订单" value={`${orderCount} 份`} />
          <MetricTile label="已完成订单" value={`${completedOrders} 份`} />
        </div>
        {trend.length > 0 ? (
          <MiniLineChart points={trend} />
        ) : (
          <p className="flex items-center justify-center rounded-lg bg-slate-50 p-6 text-sm font-bold text-slate-400">
            暂无订单交易,趋势图将在产生订单后展示。
          </p>
        )}
      </div>
    </section>
  );
}

function OrdersTab({ orders, loading }: { orders: PurchaseOrderResponse[]; loading: boolean }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-black text-slate-950">历史采购交易记录</h3>
      </div>
      {loading ? (
        <p className="mt-6 rounded-lg bg-slate-50 p-4 text-sm font-bold text-slate-500">正在加载订单...</p>
      ) : (
        <div className="mt-5 overflow-hidden rounded-lg border border-slate-100">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-black text-slate-500">
              <tr>
                <th className="px-4 py-3">订单号</th>
                <th className="px-4 py-3">项目名称</th>
                <th className="px-4 py-3">金额</th>
                <th className="px-4 py-3">状态</th>
                <th className="px-4 py-3">日期</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.slice(0, 6).map((order) => (
                <tr key={order.id} className="font-bold text-slate-700">
                  <td className="px-4 py-4 font-mono text-slate-500">{order.id}</td>
                  <td className="px-4 py-4 text-slate-950">{orderProjectName(order)}</td>
                  <td className="px-4 py-4 font-black text-slate-950">{currency(order.amount)}</td>
                  <td className="px-4 py-4">
                    <StatusPill label={order.status ?? '执行中'} />
                  </td>
                  <td className="px-4 py-4 text-slate-500">{shortDate(order.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function FinanceTab({ orders }: { orders: PurchaseOrderResponse[] }) {
  const total = orders.reduce((sum, order) => sum + (order.amount ?? 0), 0);
  // 已结算口径:已收货订单金额(真实数据);精确到发票/付款须在财务模块查看。
  const paid = orders
    .filter((order) => order.status === '已收货')
    .reduce((sum, order) => sum + (order.amount ?? 0), 0);
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-base font-black text-slate-950">财务结算概览</h3>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <MetricTile label="累计应付" value={currency(total)} strong />
        <MetricTile label="已结算" value={currency(paid)} strong />
        <MetricTile label="待付款" value={currency(total - paid)} strong />
      </div>
      <div className="mt-5 space-y-3">
        {orders.slice(0, 4).map((order) => (
          <div
            key={`${order.id}-finance`}
            className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/60 px-4 py-3"
          >
            <div>
              <p className="text-sm font-black text-slate-900">{order.id}</p>
              <p className="text-xs font-bold text-slate-500">{order.paymentTerms || '—'}</p>
            </div>
            <span className="font-black text-slate-950">{currency(order.amount ?? 0)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function ProductsTab({ supplier }: { supplier: BuyerSupplierResponse }) {
  const categories = supplier.categories?.length ? supplier.categories : ['未维护品类'];
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-base font-black text-slate-950">供应产品与能力范围</h3>
      <div className="mt-4 flex flex-wrap gap-2">
        {categories.map((category) => (
          <span
            key={category}
            className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-black text-blue-700"
          >
            {category}
          </span>
        ))}
      </div>
      <p className="mt-4 rounded-lg bg-slate-50 p-4 text-sm font-bold leading-6 text-slate-600">
        {supplier.businessScope ||
          '覆盖常规采购物资、备品备件、生产辅材及配套服务，可按采购计划进行询比、比价、订单履约与验收。'}
      </p>
    </section>
  );
}

function PanelTitle({ icon: Icon, title }: { icon: typeof Gauge; title: string }) {
  return (
    <h3 className="inline-flex items-center gap-2 text-base font-black text-slate-950">
      <Icon size={18} className="text-blue-600" /> {title}
    </h3>
  );
}

function MetricTile({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-4 py-3">
      <p className="text-xs font-black text-slate-400">{label}</p>
      <p className={cn('mt-1 font-black text-slate-950', strong ? 'text-xl' : 'text-lg')}>{value}</p>
    </div>
  );
}

function ArchiveItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Building2;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg bg-slate-50 px-4 py-3">
      <p className="inline-flex items-center gap-2 text-xs font-black text-slate-400">
        <Icon size={15} /> {label}
      </p>
      <p className="mt-1 break-words text-sm font-black text-slate-950">{value}</p>
    </div>
  );
}

function InfoRows({
  rows,
}: {
  rows: ([string, string] | [string, string, typeof Contact])[];
}) {
  return (
    <div className="mt-4 divide-y divide-slate-100">
      {rows.map(([label, value, Icon]) => (
        <div key={label} className="flex items-start justify-between gap-4 py-3 text-sm">
          <span className="inline-flex shrink-0 items-center gap-2 font-bold text-slate-500">
            {Icon && <Icon size={15} className="text-slate-400" />} {label}
          </span>
          <span className="min-w-0 break-all text-right font-black text-slate-900">{value}</span>
        </div>
      ))}
    </div>
  );
}

type TrendPoint = { label: string; value: number };

function MiniLineChart({ points }: { points: TrendPoint[] }) {
  const max = Math.max(...points.map((p) => p.value), 1);
  const min = Math.min(...points.map((p) => p.value), 0);
  const range = Math.max(max - min, 1);
  const coords = points.map((p, index) => {
    const x = 24 + index * (452 / Math.max(points.length - 1, 1));
    const y = 76 - ((p.value - min) / range) * 38;
    return { ...p, x, y };
  });
  const line = coords.map((p) => `${p.x},${p.y}`).join(' ');
  const area = `24,98 ${line} 476,98`;

  return (
    <div className="min-h-[120px] rounded-lg bg-gradient-to-b from-white to-slate-50 p-2">
      <svg viewBox="0 0 500 120" className="h-full min-h-[120px] w-full">
        <defs>
          <linearGradient id="supplierTrend" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#2563eb" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polyline points={area} fill="url(#supplierTrend)" stroke="none" />
        <polyline points={line} fill="none" stroke="#2563eb" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        {coords.map((p) => (
          <text key={p.label} x={p.x} y={114} textAnchor="middle" className="fill-slate-400 text-[12px] font-bold">
            {p.label}
          </text>
        ))}
      </svg>
    </div>
  );
}

function buildTrend(orders: PurchaseOrderResponse[]): TrendPoint[] {
  // 按订单创建月真实聚合;无订单则为空(图表隐藏)。
  const byMonth = new Map<string, number>();
  orders.forEach((order) => {
    const month = order.createdAt?.slice(0, 7);
    if (!month) return;
    byMonth.set(month, (byMonth.get(month) ?? 0) + (order.amount ?? 0));
  });
  return Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([label, value]) => ({ label: label.slice(5) + '月', value }));
}

function fallbackScore(supplier: BuyerSupplierResponse) {
  return supplier.performanceScore ?? supplier.lastEvaluationScore ?? 0;
}

function orderProjectName(order: PurchaseOrderResponse) {
  return order.lineItems?.[0]?.description ?? order.rfqId ?? '—';
}

function lifecycleAction(
  status: string | undefined,
  handlers: {
    submit: () => void;
    approve: () => void;
    reject: () => void;
    blacklist: () => void;
    restore: () => void;
  },
  canReview = false,
) {
  switch (status) {
    case '待准入':
    case '已驳回':
      return [{ label: '提交准入', onClick: handlers.submit, tone: 'blue' as const }];
    case '准入审批中':
      return canReview
        ? [
            { label: '通过', onClick: handlers.approve, tone: 'emerald' as const },
            { label: '驳回', onClick: handlers.reject, tone: 'red' as const },
          ]
        : [];
    case '已准入':
      return [{ label: '加入黑名单', onClick: handlers.blacklist, tone: 'red' as const }];
    case '黑名单':
    case '已退出':
      return [{ label: '恢复待准入', onClick: handlers.restore, tone: 'blue' as const }];
    case '退出审批中':
      return [];
    default:
      return [{ label: '提交准入', onClick: handlers.submit, tone: 'blue' as const }];
  }
}
