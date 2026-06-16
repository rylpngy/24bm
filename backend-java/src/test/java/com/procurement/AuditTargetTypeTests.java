package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;

import com.procurement.audit.domain.AuditTargetType;
import org.junit.jupiter.api.Test;

class AuditTargetTypeTests {
  @Test
  void definesAuditTargetTypes() {
    assertThat(AuditTargetType.BUYER_USER).isEqualTo("buyer_user");
    assertThat(AuditTargetType.BUYER_SUPPLIER_RELATION).isEqualTo("buyer_supplier_relation");
    assertThat(AuditTargetType.DEPARTMENT).isEqualTo("department");
    assertThat(AuditTargetType.ENTERPRISE).isEqualTo("enterprise");
    assertThat(AuditTargetType.INVOICE).isEqualTo("invoice");
    assertThat(AuditTargetType.MATERIAL).isEqualTo("material");
    assertThat(AuditTargetType.PLATFORM_ANNOUNCEMENT).isEqualTo("platform_announcement");
    assertThat(AuditTargetType.PURCHASE_ORDER).isEqualTo("purchase_order");
    assertThat(AuditTargetType.SUPPLIER_PROFILE).isEqualTo("supplier_profile");
    assertThat(AuditTargetType.SUPPLIER_USER).isEqualTo("supplier_user");
    assertThat(AuditTargetType.TENANT).isEqualTo("tenant");
  }
}
