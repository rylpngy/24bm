package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;

import com.procurement.identity.domain.BuyerUserAuditAction;
import org.junit.jupiter.api.Test;

class BuyerUserAuditActionTests {

  @Test
  void definesBuyerUserAuditActions() {
    assertThat(BuyerUserAuditAction.CREATED).isEqualTo("buyer_user.created");
    assertThat(BuyerUserAuditAction.ROLE_CHANGED).isEqualTo("buyer_user.role_changed");
    assertThat(BuyerUserAuditAction.STATUS_CHANGED).isEqualTo("buyer_user.status_changed");
    assertThat(BuyerUserAuditAction.PASSWORD_RESET).isEqualTo("buyer_user.password_reset");
  }
}
