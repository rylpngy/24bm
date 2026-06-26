package com.procurement.notification.application;

import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.notification.api.NotificationDeliveryResponse;
import com.procurement.notification.api.NotificationSettingsResponse;
import com.procurement.notification.api.UpdateNotificationSettingsRequest;
import com.procurement.notification.domain.NotificationDelivery;
import com.procurement.notification.domain.TenantNotificationSettings;
import com.procurement.notification.infrastructure.NotificationChannelMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;

// 多通道通知:租户渠道配置(邮件/Webhook)+ 跨渠道分发并记录投递结果。
@Service
public class NotificationChannelService {

  public static final String CHANNEL_INAPP = "站内";
  public static final String CHANNEL_EMAIL = "邮件";
  public static final String CHANNEL_WEBHOOK = "Webhook";

  private final NotificationChannelMapper channelMapper;
  private final HttpClient httpClient =
      HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();

  public NotificationChannelService(NotificationChannelMapper channelMapper) {
    this.channelMapper = channelMapper;
  }

  public NotificationSettingsResponse currentSettings() {
    String tenantId = TenantAccessGuard.requireTenantId("notification channel APIs");
    TenantNotificationSettings s = channelMapper.findSettings(tenantId);
    if (s == null) {
      return new NotificationSettingsResponse(false, null, false, null);
    }
    return new NotificationSettingsResponse(
        s.emailEnabled(), s.emailRecipient(), s.webhookEnabled(), s.webhookUrl());
  }

  public NotificationSettingsResponse updateSettings(UpdateNotificationSettingsRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("notification channel APIs");
    channelMapper.upsertSettings(
        tenantId,
        request.emailEnabled(),
        blankToNull(request.emailRecipient()),
        request.webhookEnabled(),
        blankToNull(request.webhookUrl()));
    return currentSettings();
  }

  public List<NotificationDeliveryResponse> deliveries() {
    String tenantId = TenantAccessGuard.requireTenantId("notification channel APIs");
    return channelMapper.listDeliveries(tenantId).stream().map(this::toResponse).toList();
  }

  // 测试分发:按配置向各启用渠道发送一条样例通知并记录投递结果。
  public List<NotificationDeliveryResponse> dispatchTest() {
    String tenantId = TenantAccessGuard.requireTenantId("notification channel APIs");
    dispatch(tenantId, "通道测试", "这是一条多通道通知测试消息。");
    return deliveries();
  }

  public void dispatch(String tenantId, String title, String content) {
    TenantNotificationSettings s = channelMapper.findSettings(tenantId);
    // 站内始终记录。
    record(tenantId, CHANNEL_INAPP, "在线用户", title, content, "已发送", null);
    if (s == null) {
      return;
    }
    if (s.emailEnabled() && s.emailRecipient() != null) {
      // 开发环境无 SMTP,记录模拟投递。
      record(tenantId, CHANNEL_EMAIL, s.emailRecipient(), title, content, "已发送", "模拟发送(无 SMTP)");
    }
    if (s.webhookEnabled() && s.webhookUrl() != null) {
      dispatchWebhook(tenantId, s.webhookUrl(), title, content);
    }
  }

  private void dispatchWebhook(String tenantId, String url, String title, String content) {
    String body =
        "{\"title\":\"" + escape(title) + "\",\"content\":\"" + escape(content) + "\"}";
    try {
      HttpRequest request =
          HttpRequest.newBuilder(URI.create(url))
              .timeout(Duration.ofSeconds(4))
              .header("Content-Type", "application/json")
              .POST(HttpRequest.BodyPublishers.ofString(body))
              .build();
      HttpResponse<String> response =
          httpClient.send(request, HttpResponse.BodyHandlers.ofString());
      boolean ok = response.statusCode() >= 200 && response.statusCode() < 300;
      record(
          tenantId,
          CHANNEL_WEBHOOK,
          url,
          title,
          content,
          ok ? "成功" : "失败",
          "HTTP " + response.statusCode());
    } catch (Exception exception) {
      record(tenantId, CHANNEL_WEBHOOK, url, title, content, "失败", exception.getClass().getSimpleName());
    }
  }

  private void record(
      String tenantId, String channel, String target, String title, String content,
      String status, String detail) {
    channelMapper.insertDelivery(
        "delivery-" + UUID.randomUUID(), tenantId, channel, target, title, content, status, detail);
  }

  private NotificationDeliveryResponse toResponse(NotificationDelivery d) {
    return new NotificationDeliveryResponse(
        d.id(), d.channel(), d.target(), d.title(), d.status(), d.detail(), d.dispatchedAt());
  }

  private static String escape(String v) {
    return v == null ? "" : v.replace("\\", "\\\\").replace("\"", "\\\"");
  }

  private static String blankToNull(String v) {
    return v == null || v.isBlank() ? null : v;
  }
}
