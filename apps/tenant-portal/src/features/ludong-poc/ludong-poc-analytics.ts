import type { LudongApplication } from './api';

export type ReportPeriod = 'year' | 'Q1' | 'Q2' | 'Q3' | 'Q4';

const STATUS_LABELS: Record<LudongApplication['status'], string> = {
  draft: '草稿/驳回',
  rejected: '草稿/驳回',
  in_approval: '审批中',
  approved: '已通过',
  archived: '已归档',
};

const periodMonths = (period: ReportPeriod) => {
  if (period === 'year') return Array.from({ length: 12 }, (_, index) => index);
  const start = (Number(period.slice(1)) - 1) * 3;
  return [start, start + 1, start + 2];
};

const reportDate = (application: LudongApplication) =>
  new Date(application.submittedAt ?? application.createdAt);

export function availableReportYears(applications: LudongApplication[], currentYear: number) {
  return [...new Set([
    currentYear,
    ...applications.map((application) => reportDate(application).getFullYear()),
  ])].sort((a, b) => b - a);
}

export function buildLudongAnalytics(
  applications: LudongApplication[],
  year: number,
  period: ReportPeriod,
) {
  const months = periodMonths(period);
  const filtered = applications.filter((application) => {
    const date = reportDate(application);
    return date.getFullYear() === year && months.includes(date.getMonth());
  });
  const totalBudget = filtered.reduce((sum, application) => sum + Number(application.budgetAmount || 0), 0);
  const approved = filtered.filter((application) => ['approved', 'archived'].includes(application.status));
  const equipmentCount = filtered.reduce(
    (sum, application) => sum + application.items.reduce((itemSum, item) => itemSum + Number(item.quantity || 0), 0),
    0,
  );
  const completedDurations = approved
    .filter((application) => application.submittedAt && application.approvedAt)
    .map((application) => (
      new Date(application.approvedAt!).getTime() - new Date(application.submittedAt!).getTime()
    ) / 86_400_000)
    .filter((days) => days >= 0);

  const monthlyData = months.map((month) => {
    const items = filtered.filter((application) => reportDate(application).getMonth() === month);
    return {
      month: `${month + 1}月`,
      count: items.length,
      amount: items.reduce((sum, application) => sum + Number(application.budgetAmount || 0), 0),
    };
  });

  const statusData = Object.entries(
    filtered.reduce<Record<string, number>>((result, application) => {
      const label = STATUS_LABELS[application.status];
      result[label] = (result[label] ?? 0) + 1;
      return result;
    }, {}),
  ).map(([name, value]) => ({ name, value }));

  const unitData = aggregate(filtered, (application) => application.applicantUnit || '未设置单位')
    .map(([name, items]) => ({
      name,
      count: items.length,
      amount: items.reduce((sum, application) => sum + Number(application.budgetAmount || 0), 0),
      approved: items.filter((application) => ['approved', 'archived'].includes(application.status)).length,
    }))
    .sort((a, b) => b.amount - a.amount);

  const categoryMap = new Map<string, { count: number; amount: number }>();
  filtered.forEach((application) => application.items.forEach((item) => {
    const name = item.materialCategory || '未分类';
    const current = categoryMap.get(name) ?? { count: 0, amount: 0 };
    current.count += Number(item.quantity || 0);
    current.amount += Number(item.totalPrice || 0);
    categoryMap.set(name, current);
  }));
  const categoryData = [...categoryMap.entries()]
    .map(([name, value]) => ({ name, ...value }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);

  const methodData = Object.entries(
    filtered.reduce<Record<string, number>>((result, application) => {
      const name = application.formData.procurementMethod || '待确定';
      result[name] = (result[name] ?? 0) + 1;
      return result;
    }, {}),
  ).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  return {
    filtered,
    total: filtered.length,
    totalBudget,
    approved: approved.length,
    approvalRate: filtered.length ? Math.round(approved.length / filtered.length * 100) : 0,
    averageBudget: filtered.length ? totalBudget / filtered.length : 0,
    equipmentCount,
    averageApprovalDays: completedDurations.length
      ? completedDurations.reduce((sum, value) => sum + value, 0) / completedDurations.length
      : null,
    monthlyData,
    statusData,
    unitData,
    categoryData,
    methodData,
  };
}

function aggregate(
  applications: LudongApplication[],
  key: (application: LudongApplication) => string,
) {
  const map = new Map<string, LudongApplication[]>();
  applications.forEach((application) => {
    const name = key(application);
    map.set(name, [...(map.get(name) ?? []), application]);
  });
  return [...map.entries()];
}
