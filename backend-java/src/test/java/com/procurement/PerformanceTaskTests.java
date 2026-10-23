package com.procurement;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.procurement.common.tenant.TenantContext;
import com.procurement.common.tenant.PermissionDeniedException;
import com.procurement.identity.application.PermissionService;
import com.procurement.supplier.application.PerformanceTaskApplicationService;
import com.procurement.supplier.application.SupplierEvaluationApplicationService;
import com.procurement.supplier.api.PerformanceTaskRequests.*;
import com.procurement.supplier.domain.PerformanceTask;
import com.procurement.supplier.infrastructure.PerformanceTaskMapper;
import com.procurement.supplier.infrastructure.BuyerSupplierRelationMapper;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class PerformanceTaskTests {
  final PerformanceTaskMapper mapper = mock(PerformanceTaskMapper.class);
  final SupplierEvaluationApplicationService evaluations = mock(SupplierEvaluationApplicationService.class);
  final PerformanceTaskApplicationService service = new PerformanceTaskApplicationService(
      mapper, mock(BuyerSupplierRelationMapper.class), evaluations, mock(PermissionService.class),
      mock(com.procurement.audit.application.AuditLogApplicationService.class));
  @AfterEach void clear() { TenantContext.clear(); }

  @Test void periodIsNormalizedAndStrict() {
    assertThat(PerformanceTaskApplicationService.normalizePeriod(" 2026-q2 ")).isEqualTo("2026-Q2");
    for (String period : new String[]{"", "2026-Q5", "2026-00", "2026-13", "26", "0000", "2026-1"}) {
      assertThatThrownBy(() -> PerformanceTaskApplicationService.normalizePeriod(period))
          .isInstanceOf(IllegalArgumentException.class);
    }
  }

  @Test void legacySqlTrimCharactersExactlyMatchJavaStrip() {
    String expected = java.util.stream.IntStream.rangeClosed(0, Character.MAX_CODE_POINT)
        .filter(Character::isWhitespace)
        .collect(StringBuilder::new, StringBuilder::appendCodePoint, StringBuilder::append).toString();
    assertThat(com.procurement.supplier.domain.SupplierEvaluationPeriod.STRIP_CHARACTERS).isEqualTo(expected);
  }

  @Test void dueDateCannotBePastOrMissing() {
    assertThatThrownBy(() -> PerformanceTaskApplicationService.validateDueDate(LocalDate.now().minusDays(1)))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> PerformanceTaskApplicationService.validateDueDate(null))
        .isInstanceOf(IllegalArgumentException.class);
    PerformanceTaskApplicationService.validateDueDate(LocalDate.now(ZoneId.of("Asia/Shanghai")));
  }

  @Test void anotherRealUserCannotEvaluateAssignment() {
    TenantContext.set("a", null, "other");
    when(mapper.buyerActor("a", "other")).thenReturn("Other");
    when(mapper.lockBuyer("a", "r", "t")).thenReturn(task("assigned"));
    assertThatThrownBy(() -> service.evaluate("r", "t", new Evaluate(
        BigDecimal.TEN, BigDecimal.TEN, BigDecimal.TEN, BigDecimal.TEN, "test")))
        .isInstanceOf(PermissionDeniedException.class);
    verifyNoInteractions(evaluations);
  }

  @Test void reviewRequiresSubmittedStateAndComment() {
    TenantContext.set("a", null, "u");
    when(mapper.buyerActor("a", "u")).thenReturn("User");
    when(mapper.lockBuyer("a", "r", "t")).thenReturn(task("evaluated"));
    assertThatThrownBy(() -> service.review("r", "t", new Review(true, "Accepted", 0L)))
        .isInstanceOf(IllegalStateException.class);
    when(mapper.lockBuyer("a", "r", "t")).thenReturn(task("remediation_submitted"));
    assertThatThrownBy(() -> service.review("r", "t", new Review(false, " ", 0L)))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test void evaluationRequiresNonblankComment() {
    TenantContext.set("a", null, "u");
    when(mapper.buyerActor("a", "u")).thenReturn("User");
    when(mapper.lockBuyer("a", "r", "t")).thenReturn(task("assigned"));
    assertThatThrownBy(() -> service.evaluate("r", "t", new Evaluate(
        BigDecimal.TEN, BigDecimal.TEN, BigDecimal.TEN, BigDecimal.TEN, " ")))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test void supplierCannotRespondToUnownedTask() {
    TenantContext.set(null, "other-supplier", "su");
    when(mapper.supplierActor("other-supplier", "su")).thenReturn("Supplier User");
    assertThatThrownBy(() -> service.respond("t", new Response("fixed", 0L)))
        .isInstanceOf(IllegalArgumentException.class);
    verify(mapper).lockSupplier("other-supplier", "t");
  }

  PerformanceTask task(String status) {
    return new PerformanceTask("t", "a", "s", "r", "Supplier", "Buyer", "2026", "u", "User",
        LocalDate.now(), status, null, null, null, null, 0L);
  }

  @Test void reviewRejectsMissingNegativeAndStaleVersion() {
    TenantContext.set("a", null, "u");
    when(mapper.buyerActor("a", "u")).thenReturn("User");
    when(mapper.lockBuyer("a", "r", "t")).thenReturn(task("remediation_submitted"));
    assertThatThrownBy(() -> service.review("r", "t", new Review(true,"Accept",null)))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> service.review("r", "t", new Review(true,"Accept",-1L)))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> service.review("r", "t", new Review(true,"Accept",1L)))
        .isInstanceOf(IllegalStateException.class);
  }
}
