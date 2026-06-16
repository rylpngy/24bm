package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;

import com.procurement.organization.domain.DepartmentStatus;
import org.junit.jupiter.api.Test;

class DepartmentStatusTests {

  @Test
  void definesActiveAndInactiveDepartmentStatuses() {
    assertThat(DepartmentStatus.ACTIVE).isEqualTo("active");
    assertThat(DepartmentStatus.INACTIVE).isEqualTo("inactive");
  }
}
