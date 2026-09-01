package com.procurement.finance.domain;

import java.util.Set;

// 付款申请审批和付款批次审批是两个独立关口，批次状态不得由申请审批结果直接越过批次审批。
public final class PaymentBatchStatus {
  public static final String PAYMENT_REQUEST_DRAFT = "付款申请待提交";
  public static final String PAYMENT_REQUEST_IN_PROGRESS = "付款申请审批中";
  public static final String PAYMENT_REQUEST_REJECTED = "付款申请未通过";
  public static final String PENDING_APPROVAL = "待提交审批";
  public static final String APPROVAL_IN_PROGRESS = "审批中";
  public static final String READY_FOR_PAYMENT = "可安排付款";
  public static final String ARCHIVED = "已付款归档";

  private static final Set<String> REQUEST_MUTABLE_STATUSES = Set.of(
      PAYMENT_REQUEST_DRAFT,
      PAYMENT_REQUEST_IN_PROGRESS,
      PAYMENT_REQUEST_REJECTED,
      PENDING_APPROVAL);

  private PaymentBatchStatus() {}

  public static boolean acceptsPaymentRequestChanges(String status) {
    return REQUEST_MUTABLE_STATUSES.contains(status);
  }

  public static void requireManualTransition(String currentStatus, String targetStatus) {
    if (APPROVAL_IN_PROGRESS.equals(targetStatus) && PENDING_APPROVAL.equals(currentStatus)) {
      return;
    }
    if (READY_FOR_PAYMENT.equals(targetStatus) && APPROVAL_IN_PROGRESS.equals(currentStatus)) {
      return;
    }
    if (ARCHIVED.equals(targetStatus) && READY_FOR_PAYMENT.equals(currentStatus)) {
      return;
    }
    throw new IllegalStateException(
        "Unsupported payment batch status transition: " + currentStatus + " -> " + targetStatus);
  }
}
