package com.procurement.approval.application;

import com.procurement.approval.api.ApprovalTemplateResponse;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class ApprovalTemplateApplicationService {
  private static final String DEFAULT_BUYER_APPROVER_ROLE_ID = "role-buyer-owner";
  private static final String ACTIVE_STATUS = "active";

  public List<ApprovalTemplateResponse> listTemplates() {
    return List.of(
        new ApprovalTemplateResponse(
            "TPL_PURCHASE_DEMAND",
            "purchase_demand",
            "需求审批",
            DEFAULT_BUYER_APPROVER_ROLE_ID,
            ACTIVE_STATUS),
        new ApprovalTemplateResponse(
            "TPL_SUPPLIER_ADMISSION",
            "buyer_supplier_admission",
            "供应商准入",
            DEFAULT_BUYER_APPROVER_ROLE_ID,
            ACTIVE_STATUS),
        new ApprovalTemplateResponse(
            "TPL_RFQ_AWARD",
            "rfq_award",
            "定标审批",
            DEFAULT_BUYER_APPROVER_ROLE_ID,
            ACTIVE_STATUS));
  }
}
