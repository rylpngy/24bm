package com.procurement.supplier.domain;

public final class BuyerSupplierAuditAction {
  public static final String RELATION_CREATED = "buyer_supplier_relation.created";
  public static final String RELATION_PROFILE_UPDATED = "buyer_supplier_relation.profile_updated";
  public static final String RELATION_PERFORMANCE_UPDATED = "buyer_supplier_relation.performance_updated";
  public static final String RELATION_STATUS_CHANGED = "buyer_supplier_relation.status_changed";
  public static final String ADMISSION_SUBMITTED = "buyer_supplier_admission.submitted";
  public static final String ADMISSION_APPROVED = "buyer_supplier_admission.approved";
  public static final String ADMISSION_REJECTED = "buyer_supplier_admission.rejected";

  private BuyerSupplierAuditAction() {}
}
