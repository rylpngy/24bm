package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;

import com.procurement.demand.domain.PurchaseDemandAuditAction;
import org.junit.jupiter.api.Test;

class PurchaseDemandAuditActionTests {

  @Test
  void definesPurchaseDemandAuditActions() {
    assertThat(PurchaseDemandAuditAction.CREATED).isEqualTo("purchase_demand.created");
    assertThat(PurchaseDemandAuditAction.APPROVED).isEqualTo("purchase_demand.approved");
    assertThat(PurchaseDemandAuditAction.REJECTED).isEqualTo("purchase_demand.rejected");
  }
}
