package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;

import com.procurement.notification.domain.NotificationRecipientStatus;
import org.junit.jupiter.api.Test;

class NotificationRecipientStatusTests {

  @Test
  void definesEnabledRecipientStatus() {
    assertThat(NotificationRecipientStatus.ENABLED).isEqualTo("启用");
  }
}
