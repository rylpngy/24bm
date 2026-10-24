package com.procurement.supplier.application;

import com.procurement.identity.application.PermissionService;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.supplier.domain.SupplierInvitation;
import com.procurement.supplier.infrastructure.InvitationNotificationMapper;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class InvitationNotificationService {
  private final InvitationNotificationMapper recipients;
  private final PermissionService permissions;
  private final NotificationApplicationService notifications;

  public InvitationNotificationService(InvitationNotificationMapper recipients,
      PermissionService permissions, NotificationApplicationService notifications) {
    this.recipients = recipients;
    this.permissions = permissions;
    this.notifications = notifications;
  }

  @Transactional(propagation = Propagation.MANDATORY)
  public void notifyEvent(SupplierInvitation invitation, String action) {
    if (invitation.supplierId() == null) return;
    String title = switch (action) {
      case "create" -> "收到供应商合作邀请";
      case "withdraw" -> "供应商合作邀请已撤回";
      case "accept" -> "供应商已接受合作邀请";
      case "decline" -> "供应商已拒绝合作邀请";
      default -> throw new IllegalArgumentException("未知合作邀请通知事件");
    };
    boolean supplierSide = action.equals("create") || action.equals("withdraw");
    var users = supplierSide ? recipients.supplierRecipients(invitation.supplierId())
        : recipients.buyerRecipients(invitation.tenantId());
    String permission = supplierSide ? "supplier:profile:" : "buyer:supplier:";
    String content = invitation.buyerName() + " / " + invitation.supplierName()
        + "，邀请编号：" + invitation.id() + "。"
        + (supplierSide ? "请在合作邀请中查看。" : "请在供应商库的邀请管理中查看；合作接受不代表准入通过。");
    users.stream().distinct()
        .filter(user -> permissions.userHas(user, permission + "read")
            && permissions.userHas(user, permission + "manage"))
        .forEach(user -> {
          String key = invitation.tenantId() + ":" + invitation.id() + ":" + action + ":" + user;
          String id = "invitation-notice-" + UUID.nameUUIDFromBytes(key.getBytes(StandardCharsets.UTF_8));
          notifications.notifyOnce(id, invitation.tenantId(), user, title, content);
        });
  }
}
