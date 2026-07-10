package com.procurement.audit.domain;

public final class AuditTargetType {
  public static final String BUYER_USER = "buyer_user";
  public static final String BUYER_SUPPLIER_RELATION = "buyer_supplier_relation";
  public static final String CONTRACT = "contract";
  public static final String DEPARTMENT = "department";
  public static final String ENTERPRISE = "enterprise";
  public static final String INVOICE = "invoice";
  public static final String MALL_LISTING = "mall_listing";
  public static final String MATERIAL = "material";
  public static final String PAYMENT_BATCH = "payment_batch";
  public static final String PLATFORM_ANNOUNCEMENT = "platform_announcement";
  public static final String PURCHASE_ORDER = "purchase_order";
  public static final String QUOTE = "quote";
  public static final String RFQ = "rfq";
  public static final String SUPPLIER_PROFILE = "supplier_profile";
  public static final String SUPPLIER_USER = "supplier_user";
  public static final String TENANT = "tenant";

  private AuditTargetType() {}
}
