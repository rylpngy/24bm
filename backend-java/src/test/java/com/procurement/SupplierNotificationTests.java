package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.procurement.common.tenant.TenantContext;
import com.procurement.identity.infrastructure.BuyerUserMapper;
import com.procurement.notification.api.NotificationResponse;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.notification.domain.Notification;
import com.procurement.notification.infrastructure.NotificationMapper;
import com.procurement.supplier.infrastructure.SupplierUserMapper;
import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class SupplierNotificationTests {

  private final NotificationMapper notificationMapper = org.mockito.Mockito.mock(NotificationMapper.class);
  private final BuyerUserMapper buyerUserMapper = org.mockito.Mockito.mock(BuyerUserMapper.class);
  private final SupplierUserMapper supplierUserMapper = org.mockito.Mockito.mock(SupplierUserMapper.class);
  private final NotificationApplicationService notificationApplicationService =
      new NotificationApplicationService(notificationMapper, buyerUserMapper, supplierUserMapper);

  @AfterEach
  void clearTenantContext() {
    TenantContext.clear();
  }

  @Test
  void supplierNotificationListUsesCurrentSupplierUserAsRecipient() {
    TenantContext.set(null, "supplier-1", "supplier-user-1");
    when(notificationMapper.listBySupplierAndRecipient("supplier-1", "supplier-user-1", 50))
        .thenReturn(List.of(notification("notice-payment")));

    List<NotificationResponse> responses = notificationApplicationService.listCurrentSupplierUserNotifications(50);

    assertThat(responses).hasSize(1);
    assertThat(responses.get(0).id()).isEqualTo("notice-payment");
    verify(notificationMapper).listBySupplierAndRecipient("supplier-1", "supplier-user-1", 50);
  }

  @Test
  void supplierNotificationReadUsesCurrentSupplierUserAsRecipient() {
    TenantContext.set(null, "supplier-1", "supplier-user-1");
    when(notificationMapper.markReadBySupplierAndRecipient("supplier-1", "supplier-user-1", "notice-payment"))
        .thenReturn(1);
    when(notificationMapper.findBySupplierRecipientAndId("supplier-1", "supplier-user-1", "notice-payment"))
        .thenReturn(notification("notice-payment"));

    NotificationResponse response =
        notificationApplicationService.markCurrentSupplierUserNotificationRead("notice-payment");

    assertThat(response.id()).isEqualTo("notice-payment");
    verify(notificationMapper).markReadBySupplierAndRecipient("supplier-1", "supplier-user-1", "notice-payment");
  }

  private Notification notification(String id) {
    return new Notification(
        id,
        "tenant-1",
        "supplier-user-1",
        "发票已付款",
        "采购方已登记付款。",
        null,
        OffsetDateTime.parse("2026-06-15T12:00:00+08:00"));
  }
}
