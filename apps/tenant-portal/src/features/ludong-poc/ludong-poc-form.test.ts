import { describe, expect, it } from 'vitest';
import { defaultFormData, emptyItem } from './api';
import { getMissingRequiredFields } from './ludong-poc-form';

describe('getMissingRequiredFields', () => {
  it('reports every hidden requirement with a user-facing label', () => {
    const missing = getMissingRequiredFields({
      projectName: '教学设备更新',
      applicantUnit: '教务处',
      departmentId: 'dept-jwc',
      budgetAmount: '120000',
      formData: { ...defaultFormData, fundingSource: '年度教学经费' },
      items: [],
    });

    expect(missing).toContain('经费主管单位');
    expect(missing).toContain('采购标的功能');
    expect(missing).toContain('拟采购设备清单');
  });

  it('accepts a completely filled project application', () => {
    const missing = getMissingRequiredFields({
      projectName: '教学设备更新',
      applicantUnit: '教务处',
      departmentId: 'dept-jwc',
      budgetAmount: '120000',
      formData: {
        ...defaultFormData,
        mallSelectionApplicable: '否',
        fundingSource: '年度教学经费',
        fundingUnitId: 'dept-jwc',
        projectLeaderName: '王老师',
        technicalLeaderName: '赵老师',
        procurementFunction: '课堂教学',
        procurementGoal: '改善教学条件',
        implementationLocation: '教学楼',
        coreProduct: '教学终端',
      },
      items: [{ ...emptyItem(), name: '教学终端', quantity: '10' }],
    });

    expect(missing).toEqual([]);
  });

  it('requires a complete mall model confirmation when mall selection applies', () => {
    const missing = getMissingRequiredFields({
      projectName: '教学设备更新',
      applicantUnit: '教务处',
      departmentId: 'dept-jwc',
      budgetAmount: '120000',
      formData: {
        ...defaultFormData,
        fundingSource: '年度教学经费',
        fundingUnitId: 'dept-jwc',
        projectLeaderName: '王老师',
        technicalLeaderName: '赵老师',
        procurementFunction: '课堂教学',
        procurementGoal: '改善教学条件',
        implementationLocation: '教学楼',
        coreProduct: '教学终端',
      },
      items: [{ ...emptyItem(), name: '教学终端', quantity: '10' }],
    });

    expect(missing).toContain('第 1 条商城确认品牌');
    expect(missing).toContain('第 1 条商城确认型号');
    expect(missing).toContain('第 1 条商城供应商');
    expect(missing).toContain('第 1 条商城单价');
    expect(missing).toContain('第 1 条商城选型参与人');
  });
});
