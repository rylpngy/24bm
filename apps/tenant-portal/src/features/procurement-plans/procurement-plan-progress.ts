export function derivePlanProgress(plan: { status?: string }, order?: { status?: string }) {
  if (['已流标', '已废标', '已取消'].includes(plan.status ?? '')) return { currentIndex: -1, terminated: true, stageLabel: plan.status ?? '已终止' };
  if (order?.status === '已收货' || order?.status === '已完成') return { currentIndex: 4, terminated: false, stageLabel: '履约结算' };
  if (order || plan.status === '已定标') return { currentIndex: 3, terminated: false, stageLabel: '订单履约' };
  if (plan.status === '已开标' || plan.status === '定标审批中') return { currentIndex: 2, terminated: false, stageLabel: '评审定标' };
  if (plan.status === '草稿') return { currentIndex: 0, terminated: false, stageLabel: '计划草稿' };
  return { currentIndex: 1, terminated: false, stageLabel: '报价征集' };
}

export function findAwardApproval<T extends { bizType?: string; parentBizId?: string }>(records: T[], rfqId?: string): T | undefined {
  return records.find(task => task.bizType === 'rfq_award' && !!rfqId && task.parentBizId === rfqId);
}
