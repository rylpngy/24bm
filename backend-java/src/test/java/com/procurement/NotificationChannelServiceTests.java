package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.procurement.common.tenant.TenantContext;
import com.procurement.notification.application.NotificationChannelService;
import com.procurement.notification.domain.TenantNotificationSettings;
import com.procurement.notification.infrastructure.NotificationChannelMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentMatchers;

// 多通道通知:分发按渠道配置扇出并记录投递(站内始终,邮件按开关,Webhook 按开关)。
class NotificationChannelServiceTests {

  private final NotificationChannelMapper mapper = mock(NotificationChannelMapper.class);
  private final com.procurement.notification.application.EmailDispatcher emailDispatcher =
      new com.procurement.notification.application.EmailDispatcher(
          mock(org.springframework.beans.factory.ObjectProvider.class), "", "no-reply@24bid.local");
  private final NotificationChannelService service =
      new NotificationChannelService(mapper, emailDispatcher);

  @AfterEach
  void clear() {
    TenantContext.clear();
  }

  @Test
  void dispatchFansOutToInAppAndEnabledEmailOnly() {
    when(mapper.findSettings("tenant-1"))
        .thenReturn(new TenantNotificationSettings(
            "tenant-1", true, "ops@x.com", false, null));

    service.dispatch("tenant-1", "标题", "内容");

    // 站内 + 邮件 各记录一次;Webhook 未启用 → 无该渠道投递。
    verify(mapper).insertDelivery(anyString(), eq("tenant-1"), eq("站内"),
        anyString(), eq("标题"), eq("内容"), eq("已记录"), ArgumentMatchers.any(), ArgumentMatchers.any());
    // 测试环境未配置 SMTP:邮件如实记为「未配置」,不谎报已发送。
    verify(mapper).insertDelivery(anyString(), eq("tenant-1"), eq("邮件"),
        eq("ops@x.com"), eq("标题"), eq("内容"), eq("未配置"), ArgumentMatchers.any(), ArgumentMatchers.any());
    verify(mapper, never()).insertDelivery(anyString(), anyString(), eq("Webhook"),
        ArgumentMatchers.any(), anyString(), anyString(), anyString(), ArgumentMatchers.any(), ArgumentMatchers.any());
  }

  @Test
  void dispatchWithNoSettingsRecordsOnlyInApp() {
    when(mapper.findSettings("tenant-1")).thenReturn(null);

    service.dispatch("tenant-1", "标题", "内容");

    verify(mapper).insertDelivery(anyString(), eq("tenant-1"), eq("站内"),
        anyString(), anyString(), anyString(), eq("已记录"), ArgumentMatchers.any(), ArgumentMatchers.any());
    verify(mapper, never()).insertDelivery(anyString(), anyString(), eq("邮件"),
        ArgumentMatchers.any(), anyString(), anyString(), anyString(), ArgumentMatchers.any(), ArgumentMatchers.any());
  }

  @Test
  void currentSettingsDefaultsWhenAbsent() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(mapper.findSettings("tenant-1")).thenReturn(null);

    var settings = service.currentSettings();

    assertThat(settings.emailEnabled()).isFalse();
    assertThat(settings.webhookEnabled()).isFalse();
  }
}
