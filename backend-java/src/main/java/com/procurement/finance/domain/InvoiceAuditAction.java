package com.procurement.finance.domain;

public final class InvoiceAuditAction {
  public static final String CREATED = "invoice.created";
  public static final String PAID = "invoice.paid";
  public static final String PARTIAL_PAID = "invoice.partial_paid";
  public static final String RECEIVABLE_NOTE_UPDATED = "invoice.receivable_note_updated";

  private InvoiceAuditAction() {}
}
