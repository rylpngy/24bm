package com.procurement.supplier.domain;

import org.springframework.stereotype.Component;

@Component
public class SupplierUserStatusTransition {

  public void requireSupportedTarget(String status) {
    if (!SupplierUserStatus.ACTIVE.equals(status) && !SupplierUserStatus.INACTIVE.equals(status)) {
      throw new IllegalArgumentException("Unsupported supplier user status: " + status);
    }
  }
}
