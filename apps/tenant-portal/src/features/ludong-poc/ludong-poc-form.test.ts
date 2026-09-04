import { describe, expect, it } from 'vitest';
import { defaultFormData, emptyItem } from './api';
import { calculateApplicationBudget, evaluateRouteDecisions, getMissingRequiredFields } from './ludong-poc-form';
import { inferGovernmentMallCatalog } from './ludong-poc-material-items-editor';

describe('getMissingRequiredFields', () => {
  it('leaves use direction, import status, user and storage location for manual confirmation', () => {
    const item = emptyItem();

    expect(item).toMatchObject({
      imported: '',
      usageDirection: '',
      userName: '',
      installationLocation: '',
    });
  });

  it('reports every hidden requirement with a user-facing label', () => {
    const missing = getMissingRequiredFields({
      projectName: '教学设备更新',
      applicantUnit: '教务处',
      departmentId: 'dept-jwc',
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
      formData: {
        ...defaultFormData,
        mallSelectionApplicable: '否',
        fundingSource: '年度教学经费',
        fundingUnitId: 'dept-jwc',
        projectLeaderName: '王老师',
        technicalLeaderName: '赵老师',
        procurementFunction: '课堂教学',
        procurementGoal: '改善教学条件',
        purchaseReason: '现有设备无法满足教学需要',
        implementationLocation: '教学楼',
        installationReady: '是',
        utilitiesReady: '是',
        deliveryDays: '30',
        warrantyYears: '3',
        acceptanceStandard: '按合同和采购文件验收',
        siteVisitRequired: '否',
        sampleRequired: '否',
        demoRequired: '否',
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
        imported: '否',
        usageDirection: '教学',
        userName: '王老师',
        installationLocation: '教学楼',
        coreProduct: '是',
        governmentMallCatalog: '否',
      }],
    });

    expect(missing).toEqual([]);
  });

  it('allows a catalog-external item and reports its missing market-research fields', () => {
    const missing = getMissingRequiredFields({
      projectName: '教学设备更新',
      applicantUnit: '教务处',
      departmentId: 'dept-jwc',
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
      projectName: '教学设备更新', applicantUnit: '教务处', departmentId: 'dept-jwc',
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

  it('calculates budget exclusively from equipment quantity and researched unit price', () => {
    expect(calculateApplicationBudget([
      { ...emptyItem(), quantity: '2', unitPrice: '12000' },
      { ...emptyItem(), quantity: '3', unitPrice: '8000' },
    ])).toBe(48000);
  });

  it('recognizes standard mall categories and keeps manual correction available for irregular names', () => {
    expect(inferGovernmentMallCatalog('台式计算机', '')).toMatchObject({ value: '是' });
    expect(inferGovernmentMallCatalog('智能教学终端', '台式计算机')).toMatchObject({ value: '是' });
    expect(inferGovernmentMallCatalog('校内自定义设备', '')).toMatchObject({ value: '否' });
  });

  it('routes teaching or research equipment to laboratory review', () => {
    const decisions = evaluateRouteDecisions({
      applicantUnit: '教务处',
      projectName: '教学设备采购',
      items: [{ ...emptyItem(), name: '专用设备', usageDirection: '教学' }],
    });
    expect(decisions.find((item) => item.key === 'requiresLabReview')?.value).toBe('是');
  });

  it('recognizes desktop-computer aliases for both IT and asset review', () => {
    const decisions = evaluateRouteDecisions({
      applicantUnit: '财经处',
      projectName: '办公终端更新',
      items: [{ ...emptyItem(), name: '台式计算机', usageDirection: '行政办公' }],
    });

    expect(decisions.find((item) => item.key === 'requiresItReview')?.value).toBe('是');
    expect(decisions.find((item) => item.key === 'requiresAssetReview')?.value).toBe('是');
  });
});
