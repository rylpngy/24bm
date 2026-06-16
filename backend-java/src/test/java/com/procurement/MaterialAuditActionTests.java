package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;

import com.procurement.catalog.domain.MaterialAuditAction;
import org.junit.jupiter.api.Test;

class MaterialAuditActionTests {

  @Test
  void definesMaterialAuditActions() {
    assertThat(MaterialAuditAction.CREATED).isEqualTo("material.created");
    assertThat(MaterialAuditAction.UPDATED).isEqualTo("material.updated");
  }
}
