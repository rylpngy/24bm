import { describe, expect, it } from 'vitest';
import { buildLudongAnalytics } from './ludong-poc-analytics';
import type { LudongApplication } from './api';

const application = (id: string, createdAt: string, amount: number): LudongApplication => ({
  id,
  applicationNo: id,
  projectName: id,
  applicantUnit: '信息与电气工程学院',
  budgetAmount: amount,
  status: 'approved',
  formData: { procurementMethod: '公开招标' },
  items: [{ quantity: '2', totalPrice: String(amount), materialCategory: '计算机设备' } as never],
  createdBy: 'user',
  submittedAt: createdAt,
  approvedAt: createdAt,
  createdAt,
  updatedAt: createdAt,
});

describe('buildLudongAnalytics', () => {
  it('按年度和季度筛选并聚合项目数据', () => {
    const result = buildLudongAnalytics([
      application('q1', '2026-02-10T08:00:00+08:00', 100_000),
      application('q3', '2026-08-10T08:00:00+08:00', 200_000),
    ], 2026, 'Q3');

    expect(result.total).toBe(1);
    expect(result.totalBudget).toBe(200_000);
    expect(result.equipmentCount).toBe(2);
    expect(result.approvalRate).toBe(100);
    expect(result.monthlyData.map((item) => item.month)).toEqual(['7月', '8月', '9月']);
  });
});
