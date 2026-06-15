import { describe, expect, it } from 'vitest';
import { approvalTypeLabel, approvalResultMessage } from './approvalUi';

describe('approval UI helpers', () => {
  it('maps approval business types to reader-facing labels', () => {
    expect(approvalTypeLabel('purchase_demand')).toBe('需求审批');
    expect(approvalTypeLabel('buyer_supplier_admission')).toBe('供应商准入');
    expect(approvalTypeLabel('rfq_award')).toBe('定标审批');
    expect(approvalTypeLabel('custom_type')).toBe('custom_type');
  });

  it('describes the visible business status change after approval review', () => {
    expect(approvalResultMessage('purchase_demand', true, '采购 20 台电脑')).toBe('需求审批已通过：采购 20 台电脑，需求状态已更新为已通过');
    expect(approvalResultMessage('buyer_supplier_admission', false, '晨光供应商')).toBe('供应商准入已驳回：晨光供应商，供应商关系已更新为已驳回');
    expect(approvalResultMessage('rfq_award', true, '办公电脑询价')).toBe('定标审批已通过：办公电脑询价，询价项目已更新为已定标');
  });
});
