package com.procurement.supplier.application;

import com.procurement.identity.application.PermissionService;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.supplier.domain.PerformanceTask;
import com.procurement.supplier.infrastructure.PerformanceTaskMapper;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PerformanceTaskNotificationService {
  private final PerformanceTaskMapper tasks;
  private final PermissionService permissions;
  private final NotificationApplicationService notifications;

  public PerformanceTaskNotificationService(PerformanceTaskMapper tasks, PermissionService permissions,
      NotificationApplicationService notifications) {
    this.tasks = tasks;
    this.permissions = permissions;
    this.notifications = notifications;
  }

  // The persisted business event and its notices must commit or roll back together.
  @Transactional(propagation = Propagation.MANDATORY)
  public void notifyEvent(PerformanceTask task, String action) {
    String title = switch (action) {
      case "assigned" -> "供应商考核任务待办理";
      case "evaluated" -> "供应商考核已完成";
      case "remediation_requested" -> "供应商整改待反馈";
      case "remediation_submitted" -> "供应商整改待复核";
      case "remediation_rejected" -> "供应商整改已退回";
      case "closed" -> "供应商整改已关闭";
      default -> throw new IllegalArgumentException("未知绩效通知事件");
    };
    boolean supplier = List.of("remediation_requested", "remediation_rejected", "closed").contains(action);
    List<String> recipients;
    if (supplier) {
      recipients = tasks.supplierRecipients(task.supplierId());
    } else if ("assigned".equals(action)) {
      recipients = tasks.buyerActor(task.tenantId(), task.assigneeId()) == null
          ? List.of() : List.of(task.assigneeId());
    } else {
      recipients = tasks.assignees(task.tenantId()).stream().map(a -> a.id()).toList();
    }
    String permission = supplier ? "supplier:profile:" : "buyer:supplier:";
    String content = task.buyerName() + " / " + task.supplierName() + "，考核周期：" + task.period()
        + "，任务编号：" + task.id() + "。"
        + (supplier ? "请在整改反馈中查看当前任务及处理记录。" : "请在供应商库的绩效考核中查看当前任务及处理记录。");
    recipients.stream().distinct()
        .filter(user -> permissions.userHas(user, permission + "read") && permissions.userHas(user, permission + "manage"))
        .forEach(user -> {
          String key = task.tenantId() + ":" + task.id() + ":" + task.version() + ":" + action + ":" + user;
          String id = "performance-notice-" + UUID.nameUUIDFromBytes(key.getBytes(StandardCharsets.UTF_8));
          notifications.notifyOnce(id, task.tenantId(), user, title, content);
        });
  }
}
