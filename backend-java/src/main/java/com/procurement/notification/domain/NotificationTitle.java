package com.procurement.notification.domain;

public final class NotificationTitle {
  public static final String PURCHASE_DEMAND_PENDING_APPROVAL = "采购需求待审批";
  public static final String PURCHASE_DEMAND_APPROVED = "采购需求审批已通过";
  public static final String PURCHASE_DEMAND_REJECTED = "采购需求审批已驳回";
  public static final String SUPPLIER_ADMISSION_APPROVED = "供应商准入审批已通过";
  public static final String SUPPLIER_ADMISSION_REJECTED = "供应商准入审批已驳回";
  public static final String RFQ_AWARD_PENDING_APPROVAL = "定标结果待审批";
  public static final String RFQ_AWARD_APPROVED = "定标审批已通过";
  public static final String RFQ_AWARD_REJECTED = "定标审批已驳回";
  public static final String PURCHASE_ORDER_CONFIRMED = "采购订单已确认";
  public static final String PURCHASE_ORDER_SHIPPED = "采购订单已发货";
  public static final String PURCHASE_ORDER_RECEIVED = "采购订单已收货";
  public static final String INVOICE_CREATED = "供应商已登记发票";
  public static final String INVOICE_PAID = "发票已付款";
  public static final String INVOICE_PARTIAL_PAID = "发票部分付款";

  private NotificationTitle() {}
}
