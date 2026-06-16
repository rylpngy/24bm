package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;

import com.procurement.supplier.domain.BuyerSupplierAuditAction;
import org.junit.jupiter.api.Test;

class BuyerSupplierAuditActionTests {

  @Test
  void definesBuyerSupplierAuditActions() {
    assertThat(BuyerSupplierAuditAction.RELATION_CREATED).isEqualTo("buyer_supplier_relation.created");
    assertThat(BuyerSupplierAuditAction.RELATION_PROFILE_UPDATED).isEqualTo("buyer_supplier_relation.profile_updated");
    assertThat(BuyerSupplierAuditAction.RELATION_PERFORMANCE_UPDATED).isEqualTo("buyer_supplier_relation.performance_updated");
    assertThat(BuyerSupplierAuditAction.RELATION_STATUS_CHANGED).isEqualTo("buyer_supplier_relation.status_changed");
    assertThat(BuyerSupplierAuditAction.ADMISSION_SUBMITTED).isEqualTo("buyer_supplier_admission.submitted");
    assertThat(BuyerSupplierAuditAction.ADMISSION_APPROVED).isEqualTo("buyer_supplier_admission.approved");
    assertThat(BuyerSupplierAuditAction.ADMISSION_REJECTED).isEqualTo("buyer_supplier_admission.rejected");
  }
}
