package com.procurement.supplier.application;

import com.procurement.identity.application.PermissionService;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.supplier.infrastructure.QualificationNoticeMapper;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class QualificationNotificationService {
  private final QualificationNoticeMapper notices;
  private final NotificationApplicationService notifications;
  private final PermissionService permissions;

  public QualificationNotificationService(QualificationNoticeMapper notices,
      NotificationApplicationService notifications, PermissionService permissions) {
    this.notices = notices;
    this.notifications = notifications;
    this.permissions = permissions;
  }

  @Transactional
  public void reviewCreated(String supplierId, String qualificationId) {
    for (var notice : notices.pending(supplierId, qualificationId)) {
      for (String user : notices.buyerUsers(notice.tenantId())) {
        if (permissions.userHas(user, "buyer:supplier:read")
            && permissions.userHas(user, "buyer:workflow:review")) {
          send("review:" + notice.id(), notice.tenantId(), user, "供应商资质待复核",
              notice.supplierName() + "更新了" + notice.qualificationType() + "，请在供应商库的资质变更复核中核验原件并处理。");
        }
      }
    }
  }

  @Transactional
  public void reviewCompleted(String tenantId, long id) {
    var notice = notices.result(tenantId, id);
    if (notice == null) return;
    for (String user : notices.supplierUsers(notice.supplierId())) {
      if (permissions.userHas(user, "supplier:qualification:read")) {
        send("result:" + id, tenantId, user, "资质复核结果",
            notice.tenantName() + "：" + notice.qualificationType() + ("approved".equals(notice.status()) ? "已通过复核。" : "复核未通过。")
                + "意见：" + notice.comment() + "。请在资质管理的复核记录查看对应采购企业及处理详情。");
      }
    }
  }

  @Transactional
  public void remindExpiry(LocalDate today) {
    for (var notice : notices.expiring(today.plusDays(30))) {
      String phase = notice.expiresAt().isBefore(today) ? "已过期"
          : notice.expiresAt().equals(today) ? "今日到期" : "30天内到期";
      String event = "expiry:" + notice.id() + ":" + notice.expiresAt() + ":" + phase;
      String content = notice.supplierName() + "的" + notice.qualificationType() + phase
          + "（有效期至" + notice.expiresAt() + "），请核验并更新证照。本提醒不自动改变合作或订单状态。";
      for (String user : notices.buyerUsers(notice.tenantId())) {
        if (permissions.userHas(user, "buyer:supplier:read") && permissions.userHas(user, "buyer:supplier:manage")) {
          send(event, notice.tenantId(), user, "供应商资质有效期提醒", content);
        }
      }
      for (String user : notices.supplierUsers(notice.supplierId())) {
        if (permissions.userHas(user, "supplier:qualification:read")) {
          send(event, notice.tenantId(), user, "资质有效期提醒", content);
        }
      }
    }
  }

  private void send(String event, String tenantId, String userId, String title, String content) {
    // Stable event/recipient identity makes retries and concurrent schedulers idempotent.
    String id = "qualification-notice-" + UUID.nameUUIDFromBytes(
        (event + ":" + userId).getBytes(StandardCharsets.UTF_8));
    notifications.notifyOnce(id, tenantId, userId, title, content);
  }
}
