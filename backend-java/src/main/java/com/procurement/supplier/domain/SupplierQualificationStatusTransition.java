package com.procurement.supplier.domain;

import org.springframework.stereotype.Component;

@Component
public class SupplierQualificationStatusTransition {

  public void requireSupportedTarget(String status) {
    if (!SupplierQualificationStatus.ACTIVE.equals(status)
        && !SupplierQualificationStatus.INACTIVE.equals(status)) {
      throw new IllegalArgumentException("Unsupported supplier qualification status: " + status);
    }
  }
}
