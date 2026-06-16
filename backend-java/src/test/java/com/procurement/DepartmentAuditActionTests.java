package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;

import com.procurement.organization.domain.DepartmentAuditAction;
import org.junit.jupiter.api.Test;

class DepartmentAuditActionTests {

  @Test
  void definesDepartmentAuditActions() {
    assertThat(DepartmentAuditAction.CREATED).isEqualTo("department.created");
    assertThat(DepartmentAuditAction.DISABLED).isEqualTo("department.disabled");
  }
}
