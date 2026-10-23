package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import com.procurement.identity.security.PortalPermissionPolicy;
import org.junit.jupiter.api.Test;

class PerformanceTaskPermissionTests {
  @Test void supplierTasksUseProfilePermissions() {
    assertThat(PortalPermissionPolicy.required("supplier", "GET", "/api/v1/supplier/performance-tasks"))
        .isEqualTo("supplier:profile:read");
    assertThat(PortalPermissionPolicy.required("supplier", "POST", "/api/v1/supplier/performance-tasks/t/response"))
        .isEqualTo("supplier:profile:manage");
  }
  @Test void buyerTasksUseSupplierPermissions() {
    assertThat(PortalPermissionPolicy.required("buyer", "GET", "/api/v1/buyer/suppliers/r/performance-assignees"))
        .isEqualTo("buyer:supplier:read");
    assertThat(PortalPermissionPolicy.required("buyer", "POST", "/api/v1/buyer/suppliers/r/performance-tasks/t/evaluate"))
        .isEqualTo("buyer:supplier:manage");
  }
}
