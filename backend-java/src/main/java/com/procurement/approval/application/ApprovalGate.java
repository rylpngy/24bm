package com.procurement.approval.application;

import com.procurement.approval.infrastructure.ApprovalTemplateMapper;
import org.springframework.stereotype.Service;

// 审批闸门:业务节点与审批引擎之间的唯一接缝。
// 业务服务只问「该节点是否需要审批」;审批的具体设置(模板/审批人/流转)由审批引擎独立管理。
// 节点关闭(模板停用)= 免审直通,业务侧自动推进并留痕,而非报错卡死。
@Service
public class ApprovalGate {
  private final ApprovalTemplateMapper approvalTemplateMapper;

  public ApprovalGate(ApprovalTemplateMapper approvalTemplateMapper) {
    this.approvalTemplateMapper = approvalTemplateMapper;
  }

  public boolean requiresApproval(String tenantId, String bizType) {
    return approvalTemplateMapper.findActiveByTenantAndBizType(tenantId, bizType) != null;
  }

  /** 免审直通的统一审计明细文案。 */
  public static String bypassDetail() {
    return "免审批直通(该审批节点已在「审批节点配置」中关闭)";
  }
}
