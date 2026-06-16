package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;

import com.procurement.platform.domain.PlatformEnterpriseAuditAction;
import org.junit.jupiter.api.Test;

class PlatformEnterpriseAuditActionTests {
  @Test
  void definesPlatformEnterpriseAuditActions() {
    assertThat(PlatformEnterpriseAuditAction.REVIEWED).isEqualTo("enterprise.reviewed");
  }
}
