package com.procurement.notification.domain;

public final class NotificationTitle {
  public static final String PURCHASE_DEMAND_PENDING_APPROVAL = "采购需求待审批";
  public static final String PURCHASE_DEMAND_APPROVED = "采购需求审批已通过";
  public static final String PURCHASE_DEMAND_REJECTED = "采购需求审批已驳回";
  public static final String SUPPLIER_ADMISSION_APPROVED = "供应商准入审批已通过";
  public static final String SUPPLIER_ADMISSION_REJECTED = "供应商准入审批已驳回";
  public static final String RFQ_INVITATION_CREATED = "询价邀请待报价";
  public static final String RFQ_INVITATION_UPDATED = "询价邀请已更新";
  public static final String SUPPLIER_QUOTE_SUBMITTED = "供应商已提交报价";
  public static final String RFQ_AWARD_PENDING_APPROVAL = "定标结果待审批";
  public static final String RFQ_AWARD_APPROVED = "定标审批已通过";
  public static final String RFQ_AWARD_REJECTED = "定标审批已驳回";
  public static final String QUOTE_AWARDED = "报价已中选";
  public static final String QUOTE_NOT_SELECTED = "报价未中选";
  public static final String CONTRACT_APPROVAL_PENDING = "合同审批待处理";
  public static final String CONTRACT_APPROVAL_APPROVED = "合同审批已通过";
  public static final String CONTRACT_APPROVAL_REJECTED = "合同审批已驳回";
  public static final String PURCHASE_ORDER_PENDING_CONFIRMATION = "采购订单待确认";
  public static final String PURCHASE_ORDER_EXPECTED_RECEIPT_UPDATED = "采购订单交期已更新";
  public static final String PURCHASE_ORDER_CONFIRMED = "采购订单已确认";
  public static final String PURCHASE_ORDER_SHIPPED = "采购订单已发货";
  public static final String PURCHASE_ORDER_RECEIVED = "采购订单已收货";
  public static final String INVOICE_CREATED = "供应商已登记发票";
  public static final String INVOICE_PAID = "发票已付款";
  public static final String INVOICE_PARTIAL_PAID = "发票部分付款";

  private NotificationTitle() {}
}
