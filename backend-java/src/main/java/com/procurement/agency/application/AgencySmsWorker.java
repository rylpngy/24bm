package com.procurement.agency.application;

import com.procurement.agency.domain.AgencySmsRecords.*;
import com.procurement.agency.infrastructure.AgencySmsMapper;
import com.procurement.common.tenant.*;
import java.time.*;
import java.util.*;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

@Component
public class AgencySmsWorker {
  final AgencySmsMapper data;
  final AgencySmsService service;
  final AgencySmsGateway gateway;
  final TransactionTemplate tx;
  final AgencyExecutionSupport support;
  final AgencyDirectory directory;

  public AgencySmsWorker(
      AgencySmsMapper data,
      AgencySmsService service,
      AgencySmsGateway gateway,
      org.springframework.transaction.PlatformTransactionManager manager,
      AgencyExecutionSupport support,
      AgencyDirectory directory) {
    this.support = support;
    this.directory = directory;
    this.data = data;
    this.service = service;
    this.gateway = gateway;
    this.tx = new TransactionTemplate(manager);
  }

  record Work(Delivery delivery, Contact contact) {}

  Work claim(Delivery candidate) {
    var d = data.lock(candidate.tenantId(), candidate.id());
    if (d == null || !d.status().equals("queued")) return null;
    try {
      var s = support;
      s.guard.permissions().require("buyer:agency:sms:send");
      if (directory.people().stream().noneMatch(x -> x.id().equals(d.createdBy())))
        throw new IllegalStateException("授权发起账号已停用");
      service.eligible(d.packageId(), d.reminderId());
      service.lockSettings();
      var settings = data.settings(d.tenantId());
      var c = data.contact(d.tenantId(), d.recipientId());
      gateway.ready();
      if (settings == null
          || !settings.enabled()
          || c == null
          || !c.consented()
          || c.version() != d.contactVersion()
          || d.createdAt().plusHours(24).isBefore(OffsetDateTime.now()))
        throw new IllegalStateException("短信配置、联系人授权或外发时效已变化");
      if (data.quota(d.tenantId(), settings.dailyLimit()) == null)
        throw new IllegalStateException("达到租户短信日配额，未发送");
      data.state(d.tenantId(), d.id(), "sending", null, "正在请求网关，尚无受理结果", 1);
      var claimed = data.lock(d.tenantId(), d.id());
      data.attempt(
          "sms-attempt-" + UUID.randomUUID(),
          d.tenantId(),
          d.id(),
          claimed.attempts(),
          "sending",
          "开始一次签名网关请求");
      return new Work(claimed, c);
    } catch (com.procurement.common.tenant.PermissionDeniedException
        | IllegalArgumentException
        | IllegalStateException e) {
      org.slf4j.LoggerFactory.getLogger(getClass())
          .warn(
              "SMS preflight failed: {} / {}",
              e.getClass().getSimpleName(),
              e.getCause() == null ? "" : e.getCause().getClass().getSimpleName());
      data.state(
          d.tenantId(),
          d.id(),
          "cancelled",
          null,
          "授权或配置已变化，未发送："
              + (e instanceof IllegalArgumentException || e instanceof IllegalStateException
                  ? e.getMessage()
                  : "权限校验未通过"),
          0);
      return null;
    }
  }

  @Scheduled(fixedDelayString = "${agency.sms.poll-ms:3000}")
  public void poll() {
    for (String t : data.tenants()) {
      data.recover(t);
      for (var candidate : data.queued(t)) {
        TenantContext.set(t, null, candidate.createdBy());
        try {
          var work = tx.execute(status -> claim(candidate));
          if (work == null) continue;
          var result = gateway.send(work.delivery(), work.contact());
          tx.executeWithoutResult(
              status -> {
                var d = data.lock(t, candidate.id());
                data.attempt(
                    "sms-attempt-" + UUID.randomUUID(),
                    t,
                    d.id(),
                    d.attempts(),
                    result.status(),
                    result.note());
                if (d.status().equals("sending"))
                  data.state(t, d.id(), result.status(), result.reference(), result.note(), 0);
              });
        } finally {
          TenantContext.clear();
        }
      }
    }
  }
}
