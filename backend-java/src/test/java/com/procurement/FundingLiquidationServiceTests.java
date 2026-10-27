package com.procurement;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.buyer.api.FundingContracts.*;
import com.procurement.buyer.api.ProjectContracts.Project;
import com.procurement.buyer.application.*;
import com.procurement.buyer.infrastructure.FundingMapper;
import com.procurement.identity.application.*;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.*;

class FundingLiquidationServiceTests {
  FundingMapper funds;
  FundingLiquidationService service;
  Project project;
  PermissionService permissions;
  DataScopeService scopes;

  BigDecimal n(String s) {
    return new BigDecimal(s);
  }

  @BeforeEach
  void setup() {
    funds = mock(FundingMapper.class);
    var carry = mock(FundingCarryoverService.class);
    permissions = mock(PermissionService.class);
    scopes = mock(DataScopeService.class);
    service =
        new FundingLiquidationService(
            funds,
            carry,
            permissions,
            scopes,
            mock(AuditLogApplicationService.class),
            new ObjectMapper());
    project =
        new ObjectMapper()
            .convertValue(
                Map.of("id", "p", "tenantId", "t", "departmentId", "d", "plannedAmount", n("1200")),
                Project.class);
    when(carry.period(project)).thenReturn("2026");
    when(funds.balances("t", "p"))
        .thenReturn(
            List.of(
                new Balance("a", "A", "专项A", n("700"), n("500"), n("200")),
                new Balance("b", "B", "专项B", n("500"), n("400"), n("100"))));
    when(funds.totalPaid("t", "p")).thenReturn(n("900"));
    when(funds.priorPaid("t", "p")).thenReturn(BigDecimal.ZERO);
    when(funds.plan("t", "p")).thenReturn("plan");
    var plan =
        new ObjectMapper().convertValue(Map.of("id", "plan", "status", "approved"), Change.class);
    when(funds.change("t", "plan")).thenReturn(plan);
    for (String id : List.of("a", "b")) {
      var f = source(id, "d", "approved");
      when(funds.fund("t", id)).thenReturn(f);
    }
  }

  Fund source(String id, String department, String status) {
    return new ObjectMapper()
        .convertValue(
            Map.of(
                "id",
                id,
                "code",
                id,
                "name",
                id,
                "departmentId",
                department,
                "period",
                "2026",
                "status",
                status,
                "createdBy",
                "owner"),
            Fund.class);
  }

  @Test
  void releaseIsExactlyUnpaidResponsibilityAndRequiresBudgetAccess() {
    var b = service.prepare(project, n("900"));
    assertThat(b.releasedAmount()).isEqualByComparingTo("300");
    assertThat(b.lines())
        .extracting(FundingLiquidationService.Line::releasedAmount)
        .containsExactly(n("200"), n("100"));
    verify(permissions).require("buyer:budget:manage");
    verify(scopes, times(2)).requireRecordAccess("d", "owner");
    verify(funds, never()).publish(any(), any(), any());
  }

  @Test
  void cannotGuessUnknownOrMismatchedCash() {
    assertThatThrownBy(() -> service.inspect(project, null)).hasMessageContaining("不能推算");
    assertThatThrownBy(() -> service.inspect(project, n("899"))).hasMessageContaining("不能推算");
  }

  @Test
  void pendingAllocationOrCorrectionBlocksTermination() {
    when(funds.pending("t", null, "p")).thenReturn(1);
    assertThatThrownBy(() -> service.inspect(project, n("900"))).hasMessageContaining("审批中");
    when(funds.pending("t", null, "p")).thenReturn(0);
    when(funds.pendingCorrection("t", "p")).thenReturn(1);
    assertThatThrownBy(() -> service.inspect(project, n("900"))).hasMessageContaining("审批中");
  }

  @Test
  void priorYearsCashIsRetainedAndNotReleased() {
    when(funds.priorPaid("t", "p")).thenReturn(n("200"));
    when(funds.balances("t", "p"))
        .thenReturn(
            List.of(
                new Balance("a", "A", "专项A", n("600"), n("400"), n("200")),
                new Balance("b", "B", "专项B", n("400"), n("300"), n("100"))));
    var b = service.inspect(project, n("900"));
    assertThat(b.historicalPaid()).isEqualByComparingTo("200");
    assertThat(b.releasedAmount()).isEqualByComparingTo("300");
  }

  @Test
  void unapprovedOrForeignSourceCannotBeReleased() {
    when(funds.fund("t", "a")).thenReturn(source("a", "other", "approved"));
    assertThatThrownBy(() -> service.inspect(project, n("900"))).hasMessageContaining("无法核验");
    when(funds.fund("t", "a")).thenReturn(source("a", "d", "draft"));
    assertThatThrownBy(() -> service.inspect(project, n("900"))).hasMessageContaining("无法核验");
  }
}
