package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;

import com.procurement.supplier.domain.SupplierProfileAuditAction;
import org.junit.jupiter.api.Test;

class SupplierProfileAuditActionTests {
  @Test
  void definesSupplierProfileAuditActions() {
    assertThat(SupplierProfileAuditAction.UPDATED).isEqualTo("supplier_profile.updated");
  }
}
