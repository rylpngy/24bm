package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;

import com.procurement.notification.domain.NotificationRecipientStatus;
import org.junit.jupiter.api.Test;

class NotificationRecipientStatusTests {

  @Test
  void definesEnabledRecipientStatus() {
    // 与买/供用户账号在用态对齐,确保通知确实投递。
    assertThat(NotificationRecipientStatus.ENABLED).isEqualTo("active");
  }
}
