export const approvalTypeLabel = (bizType: string) => {
  const labels: Record<string, string> = {
    purchase_demand: '需求审批',
    buyer_supplier_admission: '供应商准入',
    rfq_award: '定标审批',
    contract_approval: '合同审批',
  };
  return labels[bizType] ?? bizType;
};

export const approvalResultMessage = (bizType: string, approved: boolean, title?: string) => {
  const action = approved ? '通过' : '驳回';
  const subject = title?.trim() || '当前事项';
  const statusChanges: Record<string, string> = {
    purchase_demand: `需求状态已更新为已${action}`,
    buyer_supplier_admission: `供应商关系已更新为${approved ? '已准入' : '已驳回'}`,
    rfq_award: `询价项目已更新为${approved ? '已定标' : '报价中'}`,
    contract_approval: `合同状态已更新为${approved ? '已生效' : '草案'}`,
  };

  return `${approvalTypeLabel(bizType)}已${action}：${subject}，${statusChanges[bizType] ?? `审批状态已更新为已${action}`}`;
};
