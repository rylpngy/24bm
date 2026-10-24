package com.procurement;

import static org.mockito.Mockito.*;

import com.procurement.identity.application.PermissionService;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.supplier.application.InvitationNotificationService;
import com.procurement.supplier.domain.SupplierInvitation;
import com.procurement.supplier.infrastructure.InvitationNotificationMapper;
import java.util.List;
import org.junit.jupiter.api.Test;

class InvitationNotificationServiceTests {
  final InvitationNotificationMapper recipients = mock(InvitationNotificationMapper.class);
  final PermissionService permissions = mock(PermissionService.class);
  final NotificationApplicationService notifications = mock(NotificationApplicationService.class);
  final InvitationNotificationService service = new InvitationNotificationService(recipients, permissions, notifications);

  SupplierInvitation invitation(String supplier) {
    return new SupplierInvitation("inv", "buyer-tenant", supplier, "供应商", "私密联系方式", null,
        "不应复制进通知的说明", "待回复", null, null, null, "采购企业");
  }

  @Test void supplierNoticeRequiresBothPermissionsAndUsesStableEventIdentity() {
    when(recipients.supplierRecipients("supplier")).thenReturn(List.of("writer", "reader", "writer"));
    when(permissions.userHas("writer", "supplier:profile:read")).thenReturn(true);
    when(permissions.userHas("writer", "supplier:profile:manage")).thenReturn(true);
    when(permissions.userHas("reader", "supplier:profile:read")).thenReturn(true);
    service.notifyEvent(invitation("supplier"), "create");
    verify(notifications).notifyOnce(startsWith("invitation-notice-"), eq("buyer-tenant"), eq("writer"),
        eq("收到供应商合作邀请"), argThat(text -> !text.contains("私密") && !text.contains("说明")));
    verifyNoMoreInteractions(notifications);
  }

  @Test void acceptanceAndDeclineReachOnlyAuthorizedBuyerRecipients() {
    when(recipients.buyerRecipients("buyer-tenant")).thenReturn(List.of("buyer"));
    when(permissions.userHas(eq("buyer"), anyString())).thenReturn(true);
    for (String action : List.of("accept", "decline")) service.notifyEvent(invitation("supplier"), action);
    verify(notifications, times(2)).notifyOnce(anyString(), eq("buyer-tenant"), eq("buyer"), anyString(), anyString());
    verify(recipients, never()).supplierRecipients(anyString());
  }

  @Test void offlineRecordsNeverGenerateSupplierOrBuyerNotices() {
    service.notifyEvent(invitation(null), "create");
    service.notifyEvent(invitation(null), "accept");
    verifyNoInteractions(recipients, permissions, notifications);
  }
}
