package com.procurement.agency.application;

import com.procurement.agency.domain.AgencyExecutionRecords.*;
import com.procurement.agency.domain.AgencyRecords.PackageRow;
import com.procurement.agency.domain.AgencyReminderRules;
import com.procurement.identity.application.BuyerDirectoryQuery;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.notification.application.NotificationDeliveryQuery;
import java.time.*;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AgencyReminderService {
  private final AgencyExecutionSupport s;
  private final AgencyCollaborationService collaboration;
  private final BuyerDirectoryQuery directory;
  private final NotificationApplicationService notifications;
  private final NotificationDeliveryQuery receipts;

  public AgencyReminderService(
      AgencyExecutionSupport s,
      AgencyCollaborationService collaboration,
      BuyerDirectoryQuery directory,
      NotificationApplicationService notifications,
      NotificationDeliveryQuery receipts) {
    this.s = s;
    this.collaboration = collaboration;
    this.directory = directory;
    this.notifications = notifications;
    this.receipts = receipts;
  }

  private ReminderPolicy policy(Milestone m) {
    var p = s.data.reminderPolicy(s.guard.tenant(), m.id());
    return p == null
        ? new ReminderPolicy(
            m.tenantId(),
            m.id(),
            m.packageId(),
            s.json.write(AgencyReminderRules.normalize(null)),
            0,
            "系统默认提醒",
            null,
            null)
        : p;
  }

  public Reminders view(String pkg) {
    var p = s.read(pkg, "buyer:agency:plan:read");
    boolean manager = s.guard.can(p, "buyer:agency:plan:manage", true);
    var deliveries =
        s.data.reminderDeliveries(s.guard.tenant(), pkg).stream()
            .filter(d -> manager || d.recipientId().equals(s.guard.actor()))
            .map(
                d -> {
                  var r = receipts.receipt(d.recipientId(), d.id());
                  return new ReminderReceipt(d, r == null ? null : r.readAt());
                })
            .toList();
    return new Reminders(
        s.data.milestones(s.guard.tenant(), pkg).stream().map(this::policy).toList(),
        deliveries,
        false);
  }

  @Transactional
  public ReminderPolicy save(
      String pkg, String id, Long expected, ReminderSettings input, String reason) {
    var p = s.write(pkg, "buyer:agency:plan:manage");
    var m = s.data.milestone(s.guard.tenant(), id);
    if (m == null || !m.packageId().equals(pkg)) throw new IllegalArgumentException("计划节点不存在");
    var old = policy(m);
    s.expected(old.version(), expected);
    s.text(reason, 1000, true, "提醒策略调整原因");
    var settings = AgencyReminderRules.normalize(input);
    if (Objects.equals(settings.escalationUserId(), m.ownerId())
        && settings.escalationUserId() != null)
      throw new IllegalArgumentException("升级接收人应与节点负责人不同");
    if (settings.escalationUserId() != null && !eligible(p, settings.escalationUserId()))
      throw new IllegalArgumentException("升级接收人须为可查看本项目计划的有效人员");
    s.data.saveReminderPolicy(
        s.guard.tenant(), pkg, id, s.json.write(settings), reason, s.guard.actor());
    var result = policy(m);
    s.event(pkg, "reminder_policy", id, old, result, reason);
    return result;
  }

  @Transactional
  public ReminderDelivery retry(String pkg, String id) {
    s.write(pkg, "buyer:agency:plan:manage");
    var d = s.data.reminderDelivery(s.guard.tenant(), id);
    if (d == null || !pkg.equals(d.packageId())) throw new IllegalArgumentException("提醒记录不存在");
    if (s.data.retryReminder(s.guard.tenant(), id) != 1)
      throw new IllegalStateException("仅失败的提醒可手动重试");
    s.event(pkg, "reminder_retry", id, null, Map.of("id", id), "手动重试站内提醒");
    return s.data.reminderDelivery(s.guard.tenant(), id);
  }

  private boolean eligible(PackageRow p, String user) {
    return user != null
        && directory.active().stream().anyMatch(u -> u.id().equals(user))
        && s.guard.permissions().userHas(user, "buyer:agency:plan:read")
        && collaboration.userVisible(p, user);
  }

  @Transactional
  public void prepare(String id) {
    String t = s.guard.tenant();
    var m = s.data.milestone(t, id);
    if (m == null) return;
    var p = s.packages.lock(t, m.packageId());
    m = s.data.milestone(t, id);
    if (!active(p, m)) return;
    var policy = policy(m);
    var settings =
        AgencyReminderRules.normalize(s.json.read(policy.settingsJson(), ReminderSettings.class));
    var due = AgencyReminderRules.due(m);
    for (String level : AgencyReminderRules.levels(settings, due, OffsetDateTime.now())) {
      String recipient =
          level.startsWith("escalation:") ? settings.escalationUserId() : m.ownerId();
      if (!eligible(p, recipient)
          || (level.startsWith("escalation:") && Objects.equals(recipient, m.ownerId()))) continue;
      String event = AgencyReminderRules.eventId(t, m, policy.version(), recipient, level);
      s.data.queueReminder(t, event, m, policy.version(), recipient, level, due);
    }
  }

  private boolean active(PackageRow p, Milestone m) {
    return p != null
        && m != null
        && "approved".equals(p.status())
        && p.workflowId() == null
        && Set.of("planned", "doing").contains(m.status());
  }

  @Transactional
  public void deliver(String id) {
    String t = s.guard.tenant();
    var d = s.data.reminderDelivery(t, id);
    if (d == null) return;
    var p = s.packages.lock(t, d.packageId());
    d = s.data.lockReminderDelivery(t, id);
    if (p != null && p.workflowId() != null)
      return; // A pending project change pauses delivery without losing the reminder.
    if (d == null || !Set.of("pending", "failed").contains(d.status())) return;
    var m = s.data.milestone(t, d.milestoneId());
    var policy = m == null ? null : policy(m);
    var settings =
        policy == null
            ? null
            : AgencyReminderRules.normalize(
                s.json.read(policy.settingsJson(), ReminderSettings.class));
    String recipient =
        settings == null
            ? null
            : d.level().startsWith("escalation:") ? settings.escalationUserId() : m.ownerId();
    if (!active(p, m)
        || m.version() != d.milestoneVersion()
        || policy.version() != d.policyVersion()
        || !Objects.equals(d.dueAt(), AgencyReminderRules.due(m))
        || !Objects.equals(recipient, d.recipientId())
        || !eligible(p, recipient)
        || !AgencyReminderRules.levels(settings, AgencyReminderRules.due(m), OffsetDateTime.now())
            .contains(d.level())) {
      s.data.cancelReminder(t, id, "计划、策略、人员权限或当前提醒级别已变化，旧提醒取消");
      return;
    }
    String title =
        d.level().startsWith("before:")
            ? "代理项目计划临近"
            : d.level().startsWith("escalation:") ? "代理项目计划逾期升级" : "代理项目计划逾期";
    notifications.notifyOnce(
        id,
        t,
        recipient,
        title,
        p.number()
            + " · "
            + m.title()
            + " · 到期 "
            + d.dueAt()
            + " · 提醒级别 "
            + d.level()
            + "。请根据实际结果办理，系统不会自动完成节点。");
    var receipt = receipts.receipt(recipient, id);
    if (receipt == null) throw new IllegalStateException("站内通知尚未确认入库");
    s.data.deliveredReminder(t, id, receipt.storedAt());
  }
}
