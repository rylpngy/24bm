package com.procurement.agency.application;

import com.procurement.agency.domain.AgencySmsRecords.*;
import com.procurement.agency.infrastructure.AgencySmsMapper;
import com.procurement.common.tenant.*;
import java.time.*;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AgencySmsService {
  final AgencyExecutionSupport s;
  final AgencySmsMapper data;
  final AgencySmsGateway gateway;
  final AgencyDirectory directory;
  final AgencyCollaborationService collaboration;

  public AgencySmsService(
      AgencyExecutionSupport s,
      AgencySmsMapper data,
      AgencySmsGateway gateway,
      AgencyDirectory directory,
      AgencyCollaborationService collaboration) {
    this.s = s;
    this.data = data;
    this.gateway = gateway;
    this.directory = directory;
    this.collaboration = collaboration;
  }

  String t() {
    return s.guard.tenant();
  }

  void manage(String pkg) {
    s.guard.require(pkg, true);
    s.guard.permissions().require("buyer:agency:sms:manage");
  }

  void lockSettings() {
    data.init(t(), s.guard.actor());
    data.lockSettings(t());
  }

  public View view(String pkg) {
    var p = s.read(pkg, "buyer:agency:plan:read");
    boolean manager = s.guard.can(p, "buyer:agency:sms:manage", true);
    var contacts =
        manager
            ? data.contacts(t()).stream()
                .filter(c -> collaboration.userVisible(p, c.userId()))
                .map(
                    c ->
                        new ContactView(
                            c.userId(), c.maskedPhone(), c.consented(), c.version(), c.updatedAt()))
                .toList()
            : List.<ContactView>of();
    return new View(
        gateway.configured(),
        manager ? data.settings(t()) : null,
        contacts,
        data.list(t(), pkg).stream()
            .filter(d -> manager || d.recipientId().equals(s.guard.actor()))
            .toList());
  }

  @Transactional
  public Settings configure(String pkg, Config d) {
    manage(pkg);
    if (d == null) throw new IllegalArgumentException("缺少配置");
    s.text(d.reason(), 1000, true, "短信配置依据");
    if (d.dailyLimit() < 1 || d.dailyLimit() > 1000)
      throw new IllegalArgumentException("短信日配额范围1至1000");
    if (d.enabled()) gateway.ready();
    lockSettings();
    var old = data.settings(t());
    s.expected(
        old.version(),
        d.expectedVersion() == null && old.version() == 1 ? 1L : d.expectedVersion());
    if (data.settingsSave(
            t(),
            new Config(old.version(), d.enabled(), d.dailyLimit(), d.reason()),
            s.guard.actor())
        != 1) throw new IllegalStateException("短信配置已变化");
    s.event(
        pkg,
        "sms_settings",
        t(),
        null,
        Map.of("enabled", d.enabled(), "dailyLimit", d.dailyLimit()),
        d.reason());
    return data.settings(t());
  }

  @Transactional
  public ContactView contact(String pkg, String user, ContactInput d) {
    manage(pkg);
    gateway.ready();
    if (d == null || !d.verified()) throw new IllegalArgumentException("须人工核验号码归属及短信接收授权");
    s.text(d.reason(), 1000, true, "联系信息核验依据");
    var p = s.guard.require(pkg, true);
    if (directory.people().stream().noneMatch(x -> x.id().equals(user))
        || !collaboration.userVisible(p, user))
      throw new IllegalArgumentException("联系人须为有项目范围的有效内部人员");
    if (d.phone() == null || !d.phone().matches("\\+[1-9][0-9]{7,14}"))
      throw new IllegalArgumentException("号码须为含国家码的E.164格式");
    lockSettings();
    var old = data.contact(t(), user);
    s.expected(old == null ? 0 : old.version(), d.expectedVersion());
    String masked =
        d.phone().substring(0, 3) + "****" + d.phone().substring(d.phone().length() - 4);
    data.contactSave(
        t(),
        user,
        gateway.encrypt(t(), user, d.phone()),
        masked,
        d.consented(),
        s.guard.actor(),
        d.reason());
    s.event(
        pkg, "sms_contact", user, null, Map.of("consented", d.consented()), "人工核验联系人授权；完整号码加密存储");
    var c = data.contact(t(), user);
    return new ContactView(user, c.maskedPhone(), c.consented(), c.version(), c.updatedAt());
  }

  void eligible(String pkg, String event) {
    var p = s.guard.requireApproved(pkg);
    var d = s.data.reminderDelivery(t(), event);
    if (d == null || !d.packageId().equals(pkg) || !d.status().equals("delivered"))
      throw new IllegalArgumentException("须选择本项目已形成站内通知的计划提醒");
    var m = s.data.milestone(t(), d.milestoneId());
    if (m == null
        || m.version() != d.milestoneVersion()
        || !Set.of("planned", "doing").contains(m.status())
        || !collaboration.userVisible(p, d.recipientId())
        || !s.guard.permissions().userHas(d.recipientId(), "buyer:agency:plan:read")
        || directory.people().stream().noneMatch(x -> x.id().equals(d.recipientId())))
      throw new IllegalStateException("提醒计划或接收人范围已变化");
    var policy = s.data.reminderPolicy(t(), m.id());
    if ((policy == null ? 0 : policy.version()) != d.policyVersion())
      throw new IllegalStateException("提醒策略已变化");
    if (policy != null
        && !s.json
            .read(
                policy.settingsJson(),
                com.procurement.agency.domain.AgencyExecutionRecords.ReminderSettings.class)
            .enabled()) throw new IllegalStateException("提醒已停用");
  }

  @Transactional
  public Delivery send(String pkg, Send d) {
    s.guard.require(pkg, true);
    s.guard.permissions().require("buyer:agency:sms:send");
    gateway.ready();
    if (d == null || !d.authorized()) throw new IllegalArgumentException("须逐条确认授权实际外发短信");
    s.text(d.reason(), 1000, true, "外发授权依据");
    s.packages.lock(t(), pkg);
    lockSettings();
    var old = data.byReminder(t(), d.reminderId());
    if (old != null) {
      if (!old.packageId().equals(pkg)) throw new IllegalArgumentException("提醒不属于本项目");
      return old;
    }
    eligible(pkg, d.reminderId());
    var settings = data.settings(t());
    if (!settings.enabled()) throw new IllegalStateException("本租户短信通道未启用");
    var reminder = s.data.reminderDelivery(t(), d.reminderId());
    var c = data.contact(t(), reminder.recipientId());
    if (c == null || !c.consented()) throw new IllegalArgumentException("联系人未核验或未授权接收短信");
    String id = "agency-sms-" + UUID.randomUUID();
    data.queue(id, t(), pkg, d.reminderId(), c.userId(), c.version(), s.guard.actor());
    s.event(pkg, "sms_authorized", id, null, Map.of("reminderId", d.reminderId()), d.reason());
    return data.byReminder(t(), d.reminderId());
  }

  public List<Attempt> attempts(String pkg, String id) {
    s.read(pkg, "buyer:agency:plan:read");
    var d = data.find(t(), id);
    if (d == null || !d.packageId().equals(pkg)) throw new PermissionDeniedException("短信记录不存在");
    if (!d.recipientId().equals(s.guard.actor())) manage(pkg);
    return data.attempts(t(), id);
  }

  @Transactional
  public Delivery retry(String pkg, String id, String reason) {
    s.guard.require(pkg, true);
    s.guard.permissions().require("buyer:agency:sms:send");
    s.text(reason, 1000, true, "重试授权依据");
    s.packages.lock(t(), pkg);
    var d = data.lock(t(), id);
    if (d == null || !d.packageId().equals(pkg)) throw new PermissionDeniedException("短信记录不存在");
    if (!d.status().equals("failed") || d.providerRef() != null)
      throw new IllegalStateException("仅网关明确未受理的失败可授权重试；结果未知或已有供应商编号时须查询处理");
    eligible(pkg, d.reminderId());
    data.state(t(), id, "queued", null, "人工授权重试，沿用原网关幂等编号", 0);
    s.event(pkg, "sms_retry", id, null, null, reason);
    return data.lock(t(), id);
  }

  @Transactional
  public Delivery cancel(String pkg, String id, String reason) {
    manage(pkg);
    s.text(reason, 1000, true, "取消依据");
    var d = data.lock(t(), id);
    if (d == null || !d.packageId().equals(pkg)) throw new PermissionDeniedException("短信记录不存在");
    if (!d.status().equals("queued")) throw new IllegalStateException("仅尚未派发的排队短信可取消");
    data.state(t(), id, "cancelled", null, "人工取消待发短信", 0);
    s.event(pkg, "sms_cancelled", id, null, null, reason);
    return data.lock(t(), id);
  }

  @Transactional
  public void receipt(Receipt r, String hash) {
    if (r == null
        || r.tenantId() == null
        || r.deliveryId() == null
        || r.providerRef() == null
        || r.providerRef().isBlank()
        || r.providerRef().length() > 200
        || r.status() == null
        || !Set.of("delivered", "failed").contains(r.status()))
      throw new IllegalArgumentException("回执字段无效");
    var d = data.lock(r.tenantId(), r.deliveryId());
    if (d == null) throw new IllegalArgumentException("短信记录不存在");
    if (data.seen(r.tenantId(), r.deliveryId(), hash) > 0) return;
    if (d.providerRef() != null && !d.providerRef().equals(r.providerRef()))
      throw new IllegalArgumentException("回执供应商编号不匹配");
    if (!Set.of("sending", "accepted", "unknown", r.status()).contains(d.status()))
      throw new IllegalStateException("短信终态冲突，拒绝倒退");
    data.receipt(r.tenantId(), r.deliveryId(), hash, r.status());
    data.state(r.tenantId(), r.deliveryId(), r.status(), r.providerRef(), "已收到经签名验证的网关终态回执", 0);
  }
}
