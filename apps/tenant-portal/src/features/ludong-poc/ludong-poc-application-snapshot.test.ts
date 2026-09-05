import { describe, expect, it } from 'vitest';
import { emptyItem, type LudongApplication } from './api';
import {
  buildApplicationSnapshotSections, buildApprovalSnapshotSections, buildMallSelectionRows,
} from './ludong-poc-application-snapshot';
import {
  acceptanceStandardTemplate, otherTechnicalRequirementsTemplate,
} from './ludong-poc-requirement-templates';

const application = (formData: Record<string, string> = {}): LudongApplication => ({
  id: 'application-1', applicationNo: 'LDUG-001', projectName: '教学设备采购',
  applicantUnit: '教务处', budgetAmount: 100000, status: 'in_approval', formData,
  items: [{
    ...emptyItem(), materialId: 'material-1', materialCode: 'LDU-001', materialCategory: '计算机',
    name: '台式计算机', unit: '台', quantity: '2', unitPrice: '5000', totalPrice: '10000',
    technicalParameters: '16GB 内存', governmentMallCatalog: '是', standardUnitPrice: '5200',
    selectedBrand: '品牌甲', selectedModel: 'A1', selectedSupplier: '供应商甲',
    supplierContact: '李经理', supplierPhone: '13900000001', productLink: 'https://example.test/a1',
    selectedParameters: '16GB 内存、512GB SSD', selectedUnitPrice: '4980', selectionParticipants: '王老师',
  }],
  createdBy: 'user-1', createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z',
});

describe('Ludong POC application snapshot', () => {
  it('hides dependent review-site fields whenever the applicant selected no', () => {
    const sections = buildApplicationSnapshotSections(application({
      siteVisitRequired: '否', siteVisitTime: '历史残留时间', sampleRequired: '否',
      sampleRequirement: '历史残留样品要求', demoRequired: '否', demoDuration: '20分钟', demoRequirement: '历史残留演示要求',
    }));
    const facts = sections.find((section) => section.title === '评审现场与补充要求')?.facts ?? [];
    const labels = facts.map(([label]) => label);

    expect(labels).toEqual(expect.arrayContaining(['需要现场勘查', '需要样品', '需要产品演示']));
    expect(labels).not.toEqual(expect.arrayContaining(['勘查时间', '样品要求', '演示时长', '演示要求']));
  });

  it('always combines fixed template requirements with optional applicant supplements', () => {
    const sections = buildApplicationSnapshotSections(application({
      acceptanceStandard: '增加一次连续运行验收', otherTechnicalRequirements: '需提供节能证书',
    }));
    const facts = new Map(sections.find((section) => section.title === '交付、服务与验收要求')?.facts);

    expect(facts.get('验收标准')).toContain(acceptanceStandardTemplate[0]);
    expect(facts.get('验收标准')).toContain('申报补充：增加一次连续运行验收');
    expect(facts.get('其他技术与服务要求')).toContain(otherTechnicalRequirementsTemplate);
  });

  it('returns every government-mall item and preserves its complete selection details', () => {
    const rows = buildMallSelectionRows(application());

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      selectedBrand: '品牌甲', selectedModel: 'A1', selectedSupplier: '供应商甲',
      supplierContact: '李经理', supplierPhone: '13900000001',
      selectedParameters: '16GB 内存、512GB SSD', selectedUnitPrice: '4980', selectionParticipants: '王老师',
    });
  });

  it('includes conclusions and comments for every completed approval node', () => {
    const sections = buildApprovalSnapshotSections(application({
      argumentationOpinion: '同意', argumentationComment: '论证材料完整',
      financeResponsibleOpinion: '同意', financeResponsibleComment: '同意按批准方式采购',
    }));

    expect(sections.map((section) => section.title)).toEqual(['购置必要性论证', '财经处负责人终审']);
    expect(sections.flatMap((section) => section.facts)).toContainEqual(['终审批示', '同意按批准方式采购']);
  });
});
