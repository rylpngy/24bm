package com.procurement.notification.application;

import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.notification.api.NotificationResponse;
import com.procurement.notification.domain.Notification;
import com.procurement.notification.infrastructure.NotificationMapper;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class NotificationApplicationService {
  private static final int DEFAULT_LIMIT = 50;
  private static final int MAX_LIMIT = 200;

  private final NotificationMapper notificationMapper;

  public NotificationApplicationService(NotificationMapper notificationMapper) {
    this.notificationMapper = notificationMapper;
  }

  public List<NotificationResponse> listCurrentUserNotifications() {
    return listCurrentUserNotifications(DEFAULT_LIMIT);
  }

  public List<NotificationResponse> listCurrentUserNotifications(int limit) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer notification APIs");
    String userId = TenantAccessGuard.requireUserId("buyer notification APIs");
    int boundedLimit = Math.max(1, Math.min(limit, MAX_LIMIT));
    return notificationMapper.listByTenantAndRecipient(tenantId, userId, boundedLimit).stream()
        .map(this::toResponse)
        .toList();
  }

  @Transactional
  public NotificationResponse markCurrentUserNotificationRead(String notificationId) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer notification APIs");
    String userId = TenantAccessGuard.requireUserId("buyer notification APIs");
    int updated = notificationMapper.markRead(tenantId, userId, notificationId);
    if (updated == 0) {
      throw new IllegalArgumentException("Notification not found for current user: " + notificationId);
    }
    return toResponse(notificationMapper.findByTenantRecipientAndId(tenantId, userId, notificationId));
  }

  private NotificationResponse toResponse(Notification notification) {
    return new NotificationResponse(
        notification.id(),
        notification.tenantId(),
        notification.recipientId(),
        notification.title(),
        notification.content(),
        notification.readAt() != null,
        notification.readAt(),
        notification.createdAt());
  }
}
