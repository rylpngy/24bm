import { useState } from 'react';
import { History } from 'lucide-react';
import { useAuditLogList } from '@24bid/api-client';
import { CountTag, FeedbackNotice, Panel, SearchInput, StatusPill } from '@24bid/ui';

// 操作动作前缀 → 中文标签(目标类型),覆盖主流程审计动作;未命中回退原值。
const TARGET_LABELS: Record<string, string> = {
  purchase_demand: '采购需求',
  material: '物料',
  rfq: '询比',
  award: '定标',
  quote: '报价',
  purchase_order: '采购订单',
  contract: '合同',
  invoice: '发票',
  receipt: '收货',
  buyer_supplier_relation: '供应商',
  supplier_enterprise: '供应商企业',
  buyer_user: '成员',
  buyer_role: '角色',
};

const ACTION_VERB: Record<string, string> = {
  created: '创建',
  updated: '更新',
  submitted: '提交',
  approved: '通过',
  rejected: '驳回',
  awarded: '定标',
  role_changed: '改角色',
  status_changed: '改状态',
  permissions_updated: '改权限',
  password_reset: '重置密码',
  confirmed: '确认',
  shipped: '发货',
  received: '收货',
  paid: '已付款',
  partial_paid: '部分付款',
  archived: '归档',
  admitted: '准入',
  blacklisted: '拉黑',
  supplier_quorum_shortfall: '邀请家数提醒',
  award_quorum_shortfall: '定标家数提醒',
};

function actionLabel(action?: string) {
  if (!action) return '—';
  const [domain, verb] = action.split('.');
  const v = ACTION_VERB[verb] ?? verb ?? '';
  const d = TARGET_LABELS[domain] ?? domain;
  return `${d}·${v}`;
}

const filterInput =
  'h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-400';

// 审计日志:租户内操作留痕(谁、做了什么、对什么、何时),支持关键字搜索与类型/日期条件查询(服务端过滤)。
export function AuditPage() {
  const [limit, setLimit] = useState(50);
  const [keyword, setKeyword] = useState('');
  const [targetType, setTargetType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const audit = useAuditLogList({
    limit,
    ...(keyword ? { keyword } : {}),
    ...(targetType ? { targetType } : {}),
    ...(dateFrom ? { dateFrom } : {}),
    ...(dateTo ? { dateTo } : {}),
  });
  const logs = audit.data?.data ?? [];
  const filtered = Boolean(keyword || targetType || dateFrom || dateTo);

  return (
    <Panel title="审计日志" icon={History} subtitle="操作留痕 · 关键字搜索 · 类型/日期条件查询">
      {/* 查询条:类型 + 日期区间 左侧,关键字搜索 右侧(条件均由服务端过滤) */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select
          value={targetType}
          onChange={(e) => setTargetType(e.target.value)}
          aria-label="按对象类型筛选"
          className={filterInput}
        >
          <option value="">全部类型</option>
          {Object.entries(TARGET_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          aria-label="起始日期"
          className={filterInput}
        />
        <span className="text-xs font-bold text-slate-400">至</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          aria-label="截止日期"
          className={filterInput}
        />
        <SearchInput
          className="mb-0 ml-auto"
          placeholder="按对象编号 / 操作人 / 动作 / 明细搜索"
          onSearch={setKeyword}
        />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <CountTag className="mr-1">
          {filtered ? `命中 ${logs.length} 条` : `共 ${logs.length} 条`}
        </CountTag>
        {[50, 100, 200].map((n) => (
          <button key={n} type="button" onClick={() => setLimit(n)}
            className={
              n === limit
                ? 'h-8 rounded-md bg-blue-600 px-3 text-xs font-black text-white'
                : 'h-8 rounded-md border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 hover:bg-slate-50'
            }>
            近 {n} 条
          </button>
        ))}
        {filtered && (
          <button
            type="button"
            onClick={() => {
              setKeyword('');
              setTargetType('');
              setDateFrom('');
              setDateTo('');
            }}
            className="h-8 rounded-md border border-slate-200 bg-white px-3 text-xs font-black text-slate-500 hover:bg-slate-50"
          >
            清除条件
          </button>
        )}
      </div>

      {audit.isLoading ? (
        <FeedbackNotice tone="info" message="正在加载审计日志…" />
      ) : logs.length === 0 ? (
        <FeedbackNotice
          tone="info"
          message={filtered ? '没有符合条件的操作记录,可调整条件或清除后重试。' : '暂无操作记录。'}
        />
      ) : (
        <div className="space-y-2">
          {logs.map((l) => (
            <div key={l.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <StatusPill label={actionLabel(l.action)} />
                <div className="min-w-0">
                  <p className="break-words font-mono text-xs font-black text-slate-700">{l.targetId}</p>
                  <p className="mt-0.5 text-[11px] font-bold text-slate-400">
                    {TARGET_LABELS[l.targetType ?? ''] ?? l.targetType}
                    {l.detail ? (
                      <span className="ml-1.5 rounded bg-emerald-50 px-1.5 py-0.5 font-black text-emerald-700">
                        {l.detail}
                      </span>
                    ) : null}
                  </p>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs font-black text-slate-600">{l.actorId}</p>
                <p className="mt-0.5 text-[11px] font-bold text-slate-400">
                  {l.createdAt?.slice(0, 19).replace('T', ' ')}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
