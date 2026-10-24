package com.procurement.numbering.application;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.identity.application.PermissionService;
import com.procurement.numbering.domain.NumberingRule;
import com.procurement.numbering.infrastructure.NumberingRuleMapper;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.function.ToLongFunction;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class NumberingApplicationService {
  private final NumberingRuleMapper mapper;
  private final PermissionService permissions;
  private final AuditLogApplicationService audit;

  public NumberingApplicationService(NumberingRuleMapper mapper, PermissionService permissions,
      AuditLogApplicationService audit) {
    this.mapper = mapper;
    this.permissions = permissions;
    this.audit = audit;
  }

  public record Preview(String example, boolean consumesSequence, String notice) {}

  public List<NumberingRule> list() {
    String tenant = requireAdmin();
    return List.of(rule(tenant, "demand"), rule(tenant, "tender"));
  }

  @Transactional
  public NumberingRule save(String businessType, NumberingRule draft) {
    String tenant = requireAdmin();
    draft.validated(businessType);
    NumberingRule before = rule(tenant, businessType);
    mapper.save(tenant, draft);
    audit.recordCurrentTenantAction("numbering_rule.updated", "numbering_rule", businessType,
        "before=" + before + "; after=" + draft);
    return draft;
  }

  public Preview preview(String businessType, NumberingRule draft) {
    requireAdmin();
    draft.validated(businessType);
    NumberingRule effective = effective(draft, "dept-it");
    return new Preview(effective.format(effective.renderedPrefix(today()), 1), false,
        "仅格式样例，不消耗流水，不代表下一个编号；默认需求样例使用 IT 部门。");
  }

  @Transactional(propagation = Propagation.MANDATORY)
  public String nextDemandNumber(String departmentId, ToLongFunction<String> allocator) {
    return allocate("demand", departmentId, allocator);
  }

  @Transactional(propagation = Propagation.MANDATORY)
  public String nextTenderNumber(ToLongFunction<String> allocator) {
    return allocate("tender", null, allocator);
  }

  private String allocate(String type, String department, ToLongFunction<String> allocator) {
    String tenant = TenantAccessGuard.requireTenantId("automatic numbering");
    NumberingRule effective = effective(rule(tenant, type), department);
    String prefix = effective.renderedPrefix(today());
    for (int attempt = 0; attempt < 100_000; attempt++) {
      long sequence = allocator.applyAsLong(prefix);
      if (sequence <= 0) throw new IllegalStateException("Numbering allocator returned an invalid sequence");
      String number = effective.format(prefix, sequence);
      if (mapper.reserve(tenant, type, number) == 1) return number;
    }
    throw new IllegalStateException("Too many previously used numbers for this prefix; choose another prefix");
  }

  private NumberingRule rule(String tenant, String type) {
    NumberingRule defaults = NumberingRule.defaults(type);
    NumberingRule saved = mapper.find(tenant, type);
    return saved == null ? defaults : saved;
  }

  private static NumberingRule effective(NumberingRule rule, String department) {
    return rule.enabled() ? rule : new NumberingRule(rule.businessType(),
        "demand".equals(rule.businessType()) ? NumberingRule.departmentPrefix(department) : "ZB", "yyyyMMdd", 3, false);
  }

  /** Legacy standalone callers retain default formats; Spring requires the full service injection. */
  public static String defaultNumber(String type, String department, ToLongFunction<String> allocator) {
    NumberingRule format = effective(NumberingRule.defaults(type), department);
    String prefix = format.renderedPrefix(today());
    return format.format(prefix, allocator.applyAsLong(prefix));
  }

  private String requireAdmin() {
    String tenant = TenantAccessGuard.requireTenantId("buyer numbering configuration");
    permissions.require("buyer:role:manage");
    return tenant;
  }

  private static LocalDate today() { return LocalDate.now(ZoneId.of("Asia/Shanghai")); }
}
