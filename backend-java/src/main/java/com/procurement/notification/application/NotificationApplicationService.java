package com.procurement.notification.application;

import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.identity.infrastructure.BuyerUserMapper;
import com.procurement.notification.api.NotificationResponse;
import com.procurement.notification.domain.Notification;
import com.procurement.notification.domain.NotificationRecipientStatus;
import com.procurement.notification.infrastructure.NotificationMapper;
import com.procurement.supplier.infrastructure.SupplierUserMapper;
import java.util.List;
import java.util.LinkedHashSet;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class NotificationApplicationService {
  private static final int DEFAULT_LIMIT = 50;
  private static final int MAX_LIMIT = 200;

  private final NotificationMapper notificationMapper;
  private final BuyerUserMapper buyerUserMapper;
  private final SupplierUserMapper supplierUserMapper;

  @Autowired
  public NotificationApplicationService(
      NotificationMapper notificationMapper,
      BuyerUserMapper buyerUserMapper,
      SupplierUserMapper supplierUserMapper) {
    this.notificationMapper = notificationMapper;
    this.buyerUserMapper = buyerUserMapper;
    this.supplierUserMapper = supplierUserMapper;
  }

  public NotificationApplicationService(NotificationMapper notificationMapper, BuyerUserMapper buyerUserMapper) {
    this(notificationMapper, buyerUserMapper, null);
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

  public List<NotificationResponse> listCurrentSupplierUserNotifications(int limit) {
    String supplierId = TenantAccessGuard.requireSupplierId("supplier notification APIs");
    String userId = TenantAccessGuard.requireUserId("supplier notification APIs");
    int boundedLimit = Math.max(1, Math.min(limit, MAX_LIMIT));
    return notificationMapper.listBySupplierAndRecipient(supplierId, userId, boundedLimit).stream()
        .map(this::toResponse)
        .toList();
  }

  @Transactional
  public void notifyActiveTenantUsers(String tenantId, String title, String content) {
    buyerUserMapper.listByTenant(tenantId).stream()
        .filter(user -> NotificationRecipientStatus.ENABLED.equals(user.status()))
        .forEach(user -> notificationMapper.insert(
            "notice-" + UUID.randomUUID(),
            tenantId,
            user.id(),
            title,
            content));
  }

  @Transactional
  public void notifyTenantUsers(
      String tenantId, Iterable<String> recipientIds, String title, String content) {
    LinkedHashSet<String> uniqueIds = new LinkedHashSet<>();
    recipientIds.forEach(recipientId -> {
      if (recipientId != null && !recipientId.isBlank()) {
        uniqueIds.add(recipientId);
      }
    });
    uniqueIds.stream()
        .map(recipientId -> buyerUserMapper.findByTenantAndId(tenantId, recipientId))
        .filter(java.util.Objects::nonNull)
        .filter(user -> NotificationRecipientStatus.ENABLED.equals(user.status()))
        .forEach(user -> notificationMapper.insert(
            "notice-" + UUID.randomUUID(), tenantId, user.id(), title, content));
  }

  @Transactional
  public void notifyActiveSupplierUsers(String tenantId, String supplierId, String title, String content) {
    supplierUserMapper.listBySupplier(supplierId).stream()
        .filter(user -> NotificationRecipientStatus.ENABLED.equals(user.status()))
        .forEach(user -> notificationMapper.insert(
            "notice-" + UUID.randomUUID(),
            tenantId,
            user.id(),
            title,
            content));
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

  @Transactional
  public NotificationResponse markCurrentSupplierUserNotificationRead(String notificationId) {
    String supplierId = TenantAccessGuard.requireSupplierId("supplier notification APIs");
    String userId = TenantAccessGuard.requireUserId("supplier notification APIs");
    int updated = notificationMapper.markReadBySupplierAndRecipient(supplierId, userId, notificationId);
    if (updated == 0) {
      throw new IllegalArgumentException("Notification not found for current supplier user: " + notificationId);
    }
    return toResponse(notificationMapper.findBySupplierRecipientAndId(supplierId, userId, notificationId));
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
