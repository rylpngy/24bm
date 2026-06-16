package com.procurement.identity.domain;

import org.springframework.stereotype.Component;

@Component
public class BuyerUserStatusTransition {

  public void requireSupportedTarget(String status) {
    if (!BuyerUserStatus.ACTIVE.equals(status) && !BuyerUserStatus.INACTIVE.equals(status)) {
      throw new IllegalArgumentException("Unsupported buyer user status: " + status);
    }
  }
}
