package com.procurement.workflow.definition;

import com.procurement.approval.domain.ApprovalBusinessType;
import java.util.List;
import java.util.Set;

// 受控业务类型目录。避免流程配置把任意字符串接入业务回调。
public final class WorkflowBusinessTypeCatalog {
  public static final List<String> TYPES = List.of(
      "tender_document_review",
      "budget_change", "budget_exception", "order_settlement", "frozen_payment_correction", "funding_change",
      "project_initiation", "project_change", "project_carryover", "project_liquidation", "project_reopen",
      "supplier_qualification_change",
      ApprovalBusinessType.LUDONG_PROJECT_APPLICATION,
      ApprovalBusinessType.PURCHASE_DEMAND,
      ApprovalBusinessType.BUYER_SUPPLIER_ADMISSION,
      "buyer_supplier_exit",
      ApprovalBusinessType.RFQ_AWARD,
      ApprovalBusinessType.CONTRACT_APPROVAL,
      ApprovalBusinessType.PAYMENT_REQUEST,
      ApprovalBusinessType.PAYMENT_BATCH,
      ApprovalBusinessType.PAYMENT_ARCHIVE_EXCEPTION);

  private static final Set<String> SUPPORTED = Set.copyOf(TYPES);

  private WorkflowBusinessTypeCatalog() {
  }

  public static void requireSupported(String businessType) {
    if (businessType == null || !SUPPORTED.contains(businessType)) {
      throw new IllegalArgumentException("Unsupported workflow business type: " + businessType);
    }
  }
}
