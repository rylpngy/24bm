package com.procurement.platform.domain;

import com.procurement.approval.domain.ApprovalBusinessType;
import com.procurement.approval.domain.ApprovalTemplateCode;
import java.util.List;

public record PlatformDefaultApprovalTemplate(
    String code,
    String businessType,
    String name,
    int sortOrder) {
  public static final List<PlatformDefaultApprovalTemplate> BUYER_TEMPLATES = List.of(
      new PlatformDefaultApprovalTemplate(
          ApprovalTemplateCode.PURCHASE_DEMAND,
          ApprovalBusinessType.PURCHASE_DEMAND,
          "需求审批",
          10),
      new PlatformDefaultApprovalTemplate(
          ApprovalTemplateCode.SUPPLIER_ADMISSION,
          ApprovalBusinessType.BUYER_SUPPLIER_ADMISSION,
          "供应商准入",
          20),
      new PlatformDefaultApprovalTemplate(
          ApprovalTemplateCode.RFQ_AWARD,
          ApprovalBusinessType.RFQ_AWARD,
          "定标审批",
          30),
      new PlatformDefaultApprovalTemplate(
          ApprovalTemplateCode.CONTRACT_APPROVAL,
          ApprovalBusinessType.CONTRACT_APPROVAL,
          "合同审批",
          40),
      new PlatformDefaultApprovalTemplate(
          ApprovalTemplateCode.PAYMENT_BATCH,
          ApprovalBusinessType.PAYMENT_BATCH,
          "付款批次审批",
          60),
      new PlatformDefaultApprovalTemplate(
          ApprovalTemplateCode.PAYMENT_ARCHIVE_EXCEPTION,
          ApprovalBusinessType.PAYMENT_ARCHIVE_EXCEPTION,
          "付款归档异常审批",
          70));
}
