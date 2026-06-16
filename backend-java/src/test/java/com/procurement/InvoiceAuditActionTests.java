package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;

import com.procurement.finance.domain.InvoiceAuditAction;
import org.junit.jupiter.api.Test;

class InvoiceAuditActionTests {

  @Test
  void definesInvoiceAuditActions() {
    assertThat(InvoiceAuditAction.CREATED).isEqualTo("invoice.created");
    assertThat(InvoiceAuditAction.PAID).isEqualTo("invoice.paid");
    assertThat(InvoiceAuditAction.PARTIAL_PAID).isEqualTo("invoice.partial_paid");
  }
}
