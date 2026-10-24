package com.procurement;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.PermissionDeniedException;
import com.procurement.common.tenant.TenantContext;
import com.procurement.identity.application.PermissionService;
import com.procurement.numbering.application.NumberingApplicationService;
import com.procurement.numbering.domain.NumberingRule;
import com.procurement.numbering.infrastructure.NumberingRuleMapper;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class NumberingRuleTests {
  final NumberingRuleMapper mapper = mock(NumberingRuleMapper.class);
  final PermissionService permissions = mock(PermissionService.class);
  final AuditLogApplicationService audit = mock(AuditLogApplicationService.class);
  final NumberingApplicationService service = new NumberingApplicationService(mapper, permissions, audit);
  @AfterEach void clear() { TenantContext.clear(); }

  @Test void defaultsAndDisabledRulesRetainDepartmentDateAndTenderFormats() {
    TenantContext.set("one", null, "admin");
    when(mapper.reserve(anyString(), anyString(), anyString())).thenReturn(1);
    String date = LocalDate.now(ZoneId.of("Asia/Shanghai")).format(java.time.format.DateTimeFormatter.BASIC_ISO_DATE);
    assertThat(service.nextDemandNumber("dept-it", prefix -> 8)).isEqualTo("IT" + date + "008");
    when(mapper.find("one", "demand")).thenReturn(new NumberingRule("demand", "CUSTOM-", "none", 6, false));
    assertThat(service.nextDemandNumber("dept-it", prefix -> 9)).isEqualTo("IT" + date + "009");
    assertThat(service.nextTenderNumber(prefix -> 2)).isEqualTo("ZB" + date + "002");
  }

  @Test void previewUsesDraftWithoutConsumingOrReservingNumbers() {
    TenantContext.set("one", null, "admin");
    var rule = new NumberingRule("demand", "REQ-", "none", 4, true);
    assertThat(service.preview("demand", rule).example()).isEqualTo("REQ-0001");
    verifyNoInteractions(mapper, audit);
    verify(permissions).require("buyer:role:manage");
  }

  @Test void allocationSkipsPreviouslyReservedCodesAndNeverTruncatesOverflow() {
    TenantContext.set("one", null, "admin");
    when(mapper.find("one", "demand")).thenReturn(new NumberingRule("demand", "REQ-", "none", 3, true));
    when(mapper.reserve("one", "demand", "REQ-999")).thenReturn(0);
    when(mapper.reserve("one", "demand", "REQ-1000")).thenReturn(1);
    AtomicLong sequence = new AtomicLong(998);
    assertThat(service.nextDemandNumber("dept-it", p -> sequence.incrementAndGet())).isEqualTo("REQ-1000");
  }

  @Test void saveIsTenantScopedAuditedAndDoesNotResetAllocators() {
    TenantContext.set("one", null, "admin");
    var rule = new NumberingRule("tender", "BID-", "yyyyMM", 5, true);
    assertThat(service.save("tender", rule)).isEqualTo(rule);
    verify(mapper).save("one", rule);
    verify(mapper).find("one", "tender");
    verify(audit).recordCurrentTenantAction(eq("numbering_rule.updated"), eq("numbering_rule"), eq("tender"), contains("BID-"));
    verifyNoMoreInteractions(mapper);
  }

  @Test void rejectsUnsupportedTypesUnsafePrefixesAndUnboundedFormats() {
    TenantContext.set("one", null, "admin");
    for (var rule : java.util.List.of(
        new NumberingRule("contract", "X", "none", 3, true),
        new NumberingRule("demand", "../X", "none", 3, true),
        new NumberingRule("demand", "X", "yyyyMMddHHmmss", 3, true),
        new NumberingRule("demand", "X", "none", 10, true))) {
      assertThatThrownBy(() -> service.save(rule.businessType(), rule)).isInstanceOf(IllegalArgumentException.class);
    }
    verifyNoInteractions(mapper, audit);
  }

  @Test void allConfigurationOperationsRequireAdministratorPermission() {
    TenantContext.set("one", null, "user");
    doThrow(new PermissionDeniedException("denied")).when(permissions).require("buyer:role:manage");
    var rule = new NumberingRule("demand", "X", "none", 3, true);
    assertThatThrownBy(service::list).isInstanceOf(PermissionDeniedException.class);
    assertThatThrownBy(() -> service.save("demand", rule)).isInstanceOf(PermissionDeniedException.class);
    assertThatThrownBy(() -> service.preview("demand", rule)).isInstanceOf(PermissionDeniedException.class);
    verifyNoInteractions(mapper, audit);
  }
}
