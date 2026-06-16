package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;

import com.procurement.supplier.domain.SupplierUserAuditAction;
import org.junit.jupiter.api.Test;

class SupplierUserAuditActionTests {

  @Test
  void definesSupplierUserAuditActions() {
    assertThat(SupplierUserAuditAction.CREATED).isEqualTo("supplier_user.created");
    assertThat(SupplierUserAuditAction.PASSWORD_RESET).isEqualTo("supplier_user.password_reset");
    assertThat(SupplierUserAuditAction.STATUS_CHANGED).isEqualTo("supplier_user.status_changed");
  }
}
