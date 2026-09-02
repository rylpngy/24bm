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
      items: [{
        ...emptyItem(),
        materialId: 'material-terminal',
        catalogSource: 'catalog',
        name: '教学终端',
        unit: '台',
        quantity: '10',
        unitPrice: '12000',
        technicalParameters: '国产处理器，16GB 内存',
        purpose: '课堂教学',
      }],
    });

    expect(missing).toEqual([]);
  });

  it('allows a catalog-external item and reports its missing market-research fields', () => {
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

    expect(missing).not.toContain('第 1 条关联物料');
    expect(missing).toContain('第 1 条计量单位');
    expect(missing).toContain('第 1 条市场调研单价');
    expect(missing).toContain('第 1 条技术参数');
    expect(missing).toContain('第 1 条主要用途');
  });

  it('requires applicant mall confirmation only for government-mall catalog items', () => {
    const item = {
      ...emptyItem(),
      materialId: 'material-terminal',
      catalogSource: 'catalog' as const,
      governmentMallCatalog: '是' as const,
      name: '教学终端', unit: '台', quantity: '10', unitPrice: '12000',
      technicalParameters: '国产处理器，16GB 内存', purpose: '课堂教学',
    };
    const missing = getMissingRequiredFields({
      projectName: '教学设备更新', applicantUnit: '教务处', departmentId: 'dept-jwc', budgetAmount: '120000',
      formData: {
        ...defaultFormData, fundingSource: '年度教学经费', fundingUnitId: 'dept-jwc',
        projectLeaderName: '王老师', technicalLeaderName: '赵老师', procurementFunction: '课堂教学',
        procurementGoal: '改善教学条件', implementationLocation: '教学楼', coreProduct: '教学终端',
      },
      items: [item],
    });

    expect(missing).toContain('第 1 条商城最终品牌');
    expect(missing).toContain('第 1 条商城最终型号');
    expect(missing).toContain('第 1 条商城供应商');
    expect(missing).toContain('第 1 条商城确认单价');
    expect(missing).toContain('第 1 条商城选型人员');
  });
});
